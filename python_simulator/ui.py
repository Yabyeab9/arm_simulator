"""
ui.py - Live Telemetry HUD and User Interface Overlay

Renders an on-screen engineering HUD displaying:
- Robot name and connection endpoint
- Real-time UDP telemetry (server state, packet count, malformed count, client activity)
- Current joint angles (J1-J4) and calculated Cartesian tip coordinates (X, Y, Z)
- Interactive keyboard control guidance
"""

from typing import Any, Dict, List, Optional
from robot import RobotArm
from udp_server import UDPServer


class TelemetryHUD:
    """
    Manages the in-window telemetry text overlay using Ursina UI components.
    Gracefully downgrades if Ursina is not available.
    """

    def __init__(self, robot: RobotArm, udp_server: UDPServer):
        self.robot = robot
        self.udp_server = udp_server
        self.has_visuals = False
        self.panel_entity = None
        self.text_entity = None
        
        self._init_ui()

    def _init_ui(self) -> None:
        """Sets up Ursina UI entities with a semi-transparent HUD panel."""
        try:
            from ursina import Entity, Text, camera, color, window
            self.has_visuals = True
        except ImportError:
            self.has_visuals = False
            return

        # Semi-transparent dark background card positioned on the top-left
        self.panel_entity = Entity(
            parent=camera.ui,
            model="quad",
            color=color.rgba(20, 28, 38, 220),  # Dark navy/slate
            scale=(0.42, 0.72),
            position=(-0.65, 0.12),
            z=1
        )

        # Telemetry text overlay
        self.text_entity = Text(
            parent=camera.ui,
            text="Initializing Telemetry...",
            position=(-0.84, 0.45),
            scale=0.92,
            color=color.hex("#ecf0f1"),
            z=0
        )

        # Controls reference panel on the bottom-right
        self.controls_panel = Entity(
            parent=camera.ui,
            model="quad",
            color=color.rgba(20, 28, 38, 200),
            scale=(0.38, 0.32),
            position=(0.68, -0.32),
            z=1
        )
        self.controls_text = Text(
            parent=camera.ui,
            text=(
                "--- KEYBOARD CONTROLS ---\n"
                "[Q / A] : Joint 1 (Base Yaw ±5°)\n"
                "[W / S] : Joint 2 (Shoulder ±5°)\n"
                "[E / D] : Joint 3 (Elbow ±5°)\n"
                "[R / F] : Joint 4 (Wrist ±5°)\n"
                "[ H ]   : HOME / RESET\n"
                "[ESC]   : Safe Exit"
            ),
            position=(0.50, -0.20),
            scale=0.85,
            color=color.hex("#f39c12"),
            z=0
        )

    def update(self) -> None:
        """Updates the text content of the telemetry display every frame."""
        if not self.has_visuals or not self.text_entity:
            return

        telemetry = self.udp_server.get_telemetry_snapshot()
        angles = self.robot.get_angles()
        tip_x, tip_y, tip_z = self.robot.calculate_forward_kinematics()

        # Activity color badge representation
        activity = telemetry["client_activity"]
        status = telemetry["status"]

        # Color-coded string formatting
        hud_lines = [
            f"=== {self.robot.name.upper()} TELEMETRY ===",
            f"Endpoint    : {telemetry['host_port']}",
            f"UDP State   : {status}",
            f"Activity    : {activity}",
            f"Packets Recv: {telemetry['packets_received']}",
            f"Invalid Pkts: {telemetry['invalid_packets']}",
            f"Last Packet : {telemetry['last_valid_packet']}",
            f"Packet Age  : {telemetry['last_packet_age']}",
            "",
            "--- JOINT ANGLES (DEG) ---",
            f"J1 (Base)   : {angles[0]:>6.1f}°  [{self.robot.joints['J1'].min_limit:.0f}° to {self.robot.joints['J1'].max_limit:.0f}°]",
            f"J2 (Shoulder: {angles[1]:>6.1f}°  [{self.robot.joints['J2'].min_limit:.0f}° to {self.robot.joints['J2'].max_limit:.0f}°]",
            f"J3 (Elbow)  : {angles[2]:>6.1f}°  [{self.robot.joints['J3'].min_limit:.0f}° to {self.robot.joints['J3'].max_limit:.0f}°]",
            f"J4 (Wrist)  : {angles[3]:>6.1f}°  [{self.robot.joints['J4'].min_limit:.0f}° to {self.robot.joints['J4'].max_limit:.0f}°]",
            "",
            "--- 3D END-EFFECTOR TIP ---",
            f"Position (X, Y, Z): ({tip_x:+.2f}, {tip_y:+.2f}, {tip_z:+.2f})"
        ]

        if telemetry["last_error"]:
            hud_lines.append(f"Notice      : {telemetry['last_error'][:28]}")

        self.text_entity.text = "\n".join(hud_lines)
