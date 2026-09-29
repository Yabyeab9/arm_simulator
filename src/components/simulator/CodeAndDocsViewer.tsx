import React, { useState } from 'react';
import { EMBEDDED_FILES, INTERVIEW_QUESTIONS } from '@/lib/codebaseFiles';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from '@/components/ui/accordion';
import { Badge } from '@/components/ui/badge';
import { Code, BookOpen, HelpCircle, FileText, CheckCircle2 } from 'lucide-react';

export const CodeAndDocsViewer: React.FC = () => {
  const [selectedFile, setSelectedFile] = useState<string>(EMBEDDED_FILES[0].path);

  const activeFileObj = EMBEDDED_FILES.find(f => f.path === selectedFile) || EMBEDDED_FILES[0];

  return (
    <div className="calm-panel p-4 space-y-4">
      <Tabs defaultValue="code" className="w-full">
        <div className="flex items-center justify-between border-b border-border pb-2">
          <TabsList className="bg-background/50 border border-border">
            <TabsTrigger value="code" className="text-xs gap-1.5 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              <Code className="h-3.5 w-3.5" />
              Source Code Explorer
            </TabsTrigger>
            <TabsTrigger value="interview" className="text-xs gap-1.5 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              <HelpCircle className="h-3.5 w-3.5" />
              20 Interview Q&As
            </TabsTrigger>
            <TabsTrigger value="architecture" className="text-xs gap-1.5 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              <BookOpen className="h-3.5 w-3.5" />
              Architecture & Packet Trace
            </TabsTrigger>
          </TabsList>
        </div>

        {/* Tab 1: Source Code Explorer */}
        <TabsContent value="code" className="space-y-3 pt-2">
          {/* File Picker Buttons */}
          <div className="flex flex-wrap gap-1.5">
            {EMBEDDED_FILES.map(file => (
              <button
                key={file.path}
                type="button"
                onClick={() => setSelectedFile(file.path)}
                className={`px-2.5 py-1 text-xs font-mono border transition-colors flex items-center gap-1.5 ${
                  selectedFile === file.path
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-border bg-background/40 text-muted-foreground hover:text-foreground hover:border-input'
                }`}
              >
                <FileText className="h-3 w-3" />
                <span>{file.name}</span>
                <span className="text-[10px] opacity-60">({file.language})</span>
              </button>
            ))}
          </div>

          <div className="text-xs text-muted-foreground bg-background/30 p-2 border border-border font-mono">
            <span>{activeFileObj.description}</span>
          </div>

          {/* Code Display Area */}
          <pre className="p-3 bg-black/80 border border-border text-xs font-mono overflow-x-auto text-emerald-400 max-h-[380px] leading-relaxed selection:bg-primary/30">
            <code>{activeFileObj.content}</code>
          </pre>
        </TabsContent>

        {/* Tab 2: 20 Interview Q&As */}
        <TabsContent value="interview" className="space-y-3 pt-2">
          <div className="text-xs text-muted-foreground bg-background/30 p-2 border border-border font-mono">
            <span>Essential technical questions covering UDP vs. TCP, thread safety, htons(), Forward Kinematics, and scene graphs:</span>
          </div>

          <Accordion type="single" collapsible className="w-full space-y-1.5">
            {INTERVIEW_QUESTIONS.map(q => (
              <AccordionItem key={q.id} value={`item-${q.id}`} className="border border-border bg-background/40 px-3">
                <AccordionTrigger className="text-xs font-mono hover:no-underline py-2.5 text-left">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-[10px] px-1 py-0 border-primary/50 text-primary">
                      {q.category}
                    </Badge>
                    <span className="text-foreground">{q.id}. {q.question}</span>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="text-xs font-mono text-muted-foreground pb-3 pt-1 border-t border-border/50 leading-relaxed">
                  <div className="flex items-start gap-2 text-foreground/90">
                    <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
                    <span>{q.answer}</span>
                  </div>
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </TabsContent>

        {/* Tab 3: Architecture & Packet Trace */}
        <TabsContent value="architecture" className="space-y-3 pt-2 font-mono text-xs">
          <div className="bg-background/40 border border-border p-3 space-y-2">
            <h4 className="text-primary font-semibold uppercase">End-to-End Packet Trace (`30,15,-20,45`)</h4>
            <div className="space-y-1.5 text-muted-foreground leading-relaxed">
              <p><strong className="text-foreground">Step 1 (C Input):</strong> `sscanf()` reads `30 15 -20 45` from user terminal.</p>
              <p><strong className="text-foreground">Step 2 (C Formatting):</strong> `snprintf()` creates ASCII payload `"30.0,15.0,-20.0,45.0"` (20 bytes).</p>
              <p><strong className="text-foreground">Step 3 (Dispatch):</strong> `sendto()` transmits UDP packet targeting `127.0.0.1:5005` with `htons(5005)`.</p>
              <p><strong className="text-foreground">Step 4 (Python Background Thread):</strong> `socket.recvfrom()` unblocks in `udp_server.py` without stalling the 60 FPS rendering loop.</p>
              <p><strong className="text-foreground">Step 5 (Parsing & Clamping):</strong> `ProtocolParser` splits into 4 tokens, parses floats, and clamps against joint limits.</p>
              <p><strong className="text-foreground">Step 6 (Atomic Update):</strong> Protected by `threading.Lock`, `latest_angles` is updated.</p>
              <p><strong className="text-foreground">Step 7 (Render Loop):</strong> `main.py` fetches angles and updates Ursina 3D hierarchical pivots.</p>
              <p><strong className="text-foreground">Step 8 (Forward Kinematics):</strong> Real-time tip coordinate $(X, Y, Z)$ is computed via trigonometry and displayed on HUD.</p>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};
