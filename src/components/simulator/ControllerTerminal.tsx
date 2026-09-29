import React, { useState, useRef, useEffect } from 'react';
import type { RobotConfig } from '@/lib/robotics';
import { parsePacket } from '@/lib/robotics';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Terminal, Send, Play, RefreshCw, AlertTriangle, Zap, Trash2 } from 'lucide-react';

interface ControllerTerminalProps {
  config: RobotConfig;
  onSendPacket: (angles: [number, number, number, number], rawString: string, wasClamped: boolean) => void;
  onInvalidPacket: (rawString: string, error: string) => void;
}

interface LogEntry {
  id: string;
  timestamp: string;
  type: 'tx' | 'rx' | 'error' | 'info' | 'warn';
  message: string;
  bytes?: number;
}

export const ControllerTerminal: React.FC<ControllerTerminalProps> = ({
  config,
  onSendPacket,
  onInvalidPacket,
}) => {
  const [inputVal, setInputVal] = useState<string>('30, 15, -20, 45');
  const [logs, setLogs] = useState<LogEntry[]>([
    {
      id: 'init-1',
      timestamp: new Date().toLocaleTimeString(),
      type: 'info',
      message: `[C Client Initialized] Socket opened targeting ${config.network.host}:${config.network.port}`,
    },
    {
      id: 'init-2',
      timestamp: new Date().toLocaleTimeString(),
      type: 'info',
      message: 'Ready. Type J1,J2,J3,J4 or click a quick action below to test packet dispatch.',
    },
  ]);
  const [isFlooding, setIsFlooding] = useState<boolean>(false);
  const logContainerRef = useRef<HTMLDivElement | null>(null);

  // Auto-scroll terminal log
  useEffect(() => {
    if (logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  }, [logs]);

  const addLog = (type: LogEntry['type'], message: string, bytes?: number) => {
    const entry: LogEntry = {
      id: `${Date.now()}-${Math.random()}`,
      timestamp: new Date().toLocaleTimeString(),
      type,
      message,
      bytes,
    };
    setLogs(prev => [...prev.slice(-100), entry]);
  };

  // Transmit command packet
  const handleTransmit = (rawText: string) => {
    const timeStr = new Date().toLocaleTimeString();
    const result = parsePacket(rawText, config);

    if (result.success && result.clampedAngles) {
      addLog(
        'tx',
        `sendto(${config.network.host}:${config.network.port}) -> "${rawText}" [${result.byteSize} bytes]`,
        result.byteSize
      );

      if (result.wasClamped) {
        addLog(
          'warn',
          `[CLAMPED] Angles exceeded mechanical limits. Adjusted to [${result.clampedAngles.join(', ')}]`
        );
      }

      onSendPacket(result.clampedAngles, rawText, result.wasClamped);
    } else {
      addLog('tx', `sendto(${config.network.host}:${config.network.port}) -> "${rawText}" [${result.byteSize} bytes]`);
      addLog('error', `[MALFORMED REJECTED] ${result.errorMessage}`);
      onInvalidPacket(rawText, result.errorMessage || 'Malformed packet');
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputVal.trim()) return;
    handleTransmit(inputVal);
  };

  // Simulate High-Frequency Packet Flood / Burst
  const handleSimulateBurst = async () => {
    if (isFlooding) return;
    setIsFlooding(true);
    addLog('info', '[BURST TEST] Dispatching rapid sequence of 12 kinematic waypoint packets...');

    const baseAngles = [0, 15, -30, 0];
    const steps = 12;

    for (let i = 1; i <= steps; i++) {
      const j1 = Math.round(baseAngles[0] + (45 / steps) * i);
      const j2 = Math.round(baseAngles[1] + (25 / steps) * i);
      const j3 = Math.round(baseAngles[2] - (20 / steps) * i);
      const j4 = Math.round(baseAngles[3] + (40 / steps) * i);
      const packetStr = `${j1},${j2},${j3},${j4}`;

      handleTransmit(packetStr);
      await new Promise(r => setTimeout(r, 60)); // ~16 packets/sec burst
    }

    addLog('info', '[BURST TEST COMPLETED] 12 packets dispatched cleanly without receiver latency.');
    setIsFlooding(false);
  };

  return (
    <div className="calm-panel flex flex-col h-full border border-border">
      {/* Terminal Title Bar */}
      <div className="flex items-center justify-between border-b border-border px-3 py-2 bg-background/50">
        <div className="flex items-center gap-2">
          <Terminal className="h-4 w-4 text-primary" />
          <span className="text-xs font-mono font-semibold uppercase tracking-wider">
            C UDP Controller Terminal (Winsock / POSIX)
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setLogs([])}
            title="Clear Terminal Logs"
            className="h-6 px-2 text-xs text-muted-foreground hover:text-foreground"
          >
            <Trash2 className="h-3 w-3 mr-1" />
            Clear
          </Button>
        </div>
      </div>

      {/* Terminal Output Log Window */}
      <div
        ref={logContainerRef}
        className="flex-1 p-3 font-mono text-[11px] space-y-1 overflow-y-auto bg-black/60 min-h-[160px] max-h-[220px]"
      >
        {logs.map(log => {
          let color = 'text-muted-foreground';
          if (log.type === 'tx') color = 'text-primary';
          else if (log.type === 'error') color = 'text-destructive';
          else if (log.type === 'warn') color = 'text-amber-400';
          else if (log.type === 'info') color = 'text-emerald-400';

          return (
            <div key={log.id} className="leading-tight flex items-start gap-2">
              <span className="text-muted-foreground/60 shrink-0">[{log.timestamp}]</span>
              <span className={color}>{log.message}</span>
            </div>
          );
        })}
      </div>

      {/* Quick Action Presets & Test Buttons */}
      <div className="p-2 border-t border-border bg-background/30 flex flex-wrap gap-1.5 text-xs">
        <Button
          size="sm"
          variant="outline"
          onClick={() => {
            setInputVal('30, 15, -20, 45');
            handleTransmit('30, 15, -20, 45');
          }}
          className="h-7 text-xs font-mono border-input hover:text-primary hover:border-primary"
        >
          <Play className="h-3 w-3 mr-1 text-primary" />
          Valid Pose (30,15,-20,45)
        </Button>

        <Button
          size="sm"
          variant="outline"
          onClick={() => {
            setInputVal('0, 15, -30, 0');
            handleTransmit('0, 15, -30, 0');
          }}
          className="h-7 text-xs font-mono border-input hover:text-primary hover:border-primary"
        >
          <RefreshCw className="h-3 w-3 mr-1" />
          Home (0,15,-30,0)
        </Button>

        <Button
          size="sm"
          variant="outline"
          onClick={() => {
            setInputVal('0, 140, -200, 45');
            handleTransmit('0, 140, -200, 45');
          }}
          className="h-7 text-xs font-mono border-input text-amber-400 hover:text-amber-300"
          title="Test soft limit clamping on Shoulder and Elbow"
        >
          <AlertTriangle className="h-3 w-3 mr-1" />
          Test Clamping
        </Button>

        <Button
          size="sm"
          variant="outline"
          onClick={() => {
            setInputVal('10, 20');
            handleTransmit('10, 20');
          }}
          className="h-7 text-xs font-mono border-input text-destructive hover:text-red-400"
          title="Test malformed packet with 2 tokens instead of 4"
        >
          Malformed (2 Tokens)
        </Button>

        <Button
          size="sm"
          variant="outline"
          onClick={() => {
            setInputVal('hello, 15, -20, 45');
            handleTransmit('hello, 15, -20, 45');
          }}
          className="h-7 text-xs font-mono border-input text-destructive hover:text-red-400"
          title="Test non-numeric token parsing error"
        >
          Non-Numeric
        </Button>

        <Button
          size="sm"
          variant="outline"
          disabled={isFlooding}
          onClick={handleSimulateBurst}
          className="h-7 text-xs font-mono border-input text-primary hover:bg-primary/10 ml-auto"
        >
          <Zap className="h-3 w-3 mr-1" />
          {isFlooding ? 'Flooding...' : 'Simulate Flood (12 Pkts)'}
        </Button>
      </div>

      {/* Input Box for custom packet transmission */}
      <form onSubmit={handleSubmit} className="flex gap-2 p-2 border-t border-border bg-background/50">
        <Input
          value={inputVal}
          onChange={e => setInputVal(e.target.value)}
          placeholder="e.g. 30,15,-20,45 or 30 15 -20 45"
          className="font-mono text-xs h-8 bg-background border-input"
        />
        <Button type="submit" size="sm" className="h-8 px-3 font-mono text-xs">
          <Send className="h-3.5 w-3.5 mr-1" />
          sendto()
        </Button>
      </form>
    </div>
  );
};
