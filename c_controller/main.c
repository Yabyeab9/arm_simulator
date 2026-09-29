/**
 * main.c - 4-DOF Robotic Arm C UDP Controller Client
 * 
 * Demonstrates:
 * - Cross-platform UDP socket programming (Windows Winsock2 + Linux/POSIX)
 * - Constructing sockaddr_in and port byte ordering with htons()
 * - String formatting for the "J1,J2,J3,J4" telemetry protocol
 * - Transmitting datagrams to localhost:5005 using sendto()
 * - Interactive console prompts and command-line argument parsing
 */

#include <stdio.h>
#include <stdlib.h>
#include <string.h>

#ifdef _WIN32
    /* Windows Native Networking Headers */
    #include <winsock2.h>
    #include <ws2tcpip.h>
    /* Direct MSVC / MinGW to link the Winsock library */
    #pragma comment(lib, "ws2_32.lib")
    typedef int socklen_t;
    #define CLOSE_SOCKET(s) closesocket(s)
#else
    /* POSIX (Linux, macOS, WSL) Networking Headers */
    #include <unistd.h>
    #include <sys/types.h>
    #include <sys/socket.h>
    #include <netinet/in.h>
    #include <arpa/inet.h>
    #define CLOSE_SOCKET(s) close(s)
    typedef int SOCKET;
    #define INVALID_SOCKET (-1)
    #define SOCKET_ERROR   (-1)
#endif

#define DEFAULT_HOST "127.0.0.1"
#define DEFAULT_PORT 5005
#define BUFFER_SIZE  256

/**
 * Initializes socket subsystem.
 * On Windows, Winsock requires WSAStartup before any socket call.
 * On POSIX systems, this is a no-op.
 */
int initialize_networking(void) {
#ifdef _WIN32
    WSADATA wsaData;
    int result = WSAStartup(MAKEWORD(2, 2), &wsaData);
    if (result != 0) {
        fprintf(stderr, "[ERROR] WSAStartup failed with error code: %d\n", result);
        return 0;
    }
#endif
    return 1;
}

/**
 * Cleans up socket subsystem.
 * On Windows, calls WSACleanup.
 */
void cleanup_networking(void) {
#ifdef _WIN32
    WSACleanup();
#endif
}

/**
 * Formats 4 joint angles into the protocol string "J1,J2,J3,J4" and sends via UDP.
 * 
 * @param sock Active UDP socket descriptor.
 * @param server_addr Target destination address structure.
 * @param j1 Base angle (degrees).
 * @param j2 Shoulder angle (degrees).
 * @param j3 Elbow angle (degrees).
 * @param j4 Wrist angle (degrees).
 * @return Number of bytes transmitted, or -1 on failure.
 */
int send_joint_angles(SOCKET sock, struct sockaddr_in *server_addr, float j1, float j2, float j3, float j4) {
    char payload[BUFFER_SIZE];

    /* Format into standard protocol string: "J1,J2,J3,J4" with 1 decimal precision */
    snprintf(payload, sizeof(payload), "%.1f,%.1f,%.1f,%.1f", j1, j2, j3, j4);
    int payload_len = (int)strlen(payload);

    /* 
     * sendto() transmits datagram to the specified destination.
     * Note: UDP is connectionless. sendto() does not perform a 3-way handshake;
     * it immediately places the datagram onto the network interface.
     */
    int bytes_sent = sendto(
        sock,
        payload,
        payload_len,
        0,
        (struct sockaddr *)server_addr,
        sizeof(*server_addr)
    );

    if (bytes_sent == SOCKET_ERROR) {
        fprintf(stderr, "[ERROR] sendto() failed to transmit packet.\n");
        return -1;
    }

    printf("[SUCCESS] Transmitted %d bytes -> \"%s\"\n", bytes_sent, payload);
    return bytes_sent;
}

/**
 * Interactive menu allowing the user to repeatedly enter joint angles.
 */
