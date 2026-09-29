"""
udp_server.py - Thread-Safe UDP Command Receiver

Provides a decoupled, non-blocking UDP listener for incoming robotic arm commands.
Runs the socket reception loop on a background thread so network latency or packet
delays never block or freeze the 60 FPS Ursina 3D rendering loop.
"""

import logging
import socket
import threading
import time
from typing import List, Optional, Tuple

from protocol import ParseResult, ProtocolParser

logger = logging.getLogger("RobotArmUDP")
if not logger.handlers:
    logging.basicConfig(level=logging.INFO, format="[%(levelname)s] %(name)s: %(message)s")


class UDPServer:
    """
    Asynchronous UDP telemetry server.
    
    Attributes:
        host (str): Listening IP (default 127.0.0.1).
        port (int): Listening port (default 5005).
        joint_limits (Optional[List[Tuple[float, float]]]): Limits for J1-J4 clamping.
        is_running (bool): Server running status flag.
        status_text (str): Status for telemetry (e.g. 'LISTENING', 'PORT IN USE').
        packets_received (int): Total packets received.
        invalid_packets (int): Malformed or rejected packets.
        last_packet_time (Optional[float]): Epoch timestamp of the latest packet.
        last_valid_packet (str): Text payload of latest valid packet.
        latest_angles (Optional[List[float]]): Clamped joint angles ready for simulation.
    """

    def __init__(
        self,
        host: str = "127.0.0.1",
        port: int = 5005,
        joint_limits: Optional[List[Tuple[float, float]]] = None
    ):
        self.host = host
        self.port = port
        self.joint_limits = joint_limits
        
        self.is_running = False
        self.status_text = "INITIALIZING"
        self._socket: Optional[socket.socket] = None
        self._thread: Optional[threading.Thread] = None
        
        # Thread safety lock for telemetry counters and latest state
        self._lock = threading.Lock()
        
        # Telemetry metrics
        self.packets_received: int = 0
        self.invalid_packets: int = 0
        self.last_packet_time: Optional[float] = None
        self.last_valid_packet: str = "None"
        self.latest_angles: Optional[List[float]] = None
        self.new_data_available: bool = False
        self.last_error: str = ""

    def start(self) -> bool:
        """
        Initializes and binds the UDP socket, then launches the background receiver thread.
        Returns True if successful, False if port conflict or OS error occurs.
        """
        try:
            # Create UDP IPv4 datagram socket
            self._socket = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
            
            # Set a 0.5s socket timeout so recvfrom does not hang indefinitely when stopping
            self._socket.settimeout(0.5)
            
            # Bind to host and port
            self._socket.bind((self.host, self.port))
            
            self.is_running = True
            self.status_text = "LISTENING"
            logger.info(f"UDP Server successfully bound and listening on {self.host}:{self.port}")
            
            # Launch worker thread
            self._thread = threading.Thread(target=self._receive_loop, name="UDP-Receiver-Thread", daemon=True)
            self._thread.start()
            return True
        except OSError as e:
            # Edge case handling: Port already in use or permission denied
            self.status_text = f"ERROR: Port {self.port} In Use"
            self.last_error = f"Bind error: {e}"
            logger.error(f"Cannot bind UDP socket to {self.host}:{self.port}: {e}. Ensure no other instance is running.")
            self.is_running = False
            if self._socket:
                try:
                    self._socket.close()
                except Exception:
                    pass
                self._socket = None
            return False

    def _receive_loop(self) -> None:
        """
        Worker thread loop that continuously reads UDP packets.
        Decoupled from graphics loop to avoid frame drops.
        """
        while self.is_running and self._socket:
            try:
                # Buffer size 1024 bytes is more than enough for "J1,J2,J3,J4" text commands
                data, addr = self._socket.recvfrom(1024)
                now = time.time()
                
                # Parse and validate via ProtocolParser
                res: ParseResult = ProtocolParser.parse_packet(data, joint_limits=self.joint_limits)
                
                with self._lock:
                    self.packets_received += 1
                    self.last_packet_time = now
                    
                    if res.success and res.clamped_angles is not None:
                        # Rapid packet flood policy:
                        # We overwrite with the latest valid state rather than queuing indefinitely.
                        # This prevents buffer lag where the 3D arm renders seconds-old commands.
                        self.latest_angles = res.clamped_angles
                        self.last_valid_packet = res.raw_text
                        self.new_data_available = True
                        self.last_error = ""
                    else:
                        self.invalid_packets += 1
                        self.last_error = res.error_message
                        logger.warning(f"Malformed UDP packet from {addr}: {res.error_message}")
            except socket.timeout:
                # Normal timeout - allows checking self.is_running periodically
                continue
            except OSError:
                # Socket was closed during shutdown
                break
            except Exception as e:
                logger.error(f"Unexpected error in UDP receive loop: {e}")
                with self._lock:
                    self.invalid_packets += 1
                    self.last_error = str(e)

    def fetch_latest_angles(self) -> Optional[List[float]]:
        """
        Called by the simulation render loop to check if fresh commands arrived.
        Consumes the 'new_data_available' flag atomically.
        """
        with self._lock:
            if self.new_data_available and self.latest_angles is not None:
                self.new_data_available = False
                return list(self.latest_angles)
            return None

    def get_telemetry_snapshot(self) -> dict:
        """
        Returns a thread-safe snapshot of server telemetry for UI display.
        """
        with self._lock:
            now = time.time()
            if self.last_packet_time is not None:
                age_seconds = now - self.last_packet_time
                if age_seconds < 2.0:
                    activity = "ACTIVE"
                elif age_seconds < 10.0:
                    activity = "IDLE"
                else:
                    activity = "INACTIVE"
                age_str = f"{age_seconds:.1f}s ago"
            else:
                activity = "NO DATA"
                age_str = "Never"

            return {
                "status": self.status_text,
                "host_port": f"{self.host}:{self.port}",
                "packets_received": self.packets_received,
                "invalid_packets": self.invalid_packets,
                "last_valid_packet": self.last_valid_packet,
                "last_packet_age": age_str,
                "client_activity": activity,
                "last_error": self.last_error,
            }

    def stop(self) -> None:
        """Stops the background receiver thread and closes the socket cleanly."""
        self.is_running = False
        self.status_text = "STOPPED"
        if self._socket:
            try:
                self._socket.close()
            except Exception:
                pass
            self._socket = None
        if self._thread and self._thread.is_alive():
            self._thread.join(timeout=1.0)
        logger.info("UDP Server shut down cleanly.")
