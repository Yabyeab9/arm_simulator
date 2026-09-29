// Robotics simulation core mathematical models, presets, forward kinematics, and protocol parsing

export interface JointLimits {
  min: number;
  max: number;
  home: number;
  axis: 'x' | 'y' | 'z';
  name: string;
}

export interface LinkLengths {
  base: number;
  upper_arm: number;
  forearm: number;
  wrist: number;
  end_effector: number;
}

export interface RobotConfig {
  robot_name: string;
  network: {
    host: string;
    port: number;
    protocol: string;
  };
  link_lengths: LinkLengths;
  joint_limits: {
    J1: JointLimits;
    J2: JointLimits;
    J3: JointLimits;
    J4: JointLimits;
  };
}

export const PRESET_CONFIGS: Record<string, RobotConfig> = {
  Default: {
    robot_name: "Standard-4DOF",
    network: { host: "127.0.0.1", port: 5005, protocol: "UDP" },
    link_lengths: {
      base: 1.0,
      upper_arm: 2.2,
      forearm: 1.8,
      wrist: 0.6,
      end_effector: 0.4
    },
    joint_limits: {
      J1: { min: -180.0, max: 180.0, home: 0.0, axis: "y", name: "Base Yaw" },
      J2: { min: -90.0, max: 90.0, home: 15.0, axis: "x", name: "Shoulder Pitch" },
      J3: { min: -120.0, max: 120.0, home: -30.0, axis: "x", name: "Elbow Pitch" },
      J4: { min: -180.0, max: 180.0, home: 0.0, axis: "x", name: "Wrist Pitch" }
    }
  },
  MiniArm: {
    robot_name: "MiniArm-Compact",
    network: { host: "127.0.0.1", port: 5005, protocol: "UDP" },
    link_lengths: {
      base: 0.7,
      upper_arm: 1.4,
      forearm: 1.1,
      wrist: 0.4,
      end_effector: 0.3
    },
    joint_limits: {
      J1: { min: -150.0, max: 150.0, home: 0.0, axis: "y", name: "Base Yaw" },
      J2: { min: -75.0, max: 75.0, home: 20.0, axis: "x", name: "Shoulder Pitch" },
      J3: { min: -100.0, max: 100.0, home: -40.0, axis: "x", name: "Elbow Pitch" },
      J4: { min: -150.0, max: 150.0, home: 0.0, axis: "x", name: "Wrist Pitch" }
    }
  },
  HeavyArm: {
    robot_name: "HeavyArm-Industrial",
    network: { host: "127.0.0.1", port: 5005, protocol: "UDP" },
    link_lengths: {
      base: 1.4,
      upper_arm: 2.8,
      forearm: 2.3,
      wrist: 0.8,
      end_effector: 0.5
    },
    joint_limits: {
      J1: { min: -180.0, max: 180.0, home: 0.0, axis: "y", name: "Base Yaw" },
      J2: { min: -85.0, max: 95.0, home: 10.0, axis: "x", name: "Shoulder Pitch" },
      J3: { min: -130.0, max: 130.0, home: -25.0, axis: "x", name: "Elbow Pitch" },
      J4: { min: -180.0, max: 180.0, home: 0.0, axis: "x", name: "Wrist Pitch" }
    }
  },
  LongReach: {
    robot_name: "LongReach-Extended",
    network: { host: "127.0.0.1", port: 5005, protocol: "UDP" },
    link_lengths: {
      base: 1.2,
      upper_arm: 3.8,
      forearm: 3.2,
      wrist: 0.7,
      end_effector: 0.4
    },
    joint_limits: {
      J1: { min: -180.0, max: 180.0, home: 0.0, axis: "y", name: "Base Yaw" },
      J2: { min: -60.0, max: 80.0, home: 15.0, axis: "x", name: "Shoulder Pitch" },
      J3: { min: -110.0, max: 110.0, home: -35.0, axis: "x", name: "Elbow Pitch" },
      J4: { min: -180.0, max: 180.0, home: 10.0, axis: "x", name: "Wrist Pitch" }
    }
  }
};

