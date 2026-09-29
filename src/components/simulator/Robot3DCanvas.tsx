import React, { useEffect, useRef, useState, useCallback } from 'react';
import type { RobotConfig } from '@/lib/robotics';
import { calculateForwardKinematics } from '@/lib/robotics';
import { Button } from '@/components/ui/button';
import { RotateCcw, ZoomIn, ZoomOut, Maximize2 } from 'lucide-react';

interface Robot3DCanvasProps {
  angles: [number, number, number, number];
  config: RobotConfig;
  onResetCamera?: () => void;
}

// 3D Vector & Matrix helper types
interface Vector3 {
  x: number;
  y: number;
  z: number;
}

interface Point2D {
  x: number;
  y: number;
  depth: number;
}

export const Robot3DCanvas: React.FC<Robot3DCanvasProps> = ({
  angles,
  config,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Camera Orbit & Pan State
  const [cameraAngle, setCameraAngle] = useState<{ yaw: number; pitch: number }>({
    yaw: 40,
    pitch: 24,
  });
  const [cameraDistance, setCameraDistance] = useState<number>(11);
  const [cameraPan, setCameraPan] = useState<{ x: number; y: number }>({ x: 0, y: -0.5 });
  const isDragging = useRef<boolean>(false);
  const dragButton = useRef<number>(0);
  const lastMousePos = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  // Forward Kinematics calculation for tip position
  const tipPos = calculateForwardKinematics(angles, config.link_lengths);

  // Reset Camera View
  const handleResetCamera = useCallback(() => {
    setCameraAngle({ yaw: 40, pitch: 24 });
    setCameraDistance(11);
    setCameraPan({ x: 0, y: -0.5 });
  }, []);

  // 3D Perspective Projection Function
  const project3D = useCallback(
    (point: Vector3, width: number, height: number): Point2D => {
      const yawRad = (cameraAngle.yaw * Math.PI) / 180;
      const pitchRad = (cameraAngle.pitch * Math.PI) / 180;

      // Translate by pan offset
      const px = point.x - cameraPan.x;
      const py = point.y - cameraPan.y;
      const pz = point.z;

      // 1. Rotate around Y (Yaw)
      const cosY = Math.cos(yawRad);
      const sinY = Math.sin(yawRad);
      const x1 = px * cosY - pz * sinY;
      const z1 = px * sinY + pz * cosY;
      const y1 = py;

      // 2. Rotate around X (Pitch)
      const cosP = Math.cos(pitchRad);
      const sinP = Math.sin(pitchRad);
      const y2 = y1 * cosP - z1 * sinP;
      const z2 = y1 * sinP + z1 * cosP;
      const x2 = x1;

      // 3. Perspective division
      const fov = 650;
      const depth = z2 + cameraDistance;
      const safeDepth = Math.max(depth, 0.1);
      const scale = fov / safeDepth;

      return {
        x: width / 2 + x2 * scale,
        y: height / 2 - y2 * scale,
        depth: safeDepth,
      };
    },
    [cameraAngle, cameraDistance, cameraPan]
  );

  // Render loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Handle high-DPI displays
    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);

    const width = rect.width;
    const height = rect.height;

    // Clear canvas with subtle radial vignette
    const bgGrad = ctx.createRadialGradient(
      width / 2,
      height / 2,
      50,
      width / 2,
      height / 2,
      width * 0.7
    );
    bgGrad.addColorStop(0, '#0F172A');
    bgGrad.addColorStop(1, '#070A12');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, width, height);

    // 1. Draw 3D Ground Grid
    const gridSize = 6;
    const gridStep = 1.0;
    ctx.lineWidth = 1;

    for (let x = -gridSize; x <= gridSize; x += gridStep) {
      const pStart = project3D({ x, y: 0, z: -gridSize }, width, height);
      const pEnd = project3D({ x, y: 0, z: gridSize }, width, height);
      ctx.strokeStyle = x === 0 ? 'rgba(75, 85, 99, 0.5)' : 'rgba(31, 41, 55, 0.4)';
      ctx.beginPath();
      ctx.moveTo(pStart.x, pStart.y);
      ctx.lineTo(pEnd.x, pEnd.y);
      ctx.stroke();
    }

    for (let z = -gridSize; z <= gridSize; z += gridStep) {
      const pStart = project3D({ x: -gridSize, y: 0, z }, width, height);
      const pEnd = project3D({ x: gridSize, y: 0, z }, width, height);
      ctx.strokeStyle = z === 0 ? 'rgba(75, 85, 99, 0.5)' : 'rgba(31, 41, 55, 0.4)';
      ctx.beginPath();
      ctx.moveTo(pStart.x, pStart.y);
      ctx.lineTo(pEnd.x, pEnd.y);
      ctx.stroke();
    }

    // Concentric reach circles on ground
    const reachRadii = [2.0, 4.0, 6.0];
    for (const r of reachRadii) {
      ctx.strokeStyle = 'rgba(56, 189, 248, 0.15)';
      ctx.beginPath();
      const segments = 48;
      for (let i = 0; i <= segments; i++) {
        const rad = (i / segments) * Math.PI * 2;
        const pt = project3D({ x: r * Math.sin(rad), y: 0, z: r * Math.cos(rad) }, width, height);
        if (i === 0) ctx.moveTo(pt.x, pt.y);
        else ctx.lineTo(pt.x, pt.y);
      }
      ctx.stroke();
    }

    // Draw Coordinate Axes Origin
    const origin2D = project3D({ x: 0, y: 0, z: 0 }, width, height);
    const xEnd = project3D({ x: 1.5, y: 0, z: 0 }, width, height);
    const yEnd = project3D({ x: 0, y: 1.5, z: 0 }, width, height);
    const zEnd = project3D({ x: 0, y: 0, z: 1.5 }, width, height);

    ctx.lineWidth = 2;
    // X Axis - Red
    ctx.strokeStyle = '#EF4444';
    ctx.beginPath();
    ctx.moveTo(origin2D.x, origin2D.y);
    ctx.lineTo(xEnd.x, xEnd.y);
    ctx.stroke();

    // Y Axis - Green (Up)
    ctx.strokeStyle = '#10B981';
    ctx.beginPath();
    ctx.moveTo(origin2D.x, origin2D.y);
    ctx.lineTo(yEnd.x, yEnd.y);
    ctx.stroke();

    // Z Axis - Blue
    ctx.strokeStyle = '#3B82F6';
    ctx.beginPath();
    ctx.moveTo(origin2D.x, origin2D.y);
    ctx.lineTo(zEnd.x, zEnd.y);
    ctx.stroke();

    // 2. Compute 3D Kinematic Chain Positions
    const [j1, j2, j3, j4] = angles;
    const toRad = Math.PI / 180;
    const theta1 = j1 * toRad;
    const theta2 = j2 * toRad;
    const theta3 = (j2 + j3) * toRad;
    const theta4 = (j2 + j3 + j4) * toRad;

    // Joint 1: Base origin
    const pBase: Vector3 = { x: 0, y: 0, z: 0 };
    const pShoulder: Vector3 = { x: 0, y: config.link_lengths.base, z: 0 };

    // Joint 2 -> Joint 3 (Upper Arm)
    const rElbow = config.link_lengths.upper_arm * Math.sin(theta2);
    const yElbow = pShoulder.y + config.link_lengths.upper_arm * Math.cos(theta2);
    const pElbow: Vector3 = {
      x: rElbow * Math.sin(theta1),
      y: yElbow,
      z: rElbow * Math.cos(theta1),
    };

    // Joint 3 -> Joint 4 (Forearm)
    const rWrist = rElbow + config.link_lengths.forearm * Math.sin(theta3);
    const yWrist = yElbow + config.link_lengths.forearm * Math.cos(theta3);
    const pWrist: Vector3 = {
      x: rWrist * Math.sin(theta1),
      y: yWrist,
      z: rWrist * Math.cos(theta1),
    };

    // Joint 4 -> Gripper Tip (Wrist + Gripper)
    const rTip = rWrist + (config.link_lengths.wrist + config.link_lengths.end_effector) * Math.sin(theta4);
    const yTip = yWrist + (config.link_lengths.wrist + config.link_lengths.end_effector) * Math.cos(theta4);
    const pTip: Vector3 = {
      x: rTip * Math.sin(theta1),
      y: yTip,
      z: rTip * Math.cos(theta1),
    };

    // Gripper finger endpoints
    const fingerLength = config.link_lengths.end_effector * 0.7;
    const fingerSpread = 0.25;
    const perpYaw = theta1 + Math.PI / 2;
    const leftFinger: Vector3 = {
      x: pTip.x + fingerSpread * Math.sin(perpYaw),
      y: pTip.y + fingerLength * 0.2,
      z: pTip.z + fingerSpread * Math.cos(perpYaw),
    };
    const rightFinger: Vector3 = {
      x: pTip.x - fingerSpread * Math.sin(perpYaw),
      y: pTip.y + fingerLength * 0.2,
      z: pTip.z - fingerSpread * Math.cos(perpYaw),
    };

    // Project points to 2D
    const ptBase = project3D(pBase, width, height);
    const ptShoulder = project3D(pShoulder, width, height);
    const ptElbow = project3D(pElbow, width, height);
    const ptWrist = project3D(pWrist, width, height);
    const ptTip = project3D(pTip, width, height);
    const ptLeftFinger = project3D(leftFinger, width, height);
    const ptRightFinger = project3D(rightFinger, width, height);

    // Tip projection shadow on ground
    const pTipGround: Vector3 = { x: pTip.x, y: 0, z: pTip.z };
    const ptTipGround = project3D(pTipGround, width, height);

    // Draw tip ground projection line
    ctx.setLineDash([4, 4]);
    ctx.lineWidth = 1;
    ctx.strokeStyle = 'rgba(14, 165, 233, 0.4)';
    ctx.beginPath();
    ctx.moveTo(ptTip.x, ptTip.y);
    ctx.lineTo(ptTipGround.x, ptTipGround.y);
    ctx.stroke();
    ctx.setLineDash([]);

    // Draw ground target disc
    ctx.fillStyle = 'rgba(14, 165, 233, 0.2)';
    ctx.beginPath();
    ctx.arc(ptTipGround.x, ptTipGround.y, 6, 0, Math.PI * 2);
    ctx.fill();

    // 3. Render 3D Arm Structure with Cylinders & Joints

    // Draw Helper: Link with cylindrical visual styling
    const drawCylinderLink = (
      p1: Point2D,
      p2: Point2D,
      radius: number,
      colorGradStart: string,
      colorGradEnd: string
    ) => {
      ctx.lineWidth = radius * 2;
      ctx.lineCap = 'round';
      ctx.strokeStyle = colorGradStart;
      ctx.beginPath();
      ctx.moveTo(p1.x, p1.y);
      ctx.lineTo(p2.x, p2.y);
      ctx.stroke();

      // Inner highlight line for metallic 3D lighting reflection
      ctx.lineWidth = Math.max(1, radius * 0.6);
      ctx.strokeStyle = colorGradEnd;
      ctx.beginPath();
      ctx.moveTo(p1.x - 1, p1.y - 1);
      ctx.lineTo(p2.x - 1, p2.y - 1);
      ctx.stroke();
    };

    // Draw Joint Pivot Spheres
    const drawJointPivot = (p: Point2D, radius: number, label: string) => {
      const grad = ctx.createRadialGradient(p.x - 2, p.y - 2, 1, p.x, p.y, radius);
      grad.addColorStop(0, '#0284C7');
      grad.addColorStop(0.7, '#0369A1');
      grad.addColorStop(1, '#0C4A6E');

      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(p.x, p.y, radius, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = '#38BDF8';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Label badge
      ctx.font = '10px Montserrat, sans-serif';
      ctx.fillStyle = '#E0F2FE';
      ctx.textAlign = 'center';
      ctx.fillText(label, p.x, p.y - radius - 4);
    };

    // Link 1: Base Platform to Shoulder (Y-axis pedestal)
    drawCylinderLink(ptBase, ptShoulder, 14, '#1E293B', '#334155');

    // Joint 1: Base Pivot
    drawJointPivot(ptBase, 12, 'J1 (Base)');

    // Joint 2: Shoulder Pivot
    drawJointPivot(ptShoulder, 11, 'J2 (Shoulder)');

    // Link 2: Upper Arm (Shoulder -> Elbow)
    drawCylinderLink(ptShoulder, ptElbow, 11, '#334155', '#64748B');

    // Joint 3: Elbow Pivot
    drawJointPivot(ptElbow, 10, 'J3 (Elbow)');

    // Link 3: Forearm (Elbow -> Wrist)
    drawCylinderLink(ptElbow, ptWrist, 9, '#475569', '#94A3B8');

    // Joint 4: Wrist Pivot
    drawJointPivot(ptWrist, 8, 'J4 (Wrist)');

    // Link 4: Wrist to Gripper Hub
    drawCylinderLink(ptWrist, ptTip, 6, '#0284C7', '#38BDF8');

    // Draw Gripper Fingers
    ctx.lineWidth = 4;
    ctx.strokeStyle = '#38BDF8';
    ctx.lineCap = 'round';
    // Left Finger
    ctx.beginPath();
    ctx.moveTo(ptTip.x, ptTip.y);
    ctx.lineTo(ptLeftFinger.x, ptLeftFinger.y);
    ctx.stroke();

    // Right Finger
    ctx.beginPath();
    ctx.moveTo(ptTip.x, ptTip.y);
    ctx.lineTo(ptRightFinger.x, ptRightFinger.y);
    ctx.stroke();

    // End Effector Tip Reticle & Coordinates Callout
    ctx.fillStyle = '#0284C7';
    ctx.beginPath();
    ctx.arc(ptTip.x, ptTip.y, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#E0F2FE';
    ctx.lineWidth = 2;
    ctx.stroke();

    // End Effector Tooltip Callout
    const calloutText = `Tip: (${tipPos.x}, ${tipPos.y}, ${tipPos.z})`;
    ctx.font = '11px monospace';
    const textWidth = ctx.measureText(calloutText).width;
    const boxX = ptTip.x + 10;
    const boxY = ptTip.y - 20;

    ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
    ctx.strokeStyle = '#0284C7';
    ctx.lineWidth = 1;
    ctx.fillRect(boxX - 4, boxY - 12, textWidth + 8, 18);
    ctx.strokeRect(boxX - 4, boxY - 12, textWidth + 8, 18);

    ctx.fillStyle = '#38BDF8';
    ctx.textAlign = 'left';
    ctx.fillText(calloutText, boxX, boxY);
  }, [angles, config, project3D, tipPos]);

  // Mouse Interaction Handlers for 3D Orbit & Pan
  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    isDragging.current = true;
    dragButton.current = e.button;
    lastMousePos.current = { x: e.clientX, y: e.clientY };
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDragging.current) return;
    const deltaX = e.clientX - lastMousePos.current.x;
    const deltaY = e.clientY - lastMousePos.current.y;
    lastMousePos.current = { x: e.clientX, y: e.clientY };

    if (dragButton.current === 0) {
      // Left button: Orbit (Yaw & Pitch)
      setCameraAngle(prev => ({
        yaw: (prev.yaw + deltaX * 0.5) % 360,
        pitch: Math.max(-80, Math.min(80, prev.pitch + deltaY * 0.5)),
      }));
    } else if (dragButton.current === 2 || e.shiftKey) {
      // Right button or Shift+Drag: Pan
      setCameraPan(prev => ({
        x: prev.x - deltaX * 0.015,
        y: prev.y + deltaY * 0.015,
      }));
    }
  };

  const handleMouseUp = () => {
    isDragging.current = false;
  };

  const handleWheel = (e: React.WheelEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    setCameraDistance(prev => Math.max(4, Math.min(25, prev + e.deltaY * 0.01)));
  };

  return (
    <div className="relative w-full h-full min-h-[420px] bg-card border border-border overflow-hidden select-none">
      <canvas
        ref={canvasRef}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onWheel={handleWheel}
        onContextMenu={e => e.preventDefault()}
        className="w-full h-full cursor-grab active:cursor-grabbing block"
      />

      {/* Floating Viewport Overlay Controls */}
      <div className="absolute top-3 right-3 flex items-center gap-1.5 bg-background/80 backdrop-blur-sm border border-border p-1">
        <Button
          size="sm"
          variant="ghost"
          onClick={() => setCameraDistance(prev => Math.max(4, prev - 1.5))}
          title="Zoom In"
          className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground"
        >
          <ZoomIn className="h-4 w-4" />
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => setCameraDistance(prev => Math.min(25, prev + 1.5))}
          title="Zoom Out"
          className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground"
        >
          <ZoomOut className="h-4 w-4" />
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={handleResetCamera}
          title="Reset Camera View"
          className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground"
        >
          <RotateCcw className="h-4 w-4" />
        </Button>
      </div>

      {/* Viewport Info Watermark */}
      <div className="absolute bottom-3 left-3 text-[11px] font-mono text-muted-foreground bg-background/70 px-2 py-1 border border-border/50 pointer-events-none">
        <span>Orbit: Left Drag | Pan: Right Drag / Shift+Drag | Zoom: Wheel</span>
      </div>

      {/* Current Model Badge */}
      <div className="absolute top-3 left-3 flex items-center gap-2 bg-background/80 backdrop-blur-sm px-2.5 py-1 border border-border text-xs font-mono">
        <span className="w-2 h-2 bg-primary rounded-full animate-pulse" />
        <span className="text-foreground font-medium">{config.robot_name}</span>
        <span className="text-muted-foreground">| 4-DOF Hierarchy</span>
      </div>
    </div>
  );
};
