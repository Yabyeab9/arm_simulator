"""
joint.py - Robotic Joint Model

Represents a single revolute (rotational) joint in the robotic arm hierarchy.
Tracks current angle, min/max limits, rotation axis, and mathematical conversions.
"""

import math
from typing import Optional, Tuple


class Joint:
    """
    Represents an active revolute joint in a kinematic chain.
    
    Attributes:
        joint_id (str): Identifier such as 'J1', 'J2', 'J3', 'J4'.
        name (str): Human-readable joint name (e.g. 'Shoulder Pitch').
        axis (str): Primary axis of rotation ('x', 'y', or 'z').
        min_limit (float): Minimum allowable angle in degrees.
        max_limit (float): Maximum allowable angle in degrees.
        home_angle (float): Default neutral/home angle in degrees.
        angle (float): Current joint angle in degrees.
    """

    def __init__(
        self,
        joint_id: str,
        name: str,
        axis: str = "x",
        min_limit: float = -180.0,
        max_limit: float = 180.0,
        home_angle: float = 0.0,
        step: float = 5.0
    ):
        self.joint_id = joint_id
        self.name = name
        self.axis = axis.lower()
        if self.axis not in ("x", "y", "z"):
            raise ValueError(f"Invalid joint rotation axis: '{axis}'. Must be 'x', 'y', or 'z'.")
        
        self.min_limit = float(min(min_limit, max_limit))
        self.max_limit = float(max(min_limit, max_limit))
        self.home_angle = float(home_angle)
        self.step = float(step)
        
        # Initial state is initialized to home_angle clamped to limits
        self._angle: float = self.clamp(self.home_angle)

    @property
    def angle(self) -> float:
        """Current joint angle in degrees."""
        return self._angle

    @angle.setter
    def angle(self, new_val: float) -> None:
        """Sets joint angle, automatically clamping to physical limits."""
        self._angle = self.clamp(float(new_val))

    def clamp(self, value: float) -> float:
        """
        Enforces physical joint stops.
        Robotic actuators have physical mechanical hardstops or software softstops.
        Clamping guarantees that invalid input never bends a virtual link into an impossible pose.
        """
        if value < self.min_limit:
            return self.min_limit
        if value > self.max_limit:
            return self.max_limit
        return value

    def set_angle(self, target_deg: float) -> Tuple[float, bool]:
        """
        Sets the joint angle and reports whether clamping occurred.
        
        Returns:
            Tuple[float, bool]: (clamped_angle, was_clamped)
        """
        clamped = self.clamp(target_deg)
        was_clamped = (clamped != target_deg)
        self._angle = clamped
        return self._angle, was_clamped

    def adjust(self, delta_deg: float) -> float:
        """Increments or decrements current angle by delta_deg within bounds."""
        self._angle = self.clamp(self._angle + delta_deg)
        return self._angle

    def to_radians(self) -> float:
        """
        Converts the current angle from degrees to radians.
        
        Why radians?
        Trigonometric functions in Python math (math.sin, math.cos) require input in radians:
            radians = degrees * (pi / 180)
        While human engineers think in degrees (-90 to +90 deg), matrix and trigonometric
        transformations compute with radians.
        """
        return math.radians(self._angle)

    def reset_to_home(self) -> float:
        """Resets the joint to its designated home angle."""
        self._angle = self.clamp(self.home_angle)
        return self._angle

    def __repr__(self) -> str:
        return (
            f"Joint({self.joint_id}, name='{self.name}', axis='{self.axis}', "
            f"angle={self._angle:.1f}°, limits=[{self.min_limit:.1f}°, {self.max_limit:.1f}°])"
        )
