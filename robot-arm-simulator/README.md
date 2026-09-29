# 3D Robotic Arm Simulator

A lightweight, professional cross-language robotics simulation prototype built with **Python**, **Ursina 3D**, and **Native C**. Demonstrates real-time 3D kinematic hierarchies, UDP telemetry protocol parsing, socket programming, thread safety, and inter-process communication between C and Python.

---

## Visual Preview

```text
+------------------------------------------------------------------------+
|                                                                        |
|   [ 3D ROBOTIC ARM SIMULATOR - URSINA ENGINE ]                         |
|                                                                        |
|   +--------------------------+                                         |
|   | MINIARM TELEMETRY        |                                         |
|   | Endpoint   : 127.0.0.1:5005                                        |
|   | UDP State  : LISTENING   |          [End Effector Gripper]         |
|   | Activity   : ACTIVE      |                     \                   |
|   | Packets    : 142         |                 [Wrist Link]            |
|   | Invalid    : 0           |                     /                   |
|   | Last Packet: 30,15,-20,45|               [Forearm Link]            |
|   |                          |                    /                    |
|   | J1 (Base)  :  30.0°      |             [Upper Arm Link]            |
|   | J2 (Should):  15.0°      |                   /                     |
|   | J3 (Elbow) : -20.0°      |             [Base Column]               |
|   | J4 (Wrist) :  45.0°      |             ============= (Pedestal)    |
|   +--------------------------+                                         |
|                                                                        |
+------------------------------------------------------------------------+
```

*(Place screenshots here when running locally in graphical desktop environments: `screenshots/simulator_window.png`)*

---

## Key Features

- **4-DOF Articulated Robotic Arm**: Fully articulated 4-joint kinematic chain (*Base Yaw*, *Shoulder Pitch*, *Elbow Pitch*, *Wrist Pitch*, and *End Effector Gripper*).
- **Hierarchical 3D Scene Graph**: Child links inherit orientation and orbital translation from parents naturally through local transformation matrices.
- **Cross-Language Control via UDP**: A native C client (`c_controller/main.c`) transmits joint angles to the Python simulator using standard BSD/Winsock datagrams.
- **Decoupled Multithreaded Networking**: Network reception runs on a dedicated background thread, ensuring network latency never stalls or drops the 60 FPS 3D rendering loop.
- **Resilient Fault Handling**: Automatic clamping against physical joint limits (soft stops), strict packet validation, and safe fallback configuration defaults.
- **Live On-Screen Telemetry HUD**: Displays real-time server status, packet counters, client activity state, joint degrees, and calculated 3D Cartesian tip coordinates.
- **Interactive Controls**: Full keyboard navigation (`Q/A`, `W/S`, `E/D`, `R/F`, `H` for Home/Reset) alongside UDP socket control.

---

## System Architecture

```text
+----------------------+              UDP Datagram
|  C UDP Controller    | -------------------------------------> [Port 5005]
|  (c_controller/)     |           "30,15,-20,45"                     |
+----------------------+                                              v
                                                        +---------------------------+
                                                        |  Python Background Thread |
                                                        |  (udp_server.py)          |
                                                        |  - socket.recvfrom()      |
                                                        +---------------------------+
                                                                      |
                                                                      v
                                                        +---------------------------+
                                                        |  Protocol Parser          |
                                                        |  (protocol.py)            |
                                                        |  - Validates & Clamps     |
                                                        +---------------------------+
                                                                      |
                                                               (Atomic Lock)
                                                                      |
                                                                      v
                                                        +---------------------------+
                                                        |  Ursina 60 FPS Game Loop  |
                                                        |  (main.py)                |
                                                        |  - Robot Kinematics       |
                                                        |  - Telemetry HUD (ui.py)  |
                                                        +---------------------------+
```

---

## Technology Stack

| Component | Technology | Description |
| :--- | :--- | :--- |
| **3D Engine** | Ursina 3D (Panda3D) | Python 3D simulation framework for entities, lighting, and camera. |
| **Networking** | Standard `socket` library | Pure standard-library UDP datagram communication. |
| **Controller** | Standard C (C99) | Portable native client supporting Windows Winsock2 and POSIX sockets. |
| **Configuration** | Standard `json` | Human-readable configuration loader with resilient fallbacks. |

