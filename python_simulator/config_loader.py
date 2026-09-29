"""
config_loader.py - Robotic Arm Configuration Loader

Loads simulation parameters from a JSON configuration file.
Provides a resilient fallback configuration if the file is missing or corrupted,
ensuring the simulation never crashes due to configuration file errors.
"""

import json
import logging
import os
from typing import Any, Dict, List, Tuple

# Configure logging with clear prefix for simulation diagnostics
logger = logging.getLogger("RobotArmConfig")
if not logger.handlers:
    logging.basicConfig(level=logging.INFO, format="[%(levelname)s] %(name)s: %(message)s")

# Safe built-in fallback configuration
# In robotics engineering, simulators and physical controllers should have deterministic
# known-good defaults so that a corrupted configuration file does not cause catastrophic crashes.
FALLBACK_CONFIG: Dict[str, Any] = {
    "robot": {
        "name": "MiniArm-Fallback"
    },
    "network": {
        "host": "127.0.0.1",
        "port": 5005
    },
    "links": {
        "base": 0.8,
        "upper_arm": 2.2,
        "forearm": 1.6,
        "wrist": 0.7,
        "end_effector": 0.4
    },
    "joints": {
        "J1": {"name": "Base Rotation", "axis": "y", "min": -180.0, "max": 180.0, "home": 0.0, "step": 5.0},
        "J2": {"name": "Shoulder Pitch", "axis": "x", "min": -90.0, "max": 90.0, "home": 15.0, "step": 5.0},
        "J3": {"name": "Elbow Pitch", "axis": "x", "min": -120.0, "max": 120.0, "home": -30.0, "step": 5.0},
        "J4": {"name": "Wrist Pitch", "axis": "x", "min": -180.0, "max": 180.0, "home": 0.0, "step": 5.0}
    }
}


class ConfigLoader:
    """
    Manages loading, validating, and accessing simulation configuration.
    
    Attributes:
        config_path (str): Path to the JSON configuration file.
        config_data (dict): The loaded (or fallback) configuration dictionary.
        is_fallback (bool): True if using fallback defaults due to a missing or invalid file.
    """

    def __init__(self, config_path: str = "config.json"):
        self.config_path = config_path
        self.is_fallback = False
        self.config_data = self._load()

    def _load(self) -> Dict[str, Any]:
        """
        Attempts to read and parse the JSON file.
        If any error occurs (file not found, JSON decode error, permission error),
        it falls back to FALLBACK_CONFIG gracefully without throwing an uncaught exception.
        """
        if not os.path.exists(self.config_path):
            logger.warning(
                f"Configuration file '{self.config_path}' not found. Using safe built-in fallback configuration."
            )
            self.is_fallback = True
            return FALLBACK_CONFIG.copy()

        try:
            with open(self.config_path, "r", encoding="utf-8") as f:
                data = json.load(f)
            
            # Merge with fallback to ensure all required keys exist
            merged = self._merge_with_fallback(data)
            logger.info(f"Loaded configuration from '{self.config_path}' for robot '{merged['robot']['name']}'.")
            return merged
        except json.JSONDecodeError as err:
            logger.error(
                f"Invalid JSON syntax in '{self.config_path}' (Line {err.lineno}, Col {err.colno}): {err.msg}. "
                f"Reverting to fallback configuration."
            )
            self.is_fallback = True
            return FALLBACK_CONFIG.copy()
        except Exception as err:
            logger.error(f"Failed to read '{self.config_path}': {err}. Reverting to fallback configuration.")
            self.is_fallback = True
            return FALLBACK_CONFIG.copy()

    def _merge_with_fallback(self, loaded: Dict[str, Any]) -> Dict[str, Any]:
        """
        Deep-merges loaded config over FALLBACK_CONFIG.
        This guarantees that even if the user config omits optional fields (e.g. wrist link or step),
        the simulator remains functional without KeyErrors.
        """
        merged = FALLBACK_CONFIG.copy()
        
        if "robot" in loaded and isinstance(loaded["robot"], dict):
            merged["robot"] = {**merged["robot"], **loaded["robot"]}
            
        if "network" in loaded and isinstance(loaded["network"], dict):
            merged["network"] = {**merged["network"], **loaded["network"]}
            # Validate port is valid integer
            try:
                merged["network"]["port"] = int(merged["network"]["port"])
            except (ValueError, TypeError):
                logger.warning("Invalid port in configuration. Resetting to default 5005.")
                merged["network"]["port"] = 5005

        if "links" in loaded and isinstance(loaded["links"], dict):
            merged["links"] = {**merged["links"], **loaded["links"]}

        if "joints" in loaded and isinstance(loaded["joints"], dict):
            # Ensure each joint (J1-J4) has required bounds
            for j_key in ["J1", "J2", "J3", "J4"]:
                if j_key in loaded["joints"] and isinstance(loaded["joints"][j_key], dict):
                    merged["joints"][j_key] = {**merged["joints"][j_key], **loaded["joints"][j_key]}

        return merged

    @property
    def robot_name(self) -> str:
        return self.config_data.get("robot", {}).get("name", "MiniArm")

    @property
    def host(self) -> str:
        return self.config_data.get("network", {}).get("host", "127.0.0.1")

    @property
    def port(self) -> int:
        return self.config_data.get("network", {}).get("port", 5005)

    @property
    def link_lengths(self) -> Dict[str, float]:
        return self.config_data.get("links", FALLBACK_CONFIG["links"])

    @property
    def joint_configs(self) -> Dict[str, Dict[str, Any]]:
        return self.config_data.get("joints", FALLBACK_CONFIG["joints"])

    def get_joint_limits(self, joint_id: str) -> Tuple[float, float]:
        """Returns (min_angle, max_angle) in degrees for joint_id (e.g. 'J1')."""
        j_info = self.joint_configs.get(joint_id, {})
        return float(j_info.get("min", -180.0)), float(j_info.get("max", 180.0))

    def get_home_angles(self) -> List[float]:
        """Returns the list of 4 home angles [J1, J2, J3, J4] in degrees."""
        joints = self.joint_configs
        return [
            float(joints.get("J1", {}).get("home", 0.0)),
            float(joints.get("J2", {}).get("home", 15.0)),
            float(joints.get("J3", {}).get("home", -30.0)),
            float(joints.get("J4", {}).get("home", 0.0)),
        ]
