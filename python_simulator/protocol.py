"""
protocol.py - UDP Packet Parser and Angle Validator

Defines the text-based UDP protocol for 4-DOF robotic arm joint control:
    Format: "J1,J2,J3,J4"
    Example: "30,15,-20,45"
    Units: Degrees

Includes validation, string/bytes decoding, clamping against physical limits,
and detailed diagnostic reporting for invalid packets.
"""

from dataclasses import dataclass
from typing import List, Optional, Tuple


@dataclass
class ParseResult:
    """
    Result of parsing an incoming raw UDP payload.
    
    Attributes:
        success (bool): True if the packet had exactly 4 numeric values.
        raw_text (str): The decoded text received over the wire.
        raw_angles (Optional[List[float]]): The exact parsed floats prior to clamping.
        clamped_angles (Optional[List[float]]): The angles after clamping to joint limits.
        was_clamped (bool): True if any angle exceeded its physical limit and was clamped.
        error_message (str): Explanation of failure if success is False.
    """
    success: bool
    raw_text: str
    raw_angles: Optional[List[float]] = None
    clamped_angles: Optional[List[float]] = None
    was_clamped: bool = False
    error_message: str = ""


class ProtocolParser:
    """
    Stateless parser and validator for the robotic arm UDP telemetry protocol.
    """

    NUM_JOINTS = 4
    DELIMITER = ","

    @classmethod
    def parse_packet(
        cls,
        payload_bytes: bytes,
        joint_limits: Optional[List[Tuple[float, float]]] = None
    ) -> ParseResult:
        """
        Parses a raw UDP byte packet into joint angles.
        
        Args:
            payload_bytes (bytes): Raw payload from socket.recvfrom().
            joint_limits (Optional[List[Tuple[float, float]]]): List of 4 (min, max) tuples.
                If provided, angles are clamped to these limits.
                
        Returns:
            ParseResult: Detailed result containing success status, angles, or error info.
        """
        # Step 1: Decode raw network bytes to string (UTF-8 with ASCII fallback)
        try:
            raw_text = payload_bytes.decode("utf-8").strip()
        except UnicodeDecodeError:
            try:
                raw_text = payload_bytes.decode("ascii", errors="replace").strip()
            except Exception as e:
                return ParseResult(
                    success=False,
                    raw_text="<undecodable bytes>",
                    error_message=f"Byte decoding failed: {e}"
                )

        if not raw_text:
            return ParseResult(
                success=False,
                raw_text="",
                error_message="Empty packet received"
            )

        # Step 2: Split by delimiter
        tokens = [token.strip() for token in raw_text.split(cls.DELIMITER)]

        # Step 3: Validate field count (must be exactly 4 joints)
        if len(tokens) != cls.NUM_JOINTS:
            return ParseResult(
                success=False,
                raw_text=raw_text,
                error_message=(
                    f"Expected {cls.NUM_JOINTS} comma-separated values, "
                    f"but received {len(tokens)} token(s): '{raw_text}'"
                )
            )

        # Step 4: Validate that every token is a valid float
        raw_angles: List[float] = []
        for i, token in enumerate(tokens):
            try:
                val = float(token)
                # Check for NaN / Infinity edge cases
                if val != val or abs(val) == float("inf"):
                    return ParseResult(
                        success=False,
                        raw_text=raw_text,
                        error_message=f"Field {i+1} ('{token}') is NaN or Infinity, not a valid angle"
                    )
                raw_angles.append(val)
            except ValueError:
                return ParseResult(
                    success=False,
                    raw_text=raw_text,
                    error_message=f"Field {i+1} ('{token}') is non-numeric, expected degrees as float"
                )

        # Step 5: Clamping policy
        # Requirement: Out-of-range values are NOT rejected; they are safely clamped to limits!
        clamped_angles = list(raw_angles)
        was_clamped = False

        if joint_limits and len(joint_limits) == cls.NUM_JOINTS:
            for i in range(cls.NUM_JOINTS):
                min_lim, max_lim = joint_limits[i]
                orig_val = clamped_angles[i]
                if orig_val < min_lim:
                    clamped_angles[i] = min_lim
                    was_clamped = True
                elif orig_val > max_lim:
                    clamped_angles[i] = max_lim
                    was_clamped = True

        return ParseResult(
            success=True,
            raw_text=raw_text,
            raw_angles=raw_angles,
            clamped_angles=clamped_angles,
            was_clamped=was_clamped,
            error_message=""
        )

    @classmethod
    def format_packet(cls, angles: List[float]) -> str:
        """
        Formats a list of 4 float angles into the wire format "J1,J2,J3,J4".
        Example: [30.0, 15.0, -20.0, 45.0] -> "30.0,15.0,-20.0,45.0"
        """
        if len(angles) != cls.NUM_JOINTS:
            raise ValueError(f"Expected {cls.NUM_JOINTS} angles, got {len(angles)}")
        return cls.DELIMITER.join(f"{float(a):.1f}" for a in angles)