void run_interactive_mode(SOCKET sock, struct sockaddr_in *server_addr) {
    printf("\n=======================================================\n");
    printf("   Interactive Robotic Arm UDP Controller (4-DOF)\n");
    printf("=======================================================\n");
    printf("Type 4 angles separated by spaces or commas (e.g., '30 15 -20 45')\n");
    printf("Type 'h' for Home [0, 15, -30, 0], or 'q' to quit.\n\n");

    char input_line[BUFFER_SIZE];
    while (1) {
        printf("Controller> Enter J1 J2 J3 J4: ");
        if (!fgets(input_line, sizeof(input_line), stdin)) {
            break;
        }

        /* Strip trailing newline */
        input_line[strcspn(input_line, "\r\n")] = '\0';

        if (strcmp(input_line, "q") == 0 || strcmp(input_line, "quit") == 0) {
            printf("[INFO] Exiting interactive controller.\n");
            break;
        }

        if (strcmp(input_line, "h") == 0 || strcmp(input_line, "home") == 0) {
            printf("[INFO] Sending HOME angles [0.0, 15.0, -30.0, 0.0]...\n");
            send_joint_angles(sock, server_addr, 0.0f, 15.0f, -30.0f, 0.0f);
            continue;
        }

        if (strlen(input_line) == 0) {
            continue;
        }

        /* Parse 4 floats allowing spaces or commas */
        float j1 = 0, j2 = 0, j3 = 0, j4 = 0;
        int parsed = sscanf(input_line, "%f%*[, ]%f%*[, ]%f%*[, ]%f", &j1, &j2, &j3, &j4);

        if (parsed != 4) {
            printf("[WARN] Invalid input. Please enter exactly 4 numbers. Example: 30 15 -20 45\n");
            continue;
        }

        send_joint_angles(sock, server_addr, j1, j2, j3, j4);
    }
}

int main(int argc, char *argv[]) {
    printf("--- C UDP Controller for 3D Robotic Arm Simulator ---\n");

    /* Step 1: Initialize Network Subsystem */
    if (!initialize_networking()) {
        return 1;
    }

    /* Step 2: Create a UDP Datagram Socket */
    /* AF_INET = IPv4 Internet protocols, SOCK_DGRAM = Connectionless UDP datagram */
    SOCKET sock = socket(AF_INET, SOCK_DGRAM, IPPROTO_UDP);
    if (sock == INVALID_SOCKET) {
        fprintf(stderr, "[ERROR] Failed to create UDP socket.\n");
        cleanup_networking();
        return 1;
    }

    /* Step 3: Configure Destination Address */
    struct sockaddr_in server_addr;
    memset(&server_addr, 0, sizeof(server_addr));
    server_addr.sin_family = AF_INET;

    /* 
     * htons() converts port number from host byte order (little-endian on x86/x64)
     * to network byte order (big-endian), which is required by internet protocols.
     */
    server_addr.sin_port = htons(DEFAULT_PORT);

    /* Convert IP string "127.0.0.1" to binary in network byte order */
#ifdef _WIN32
    server_addr.sin_addr.s_addr = inet_addr(DEFAULT_HOST);
#else
    if (inet_pton(AF_INET, DEFAULT_HOST, &server_addr.sin_addr) <= 0) {
        fprintf(stderr, "[ERROR] Invalid IP address format: %s\n", DEFAULT_HOST);
        CLOSE_SOCKET(sock);
        cleanup_networking();
        return 1;
    }
#endif

    printf("[INFO] Target UDP Server: %s:%d\n", DEFAULT_HOST, DEFAULT_PORT);

    /* Step 4: Handle Command-Line Arguments or Launch Interactive Mode */
    if (argc == 5) {
        /* Direct CLI command: ./robot_controller <J1> <J2> <J3> <J4> */
        float j1 = (float)atof(argv[1]);
        float j2 = (float)atof(argv[2]);
        float j3 = (float)atof(argv[3]);
        float j4 = (float)atof(argv[4]);
        printf("[INFO] CLI mode: Sending single packet (%.1f, %.1f, %.1f, %.1f)...\n", j1, j2, j3, j4);
        send_joint_angles(sock, &server_addr, j1, j2, j3, j4);
    } else if (argc == 2) {
        /* Direct CLI comma format: ./robot_controller "30,15,-20,45" */
        float j1 = 0, j2 = 0, j3 = 0, j4 = 0;
        int parsed = sscanf(argv[1], "%f,%f,%f,%f", &j1, &j2, &j3, &j4);
        if (parsed == 4) {
            printf("[INFO] CLI mode: Sending single packet (%.1f, %.1f, %.1f, %.1f)...\n", j1, j2, j3, j4);
            send_joint_angles(sock, &server_addr, j1, j2, j3, j4);
        } else {
            printf("[WARN] Could not parse 4 values from '%s'. Starting interactive mode.\n", argv[1]);
            run_interactive_mode(sock, &server_addr);
        }
    } else {
        /* Default: Interactive terminal prompt */
        run_interactive_mode(sock, &server_addr);
    }

    /* Step 5: Clean Socket Shutdown */
    CLOSE_SOCKET(sock);
    cleanup_networking();
    printf("[INFO] Controller closed cleanly.\n");
    return 0;
}
