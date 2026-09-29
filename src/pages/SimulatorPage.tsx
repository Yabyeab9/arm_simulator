import React, { useState, useEffect, useCallback } from 'react';
import type { RobotConfig } from '@/lib/robotics';
import { PRESET_CONFIGS } from '@/lib/robotics';
import { Robot3DCanvas } from '@/components/simulator/Robot3DCanvas';
import { TelemetryHUD } from '@/components/simulator/TelemetryHUD';
import { ControllerTerminal } from '@/components/simulator/ControllerTerminal';
import { ManualControls } from '@/components/simulator/ManualControls';
import { ConfigEditor } from '@/components/simulator/ConfigEditor';
import { CodeAndDocsViewer } from '@/components/simulator/CodeAndDocsViewer';
import { ExportModal } from '@/components/simulator/ExportModal';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { RotateCcw, Bot, Terminal, Sliders, Settings2, BookOpen } from 'lucide-react';
import { toast } from 'sonner';

export const SimulatorPage: React.FC = () => {
  const [config, setConfig] = useState<RobotConfig>(PRESET_CONFIGS.Default);
  const [angles, setAngles] = useState<[number, number, number, number]>([
    config.joint_limits.J1.home,
    config.joint_limits.J2.home,
    config.joint_limits.J3.home,
    config.joint_limits.J4.home,
  ]);

  // Telemetry metrics state
  const [packetCount, setPacketCount] = useState<number>(0);
  const [invalidCount, setInvalidCount] = useState<number>(0);
  const [lastPacket, setLastPacket] = useState<string>('');
  const [lastPacketTime, setLastPacketTime] = useState<number | null>(null);
  const [serverState] = useState<string>('LISTENING');

  // Home / Reset angles
  const handleResetHome = useCallback(() => {
    const homeAngles: [number, number, number, number] = [
      config.joint_limits.J1.home,
      config.joint_limits.J2.home,
      config.joint_limits.J3.home,
      config.joint_limits.J4.home,
    ];
    setAngles(homeAngles);
    toast.info('Robotic arm returned to HOME neutral pose');
  }, [config]);

  // Handle single joint angle change with clamping
  const handleChangeAngle = useCallback(
    (jointIndex: number, newAngle: number) => {
      setAngles(prev => {
        const next = [...prev] as [number, number, number, number];
        const keys = ['J1', 'J2', 'J3', 'J4'] as const;
        const limits = config.joint_limits[keys[jointIndex]];
        const clamped = Math.max(limits.min, Math.min(limits.max, newAngle));
        next[jointIndex] = Number(clamped.toFixed(1));
        return next;
      });
    },
    [config]
  );

  // Handle packet transmission from C controller emulator
  const handleSendPacket = (
    newAngles: [number, number, number, number],
    rawString: string,
    wasClamped: boolean
  ) => {
    setAngles(newAngles);
    setPacketCount(prev => prev + 1);
    setLastPacket(rawString);
    setLastPacketTime(Date.now());

    if (wasClamped) {
      toast.warning('Angles clamped to mechanical soft stops', {
        description: `Command: "${rawString}"`,
      });
    }
  };

  const handleInvalidPacket = (rawString: string, error: string) => {
    setInvalidCount(prev => prev + 1);
    toast.error('Malformed packet rejected', {
      description: error,
    });
  };

  // Keyboard Navigation Bindings (Q/A, W/S, E/D, R/F, H)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if user is typing in an input or textarea
      const target = e.target as HTMLElement;
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.isContentEditable)
      ) {
        return;
      }

      const key = e.key.toUpperCase();
      const step = 5;

      switch (key) {
        case 'Q':
          e.preventDefault();
          handleChangeAngle(0, angles[0] + step);
          break;
        case 'A':
          e.preventDefault();
          handleChangeAngle(0, angles[0] - step);
          break;
        case 'W':
          e.preventDefault();
          handleChangeAngle(1, angles[1] + step);
          break;
        case 'S':
          e.preventDefault();
          handleChangeAngle(1, angles[1] - step);
          break;
        case 'E':
          e.preventDefault();
          handleChangeAngle(2, angles[2] + step);
          break;
        case 'D':
          e.preventDefault();
          handleChangeAngle(2, angles[2] - step);
          break;
        case 'R':
          e.preventDefault();
          handleChangeAngle(3, angles[3] + step);
          break;
        case 'F':
          e.preventDefault();
          handleChangeAngle(3, angles[3] - step);
          break;
        case 'H':
          e.preventDefault();
          handleResetHome();
          break;
        default:
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [angles, handleChangeAngle, handleResetHome]);

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col font-sans selection:bg-primary selection:text-primary-foreground">
      {/* Top Application Header */}
      <header className="border-b border-border bg-card/60 backdrop-blur-md sticky top-0 z-30 px-4 py-2.5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 bg-primary/20 border border-primary/50 flex items-center justify-center text-primary">
            <Bot className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-base font-bold tracking-tight text-foreground flex items-center gap-2">
              3D Robotic Arm Simulator
              <span className="text-xs font-mono font-normal text-primary px-1.5 py-0.5 border border-primary/40 bg-primary/10">
                v1.0.0
              </span>
            </h1>
            <p className="text-[11px] text-muted-foreground font-mono">
              Kinematics &bull; C UDP Sockets &bull; 4-DOF Hierarchy &bull; Telemetry
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={handleResetHome}
            className="h-8 text-xs font-mono border-input hover:text-primary"
          >
            <RotateCcw className="h-3.5 w-3.5 mr-1" />
            Home (H)
          </Button>
          <ExportModal />
        </div>
      </header>

      {/* Main Workspace Layout */}
      <main className="flex-1 p-4 max-w-7xl w-full mx-auto space-y-4">
        {/* Top Split View: 3D Canvas on Left, Telemetry on Right */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
          {/* Left Column (8 cols): 3D Viewport */}
          <div className="md:col-span-8 flex flex-col space-y-4">
            <div className="w-full h-[460px] relative border border-border">
              <Robot3DCanvas angles={angles} config={config} />
            </div>

            {/* Virtual C UDP Controller Terminal below 3D Canvas */}
            <div className="w-full">
              <ControllerTerminal
                config={config}
                onSendPacket={handleSendPacket}
                onInvalidPacket={handleInvalidPacket}
              />
            </div>
          </div>

          {/* Right Column (4 cols): Telemetry HUD & Manual Sliders */}
          <div className="md:col-span-4 flex flex-col space-y-4">
            <TelemetryHUD
              angles={angles}
              config={config}
              packetCount={packetCount}
              invalidCount={invalidCount}
              lastPacket={lastPacket}
              lastPacketTime={lastPacketTime}
              serverState={serverState}
            />

            <ManualControls
              angles={angles}
              config={config}
              onChangeAngle={handleChangeAngle}
              onResetHome={handleResetHome}
            />
          </div>
        </div>

        {/* Bottom Panel: Tabbed Education & Configuration Modules */}
        <div className="w-full pt-2">
          <Tabs defaultValue="docs" className="w-full">
            <TabsList className="bg-card border border-border">
              <TabsTrigger
                value="docs"
                className="text-xs gap-1.5 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground font-mono"
              >
                <BookOpen className="h-3.5 w-3.5" />
                Educational Resources & Code Explorer
              </TabsTrigger>
              <TabsTrigger
                value="config"
                className="text-xs gap-1.5 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground font-mono"
              >
                <Settings2 className="h-3.5 w-3.5" />
                Robot Configuration & Presets
              </TabsTrigger>
            </TabsList>

            <TabsContent value="docs" className="pt-3">
              <CodeAndDocsViewer />
            </TabsContent>

            <TabsContent value="config" className="pt-3">
              <ConfigEditor
                currentConfig={config}
                onApplyConfig={newCfg => setConfig(newCfg)}
                onSelectPreset={name => {
                  const p = PRESET_CONFIGS[name];
                  if (p) setConfig(p);
                }}
              />
            </TabsContent>
          </Tabs>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-border py-3 px-4 bg-card/40 text-center text-xs text-muted-foreground font-mono mt-8">
        <span>3D Robotic Arm Simulator Learning Platform &bull; Python &bull; C &bull; Ursina 3D &bull; Standard Sockets</span>
      </footer>
    </div>
  );
};

export default SimulatorPage;