export interface ParseResult {
  success: boolean;
  rawString: string;
  parsedAngles: [number, number, number, number] | null;
  clampedAngles: [number, number, number, number] | null;
  wasClamped: boolean;
  clampedIndices: number[];
  errorMessage?: string;
  byteSize: number;
}

/**
 * Validates and parses an ASCII angle packet 'J1,J2,J3,J4'
 */
export function parsePacket(rawText: string, config: RobotConfig): ParseResult {
  const byteSize = new TextEncoder().encode(rawText).length;
  const trimmed = rawText.trim();
  
  if (!trimmed) {
    return {
      success: false,
      rawString: rawText,
      parsedAngles: null,
      clampedAngles: null,
      wasClamped: false,
      clampedIndices: [],
      errorMessage: "Empty datagram payload received",
      byteSize
    };
  }

  // Support both comma-separated and space-separated inputs in the terminal
  const tokens = trimmed.includes(",")
    ? trimmed.split(",").map(t => t.trim())
    : trimmed.split(/\s+/).map(t => t.trim());

  if (tokens.length !== 4) {
    return {
      success: false,
      rawString: rawText,
      parsedAngles: null,
      clampedAngles: null,
      wasClamped: false,
      clampedIndices: [],
      errorMessage: `Expected exactly 4 values (J1,J2,J3,J4), but received ${tokens.length} token(s)`,
      byteSize
    };
  }

  const parsed: number[] = [];
  for (let i = 0; i < 4; i++) {
    const val = Number(tokens[i]);
    if (Number.isNaN(val) || !Number.isFinite(val)) {
      return {
        success: false,
        rawString: rawText,
        parsedAngles: null,
        clampedAngles: null,
        wasClamped: false,
        clampedIndices: [],
        errorMessage: `Field ${i + 1} ('${tokens[i]}') is non-numeric; expected valid degrees as float`,
        byteSize
      };
    }
    parsed.push(val);
  }

  const jointKeys = ["J1", "J2", "J3", "J4"] as const;
  const clamped: number[] = [];
  let wasClamped = false;
  const clampedIndices: number[] = [];

  for (let i = 0; i < 4; i++) {
    const key = jointKeys[i];
    const limits = config.joint_limits[key];
    const original = parsed[i];
    const val = Math.max(limits.min, Math.min(limits.max, original));
    if (Math.abs(val - original) > 1e-4) {
      wasClamped = true;
      clampedIndices.push(i);
    }
    clamped.push(val);
  }

  return {
    success: true,
    rawString: rawText,
    parsedAngles: [parsed[0], parsed[1], parsed[2], parsed[3]],
    clampedAngles: [clamped[0], clamped[1], clamped[2], clamped[3]],
    wasClamped,
    clampedIndices,
    byteSize
  };
}

/**
 * Calculates 3D Cartesian coordinates of the End Effector tip via Forward Kinematics
 */
export function calculateForwardKinematics(
  angles: [number, number, number, number],
  linkLengths: LinkLengths
): { x: number; y: number; z: number; pitchAngle: number } {
  const [j1, j2, j3, j4] = angles;
  const toRad = Math.PI / 180;

  const theta1 = j1 * toRad;
  const theta2 = j2 * toRad;
  const theta3 = (j2 + j3) * toRad;
  const theta4 = (j2 + j3 + j4) * toRad;

  // Planar vertical accumulation of pitch links
  const y =
    linkLengths.base +
    linkLengths.upper_arm * Math.cos(theta2) +
    linkLengths.forearm * Math.cos(theta3) +
    (linkLengths.wrist + linkLengths.end_effector) * Math.cos(theta4);

  const r =
    linkLengths.upper_arm * Math.sin(theta2) +
    linkLengths.forearm * Math.sin(theta3) +
    (linkLengths.wrist + linkLengths.end_effector) * Math.sin(theta4);

  // Azimuthal rotation around Base Yaw (J1)
  const x = r * Math.sin(theta1);
  const z = r * Math.cos(theta1);

  return {
    x: Number(x.toFixed(3)),
    y: Number(y.toFixed(3)),
    z: Number(z.toFixed(3)),
    pitchAngle: Number((j2 + j3 + j4).toFixed(1))
  };
}
