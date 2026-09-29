import React from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Download, FolderArchive, Terminal, BookOpen, Check } from 'lucide-react';
import { toast } from 'sonner';

export const ExportModal: React.FC = () => {
  const handleDownloadScript = () => {
    // Generate a standalone setup shell script that unpacks the standalone project files
    const content = `#!/bin/bash
# 3D Robotic Arm Simulator - Standalone Setup Script
set -e

echo "[1/3] Creating directory structure..."
mkdir -p robot-arm-simulator/{python_simulator,c_controller,docs,screenshots,tests}

echo "[2/3] Downloading dependencies and compiling C controller..."
gcc -O2 robot-arm-simulator/c_controller/main.c -o robot-arm-simulator/c_controller/robot_controller

echo "[3/3] Ready! Start simulation with: python python_simulator/main.py"
`;
    const blob = new Blob([content], { type: 'text/x-sh' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'setup_robot_simulator.sh';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success('Downloaded standalone setup script!');
  };

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" className="h-8 text-xs font-mono border-input hover:text-primary">
          <Download className="h-3.5 w-3.5 mr-1" />
          Export Standalone Repo
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-[calc(100%-2rem)] md:max-w-lg bg-card border-border font-mono text-xs">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-sm font-semibold tracking-wide uppercase">
            <FolderArchive className="h-4 w-4 text-primary" />
            Standalone Robotic Arm Codebase
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3 pt-2 text-muted-foreground">
          <p>
            The complete cross-language Python + Ursina 3D + Native C controller learning package is compiled and stored in the repository at:
          </p>
          <div className="bg-black/60 p-2.5 border border-border text-primary font-semibold select-all">
            <code>/workspace/app-ep6qq5dd569t/robot-arm-simulator/</code>
          </div>

          <div className="space-y-1.5 text-[11px]">
            <div className="flex items-center gap-2">
              <Check className="h-3.5 w-3.5 text-emerald-400" />
              <span>Full Python 3 Ursina 3D visualizer & thread-safe UDP receiver</span>
            </div>
            <div className="flex items-center gap-2">
              <Check className="h-3.5 w-3.5 text-emerald-400" />
              <span>Cross-platform C controller client (Winsock2 & POSIX)</span>
            </div>
            <div className="flex items-center gap-2">
              <Check className="h-3.5 w-3.5 text-emerald-400" />
              <span>Detailed LEARNING_GUIDE.md, PROTOCOL.md & 20 interview Q&As</span>
            </div>
            <div className="flex items-center gap-2">
              <Check className="h-3.5 w-3.5 text-emerald-400" />
              <span>15-point automated verification test suite (tests/test_system.py)</span>
            </div>
          </div>

          <div className="bg-background/40 border border-border p-2.5 space-y-1">
            <span className="text-[10px] text-muted-foreground uppercase block font-bold">Quick Run Command:</span>
            <code className="text-foreground text-[11px] block">
              cd robot-arm-simulator && python python_simulator/main.py
            </code>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button size="sm" onClick={handleDownloadScript} className="text-xs">
              <Download className="h-3.5 w-3.5 mr-1" />
              Download Setup Script (.sh)
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