---

## Repository Structure

```text
robot-arm-simulator/
├── python_simulator/
│   ├── main.py             # Ursina 3D simulation entry point & game loop
│   ├── robot.py            # 4-DOF kinematic hierarchy & 3D mesh entities
│   ├── joint.py            # Revolute joint model, physical limits & clamping
│   ├── udp_server.py       # Thread-safe, non-blocking UDP socket server
│   ├── protocol.py         # Wire protocol tokenizer, validator, and parser
│   ├── config_loader.py    # Resilient JSON loader with fallback defaults
│   ├── ui.py               # Live on-screen telemetry HUD overlay
│   └── config.json         # Robot parameters (link lengths, joint limits, port)
├── c_controller/
│   ├── main.c              # Cross-platform native C UDP controller
│   └── README.md           # Compilation & execution instructions for C
├── docs/
│   ├── PROTOCOL.md         # Wire protocol specification & test suite
│   └── LEARNING_GUIDE.md   # Deep educational engineering manual (20 interview Q&As)
├── screenshots/            # Graphical simulation preview placeholder
├── requirements.txt        # Python dependency manifest (ursina)
├── README.md               # Main project documentation
└── .gitignore              # Clean ignore rules
```

---

## Quick Start Guide

### 1. Python 3D Simulator Setup

```bash
# 1. Clone repository and navigate to directory
cd robot-arm-simulator

# 2. Create and activate a Python virtual environment
python -m venv venv
# On Windows:
venv\Scripts\activate
# On Linux/macOS:
source venv/bin/activate

# 3. Install requirements
pip install -r requirements.txt

# 4. Start the 3D simulator
python python_simulator/main.py
```

### 2. C Controller Compilation & Execution

Open a second terminal window:

#### Windows (MinGW GCC or MSVC)
```cmd
cd c_controller
gcc main.c -o robot_controller.exe -lws2_32
robot_controller.exe
```

#### Linux / macOS / WSL
```bash
cd c_controller
gcc main.c -o robot_controller
./robot_controller
```

### 3. Sending Angle Commands

In the C controller terminal:
```text
Controller> Enter J1 J2 J3 J4: 30 15 -20 45
[SUCCESS] Transmitted 14 bytes -> "30.0,15.0,-20.0,45.0"
```
The 3D robotic arm in the simulator will immediately rotate to match the commanded pose, and the Telemetry HUD will log the transmission.

---

## UDP Protocol Example

Packets are comma-separated ASCII text representing degrees:
```text
<J1>,<J2>,<J3>,<J4>
```

- **Valid**: `30,15,-20,45`
- **Home**: `0,15,-30,0`
- **Soft Clamping**: If `J2` limit is `[-90, 90]`, sending `0,140,0,0` automatically clamps `J2` to `90.0°`.
- **Malformed**: `hello,15,30` (discarded safely; simulator never crashes).

See [docs/PROTOCOL.md](docs/PROTOCOL.md) for the complete protocol specification.

---

## Keyboard Controls

| Key | Action |
| :---: | :--- |
| **Q / A** | Joint 1 (Base Yaw) rotate ±5° |
| **W / S** | Joint 2 (Shoulder Pitch) rotate ±5° |
| **E / D** | Joint 3 (Elbow Pitch) rotate ±5° |
| **R / F** | Joint 4 (Wrist Pitch) rotate ±5° |
| **H** | **HOME / RESET** arm to default angles |
| **ESC** | Clean application exit |
| **Left Click + Drag** | Orbit 3D Camera |
| **Right Click + Drag** | Pan 3D Camera |
| **Scroll Wheel** | Zoom In / Out |

---

## Educational Roadmap & Post-Build Extensions

This project is accompanied by an extensive educational manual: [docs/LEARNING_GUIDE.md](docs/LEARNING_GUIDE.md).

After exploring the core codebase, challenge yourself to implement the **three guided post-build features**:
1. **Smooth Joint Movement**: Frame-independent linear and spherical interpolation ($\Delta t$) instead of instantaneous angle snapping.
2. **Command Recording & Playback**: Timestamped trajectory recording and JSON session replay.
3. **Multi-Robot Configuration System**: Hot-swapping between diverse robot models (desktop mini-arm vs. industrial high-reach arm) at runtime.
