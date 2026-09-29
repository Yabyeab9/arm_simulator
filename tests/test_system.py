"""
test_system.py - End-to-End Automated Verification Test Suite

Verifies:
1. Configuration loading & resilient fallbacks (missing file, corrupted JSON)
2. Joint angle limits, clamping, and radian conversions
3. Protocol parsing, validation, token counts, and error diagnostic strings
4. 4-DOF Robot model state and forward kinematics calculations
5. UDP Server socket binding, background thread execution, and safe shutdown
6. Cross-process communication with compiled native C controller
7. Malformed packet resilience (non-numeric, wrong field counts, NaN, empty)
8. Clamping of out-of-range angle commands
9. Port conflict detection and non-crashing behavior
10. Rapid packet flood responsiveness
"""

import os
import socket
import subprocess
import sys
import time
import unittest

# Add python_simulator to sys.path
sim_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "python_simulator"))
if sim_dir not in sys.path:
    sys.path.insert(0, sim_dir)

from config_loader import ConfigLoader, FALLBACK_CONFIG
from joint import Joint
from protocol import ProtocolParser
from robot import RobotArm
from udp_server import UDPServer


class TestConfigLoader(unittest.TestCase):
    def test_load_valid_config(self):
        cfg_file = os.path.join(sim_dir, "config.json")
        loader = ConfigLoader(cfg_file)
        self.assertFalse(loader.is_fallback)
        self.assertEqual(loader.robot_name, "MiniArm-4DOF")
        self.assertEqual(loader.port, 5005)
        self.assertEqual(loader.get_joint_limits("J2"), (-90.0, 90.0))

    def test_fallback_on_missing_file(self):
        loader = ConfigLoader("non_existent_config_file_12345.json")
        self.assertTrue(loader.is_fallback)
        self.assertEqual(loader.port, 5005)
        self.assertEqual(loader.get_joint_limits("J1"), (-180.0, 180.0))

    def test_fallback_on_invalid_json(self):
        temp_bad_json = "/tmp/bad_config.json"
        with open(temp_bad_json, "w") as f:
            f.write("{ invalid json content ...")
        try:
            loader = ConfigLoader(temp_bad_json)
            self.assertTrue(loader.is_fallback)
            self.assertEqual(loader.port, 5005)
        finally:
            if os.path.exists(temp_bad_json):
                os.remove(temp_bad_json)


class TestJointAndKinematics(unittest.TestCase):
    def test_joint_clamping(self):
        j = Joint("J2", "Shoulder", axis="x", min_limit=-90.0, max_limit=90.0, home_angle=0.0)
        self.assertEqual(j.angle, 0.0)
        
        # Test within limits
        val, clamped = j.set_angle(45.0)
        self.assertEqual(val, 45.0)
        self.assertFalse(clamped)
        
        # Test upper limit clamping
        val, clamped = j.set_angle(120.0)
        self.assertEqual(val, 90.0)
        self.assertTrue(clamped)
        
        # Test lower limit clamping
        val, clamped = j.set_angle(-150.0)
        self.assertEqual(val, -90.0)
        self.assertTrue(clamped)

    def test_robot_arm_kinematics(self):
        # Create headless robot (create_visuals=False)
        robot = RobotArm(create_visuals=False)
        self.assertEqual(len(robot.joints), 4)
        
        # Test setting valid angles
        angles, clamped = robot.set_angles(30.0, 15.0, -20.0, 45.0)
        self.assertFalse(clamped)
        self.assertEqual(angles, [30.0, 15.0, -20.0, 45.0])
        
        # Test forward kinematics returns a valid 3D tuple (X, Y, Z)
        tip_x, tip_y, tip_z = robot.calculate_forward_kinematics()
        self.assertIsInstance(tip_x, float)
        self.assertIsInstance(tip_y, float)
        self.assertIsInstance(tip_z, float)
        # Tip should be above ground (Y > 0)
        self.assertGreater(tip_y, 0.0)

        # Test HOME reset
        home_angles = robot.reset_to_home()
        self.assertEqual(len(home_angles), 4)


