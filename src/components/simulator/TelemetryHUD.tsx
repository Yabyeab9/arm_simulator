import React from 'react';
import type { RobotConfig } from '@/lib/robotics';
import { calculateForwardKinematics } from '@/lib/robotics';
import { Badge } from '@/components/ui/badge';
import { Activity, Radio, Cpu, Compass, Layers } from 'lucide-react';

export type ClientActivityState = 'ACTIVE' | 'IDLE' | 'INACTIVE';

interface TelemetryHUDProps {
  angles: [number, number, number, number];
  config: RobotConfig;
  packetCount: number;
  invalidCount: number;
  lastPacket: string;
  lastPacketTime: number | null;
  serverState: string;
}

export const TelemetryHUD: React.FC<TelemetryHUDProps> = ({
  angles,
  config,
  packetCount,
  invalidCount,
  lastPacket,
  lastPacketTime,
  serverState,
}) => {
  const now = Date.now();
  const packetAgeSec = lastPacketTime ? Math.max(0, (now - lastPacketTime) / 1000) : null;

  // Determine client activity state based on packet age
  let activityState: ClientActivityState = 'INACTIVE';
  if (packetAgeSec !== null) {
    if (packetAgeSec < 2.0) {
      activityState = 'ACTIVE';
    } else if (packetAgeSec < 10.0) {
      activityState = 'IDLE';
    } else {
      activityState = 'INACTIVE';
    }
  }

  // Calculate Forward Kinematics 3D tip position
  const fkTip = calculateForwardKinematics(angles, config.link_lengths);

  const jointKeys = ['J1', 'J2', 'J3', 'J4'] as const;

  return (
    <div className="calm-panel p-4 space-y-4">
      {/* Header & Server Status */}
      <div className="flex items-center justify-between border-b border-border pb-3">
        <div className="flex items-center gap-2">
          <Cpu className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-semibold tracking-wide uppercase">Telemetry Diagnostics</h3>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="font-mono text-xs border-primary/40 text-primary">
            <Radio className="h-3 w-3 mr-1 animate-pulse text-primary" />
            {serverState} :{config.network.port}
          </Badge>
        </div>
      </div>

      {/* Network Diagnostics Cards */}
      <div className="grid grid-cols-2 gap-2 text-xs font-mono">
        <div className="bg-background/50 border border-border p-2">
          <span className="text-muted-foreground block text-[10px]">CLIENT STATUS</span>
          <div className="flex items-center gap-1.5 mt-0.5">
            <span
              className={`w-2 h-2 rounded-full ${
                activityState === 'ACTIVE'
                  ? 'bg-emerald-400 animate-ping'
                  : activityState === 'IDLE'
                  ? 'bg-amber-400'
                  : 'bg-muted-foreground/40'
              }`}
            />
            <span
              className={`font-semibold ${
                activityState === 'ACTIVE'
                  ? 'text-emerald-400'
                  : activityState === 'IDLE'
                  ? 'text-amber-400'
                  : 'text-muted-foreground'
              }`}
            >
              {activityState}
            </span>
          </div>
        </div>

        <div className="bg-background/50 border border-border p-2">
          <span className="text-muted-foreground block text-[10px]">PACKET COUNTS</span>
          <div className="flex items-baseline gap-2 mt-0.5">
            <span className="text-foreground font-semibold">{packetCount} valid</span>
            {invalidCount > 0 && (
              <span className="text-destructive text-[11px]">({invalidCount} err)</span>
            )}
          </div>
        </div>
      </div>

      {/* Last Command Received */}
      <div className="bg-background/40 border border-border p-2 font-mono text-xs space-y-1">
        <div className="flex justify-between text-[10px] text-muted-foreground">
          <span>LAST UDP PACKET</span>
          <span>{packetAgeSec !== null ? `${packetAgeSec.toFixed(1)}s ago` : 'None'}</span>
        </div>
        <div className="text-primary font-medium truncate">
          {lastPacket ? `"${lastPacket}"` : '<No packets received yet>'}
        </div>
      </div>

      {/* Joint Angles Gauges & Limits */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <Compass className="h-3.5 w-3.5 text-primary" />
            <span>JOINT ANGLES (DEGREES)</span>
          </span>
          <span className="text-[10px]">MIN / MAX</span>
        </div>

        <div className="space-y-1.5 font-mono text-xs">
          {jointKeys.map((key, idx) => {
            const angle = angles[idx];
            const limits = config.joint_limits[key];
            const range = limits.max - limits.min;
            const percentage = Math.max(0, Math.min(100, ((angle - limits.min) / range) * 100));
            const isAtLimit = Math.abs(angle - limits.min) < 0.1 || Math.abs(angle - limits.max) < 0.1;

            return (
              <div key={key} className="bg-background/30 border border-border/80 p-1.5 space-y-1">
                <div className="flex justify-between items-center text-[11px]">
                  <span className="font-medium text-foreground">
                    {key}: <span className="text-muted-foreground font-normal">{limits.name}</span>
                  </span>
                  <div className="flex items-center gap-1.5">
                    {isAtLimit && (
                      <span className="text-[9px] bg-amber-500/10 text-amber-400 px-1 border border-amber-500/20">
                        LIMIT
                      </span>
                    )}
                    <span className="font-semibold text-primary">{angle.toFixed(1)}°</span>
                  </div>
                </div>

                {/* Progress bar representing joint angle span */}
                <div className="w-full h-1 bg-border rounded-none overflow-hidden relative">
                  <div
                    className="h-full bg-primary transition-all duration-150"
                    style={{ width: `${percentage}%` }}
                  />
                </div>

                <div className="flex justify-between text-[9px] text-muted-foreground">
                  <span>{limits.min}°</span>
                  <span>{limits.max}°</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Forward Kinematics End-Effector Cartesian Coordinates */}
      <div className="border-t border-border pt-3 space-y-1.5">
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <Layers className="h-3.5 w-3.5 text-primary" />
            <span>CARTESIAN TIP POSITION</span>
          </span>
          <span className="text-[10px] text-primary">WORLD (X, Y, Z)</span>
        </div>

        <div className="grid grid-cols-3 gap-1.5 font-mono text-xs text-center">
          <div className="bg-background/60 border border-border p-1.5">
            <span className="text-[10px] text-red-400 block">X</span>
            <span className="font-semibold text-foreground">{fkTip.x}</span>
          </div>
          <div className="bg-background/60 border border-border p-1.5">
            <span className="text-[10px] text-emerald-400 block">Y</span>
            <span className="font-semibold text-foreground">{fkTip.y}</span>
          </div>
          <div className="bg-background/60 border border-border p-1.5">
            <span className="text-[10px] text-blue-400 block">Z</span>
            <span className="font-semibold text-foreground">{fkTip.z}</span>
          </div>
        </div>
      </div>
    </div>
  );
};
