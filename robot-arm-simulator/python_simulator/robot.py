"""
robot.py - 4-DOF Robotic Arm Model and Kinematic Hierarchy

Assembles a 4-joint articulated robotic arm using a parent-child scene hierarchy:
    Base (Y-axis Yaw)
      -> Shoulder (X-axis Pitch)
          -> Elbow (X-axis Pitch)
              -> Wrist (X-axis Pitch)
                  -> End Effector (Gripper)

When a parent rotates, all child links rotate and translate with it automatically.
Supports both Ursina 3D visual entities and headless mathematical calculation.
"""

import math
from typing import Any, Dict, List, Optional, Tuple

from config_loader import ConfigLoader
from joint import Joint


class RobotArm:
    """
    Manages the complete 4-DOF robotic arm state, joints, and visual 3D entities.
    
    Attributes:
        config (ConfigLoader): Loaded configuration object.
        name (str): Robot model name.
        joints (Dict[str, Joint]): Dictionary of joints indexed by 'J1', 'J2', 'J3', 'J4'.
        link_lengths (Dict[str, float]): Lengths of each arm segment.
    """

    def __init__(self, config: Optional[ConfigLoader] = None, create_visuals: bool = True):
        self.config = config or ConfigLoader()
        self.name = self.config.robot_name
        self.link_lengths = self.config.link_lengths
        
        # Instantiate the 4 revolute joints based on configuration
        self.joints: Dict[str, Joint] = {}
        for j_key in ["J1", "J2", "J3", "J4"]:
            j_cfg = self.config.joint_configs.get(j_key, {})
            self.joints[j_key] = Joint(
                joint_id=j_key,
                name=j_cfg.get("name", f"Joint {j_key}"),
                axis=j_cfg.get("axis", "x" if j_key != "J1" else "y"),
                min_limit=float(j_cfg.get("min", -180.0)),
                max_limit=float(j_cfg.get("max", 180.0)),
                home_angle=float(j_cfg.get("home", 0.0)),
                step=float(j_cfg.get("step", 5.0))
            )

        # 3D visualization entities (populated if Ursina is active)
        self.has_visuals = False
        self.entities: Dict[str, Any] = {}
        
        if create_visuals:
            self._build_3d_hierarchy()

    def _build_3d_hierarchy(self) -> None:
        """
        Constructs the 3D entity parent-child hierarchy in Ursina.
        
        Parent-Child Concept:
        - If Entity B is parented to Entity A, then rotating or translating A
          inherently updates B's world transformation matrix.
        - The shoulder sits on the base. When J1 (base yaw) turns, shoulder, elbow,
          wrist, and gripper all orbit with the base.
        - When J2 (shoulder) pitches, elbow and wrist rotate together around the shoulder pivot.
        """
        try:
            # Import Ursina classes dynamically so non-GUI headless tests don't fail
            from ursina import Entity, color, Vec3
        except ImportError:
            # Ursina not available in current runtime; robot operates in headless mode
            self.has_visuals = False
            return

        self.has_visuals = True

        # Segment lengths from configuration
        l_base = self.link_lengths.get("base", 0.8)
        l_upper = self.link_lengths.get("upper_arm", 2.2)
        l_fore = self.link_lengths.get("forearm", 1.6)
        l_wrist = self.link_lengths.get("wrist", 0.7)

        # Color palette: Industrial robotics aesthetic (dark slate base, brushed steel links, safety orange pivots)
        c_ground_ring = color.hex("#2c3e50")
        c_base = color.hex("#34495e")
        c_pivot = color.hex("#e67e22")        # Distinct accent for joint motors
        c_link = color.hex("#bdc3c7")         # Arm structure
        c_wrist = color.hex("#7f8c8d")
        c_gripper = color.hex("#d35400")

        # 1. ROOT / PEDESTAL (Fixed to world origin [0, 0, 0])
        root_platform = Entity(
            name="robot_root",
            model="cylinder",
            color=c_ground_ring,
            scale=(1.8, 0.15, 1.8),
            position=(0, 0.075, 0)
        )
        self.entities["root"] = root_platform

        # 2. BASE PIVOT (Joint 1 - Yaw rotation around Y axis)
        # Positioned at world origin
        base_pivot = Entity(name="joint1_base_pivot", position=(0, 0.15, 0))
        # Visual cylinder for base column
        base_mesh = Entity(
            parent=base_pivot,
            model="cylinder",
            color=c_base,
            scale=(1.0, l_base, 1.0),
            position=(0, l_base / 2.0, 0)
        )
        self.entities["j1_pivot"] = base_pivot
        self.entities["base_mesh"] = base_mesh

        # 3. SHOULDER PIVOT (Joint 2 - Pitch rotation around X axis)
        # Located at top of base column
        shoulder_pivot = Entity(
            name="joint2_shoulder_pivot",
            parent=base_pivot,
            position=(0, l_base, 0)
        )
        # Decorative joint hub sphere
        Entity(parent=shoulder_pivot, model="sphere", color=c_pivot, scale=0.55)
        # Upper arm link extending along local +Y (or forward)
        upper_arm_mesh = Entity(
            parent=shoulder_pivot,
            model="cube",
            color=c_link,
            scale=(0.35, l_upper, 0.35),
            position=(0, l_upper / 2.0, 0)
        )
        self.entities["j2_pivot"] = shoulder_pivot
        self.entities["upper_arm"] = upper_arm_mesh

        # 4. ELBOW PIVOT (Joint 3 - Pitch rotation around X axis)
        # Located at tip of upper arm
        elbow_pivot = Entity(
            name="joint3_elbow_pivot",
            parent=shoulder_pivot,
            position=(0, l_upper, 0)
        )
        Entity(parent=elbow_pivot, model="sphere", color=c_pivot, scale=0.48)
        forearm_mesh = Entity(
            parent=elbow_pivot,
            model="cube",
            color=c_link,
            scale=(0.28, l_fore, 0.28),
            position=(0, l_fore / 2.0, 0)
        )
        self.entities["j3_pivot"] = elbow_pivot
        self.entities["forearm"] = forearm_mesh

        # 5. WRIST PIVOT (Joint 4 - Pitch rotation around X axis)
        # Located at tip of forearm
        wrist_pivot = Entity(
            name="joint4_wrist_pivot",
            parent=elbow_pivot,
            position=(0, l_fore, 0)
        )
        Entity(parent=wrist_pivot, model="sphere", color=c_pivot, scale=0.38)
        wrist_mesh = Entity(
            parent=wrist_pivot,
            model="cylinder",
            color=c_wrist,
            scale=(0.22, l_wrist, 0.22),
            position=(0, l_wrist / 2.0, 0)
        )
        self.entities["j4_pivot"] = wrist_pivot
        self.entities["wrist"] = wrist_mesh

        # 6. END EFFECTOR (Gripper at the end of wrist link)
        end_effector = Entity(
            name="end_effector",
            parent=wrist_pivot,
            position=(0, l_wrist, 0)
        )
        # Gripper palm
        Entity(parent=end_effector, model="cube", color=c_base, scale=(0.35, 0.08, 0.2), position=(0, 0.04, 0))
        # Left finger
        Entity(parent=end_effector, model="cube", color=c_gripper, scale=(0.06, 0.25, 0.08), position=(-0.12, 0.17, 0))
        # Right finger
        Entity(parent=end_effector, model="cube", color=c_gripper, scale=(0.06, 0.25, 0.08), position=(0.12, 0.17, 0))
        self.entities["end_effector"] = end_effector

        # Apply initial rotation from joints
        self.update_visuals()

    def update_visuals(self) -> None:
        """
        Synchronizes Ursina entity rotations with current joint angles.
        Rotates each joint's pivot entity around its configured axis.
        """
        if not self.has_visuals:
            return

        # J1: Base yaw around Y axis
        if "j1_pivot" in self.entities:
            self.entities["j1_pivot"].rotation_y = self.joints["J1"].angle

        # J2: Shoulder pitch around X axis
        if "j2_pivot" in self.entities:
            self.entities["j2_pivot"].rotation_x = self.joints["J2"].angle

        # J3: Elbow pitch around X axis
        if "j3_pivot" in self.entities:
            self.entities["j3_pivot"].rotation_x = self.joints["J3"].angle

        # J4: Wrist pitch around X axis
        if "j4_pivot" in self.entities:
            self.entities["j4_pivot"].rotation_x = self.joints["J4"].angle

    def set_angles(self, j1: float, j2: float, j3: float, j4: float) -> Tuple[List[float], bool]:
        """
        Updates all 4 joint angles, clamping to configured physical limits.
        
        Returns:
            Tuple[List[float], bool]: (clamped_angles_list, was_any_clamped)
        """
        raw = [j1, j2, j3, j4]
        keys = ["J1", "J2", "J3", "J4"]
        any_clamped = False
        final_angles = []

        for k, val in zip(keys, raw):
            clamped, clamped_flag = self.joints[k].set_angle(val)
            final_angles.append(clamped)
            if clamped_flag:
                any_clamped = True

        self.update_visuals()
        return final_angles, any_clamped

    def get_angles(self) -> List[float]:
        """Returns the current angles [J1, J2, J3, J4] in degrees."""
        return [
            self.joints["J1"].angle,
            self.joints["J2"].angle,
            self.joints["J3"].angle,
            self.joints["J4"].angle,
        ]

    def reset_to_home(self) -> List[float]:
        """Resets all joints to their configured home angles."""
        for j in self.joints.values():
            j.reset_to_home()
        self.update_visuals()
        return self.get_angles()

    def adjust_joint(self, joint_key: str, delta_deg: float) -> float:
        """
        Manual control helper: increments/decrements a specific joint angle.
        Used for keyboard navigation.
        """
        if joint_key in self.joints:
            res = self.joints[joint_key].adjust(delta_deg)
            self.update_visuals()
            return res
        return 0.0

    def calculate_forward_kinematics(self) -> Tuple[float, float, float]:
        """
        Calculates the 3D Cartesian coordinates (X, Y, Z) of the End Effector tip.
        
        Demonstrates 3D Math & Trigonometry:
        -----------------------------------
        1. Angles J2 (Shoulder), J3 (Elbow), J4 (Wrist) operate in the vertical pitch plane.
           Because they are serially chained:
             pitch2 = J2
             pitch3 = J2 + J3
             pitch4 = J2 + J3 + J4
           (Euler angle summation along same axis)
           
        2. Planar projection (R = horizontal distance from base, H = vertical height):
           H = l_base + l_upper * cos(pitch2) + l_fore * cos(pitch3) + (l_wrist + l_eff) * cos(pitch4)
           R =          l_upper * sin(pitch2) + l_fore * sin(pitch3) + (l_wrist + l_eff) * sin(pitch4)
           
        3. 3D polar-to-Cartesian transformation via Base Yaw (J1):
           X = R * sin(J1)
           Z = R * cos(J1)
           Y = H
           
        Returns:
            Tuple[float, float, float]: (X, Y, Z) coordinates in world units.
        """
        l_base = self.link_lengths.get("base", 0.8)
        l_upper = self.link_lengths.get("upper_arm", 2.2)
        l_fore = self.link_lengths.get("forearm", 1.6)
        l_wrist = self.link_lengths.get("wrist", 0.7)
        l_eff = self.link_lengths.get("end_effector", 0.4)

        j1_rad = self.joints["J1"].to_radians()
        j2_rad = self.joints["J2"].to_radians()
        j3_rad = self.joints["J3"].to_radians()
        j4_rad = self.joints["J4"].to_radians()

        # Cumulative pitch angles along the arm
        th2 = j2_rad
        th3 = j2_rad + j3_rad
        th4 = j2_rad + j3_rad + j4_rad

        # Planar reach and height
        # Note: in standard zero-pose, links point straight up (+Y)
        # Pitch rotates forward (+Z in local coords, giving sin for forward and cos for height)
        # Depending on convention:
        h = l_base + l_upper * math.cos(th2) + l_fore * math.cos(th3) + (l_wrist + l_eff) * math.cos(th4)
        r = l_upper * math.sin(th2) + l_fore * math.sin(th3) + (l_wrist + l_eff) * math.sin(th4)

        x = r * math.sin(j1_rad)
        z = r * math.cos(j1_rad)
        y = h

        return (round(x, 3), round(y, 3), round(z, 3))
