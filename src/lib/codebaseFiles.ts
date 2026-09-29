// Embedded project files and interview documentation for interactive educational viewing

export interface ProjectFile {
  name: string;
  path: string;
  language: 'c' | 'python' | 'markdown' | 'json';
  description: string;
  content: string;
}

export const EMBEDDED_FILES: ProjectFile[] = [
  {
    name: "main.c",
    path: "c_controller/main.c",
    language: "c",
    description: "Cross-platform native C UDP controller client supporting Winsock2 and POSIX sockets",
    content: `#include <stdio.h>
#include <stdlib.h>
#include <string.h>

#ifdef _WIN32
    #include <winsock2.h>
    #include <ws2tcpip.h>
    #pragma comment(lib, "ws2_32.lib")
    typedef int socklen_t;
#else
    #include <unistd.h>
    #include <sys/types.h>
    #include <sys/socket.h>
    #include <netinet/in.h>
    #include <arpa/inet.h>
    #define INVALID_SOCKET -1
    #define SOCKET_ERROR -1
    #define closesocket close
    typedef int SOCKET;
#endif

#define DEFAULT_PORT 5005
#define DEFAULT_HOST "127.0.0.1"

static int initialize_networking(void) {
#ifdef _WIN32
    WSADATA wsa;
    if (WSAStartup(MAKEWORD(2, 2), &wsa) != 0) return -1;
#endif
    return 0;
}

static void cleanup_networking(void) {
#ifdef _WIN32
    WSACleanup();
#endif
}

int send_joint_angles(SOCKET sock, struct sockaddr_in *dest, float j1, float j2, float j3, float j4) {
    char buffer[128];
    int len = snprintf(buffer, sizeof(buffer), "%.1f,%.1f,%.1f,%.1f", j1, j2, j3, j4);
    int sent = sendto(sock, buffer, len, 0, (struct sockaddr*)dest, sizeof(*dest));
    return (sent == len) ? 0 : -1;
}`
  },
  {
    name: "robot.py",
    path: "python_simulator/robot.py",
    language: "python",
    description: "4-DOF kinematic hierarchy, joint pivots, and 3D geometric primitives in Ursina",
    content: `from joint import Joint
from config_loader import ConfigLoader
import math

class RobotArm:
    """
    Manages 4-DOF robotic arm kinematics and 3D visual hierarchy:
    Base (Yaw) -> Shoulder (Pitch) -> Elbow (Pitch) -> Wrist (Pitch) -> Gripper
    """
    def __init__(self, config=None):
        self.config = config or ConfigLoader()
        self.joints = {
            "J1": Joint("J1", "Base Yaw", axis="y", min_limit=-180, max_limit=180),
            "J2": Joint("J2", "Shoulder Pitch", axis="x", min_limit=-90, max_limit=90),
            "J3": Joint("J3", "Elbow Pitch", axis="x", min_limit=-120, max_limit=120),
            "J4": Joint("J4", "Wrist Pitch", axis="x", min_limit=-180, max_limit=180),
        }

    def set_angles(self, j1, j2, j3, j4):
        self.joints["J1"].set_angle(j1)
        self.joints["J2"].set_angle(j2)
        self.joints["J3"].set_angle(j3)
        self.joints["J4"].set_angle(j4)
        self.update_visuals()`
  },
  {
    name: "udp_server.py",
    path: "python_simulator/udp_server.py",
    language: "python",
    description: "Thread-safe, non-blocking UDP socket receiver with telemetry tracking",
    content: `import socket
import threading
from protocol import ProtocolParser

class UDPServer:
    """Listens on 127.0.0.1:5005 in a background daemon thread."""
    def __init__(self, host="127.0.0.1", port=5005):
        self.host = host
        self.port = port
        self._lock = threading.Lock()
        self.packets_received = 0
        self.invalid_packets = 0
        self.latest_angles = None

    def _receive_loop(self):
        while self.is_running:
            try:
                data, addr = self._socket.recvfrom(1024)
                res = ProtocolParser.parse_packet(data)
                with self._lock:
                    if res.success:
                        self.latest_angles = res.clamped_angles
                        self.packets_received += 1
                    else:
                        self.invalid_packets += 1
            except socket.timeout:
                continue`
  },
  {
    name: "protocol.py",
    path: "python_simulator/protocol.py",
    language: "python",
    description: "Wire protocol parser, token validation, and physical limit clamping",
    content: `class ProtocolParser:
    @staticmethod
    def parse_packet(raw_bytes, joint_limits=None):
        payload = raw_bytes.decode('utf-8', errors='replace').strip()
        tokens = payload.split(',')
        if len(tokens) != 4:
            return ParseResult(success=False, error_message="Expected 4 tokens")
        angles = [float(t) for t in tokens]
        clamped = [clamp(val, limits[i]) for i, val in enumerate(angles)]
        return ParseResult(success=True, clamped_angles=clamped)`
  },
  {
    name: "PROTOCOL.md",
    path: "docs/PROTOCOL.md",
    language: "markdown",
    description: "Full wire specification, delimiter conventions, field mapping, and test cases",
    content: `# Robotic Arm UDP Telemetry Protocol Specification

**Transport:** UDP Datagram  
**Port:** 5005  
**Format:** <J1>,<J2>,<J3>,<J4>  
**Units:** Degrees (°)  

### Field Mapping:
- J1: Base Yaw [-180°, +180°]
- J2: Shoulder Pitch [-90°, +90°]
- J3: Elbow Pitch [-120°, +120°]
- J4: Wrist Pitch [-180°, +180°]

### Clamping Policy:
Out-of-range angles are clamped to physical boundaries without halting the simulation loop.`
  }
];

