import React from 'react';
import type { RobotConfig } from '@/lib/robotics';
import { Slider } from '@/components/ui/slider';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { RotateCcw, Sliders, Keyboard } from 'lucide-react';

interface ManualControlsProps {
  angles: [number, number, number, number];
  config: RobotConfig;
  onChangeAngle: (jointIndex: number, newAngle: number) => void;
  onResetHome: () => void;
}

export const ManualControls: React.FC<ManualControlsProps> = ({
  angles,
  config,
  onChangeAngle,
  onResetHome,
}) => {
  const jointKeys = ['J1', 'J2', 'J3', 'J4'] as const;
  const keyboardHints = [
    { keyPositive: 'Q', keyNegative: 'A', label: 'J1 (Base Yaw)' },
    { keyPositive: 'W', keyNegative: 'S', label: 'J2 (Shoulder Pitch)' },
    { keyPositive: 'E', keyNegative: 'D', label: 'J3 (Elbow Pitch)' },
    { keyPositive: 'R', keyNegative: 'F', label: 'J4 (Wrist Pitch)' },
  ];

  return (
    <div className="calm-panel p-4 space-y-4">
      <div className="flex items-center justify-between border-b border-border pb-3">
        <div className="flex items-center gap-2">
          <Sliders className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-semibold tracking-wide uppercase">Manual Joint Controls</h3>
        </div>
        <Button
          size="sm"
          variant="outline"
          onClick={onResetHome}
          className="h-7 text-xs border-input hover:text-primary hover:border-primary"
        >
          <RotateCcw className="h-3 w-3 mr-1" />
          Home / Reset (H)
        </Button>
      </div>

      {/* 4 Joint Sliders & Steppers */}
      <div className="space-y-3 font-mono">
        {jointKeys.map((key, idx) => {
          const limits = config.joint_limits[key];
          const currentVal = angles[idx];
          const isAtMin = currentVal <= limits.min;
          const isAtMax = currentVal >= limits.max;

          return (
            <div key={key} className="bg-background/40 border border-border p-2.5 space-y-2">
              <div className="flex justify-between items-center text-xs">
                <div className="flex items-center gap-1.5">
                  <span className="font-semibold text-foreground">{key}</span>
                  <span className="text-muted-foreground text-[11px]">({limits.name})</span>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className="font-mono text-xs px-1.5 py-0">
                    {currentVal.toFixed(1)}°
                  </Badge>
                  <div className="flex items-center gap-1">
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={isAtMin}
                      onClick={() => onChangeAngle(idx, currentVal - 5)}
                      className="h-5 w-6 p-0 text-xs border border-border hover:text-primary"
                      title="Step -5°"
                    >
                      -5°
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={isAtMax}
                      onClick={() => onChangeAngle(idx, currentVal + 5)}
                      className="h-5 w-6 p-0 text-xs border border-border hover:text-primary"
                      title="Step +5°"
                    >
                      +5°
                    </Button>
                  </div>
                </div>
              </div>

              {/* Slider */}
              <div className="pt-1">
                <Slider
                  value={[currentVal]}
                  min={limits.min}
                  max={limits.max}
                  step={0.5}
                  onValueChange={vals => onChangeAngle(idx, vals[0])}
                  className="cursor-pointer"
                />
              </div>

              <div className="flex justify-between text-[10px] text-muted-foreground">
                <span>Min: {limits.min}°</span>
                <span>Home: {limits.home}°</span>
                <span>Max: {limits.max}°</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Keyboard Shortcut Legend */}
      <div className="border-t border-border pt-3 space-y-2">
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Keyboard className="h-3.5 w-3.5 text-primary" />
          <span className="font-semibold text-[11px] tracking-wider uppercase">Keyboard Hotkeys</span>
        </div>
        <div className="grid grid-cols-2 gap-2 text-[11px] font-mono">
          {keyboardHints.map(hint => (
            <div key={hint.label} className="bg-background/30 border border-border/80 px-2 py-1 flex justify-between items-center">
              <span className="text-muted-foreground truncate">{hint.label}</span>
              <span className="text-primary font-semibold">
                [{hint.keyPositive}/{hint.keyNegative}]
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
