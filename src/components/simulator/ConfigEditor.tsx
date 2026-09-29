import React, { useState } from 'react';
import type { RobotConfig } from '@/lib/robotics';
import { PRESET_CONFIGS } from '@/lib/robotics';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Settings2, Check, RefreshCw, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';

interface ConfigEditorProps {
  currentConfig: RobotConfig;
  onApplyConfig: (config: RobotConfig) => void;
  onSelectPreset: (presetName: string) => void;
}

export const ConfigEditor: React.FC<ConfigEditorProps> = ({
  currentConfig,
  onApplyConfig,
  onSelectPreset,
}) => {
  const [jsonText, setJsonText] = useState<string>(
    JSON.stringify(currentConfig, null, 2)
  );
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Synchronize when currentConfig updates from preset selector
  const handlePresetClick = (name: string) => {
    onSelectPreset(name);
    const cfg = PRESET_CONFIGS[name];
    if (cfg) {
      setJsonText(JSON.stringify(cfg, null, 2));
      setErrorMsg(null);
      toast.success(`Applied '${name}' configuration preset`);
    }
  };

  const handleApply = () => {
    try {
      const parsed = JSON.parse(jsonText);
      // Basic schema validation
      if (!parsed.robot_name || !parsed.link_lengths || !parsed.joint_limits) {
        throw new Error("Missing required root keys ('robot_name', 'link_lengths', 'joint_limits')");
      }
      setErrorMsg(null);
      onApplyConfig(parsed);
      toast.success('Configuration updated and verified successfully');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Invalid JSON syntax';
      setErrorMsg(msg);
      toast.error(`Configuration error: ${msg}`);
    }
  };

  const handleReset = () => {
    const def = PRESET_CONFIGS.Default;
    setJsonText(JSON.stringify(def, null, 2));
    setErrorMsg(null);
    onApplyConfig(def);
    toast.info('Reverted to default configuration');
  };

  return (
    <div className="calm-panel p-4 space-y-4">
      {/* Title & Preset Buttons */}
      <div className="flex flex-col gap-2 border-b border-border pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Settings2 className="h-4 w-4 text-primary" />
            <h3 className="text-sm font-semibold tracking-wide uppercase">Robot Configuration (JSON)</h3>
          </div>
          <Button
            size="sm"
            variant="ghost"
            onClick={handleReset}
            className="h-7 text-xs text-muted-foreground hover:text-foreground"
            title="Reset to default"
          >
            <RefreshCw className="h-3 w-3 mr-1" />
            Reset Default
          </Button>
        </div>

        {/* Quick Presets */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-xs text-muted-foreground font-mono mr-1">Presets:</span>
          {Object.keys(PRESET_CONFIGS).map(name => {
            const isSelected = currentConfig.robot_name === PRESET_CONFIGS[name].robot_name;
            return (
              <Button
                key={name}
                size="sm"
                variant={isSelected ? 'default' : 'outline'}
                onClick={() => handlePresetClick(name)}
                className={`h-6 px-2.5 text-xs font-mono ${
                  isSelected ? 'bg-primary text-primary-foreground' : 'border-input hover:text-primary'
                }`}
              >
                {name}
              </Button>
            );
          })}
        </div>
      </div>

      {/* JSON Code Textarea */}
      <div className="space-y-2">
        <Textarea
          value={jsonText}
          onChange={e => {
            setJsonText(e.target.value);
            setErrorMsg(null);
          }}
          rows={14}
          className="font-mono text-xs bg-black/60 border-input leading-relaxed p-2.5 selection:bg-primary/30"
          placeholder="Paste or edit robot configuration JSON..."
        />

        {errorMsg && (
          <div className="flex items-center gap-2 text-xs text-destructive bg-destructive/10 border border-destructive/30 p-2 font-mono">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}
      </div>

      <div className="flex justify-end gap-2">
        <Button size="sm" onClick={handleApply} className="text-xs font-mono">
          <Check className="h-3.5 w-3.5 mr-1" />
          Validate & Apply Configuration
        </Button>
      </div>
    </div>
  );
};