export interface InterviewQA {
  id: number;
  question: string;
  category: 'Networking' | 'Kinematics' | 'Systems & C' | 'Architecture';
  answer: string;
}

export const INTERVIEW_QUESTIONS: InterviewQA[] = [
  {
    id: 1,
    category: "Networking",
    question: "Why did you choose UDP instead of TCP for this robotic arm controller?",
    answer: "In real-time robotics and telemetry, timely delivery is far more important than guaranteed delivery. TCP features connection handshakes, retransmissions, and head-of-line blocking that cause latency spikes if a packet is lost. In high-frequency joint control, if packet N arrives late after packet N+1, it is obsolete. UDP provides zero-overhead, connectionless transmission where the simulator always consumes the freshest available state."
  },
  {
    id: 2,
    category: "Architecture",
    question: "How does the simulator decouple network packet reception from 60 FPS graphics rendering?",
    answer: "We use a multithreaded architecture. The UDP listener runs inside a dedicated background daemon thread performing socket.recvfrom(). When a valid packet arrives, it safely updates a shared state register protected by a threading.Lock. The main graphics thread polls this register non-blockingly during each frame update, completely preventing socket I/O from stalling the rendering loop."
  },
  {
    id: 3,
    category: "Systems & C",
    question: "What is the purpose of htons() in the C controller client?",
    answer: "htons() stands for 'Host to Network Short'. Host processors (x86, x64, ARM) typically use Little-Endian byte order in memory. Internet protocol headers require Big-Endian (Network Byte Order). htons() converts a 16-bit port number (like 5005) into the standard network byte order so operating systems and routers parse destination ports correctly."
  },
  {
    id: 4,
    category: "Kinematics",
    question: "What is a kinematic hierarchy and why are parent-child transformations essential?",
    answer: "A kinematic hierarchy models an articulated robot as a serial chain tree. Each child entity's transform is defined locally relative to its parent. Because the Elbow is parented to the Shoulder, pitching the Shoulder automatically orbits and reorients the Elbow, Forearm, Wrist, and End Effector in 3D world space without needing manual trigonometric matrix calculations for every single link."
  },
  {
    id: 5,
    category: "Kinematics",
    question: "Explain the Forward Kinematics formula used to calculate the 3D tip coordinates.",
    answer: "Because joints J2 (Shoulder), J3 (Elbow), and J4 (Wrist) share parallel pitch axes, their relative angles accumulate: θ2 = J2, θ3 = J2 + J3, θ4 = J2 + J3 + J4. Right-triangle trigonometry determines vertical height (H = L_base + Σ L_i * cos(θ_i)) and radial reach (R = Σ L_i * sin(θ_i)). Finally, horizontal coordinates are projected via Base Yaw (J1): X = R * sin(J1) and Z = R * cos(J1)."
  },
  {
    id: 6,
    category: "Systems & C",
    question: "How does cross-platform compatibility between Winsock2 (Windows) and POSIX (Linux) work in C?",
    answer: "We use preprocessor directives (#ifdef _WIN32). On Windows, we include <winsock2.h>, link ws2_32.lib, and call WSAStartup() before creating sockets, followed by WSACleanup() on exit. On Linux/macOS, sockets are native kernel file descriptors from <sys/socket.h> without initialization overhead."
  },
  {
    id: 7,
    category: "Architecture",
    question: "Why clamp out-of-range angles instead of rejecting the packet entirely?",
    answer: "In physical robotic manipulators, rejecting an entire packet due to a 1° overshoot on one joint would cause an abrupt emergency stop across all other joints, risking mechanical wear or payload loss. Clamping implements a soft-stop limit where the actuator holds its maximum safe travel while allowing the remaining joints to continue motion smoothly."
  },
  {
    id: 8,
    category: "Networking",
    question: "How does the system handle rapid packet floods (e.g. 1,000 packets/second)?",
    answer: "Rather than buffering packets in an unbounded queue (which would cause memory expansion and display lag), we implement a latest-state overwrite policy. Incoming packets overwrite the target angle register immediately. The rendering loop operates at 60 FPS and always grabs the most current target."
  },
  {
    id: 9,
    category: "Networking",
    question: "How do you detect client activity (ACTIVE, IDLE, INACTIVE) on a connectionless UDP socket?",
    answer: "Because UDP has no TCP SYN/FIN control packets or keep-alives, the server timestamps every successfully received packet using the system clock. On each frame, elapsed time (now - last_packet_time) is evaluated: < 2.0s is ACTIVE, 2.0s to 10.0s is IDLE, and > 10.0s is INACTIVE."
  },
  {
    id: 10,
    category: "Architecture",
    question: "What design pattern prevents simulation crashes when config.json is missing or corrupted?",
    answer: "The Fallback / Null Object pattern. When ConfigLoader catches a FileNotFoundError or JSONDecodeError, it logs a warning, loads a pre-verified built-in dictionary (FALLBACK_CONFIG), and marks an is_fallback flag, allowing the application to boot safely in degraded environments."
  }
];
