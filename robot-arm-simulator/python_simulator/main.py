"""
main.py - 3D Robotic Arm Simulator Entry Point

Orchestrates the complete system:
1. Loads configuration from config.json (or fallback)
2. Initializes the non-blocking UDP telemetry server on localhost:5005
3. Initializes the Ursina 3D application, ground grid, and lighting
4. Spawns the 4-DOF hierarchical RobotArm
5. Sets up the live TelemetryHUD overlay
6. Runs the simulation loop (processes UDP commands + keyboard controls)
7. Handles clean, safe shutdown
"""

import os
import sys

# Ensure python_simulator directory is in sys.path for relative module loading
current_dir = os.path.dirname(os.path.abspath(__file__))
if current_dir not in sys.path:
    sys.path.insert(0, current_dir)

from config_loader import ConfigLoader
from robot import RobotArm
from udp_server import UDPServer
from ui import TelemetryHUD


def run_simulator():
    """Main simulation launcher."""
    print("=" * 65)
    print(" 3D Robotic Arm Simulator (4-DOF) - Ursina & UDP Control")
    print("=" * 65)

    # Step 1: Load configuration
    config_path = os.path.join(current_dir, "config.json")
    config = ConfigLoader(config_path)
    print(f"[*] Configuration loaded for robot: '{config.robot_name}'")
    print(f"[*] Target UDP Endpoint: {config.host}:{config.port}")

    # Extract joint limits for UDP packet clamping
    limits = [
        config.get_joint_limits("J1"),
        config.get_joint_limits("J2"),
        config.get_joint_limits("J3"),
        config.get_joint_limits("J4"),
    ]

    # Step 2: Start background UDP server
    udp_server = UDPServer(host=config.host, port=config.port, joint_limits=limits)
    server_started = udp_server.start()
    if not server_started:
        print("[!] Warning: UDP server could not bind to port. Check telemetry overlay for details.")

    # Step 3: Initialize Ursina Engine
    try:
        from ursina import (
            DirectionalLight,
            EditorCamera,
            Entity,
            Ursina,
            application,
            color,
            destroy,
            held_keys,
            window
        )
    except ImportError as e:
        print(f"[ERROR] Ursina engine is not installed or available: {e}")
        print("Please install requirements: pip install ursina")
        udp_server.stop()
        sys.exit(1)

    app = Ursina(title=f"{config.robot_name} - 3D Robotic Arm Simulator", borderless=False)
    window.color = color.hex("#111827")  # Deep modern dark background
    window.fps_counter.enabled = True

    # Step 4: Environment, Camera, and Lighting setup
    # Ground plane with coordinate grid
    ground = Entity(
        model="plane",
        scale=(24, 1, 24),
        color=color.hex("#1f2937"),
        texture="white_cube"
    )

    # Clean directional light and ambient light
    DirectionalLight(rotation=(45, -45, 45), shadows=True)

    # Interactive 3D orbit camera
    # Left click + drag to orbit, right click + drag to pan, scroll to zoom
    camera_controller = EditorCamera()
    camera_controller.position = (0, 3.0, -7.0)
    camera_controller.rotation = (22, 0, 0)

    # Step 5: Instantiate RobotArm and Telemetry HUD
    robot = RobotArm(config=config, create_visuals=True)
    hud = TelemetryHUD(robot=robot, udp_server=udp_server)

    # Step 6: Define frame update function
    def update():
        """
        Executed on every frame (~60 FPS) by Ursina.
        Pulls latest UDP commands and reads keyboard inputs.
        """
        # 1. Check for incoming UDP commands from background thread
        new_angles = udp_server.fetch_latest_angles()
        if new_angles is not None:
            robot.set_angles(new_angles[0], new_angles[1], new_angles[2], new_angles[3])

        # 2. Manual Keyboard Controls
        # Continuous press adjustments: small increments per frame
        step = 1.0  # degrees per frame held
        if held_keys["q"]:
            robot.adjust_joint("J1", +step)
        if held_keys["a"]:
            robot.adjust_joint("J1", -step)
        if held_keys["w"]:
            robot.adjust_joint("J2", +step)
        if held_keys["s"]:
            robot.adjust_joint("J2", -step)
        if held_keys["e"]:
            robot.adjust_joint("J3", +step)
        if held_keys["d"]:
            robot.adjust_joint("J3", -step)
        if held_keys["r"]:
            robot.adjust_joint("J4", +step)
        if held_keys["f"]:
            robot.adjust_joint("J4", -step)

        # 3. Update Telemetry HUD text
        hud.update()

    # Step 7: Define discrete input events
    def input(key):
        """Processes single-press events."""
        if key == "h":
            # HOME / RESET command
            print("[SIM] Returning to home position...")
            robot.reset_to_home()
        elif key == "escape":
            # Safe application shutdown
            print("[SIM] Safe exit triggered via ESC key.")
            cleanup_and_exit()

    def cleanup_and_exit():
        """Ensures socket and background thread are stopped before exit."""
        print("[*] Shutting down UDP server...")
        udp_server.stop()
        application.quit()

    # Assign event handlers to Ursina's global update and input hooks
    import __main__
    __main__.update = update
    __main__.input = input

    print("[*] Simulation running. Press ESC to quit.")
    
    try:
        app.run()
    finally:
        # Guarantee cleanup even on unexpected window close or Ctrl+C
        udp_server.stop()


if __name__ == "__main__":
    run_simulator()