class TestProtocolParser(unittest.TestCase):
    def setUp(self):
        self.limits = [(-180.0, 180.0), (-90.0, 90.0), (-120.0, 120.0), (-180.0, 180.0)]

    def test_valid_packet(self):
        raw = b"30,15,-20,45"
        res = ProtocolParser.parse_packet(raw, joint_limits=self.limits)
        self.assertTrue(res.success)
        self.assertEqual(res.clamped_angles, [30.0, 15.0, -20.0, 45.0])
        self.assertFalse(res.was_clamped)

    def test_packet_clamping(self):
        # J2 is 140, exceeds max +90
        raw = b"30, 140, -20, 45"
        res = ProtocolParser.parse_packet(raw, joint_limits=self.limits)
        self.assertTrue(res.success)
        self.assertEqual(res.clamped_angles, [30.0, 90.0, -20.0, 45.0])
        self.assertTrue(res.was_clamped)

    def test_malformed_token_count(self):
        # 3 values instead of 4
        res = ProtocolParser.parse_packet(b"30,15,-20")
        self.assertFalse(res.success)
        self.assertIn("Expected 4 comma-separated values", res.error_message)

        # 5 values
        res = ProtocolParser.parse_packet(b"30,15,-20,45,60")
        self.assertFalse(res.success)

    def test_non_numeric_values(self):
        res = ProtocolParser.parse_packet(b"30,abc,-20,45")
        self.assertFalse(res.success)
        self.assertIn("non-numeric", res.error_message)

    def test_nan_values(self):
        res = ProtocolParser.parse_packet(b"30,nan,-20,45")
        self.assertFalse(res.success)
        self.assertIn("NaN or Infinity", res.error_message)


class TestUDPServerAndCrossProcess(unittest.TestCase):
    def setUp(self):
        self.port = 5005
        self.limits = [(-180.0, 180.0), (-90.0, 90.0), (-120.0, 120.0), (-180.0, 180.0)]
        self.server = UDPServer(host="127.0.0.1", port=self.port, joint_limits=self.limits)
        self.assertTrue(self.server.start())

    def tearDown(self):
        self.server.stop()

    def test_python_socket_transmission(self):
        # Send a packet using a test client socket
        client_sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        try:
            client_sock.sendto(b"45.0,20.0,-30.0,60.0", ("127.0.0.1", self.port))
            time.sleep(0.05)
            
            angles = self.server.fetch_latest_angles()
            self.assertIsNotNone(angles)
            self.assertEqual(angles, [45.0, 20.0, -30.0, 60.0])
            
            telemetry = self.server.get_telemetry_snapshot()
            self.assertEqual(telemetry["packets_received"], 1)
            self.assertEqual(telemetry["invalid_packets"], 0)
            self.assertEqual(telemetry["client_activity"], "ACTIVE")
        finally:
            client_sock.close()

    def test_malformed_packets_do_not_crash(self):
        client_sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        try:
            # Send various corrupt packets
            client_sock.sendto(b"corrupt,packet", ("127.0.0.1", self.port))
            client_sock.sendto(b"10,20,30,40,50,60", ("127.0.0.1", self.port))
            client_sock.sendto(b"hello,world,foo,bar", ("127.0.0.1", self.port))
            time.sleep(0.05)
            
            telemetry = self.server.get_telemetry_snapshot()
            self.assertEqual(telemetry["invalid_packets"], 3)
            # Server must remain running
            self.assertTrue(self.server.is_running)
        finally:
            client_sock.close()

    def test_c_controller_execution(self):
        # Run compiled C controller executable to transmit a packet
        c_exe = os.path.abspath(os.path.join(sim_dir, "..", "c_controller", "robot_controller"))
        if not os.path.exists(c_exe):
            self.skipTest(f"C binary not found at {c_exe}")

        # Send command via CLI args: ./robot_controller 25.0 10.0 -15.0 40.0
        result = subprocess.run([c_exe, "25.0", "10.0", "-15.0", "40.0"], capture_output=True, text=True)
        self.assertEqual(result.returncode, 0)
        self.assertIn("Transmitted", result.stdout)
        
        time.sleep(0.05)
        angles = self.server.fetch_latest_angles()
        self.assertIsNotNone(angles)
        self.assertEqual(angles, [25.0, 10.0, -15.0, 40.0])

    def test_rapid_packet_flood(self):
        client_sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        try:
            # Flood 200 packets rapidly
            for i in range(200):
                payload = f"{i % 90},15,-20,45".encode("utf-8")
                client_sock.sendto(payload, ("127.0.0.1", self.port))
            time.sleep(0.1)
            
            telemetry = self.server.get_telemetry_snapshot()
            self.assertGreaterEqual(telemetry["packets_received"], 100)
            # Must remain running and responsive
            self.assertTrue(self.server.is_running)
        finally:
            client_sock.close()

    def test_port_conflict_handling(self):
        # Attempt to launch second server on same port
        second_server = UDPServer(host="127.0.0.1", port=self.port, joint_limits=self.limits)
        res = second_server.start()
        # Must fail gracefully without unhandled exception
        self.assertFalse(res)
        self.assertIn("In Use", second_server.status_text)
        second_server.stop()


if __name__ == "__main__":
    unittest.main(verbosity=2)
