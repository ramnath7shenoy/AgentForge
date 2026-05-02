"use client";

import React, { useEffect, useState } from "react";
import { useFlowStore } from "@/stores/flowStore";
import { NodeData } from "@/types/flowStoreTypes";
import {
  Split,
  Settings,
  Terminal,
  Zap,
  Brain,
  MessageSquare,
  Plus,
  Trash2,
  Database,
  ShieldCheck,
  Clock,
  Code,
  Upload,
  Globe,
  Briefcase,
  ShieldAlert,
  PlugZap
} from "lucide-react";
import { cn } from "@/lib/utils";
import VaultInput from "@/components/ui/VaultInput";
import { APP_REGISTRY, getApp, getAction } from "@/lib/providers";

interface NodeSettingsSidebarProps {
  isOwner?: boolean;
}

// Provider and model selection are handled JIT by the Reactive Engine.
// The engine reads the vault key prefix (gsk_ → Groq, sk- → OpenAI, AIza → Gemini)
// and auto-selects the best model. No manual config needed per node.

const NodeSettingsSidebar: React.FC<NodeSettingsSidebarProps> = ({ isOwner = true }) => {
  const nodes = useFlowStore((state) => state.nodes);
  const selectedNodeId = useFlowStore((state) => state.selectedNodeId);
  const setNodes = useFlowStore((state) => state.setNodes);
  const theme = useFlowStore((state) => state.theme);
  const tutorialStep = useFlowStore((state) => state.tutorialStep);
  const setTutorialStep = useFlowStore((state) => state.setTutorialStep);
  const currentContext = useFlowStore((state) => state.currentContext);
  const executionLogs = useFlowStore((state) => state.executionLogs);
  const updateNodeData = useFlowStore((state) => state.updateNodeData);
  const executionResult = (useFlowStore((state) => (state as any).executionResult) || {}) as Record<string, any>;

  const selectedNode = nodes.find((n) => n.id === selectedNodeId) || null;
  const [sidebarTab, setSidebarTab] = React.useState<"settings" | "data">("settings");
  const [apiKeySaved, setApiKeySaved] = React.useState(false);

  // Force settings tab for guests
  React.useEffect(() => {
    if (!isOwner && sidebarTab === "data") {
      setSidebarTab("settings");
    }
  }, [isOwner, sidebarTab]);

  // Connection status for the selected appProvider — must be here (before early return) to obey Rules of Hooks
  const [appConnected, setAppConnected] = React.useState<boolean | null>(null);
  const appProviderKey = selectedNode?.type === "appaction" ? (selectedNode.data.appProvider || "") : "";
  React.useEffect(() => {
    if (!appProviderKey) { setAppConnected(null); return; }
    import("@/app/actions/integration").then(({ getIntegrations }) =>
      getIntegrations().then((res) => {
        setAppConnected((res.integrations ?? []).some((i) => i.provider === appProviderKey));
      })
    );
  }, [appProviderKey]);

  if (!selectedNode) {
    return (
      <div className={cn(
        "w-full h-full p-6 flex flex-col items-center justify-center text-center transition-colors duration-300 border-l mb-2",
        "bg-card border-border text-muted-foreground"
      )}>
        <Settings size={24} className="mb-2 opacity-20" />
        <p className="italic text-sm">Select a tool to configure</p>
      </div>
    );
  }

  const renderInputNodeSettings = () => (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2 text-blue-500">
        <Terminal size={16} />
        <h3 className="text-sm font-bold uppercase tracking-tight">Starting Point</h3>
      </div>
      <div className="flex flex-col gap-2">
        <label className="text-[10px] font-bold uppercase text-slate-500">What information are we starting with?</label>
        <p className="text-[10px] text-slate-400 italic leading-relaxed">
          Use the node on the canvas to type text or drop files directly.
        </p>
      </div>
    </div>
  );

  const renderTriggerNodeSettings = () => {
    const handleCopyWebhook = () => {
      const url = `https://agentforge.com/api/webhook/${selectedNode.id}`;
      navigator.clipboard.writeText(url);
      // Optional: Add a subtle toast or visual confirmation here if needed
    };

    return (
      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-2 text-amber-500">
          <Clock size={16} />
          <h3 className="text-sm font-bold uppercase tracking-tight">Smart Trigger</h3>
        </div>
        <div className="flex flex-col gap-2">
          <label className="text-[10px] font-bold uppercase text-slate-500">Execution Schedule (Mode)</label>
          <select
            className={cn(
              "rounded-lg p-2 text-sm focus:ring-2 focus:ring-amber-500/20 outline-none transition-all border",
              "bg-background border-border text-foreground",
              tutorialStep === 3 && "ring-4 ring-amber-500/40 animate-[pulse_1.5s_ease-in-out_infinite] shadow-[0_0_20px_rgba(245,158,11,0.5)]"
            )}
            value={selectedNode.data.schedule || "Manual"}
            onChange={(e) => {
              updateNodeData(selectedNode.id, { schedule: e.target.value });
              if (tutorialStep === 3) {
                setTutorialStep(4);
              }
            }}
          >
            <option value="Manual">Manual</option>
            <option value="Schedule">Schedule</option>
            <option value="Webhook">Webhook</option>
          </select>

          {(!selectedNode.data.schedule || selectedNode.data.schedule === "Manual") && (
            <p className="text-[10px] text-slate-400 italic leading-relaxed mt-1">
              &quot;This agent will only run when manually triggered by a user.&quot;
            </p>
          )}

          {selectedNode.data.schedule === "Schedule" && (
            <div className="flex flex-col gap-4 mt-2">
              <div className="flex flex-col gap-2">
                <label className="text-[10px] font-bold uppercase text-slate-500">Frequency</label>
                <select
                  className={cn(
                    "rounded-lg p-2 text-sm focus:ring-2 focus:ring-amber-500/20 outline-none transition-all border",
                    "bg-background border-border text-foreground"
                  )}
                  value={selectedNode.data.cron || "Every Minute"}
                  onChange={(e) => updateNodeData(selectedNode.id, { cron: e.target.value })}
                >
                  <option value="Every Minute">Every Minute</option>
                  <option value="Hourly">Hourly</option>
                  <option value="Daily">Daily</option>
                  <option value="Weekly">Weekly</option>
                </select>
              </div>

              {(selectedNode.data.cron === "Daily" || selectedNode.data.cron === "Weekly") && (
                <div className="flex flex-col gap-2 p-3 bg-muted rounded-xl border border-border">
                  {selectedNode.data.cron === "Weekly" && (
                    <div className="flex flex-col gap-2 mb-2">
                      <label className="text-[10px] font-bold uppercase text-slate-500">Run on Days</label>
                      <div className="flex flex-wrap gap-1">
                        {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(day => {
                          const currentDays = selectedNode.data.days || [];
                          const isSelected = currentDays.includes(day);
                          return (
                            <button
                              key={day}
                              onClick={() => {
                                const newDays = isSelected 
                                  ? currentDays.filter((d: string) => d !== day)
                                  : [...currentDays, day];
                                updateNodeData(selectedNode.id, { days: newDays });
                              }}
                              className={cn(
                                "px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider rounded-md border transition-all",
                                isSelected 
                                  ? "bg-amber-500 border-amber-500 text-white shadow-md shadow-amber-500/20" 
                                  : "bg-card border-border text-muted-foreground hover:text-foreground"
                              )}
                            >
                              {day}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                  
                  <div className="flex flex-col gap-2">
                    <label className="text-[10px] font-bold uppercase text-slate-500">Run at Time ({selectedNode.data.timezone || 'Local Browser Time'})</label>
                    <input
                      type="time"
                      className={cn(
                        "rounded-lg p-2 text-sm focus:ring-2 focus:ring-amber-500/20 outline-none transition-all border w-full",
                        "bg-background border-border text-foreground"
                      )}
                      value={selectedNode.data.time || "09:00"}
                      onChange={(e) => updateNodeData(selectedNode.id, { time: e.target.value })}
                    />
                  </div>
                </div>
              )}

              <div className="flex flex-col gap-2">
                <label className="text-[10px] font-bold uppercase text-slate-500">Timezone Context</label>
                <select
                  className={cn(
                    "rounded-lg p-2 text-sm focus:ring-2 focus:ring-amber-500/20 outline-none transition-all border",
                    "bg-background border-border text-foreground"
                  )}
                  value={selectedNode.data.timezone || "Local Browser Time"}
                  onChange={(e) => updateNodeData(selectedNode.id, { timezone: e.target.value })}
                >
                  <option value="Local Browser Time">Local Browser Time</option>
                  <option value="UTC">UTC (Coordinated Universal Time)</option>
                </select>
              </div>
            </div>
          )}

          {selectedNode.data.schedule === "Webhook" && (
            <div className="mt-2 p-3 bg-muted rounded-lg border border-border break-all text-xs font-mono text-muted-foreground flex flex-col gap-2 relative group">
              <span className="text-[10px] font-bold uppercase text-muted-foreground text-opacity-70">Webhook URL Generated:</span>
              <span className="pr-6">https://agentforge.com/api/webhook/{selectedNode.id}</span>
              <button 
                onClick={handleCopyWebhook}
                className="absolute right-3 top-1/2 mt-1 -translate-y-1/2 text-muted-foreground hover:text-amber-500 opacity-0 group-hover:opacity-100 transition-all font-sans text-[10px] bg-background px-2 py-1 rounded"
              >
                Copy URL
              </button>
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderWebhookNodeSettings = () => {
    const handleCopyWebhook = () => {
      const url = `https://agentforge.com/api/webhook/${selectedNode.id}`;
      navigator.clipboard.writeText(url);
    };

    return (
      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-2 text-purple-500">
          <Globe size={16} />
          <h3 className="text-sm font-bold uppercase tracking-tight">Webhook Configuration</h3>
        </div>
        <div className="flex flex-col gap-2">
          <label className="text-[10px] font-bold uppercase text-slate-500">Incoming URL</label>
          <p className="text-[10px] text-muted-foreground italic leading-relaxed">
            Send POST requests to this endpoint to trigger the flow and pass payload data.
          </p>
          <div className="mt-2 p-3 bg-muted rounded-lg border border-border break-all text-xs font-mono text-muted-foreground flex flex-col gap-2 relative group">
            <span className="text-[10px] font-bold uppercase text-muted-foreground text-opacity-70">Webhook Endpoint Generated:</span>
            <span className="pr-6">https://agentforge.com/api/webhook/{selectedNode.id}</span>
            <button 
                onClick={handleCopyWebhook}
                className="absolute right-3 top-1/2 mt-1 -translate-y-1/2 text-muted-foreground hover:text-purple-500 opacity-0 group-hover:opacity-100 transition-all font-sans text-[10px] bg-background px-2 py-1 rounded"
              >
                Copy URL
              </button>
          </div>
        </div>
        <div className="flex flex-col gap-2">
          <label className="text-[10px] font-bold uppercase text-slate-500">Webhook Secret</label>
          <VaultInput
            value={selectedNode.data.webhookID || ""}
            onChange={(val) => updateNodeData(selectedNode.id, { webhookID: val })}
            placeholder="Webhook signing secret..."
            theme={theme}
            isOwner={isOwner}
          />        </div>
      </div>
    );
  };

  const renderVaultNodeSettings = () => (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2 text-cyan-500">
        <Database size={16} />
        <h3 className="text-sm font-bold uppercase tracking-tight">Knowledge Vault</h3>
      </div>
      <div className="flex flex-col gap-2">
        <label className="text-[10px] font-bold uppercase text-slate-500">Search Query</label>
        <textarea
          rows={3}
          placeholder="What should we search for in the vault?"
          className={cn(
            "rounded-lg p-3 text-sm focus:ring-2 focus:ring-cyan-500/20 outline-none transition-all border resize-none",
            "bg-background border-border text-foreground focus:border-cyan-500"
          )}
          value={selectedNode.data.instructions || ""}
          onChange={(e) => updateNodeData(selectedNode.id, { instructions: e.target.value })}
        />
        
        <label className="text-[10px] font-bold uppercase text-slate-500 mt-2">Manage Knowledge</label>
        <button className={cn(
          "w-full flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-bold uppercase border transition-all",
          "bg-card hover:bg-muted border-border text-muted-foreground"
        )}>
           <Upload size={14} /> Upload File
        </button>
        <div className="flex flex-col gap-1 mt-2">
           <span className="text-[10px] font-bold uppercase text-slate-500">Learned Documents</span>
           <div className={cn(
             "text-xs p-3 rounded-md border italic text-center",
             "bg-background border-border text-muted-foreground"
           )}>
               No documents uploaded yet.
           </div>
        </div>
      </div>
    </div>
  );

  const renderGatekeeperNodeSettings = () => (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2 text-emerald-500">
        <ShieldCheck size={16} />
        <h3 className="text-sm font-bold uppercase tracking-tight">Safety Gatekeeper</h3>
      </div>
      <div className="flex flex-col gap-2">
        <label className="text-[10px] font-bold uppercase text-slate-500">Verification Mode</label>
        <select
          className={cn(
            "rounded-lg p-2 text-sm focus:ring-2 focus:ring-emerald-500/20 outline-none transition-all border",
            "bg-background border-border text-foreground"
          )}
          value={selectedNode.data.verification || "Critic AI"}
          onChange={(e) => updateNodeData(selectedNode.id, { verification: e.target.value })}
        >
          <option value="Critic AI">AI Critic</option>
          <option value="Human">Human Approval</option>
        </select>

        <label className="text-[10px] font-bold uppercase text-slate-500 mt-2">Rules to check</label>
        <textarea
          rows={3}
          placeholder="e.g. Ensure no PII is present in the response..."
          className={cn(
            "rounded-lg p-3 text-sm focus:ring-2 focus:ring-emerald-500/20 outline-none transition-all border resize-none",
            "bg-background border-border text-foreground focus:border-emerald-500"
          )}
          value={selectedNode.data.instructions || ""}
          onChange={(e) => updateNodeData(selectedNode.id, { instructions: e.target.value })}
        />
      </div>
    </div>
  );

  const renderProcessorNodeSettings = () => (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2 text-slate-400">
        <Code size={16} />
        <h3 className="text-sm font-bold uppercase tracking-tight">Logic Processor</h3>
      </div>
      <div className="flex flex-col gap-2">
        <label className="text-[10px] font-bold uppercase text-slate-500">Task Type</label>
        <select
          className={cn(
            "rounded-lg p-2 text-sm focus:ring-2 focus:ring-slate-500/20 outline-none transition-all border",
            "bg-background border-border text-foreground"
          )}
          value={selectedNode.data.batchLogic || "Loop through List"}
          onChange={(e) => updateNodeData(selectedNode.id, { batchLogic: e.target.value })}
        >
          <option value="Loop through List">Loop through List</option>
          <option value="Run Script">Run Script</option>
        </select>

        <label className="text-[10px] font-bold uppercase text-slate-500 mt-2">Plain English Logic</label>
        <textarea
          rows={5}
          placeholder="e.g. Extract the email address from each item..."
          className={cn(
            "rounded-lg p-3 text-sm focus:ring-2 focus:ring-slate-500/20 outline-none transition-all border resize-none font-mono",
            "bg-background border-border text-foreground focus:border-slate-500"
          )}
          value={selectedNode.data.instructions || ""}
          onChange={(e) => updateNodeData(selectedNode.id, { instructions: e.target.value })}
        />
      </div>
    </div>
  );

  const renderActionNodeSettings = () => {
    const headers: Array<{ key: string; value: string }> = selectedNode.data.headers || [];
    const authType = selectedNode.data.authType || 'none';

    const addHeader = () =>
      updateNodeData(selectedNode.id, { headers: [...headers, { key: '', value: '' }] });

    const removeHeader = (idx: number) =>
      updateNodeData(selectedNode.id, { headers: headers.filter((_, i) => i !== idx) });

    const updateHeader = (idx: number, field: 'key' | 'value', val: string) => {
      const next = headers.map((h, i) => (i === idx ? { ...h, [field]: val } : h));
      updateNodeData(selectedNode.id, { headers: next });
    };

    return (
      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-2 text-emerald-500">
          <Zap size={16} />
          <h3 className="text-sm font-bold uppercase tracking-tight">Universal Integration</h3>
        </div>

        {/* Connection Type */}
        <div className="flex flex-col gap-2">
          <label className="text-[10px] font-bold uppercase text-slate-500">Connection type</label>
          <select
            className={cn(
              "rounded-lg p-2 text-sm focus:ring-2 focus:ring-emerald-500/20 outline-none transition-all border",
              "bg-background border-border text-foreground focus:border-emerald-500"
            )}
            value={selectedNode.data.connectionType || ""}
            onChange={(e) => updateNodeData(selectedNode.id, { connectionType: e.target.value })}
          >
            <option value="">Choose an action...</option>
            <option value="REST API">REST API</option>
            <option value="Send to Slack">Send to Slack</option>
            <option value="Discord Webhook">Discord Webhook</option>
            <option value="Twitter/X API">Twitter/X API</option>
            <option value="Get from Website">Get from Website</option>
            <option value="Post to API">Post to API</option>
            <option value="Fetch Data">Fetch Data</option>
            <option value="Custom Webhook">Custom Webhook</option>
          </select>
        </div>

        {/* Method + URL row */}
        <div className="flex flex-col gap-2">
          <label className="text-[10px] font-bold uppercase text-slate-500 flex items-center gap-1">
            <Globe size={10} className="text-emerald-500" />
            Endpoint URL
            <span className="text-rose-400 ml-0.5">*</span>
          </label>
          <div className="flex gap-2">
            <select
              className={cn(
                "rounded-lg px-2 py-2 text-xs font-bold focus:ring-2 focus:ring-emerald-500/20 outline-none transition-all border flex-shrink-0 w-24",
                "bg-background border-border text-emerald-400 focus:border-emerald-500"
              )}
              value={selectedNode.data.method || "POST"}
              onChange={(e) => updateNodeData(selectedNode.id, { method: e.target.value })}
            >
              <option value="GET">GET</option>
              <option value="POST">POST</option>
              <option value="PUT">PUT</option>
              <option value="PATCH">PATCH</option>
              <option value="DELETE">DELETE</option>
            </select>
            <input
              type="url"
              className={cn(
                "flex-1 rounded-lg px-3 py-2 text-xs focus:ring-2 focus:ring-emerald-500/20 outline-none transition-all border font-mono",
                "bg-background border-border text-foreground focus:border-emerald-500",
                !selectedNode.data.url && "border-rose-500/40"
              )}
              placeholder="https://api.example.com/endpoint"
              value={selectedNode.data.url || ""}
              onChange={(e) => updateNodeData(selectedNode.id, { url: e.target.value })}
            />
          </div>
          {!selectedNode.data.url && (
            <p className="text-[10px] text-rose-400 font-medium">Required — flow will error without a URL.</p>
          )}
        </div>

        {/* Auth */}
        <div className="flex flex-col gap-2">
          <label className="text-[10px] font-bold uppercase text-slate-500">Authentication</label>
          <select
            className={cn(
              "rounded-lg p-2 text-xs focus:ring-2 focus:ring-emerald-500/20 outline-none transition-all border",
              "bg-background border-border text-foreground focus:border-emerald-500"
            )}
            value={authType}
            onChange={(e) => updateNodeData(selectedNode.id, { authType: e.target.value as any })}
          >
            <option value="none">None</option>
            <option value="bearer">Bearer Token</option>
            <option value="basic">Basic Auth</option>
          </select>
          {authType !== 'none' && (
            <VaultInput
              value={selectedNode.data.authValue || selectedNode.data.persistence || ""}
              onChange={(val) => updateNodeData(selectedNode.id, { authValue: val, persistence: val })}
              placeholder={authType === 'bearer' ? "Bearer token or vault key..." : "user:password or vault key..."}
              theme={theme}
              isOwner={isOwner}
            />
          )}
        </div>

        {/* Custom Headers */}
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <label className="text-[10px] font-bold uppercase text-slate-500">Custom Headers</label>
            <button
              onClick={addHeader}
              className="flex items-center gap-1 text-[9px] font-bold text-emerald-500 hover:text-emerald-400 transition-colors bg-emerald-500/5 px-2 py-1 rounded border border-emerald-500/20 hover:border-emerald-500/40"
            >
              <Plus size={9} />
              Add
            </button>
          </div>
          {headers.length === 0 && (
            <p className="text-[10px] text-slate-600 italic">No custom headers — Content-Type: application/json is sent by default.</p>
          )}
          {headers.map((h, i) => (
            <div key={i} className="flex gap-1.5 items-center">
              <input
                className={cn(
                  "flex-1 rounded-lg px-2 py-1.5 text-xs focus:ring-2 focus:ring-emerald-500/20 outline-none border font-mono",
                  "bg-background border-border text-foreground focus:border-emerald-500"
                )}
                placeholder="X-Header-Key"
                value={h.key}
                onChange={(e) => updateHeader(i, 'key', e.target.value)}
              />
              <input
                className={cn(
                  "flex-1 rounded-lg px-2 py-1.5 text-xs focus:ring-2 focus:ring-emerald-500/20 outline-none border",
                  "bg-background border-border text-foreground focus:border-emerald-500"
                )}
                placeholder="value or {{node-id}}"
                value={h.value}
                onChange={(e) => updateHeader(i, 'value', e.target.value)}
              />
              <button
                onClick={() => removeHeader(i)}
                className="p-1.5 text-slate-600 hover:text-rose-400 transition-colors flex-shrink-0"
              >
                <Trash2 size={11} />
              </button>
            </div>
          ))}
        </div>

        {/* Body Mapping */}
        <div className="flex flex-col gap-2">
          <label className="text-[10px] font-bold uppercase text-slate-500">Body / Payload Template</label>
          <textarea
            rows={4}
            className={cn(
              "rounded-lg p-3 text-xs focus:ring-2 focus:ring-emerald-500/20 outline-none transition-all placeholder:text-muted-foreground resize-none font-mono border",
              "bg-background border-border text-foreground"
            )}
            placeholder={'{"message": "{{r-ai-1.output}}", "source": "agentforge"}'}
            value={(selectedNode.data.bodyMapping as string) || (selectedNode.data.instructions as string) || ""}
            onChange={(e) => updateNodeData(selectedNode.id, { bodyMapping: e.target.value, instructions: e.target.value })}
          />
          <p className="text-[9px] text-slate-500 italic">
            Reference upstream nodes with <code className="font-mono bg-slate-100 dark:bg-slate-800 px-1 rounded">{"{{node-id}}"}</code> or <code className="font-mono bg-slate-100 dark:bg-slate-800 px-1 rounded">{"{{node-id.output}}"}</code>
          </p>
        </div>
      </div>
    );
  };

  const renderAINodeSettings = () => (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2 text-blue-500">
        <Brain size={16} />
        <h3 className="text-sm font-bold uppercase tracking-tight">Agent Brain</h3>
      </div>

      {/* Auto-detect badge */}
      <div className={cn(
        "flex items-center gap-2 px-3 py-2 rounded-lg border text-[10px]",
        "bg-blue-500/5 border-blue-500/20 text-blue-400"
      )}>
        <span className="font-bold">⚡ Auto</span>
        <span className="text-blue-300/70">
          Provider &amp; model resolved from your Vault key at runtime —
          no manual config needed.
        </span>
      </div>

      <div className="flex flex-col gap-2">
        <label className="text-[10px] font-bold uppercase text-slate-500">Instructions</label>
        <textarea
          rows={7}
          className={cn(
            "rounded-lg p-3 text-sm focus:ring-2 focus:ring-blue-500/20 outline-none transition-all placeholder:text-muted-foreground resize-none font-mono text-xs border",
            "bg-background border-border text-foreground"
          )}
          placeholder={"You are a helpful assistant.\n\nUser message: {{input-1}}\n\nRespond concisely."}
          value={(selectedNode.data.instructions as string) || ""}
          onChange={(e) => updateNodeData(selectedNode.id, { instructions: e.target.value })}
        />
        <p className="text-[9px] text-slate-500 italic">
          Reference upstream nodes with <code className="font-mono bg-slate-100 dark:bg-slate-800 px-1 rounded">{"{{node-id}}"}</code>
        </p>
      </div>

      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <label className="text-[10px] font-bold uppercase text-slate-500">Node-Level API Key</label>
          {apiKeySaved && (
            <span className="text-[9px] font-bold text-emerald-500 animate-pulse uppercase tracking-widest">
              ✓ Saved
            </span>
          )}
        </div>
        <p className="text-[9px] text-slate-500 italic -mt-1">
          Optional — overrides the Vault key for this node only.
        </p>
        <div className={cn(
          "transition-all duration-300 rounded-lg",
          apiKeySaved ? "ring-2 ring-emerald-500/50" : ""
        )}>
          <VaultInput
            value={selectedNode.data.apiKey || ""}
            onChange={(val) => {
              updateNodeData(selectedNode.id, { apiKey: val });
              setApiKeySaved(true);
              setTimeout(() => setApiKeySaved(false), 2000);
            }}
            placeholder="gsk_… or sk-… or AIza… (auto-detected)"
            theme={theme}
          />
        </div>
      </div>
    </div>
  );

  const renderRouterNodeSettings = () => {
    const routes = selectedNode.data.routes || ["Path A", "Path B"];

    const addRoute = () => {
      const newPath = `Path ${String.fromCharCode(65 + routes.length)}`;
      updateNodeData(selectedNode.id, { routes: [...routes, newPath] });
    };

    const removeRoute = (path: string) => {
      const newRoutes = routes.filter(r => r !== path);
      const newConditions = { ...selectedNode.data.conditions };
      delete newConditions[path];
      updateNodeData(selectedNode.id, { routes: newRoutes, conditions: newConditions });
    };

    return (
      <div className="flex flex-col gap-6">
        <div className="flex items-center justify-between text-orange-500">
          <div className="flex items-center gap-2">
            <Split size={16} />
            <h3 className="text-sm font-bold uppercase tracking-tight">Decision Logic</h3>
          </div>
          <button 
            onClick={addRoute}
            className="flex items-center gap-1 bg-orange-500 text-white px-2 py-1 rounded-lg text-[10px] font-bold shadow-lg shadow-orange-500/20 hover:bg-orange-600 transition-colors"
          >
            <Plus size={10} />
            Add Path
          </button>
        </div>

        <div className="flex flex-col gap-4">
          <label className="text-[10px] font-bold uppercase text-slate-500">Where should we go next?</label>
          {routes.map((route: string) => (
            <div key={route} className={cn(
              "flex flex-col gap-2 p-3 border rounded-xl transition-colors relative group",
              "bg-card border-border"
            )}>
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-black uppercase text-orange-500">{route}</span>
                {routes.length > 1 && (
                  <button onClick={() => removeRoute(route)} className="text-rose-500 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Trash2 size={12} />
                  </button>
                )}
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-[10px] text-slate-400 italic">Go this way if...</span>
                <textarea
                  rows={2}
                  className={cn(
                    "border rounded-md p-2 text-sm focus:ring-2 focus:ring-orange-500/20 outline-none resize-none transition-all",
                    "bg-background border-border text-foreground"
                  )}
                  value={selectedNode.data.conditions?.[route] || ""}
                  onChange={(e) => {
                    const currentConditions = selectedNode.data.conditions || {};
                    updateNodeData(selectedNode.id, {
                      conditions: { ...currentConditions, [route]: e.target.value }
                    });
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  const renderOutputNodeSettings = () => (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2 text-pink-500">
        <MessageSquare size={16} />
        <h3 className="text-sm font-bold uppercase tracking-tight">Final Result</h3>
      </div>
      <div className="flex flex-col gap-2">
        <label className="text-[10px] font-bold uppercase text-slate-500">How should the response look?</label>
        <textarea
          rows={6}
          placeholder="e.g. Hello {{name}}, your request is complete."
          className={cn(
            "rounded-lg p-3 text-sm focus:ring-2 focus:ring-pink-500/20 outline-none transition-all border resize-none",
            "bg-background border-border text-foreground focus:border-pink-500"
          )}
          value={selectedNode.data.resultFormat || ""}
          onChange={(e) => updateNodeData(selectedNode.id, { resultFormat: e.target.value })}
        />
      </div>
    </div>
  );

  const renderApprovalNodeSettings = () => (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2 text-amber-400">
        <ShieldAlert size={16} />
        <h3 className="text-sm font-bold uppercase tracking-tight">Safety Gatekeeper</h3>
      </div>
      <div className="flex flex-col gap-2">
        <label className="text-[10px] font-bold uppercase text-slate-500">Gatekeeper Message</label>
        <input
          type="text"
          placeholder="e.g. Verify email content before sending..."
          value={selectedNode.data.gatekeeperMessage || ""}
          onChange={(e) => updateNodeData(selectedNode.id, { gatekeeperMessage: e.target.value })}
          className={cn(
            "rounded-lg p-2 text-sm outline-none transition-all border focus:ring-2",
            "bg-background border-border text-foreground focus:ring-amber-500/20 focus:border-amber-500"
          )}
        />
        <p className="text-[10px] text-slate-400 italic">Displayed in the approval banner when flow pauses.</p>
      </div>
      <div className="flex flex-col gap-2">
        <label className="text-[10px] font-bold uppercase text-slate-500">Timeout (minutes)</label>
        <input
          type="number"
          min={0}
          placeholder="0 = no timeout"
          value={selectedNode.data.timeoutMinutes || ""}
          onChange={(e) => updateNodeData(selectedNode.id, { timeoutMinutes: parseInt(e.target.value) || 0 })}
          className={cn(
            "rounded-lg p-2 text-sm outline-none transition-all border focus:ring-2 w-24",
            "bg-background border-border text-foreground focus:ring-amber-500/20"
          )}
        />
      </div>
      <div className="flex flex-col gap-2">
        <label className="text-[10px] font-bold uppercase text-slate-500">Timeout Action</label>
        <select
          value={selectedNode.data.timeoutAction || "abort"}
          onChange={(e) => updateNodeData(selectedNode.id, { timeoutAction: e.target.value })}
          className={cn(
            "rounded-lg p-2 text-sm outline-none transition-all border focus:ring-2",
            "bg-background border-border text-foreground focus:ring-amber-500/20"
          )}
        >
          <option value="abort">Abort Flow</option>
          <option value="continue">Continue Execution</option>
        </select>
      </div>
    </div>
  );

  const renderSubflowNodeSettings = () => (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2 text-indigo-400">
        <Briefcase size={16} />
        <h3 className="text-sm font-bold uppercase tracking-tight">Nested Agent</h3>
      </div>
      <div className="flex flex-col gap-2">
        <label className="text-[10px] font-bold uppercase text-slate-500">Linked Agent</label>
        <div className={cn(
          "p-3 rounded-lg border text-sm",
          "bg-background border-border text-foreground"
        )}>
          {selectedNode.data.subflowName || "Sub-Agent"}
        </div>
        <p className="text-[10px] text-slate-400 italic leading-relaxed mt-1">
          This node runs the saved agent&apos;s full flow as a nested sub-flow within your pipeline.
        </p>
        <label className="text-[10px] font-bold uppercase text-slate-500 mt-2">Agent ID</label>
        <div className={cn(
          "p-2 rounded-lg border text-[10px] font-mono break-all",
          "bg-card border-border text-muted-foreground"
        )}>
          {selectedNode.data.subflowId || "N/A"}
        </div>
      </div>
    </div>
  );


  const renderAppActionNodeSettings = () => {
    const appProvider = selectedNode.data.appProvider || "";
    const appAction = selectedNode.data.appAction || "";
    const appInputs: Record<string, string> = selectedNode.data.appInputs || {};

    const app = appProvider ? getApp(appProvider) : undefined;
    const action = app && appAction ? getAction(app.id, appAction) : undefined;

    const updateInput = (key: string, value: string) =>
      updateNodeData(selectedNode.id, { appInputs: { ...appInputs, [key]: value } });

    return (
      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-2 text-violet-400">
          <PlugZap size={16} />
          <h3 className="text-sm font-bold uppercase tracking-tight">App Action</h3>
        </div>

        {/* Select App (Account) */}
        <div className="flex flex-col gap-2">
          <label className="text-[10px] font-bold uppercase text-slate-500">Select Account</label>
          <select
            className={cn(
              "rounded-lg p-2 text-sm focus:ring-2 focus:ring-violet-500/20 outline-none transition-all border",
              "bg-background border-border text-foreground focus:border-violet-500"
            )}
            value={appProvider}
            onChange={(e) => updateNodeData(selectedNode.id, { appProvider: e.target.value, appAction: "", appInputs: {} })}
          >
            <option value="">Choose an app...</option>
            {APP_REGISTRY.map((a) => (
              <option key={a.id} value={a.id}>{a.icon} {a.name}</option>
            ))}
          </select>

          {/* Connection status badge */}
          {app && appConnected !== null && (
            <div className={cn(
              "flex items-center justify-between px-2.5 py-1.5 rounded-lg border text-[10px] font-semibold",
              appConnected
                ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400"
                : "bg-rose-500/10 border-rose-500/20 text-rose-400"
            )}>
              <div className="flex items-center gap-1.5">
                <span className={cn("w-1.5 h-1.5 rounded-full", appConnected ? "bg-emerald-400" : "bg-rose-400")} />
                {appConnected ? `${app.name} connected` : `${app.name} not connected`}
              </div>
              {!appConnected && (
                <a
                  href="/dashboard/integrations"
                  target="_blank"
                  className="underline underline-offset-2 hover:text-rose-300 transition-colors"
                >
                  Connect →
                </a>
              )}
            </div>
          )}
        </div>

        {/* Select Action */}
        {app && (
          <div className="flex flex-col gap-2">
            <label className="text-[10px] font-bold uppercase text-slate-500">Select Action</label>
            <select
              className={cn(
                "rounded-lg p-2 text-sm focus:ring-2 focus:ring-violet-500/20 outline-none transition-all border",
                "bg-background border-border text-foreground focus:border-violet-500"
              )}
              value={appAction}
              onChange={(e) => updateNodeData(selectedNode.id, { appAction: e.target.value, appInputs: {} })}
            >
              <option value="">Choose an action...</option>
              {app.actions.map((a) => (
                <option key={a.id} value={a.id}>{a.label} — {a.description}</option>
              ))}
            </select>
          </div>
        )}

        {/* Dynamic Input Fields */}
        {action && (
          <div className="flex flex-col gap-3">
            <label className="text-[10px] font-bold uppercase text-slate-500">Input Mapping</label>
            <p className="text-[10px] text-muted-foreground -mt-1">
              Use <code className="bg-muted px-1 rounded text-[9px]">{"{{node-id}}"}</code> to inject upstream node output.
            </p>
            {action.fields.map((field) => (
              <div key={field.key} className="flex flex-col gap-1">
                <label className="text-[10px] font-semibold text-slate-400 flex items-center gap-1">
                  {field.label}
                  {field.required && <span className="text-rose-400">*</span>}
                </label>
                {field.type === "textarea" ? (
                  <textarea
                    rows={3}
                    className={cn(
                      "rounded-lg px-3 py-2 text-xs focus:ring-2 focus:ring-violet-500/20 outline-none transition-all border resize-none font-mono",
                      "bg-background border-border text-foreground focus:border-violet-500"
                    )}
                    placeholder={field.placeholder}
                    value={appInputs[field.key] || ""}
                    onChange={(e) => updateInput(field.key, e.target.value)}
                  />
                ) : (
                  <input
                    type="text"
                    className={cn(
                      "rounded-lg px-3 py-2 text-xs focus:ring-2 focus:ring-violet-500/20 outline-none transition-all border font-mono",
                      "bg-background border-border text-foreground focus:border-violet-500"
                    )}
                    placeholder={field.placeholder}
                    value={appInputs[field.key] || ""}
                    onChange={(e) => updateInput(field.key, e.target.value)}
                  />
                )}
              </div>
            ))}
          </div>
        )}

        {!app && (
          <div className="text-[10px] text-muted-foreground italic px-3 py-2 rounded-lg border border-dashed border-border text-center">
            Connect your apps in{" "}
            <a href="/dashboard/integrations" target="_blank" className="text-violet-400 underline underline-offset-2 hover:text-violet-300">
              Dashboard → Integrations
            </a>
            , then select one above.
          </div>
        )}
      </div>
    );
  };

  const logEntry = executionLogs?.find((l: any) => l.nodeId === selectedNode.id);
  const nodeOutput = currentContext?.nodes?.[selectedNode.id];
  const hasData = logEntry || nodeOutput;

  return (
    <div className={cn(
      "w-full h-full flex flex-col border-l transition-colors duration-300",
      "bg-card border-border text-foreground"
    )}>
      {/* Tab header */}
      <div className={cn(
        "flex items-center border-b px-6 pt-4 pb-0 gap-0",
        "border-border"
      )}>
        <button
          onClick={() => setSidebarTab("settings")}
          className={cn(
            "px-4 py-2 text-[10px] font-bold uppercase tracking-widest transition-all border-b-2 -mb-px",
            sidebarTab === "settings"
              ? "text-indigo-500 border-indigo-500"
              : "text-muted-foreground border-transparent hover:text-foreground"
          )}
        >
          Settings
        </button>
        {isOwner && (
          <button
            onClick={() => setSidebarTab("data")}
            className={cn(
              "flex items-center gap-1.5 px-4 py-2 text-[10px] font-bold uppercase tracking-widest transition-all border-b-2 -mb-px",
              sidebarTab === "data"
                ? "text-purple-500 border-purple-500"
                : "text-muted-foreground border-transparent hover:text-foreground"
            )}
          >
            Data
            {hasData && <span className="w-1.5 h-1.5 rounded-full bg-purple-400 animate-pulse" />}
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        {sidebarTab === "settings" && (
          <>
            <div className={cn(
              "flex items-center justify-between mb-8 border-b pb-4",
              "border-border"
            )}>
              <div className="flex flex-col">
                <span className="text-[10px] uppercase tracking-widest text-indigo-500 font-bold">Tool Configuration</span>
                <h2 className="text-lg font-bold capitalize">{selectedNode.type} Node</h2>
              </div>
            </div>

            <div className="mb-12">
              {selectedNode.type === "input" && renderInputNodeSettings()}
              {selectedNode.type === "trigger" && renderTriggerNodeSettings()}
              {selectedNode.type === "webhook" && renderWebhookNodeSettings()}
              {selectedNode.type === "vault" && renderVaultNodeSettings()}
              {selectedNode.type === "gatekeeper" && renderGatekeeperNodeSettings()}
              {selectedNode.type === "processor" && renderProcessorNodeSettings()}
              {selectedNode.type === "action" && renderActionNodeSettings()}
              {selectedNode.type === "appaction" && renderAppActionNodeSettings()}
              {selectedNode.type === "ai" && renderAINodeSettings()}
              {selectedNode.type === "router" && renderRouterNodeSettings()}
              {selectedNode.type === "output" && renderOutputNodeSettings()}
              {selectedNode.type === "subflow" && renderSubflowNodeSettings()}
              {selectedNode.type === "approval" && renderApprovalNodeSettings()}
            </div>

            {/* LATEST OUTPUT SECTION */}
            {selectedNodeId && executionResult[selectedNodeId] && (
              <div className="mt-8 pt-6 border-t border-border animate-in fade-in slide-in-from-bottom-2 duration-300">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Terminal size={12} className="text-green-500" />
                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Latest Output</span>
                  </div>
                  <button 
                    onClick={() => {
                      const text = typeof executionResult[selectedNodeId]?.payload === 'string' 
                        ? executionResult[selectedNodeId].payload 
                        : JSON.stringify(executionResult[selectedNodeId]?.payload || executionResult[selectedNodeId], null, 2);
                      navigator.clipboard.writeText(text);
                    }}
                    className="flex items-center gap-1 text-[10px] font-bold text-indigo-500 hover:text-indigo-400 transition-colors bg-indigo-500/5 px-2 py-1 rounded-md border border-indigo-500/10"
                  >
                    Copy Result
                  </button>
                </div>
                <div className="bg-zinc-200 dark:bg-zinc-900 rounded-xl p-4 border border-zinc-300 dark:border-zinc-800 shadow-inner group relative max-h-64 overflow-y-auto block">
                  <pre className="text-[11px] font-mono text-green-700 dark:text-green-400 whitespace-pre-wrap break-all leading-relaxed min-h-[20px]">
                    {typeof executionResult[selectedNodeId]?.payload === 'string' 
                      ? executionResult[selectedNodeId].payload 
                      : JSON.stringify(executionResult[selectedNodeId]?.payload || executionResult[selectedNodeId], null, 2)}
                  </pre>
                  <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                  </div>
                </div>
              </div>
            )}
          </>
        )}

        {sidebarTab === "data" && (
          <div className="space-y-4">
            <div className="flex flex-col mb-4">
              <span className="text-[10px] uppercase tracking-widest text-purple-400 font-bold">Execution Data</span>
              <h2 className="text-lg font-bold capitalize">{selectedNode.data.label || selectedNode.type}</h2>
            </div>

            {!hasData ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <span className="text-[10px] text-slate-600 italic">Run the flow to see this node&apos;s data</span>
              </div>
            ) : (
              <>
                {logEntry && (
                  <>
                    <div className="flex items-center gap-2 mb-3">
                      <div className={cn("w-2 h-2 rounded-full", logEntry.status === "success" ? "bg-emerald-400" : "bg-rose-400")} />
                      <span className={cn("text-[10px] font-bold uppercase", logEntry.status === "success" ? "text-emerald-400" : "text-rose-400")}>
                        {logEntry.status}
                      </span>
                      {logEntry.durationMs > 0 && <span className="text-[9px] text-slate-500 ml-auto">{logEntry.durationMs}ms</span>}
                    </div>

                    {logEntry.inputSnapshot != null && (
                      <div className="mb-3">
                        <span className="text-[9px] font-bold text-slate-500 uppercase block mb-1">Input</span>
                        <pre className={cn(
                          "text-[10px] font-mono p-3 rounded-xl border overflow-auto max-h-32",
                          theme === "dark" ? "bg-slate-900/50 border-slate-800 text-slate-400" : "bg-slate-50 border-slate-200 text-slate-600"
                        )}>
                          {typeof logEntry.inputSnapshot === "string" ? String(logEntry.inputSnapshot) : JSON.stringify(logEntry.inputSnapshot, null, 2)}
                        </pre>
                      </div>
                    )}

                    {logEntry.outputSnapshot != null && (
                      <div className="mb-3">
                        <span className="text-[9px] font-bold text-slate-500 uppercase block mb-1">Output</span>
                        <pre className={cn(
                          "text-[10px] font-mono p-3 rounded-xl border overflow-auto max-h-32",
                          "bg-background border-border text-muted-foreground"
                        )}>
                          {typeof logEntry.outputSnapshot === "string" ? String(logEntry.outputSnapshot) : JSON.stringify(logEntry.outputSnapshot, null, 2)}
                        </pre>
                      </div>
                    )}
                  </>
                )}

                {nodeOutput && !logEntry && (
                  <div>
                    <span className="text-[9px] font-bold text-slate-500 uppercase block mb-1">Node Output</span>
                    <pre className={cn(
                      "text-[10px] font-mono p-3 rounded-xl border overflow-auto max-h-40",
                      "bg-background border-border text-muted-foreground"
                    )}>
                      {typeof nodeOutput === "string" ? nodeOutput : JSON.stringify(nodeOutput, null, 2)}
                    </pre>
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default NodeSettingsSidebar;