"use client";

import React from "react";
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
  Globe
} from "lucide-react";
import { cn } from "@/lib/utils";

const NodeSettingsSidebar: React.FC = () => {
  const nodes = useFlowStore((state) => state.nodes);
  const selectedNodeId = useFlowStore((state) => state.selectedNodeId);
  const setNodes = useFlowStore((state) => state.setNodes);
  const theme = useFlowStore((state) => state.theme);
  const tutorialStep = useFlowStore((state) => state.tutorialStep);
  const setTutorialStep = useFlowStore((state) => state.setTutorialStep);

  const selectedNode = nodes.find((n) => n.id === selectedNodeId) || null;

  const updateNodeData = (id: string, newData: Partial<NodeData>) => {
    setNodes(
      nodes.map((node) =>
        node.id === id ? { ...node, data: { ...node.data, ...newData } } : node
      )
    );
  };

  if (!selectedNode) {
    return (
      <div className={cn(
        "w-full h-full p-6 flex flex-col items-center justify-center text-center transition-colors duration-300 border-l",
        theme === "dark" ? "bg-[#0b0e14] border-slate-800 text-slate-500" : "bg-white border-slate-200 text-slate-400"
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
              theme === "dark" ? "bg-slate-900 border-slate-700 text-white" : "bg-slate-50 border-slate-200 text-slate-900"
            )}
            value={selectedNode.data.schedule || "Manual"}
            onChange={(e) => updateNodeData(selectedNode.id, { schedule: e.target.value })}
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
                    theme === "dark" ? "bg-slate-900 border-slate-700 text-white" : "bg-slate-50 border-slate-200 text-slate-900"
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
                <div className="flex flex-col gap-2 p-3 bg-slate-100 dark:bg-slate-900/50 rounded-xl border border-slate-200 dark:border-slate-800">
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
                                  : theme === "dark" 
                                    ? "bg-slate-800 border-slate-700 text-slate-400 hover:text-slate-200" 
                                    : "bg-white border-slate-200 text-slate-500 hover:text-slate-800"
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
                        theme === "dark" ? "bg-slate-900 border-slate-700 text-white" : "bg-white border-slate-200 text-slate-900"
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
                    theme === "dark" ? "bg-slate-900 border-slate-700 text-white" : "bg-slate-50 border-slate-200 text-slate-900"
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
            <div className="mt-2 p-3 bg-slate-100 dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800 break-all text-xs font-mono text-slate-500 flex flex-col gap-2 relative group">
              <span className="text-[10px] font-bold uppercase text-slate-400">Webhook URL Generated:</span>
              <span className="pr-6">https://agentforge.com/api/webhook/{selectedNode.id}</span>
              <button 
                onClick={handleCopyWebhook}
                className="absolute right-3 top-1/2 mt-1 -translate-y-1/2 text-slate-400 hover:text-amber-500 opacity-0 group-hover:opacity-100 transition-all font-sans text-[10px] bg-slate-200 dark:bg-slate-800 px-2 py-1 rounded"
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
          <p className="text-[10px] text-slate-400 italic leading-relaxed">
            Send POST requests to this endpoint to trigger the flow and pass payload data.
          </p>
          <div className="mt-2 p-3 bg-slate-100 dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800 break-all text-xs font-mono text-slate-500 flex flex-col gap-2 relative group">
            <span className="text-[10px] font-bold uppercase text-slate-400">Webhook Endpoint Generated:</span>
            <span className="pr-6">https://agentforge.com/api/webhook/{selectedNode.id}</span>
            <button 
                onClick={handleCopyWebhook}
                className="absolute right-3 top-1/2 mt-1 -translate-y-1/2 text-slate-400 hover:text-purple-500 opacity-0 group-hover:opacity-100 transition-all font-sans text-[10px] bg-slate-200 dark:bg-slate-800 px-2 py-1 rounded"
              >
                Copy URL
              </button>
          </div>
        </div>
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
            theme === "dark" ? "bg-slate-900 border-slate-700 text-white focus:border-cyan-500" : "bg-slate-50 border-slate-200 text-slate-900 focus:border-cyan-500"
          )}
          value={selectedNode.data.instructions || ""}
          onChange={(e) => updateNodeData(selectedNode.id, { instructions: e.target.value })}
        />
        
        <label className="text-[10px] font-bold uppercase text-slate-500 mt-2">Manage Knowledge</label>
        <button className={cn(
          "w-full flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-bold uppercase border transition-all",
          theme === "dark" ? "bg-slate-900 hover:bg-slate-800 border-slate-700 text-slate-400" : "bg-slate-100 hover:bg-slate-200 border-slate-200 text-slate-600"
        )}>
           <Upload size={14} /> Upload File
        </button>
        <div className="flex flex-col gap-1 mt-2">
           <span className="text-[10px] font-bold uppercase text-slate-500">Learned Documents</span>
           <div className={cn(
             "text-xs p-3 rounded-md border italic text-center",
             theme === "dark" ? "bg-slate-900/50 border-slate-800 text-slate-500" : "bg-slate-50 border-slate-200 text-slate-400"
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
            theme === "dark" ? "bg-slate-900 border-slate-700 text-white" : "bg-slate-50 border-slate-200 text-slate-900"
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
            theme === "dark" ? "bg-slate-900 border-slate-700 text-white focus:border-emerald-500" : "bg-slate-50 border-slate-200 text-slate-900 focus:border-emerald-500"
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
            theme === "dark" ? "bg-slate-900 border-slate-700 text-white" : "bg-slate-50 border-slate-200 text-slate-900"
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
            theme === "dark" ? "bg-[#05070a] border-slate-800 text-white focus:border-slate-500" : "bg-white border-slate-200 text-slate-900 focus:border-slate-500"
          )}
          value={selectedNode.data.instructions || ""}
          onChange={(e) => updateNodeData(selectedNode.id, { instructions: e.target.value })}
        />
      </div>
    </div>
  );

  const renderActionNodeSettings = () => (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2 text-emerald-500">
        <Zap size={16} />
        <h3 className="text-sm font-bold uppercase tracking-tight">Integration</h3>
      </div>
      <div className="flex flex-col gap-2">
        <label className="text-[10px] font-bold uppercase text-slate-500">What are we doing here?</label>
        <select
          className={cn(
            "rounded-lg p-2 text-sm focus:ring-2 focus:ring-emerald-500/20 outline-none transition-all border",
            theme === "dark"
              ? "bg-slate-900 border-slate-700 text-white focus:border-emerald-500"
              : "bg-slate-50 border-slate-200 text-slate-900 focus:border-emerald-500"
          )}
          value={selectedNode.data.connectionType || ""}
          onChange={(e) => updateNodeData(selectedNode.id, { connectionType: e.target.value })}
        >
          <option value="">Choose an action...</option>
          <option value="Send to Slack">Send to Slack</option>
          <option value="Get from Website">Get from Website</option>
          <option value="Post to API">Post to API</option>
          <option value="Fetch Data">Fetch Data</option>
        </select>
      </div>
    </div>
  );

  const renderAINodeSettings = () => (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2 text-blue-500">
        <Brain size={16} />
        <h3 className="text-sm font-bold uppercase tracking-tight">Agent Brain</h3>
      </div>
      <div className="flex flex-col gap-2 relative">
        <label className="text-[10px] font-bold uppercase text-slate-500">Assistant Instructions</label>
        <textarea
          rows={4}
          className={cn(
            "rounded-lg p-3 text-sm focus:ring-2 focus:ring-blue-500/20 outline-none transition-all placeholder:text-slate-400 dark:placeholder:text-slate-600 resize-none font-mono text-xs border relative z-10",
            theme === "dark" ? "bg-slate-900 border-slate-700 text-white" : "bg-slate-50 border-slate-200 text-slate-900"
          )}
          placeholder="e.g. You are a helpful assistant..."
          value={(selectedNode.data.instructions as string) || ""}
          onChange={(e) => {
            updateNodeData(selectedNode.id, { instructions: e.target.value });
          }}
        />
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
              theme === "dark" ? "bg-slate-900/50 border-slate-800" : "bg-slate-50 border-slate-200"
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
                    theme === "dark" ? "bg-[#05070a] border-slate-800 text-white" : "bg-white border-slate-200"
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
            theme === "dark"
              ? "bg-slate-900 border-slate-700 text-white focus:border-pink-500"
              : "bg-slate-50 border-slate-200 text-slate-900 focus:border-pink-500"
          )}
          value={selectedNode.data.resultFormat || ""}
          onChange={(e) => updateNodeData(selectedNode.id, { resultFormat: e.target.value })}
        />
      </div>
    </div>
  );

  return (
    <div className={cn(
      "w-full h-full p-6 overflow-y-auto border-l transition-colors duration-300",
      theme === "dark" ? "bg-[#0b0e14] border-slate-800 text-white" : "bg-white border-slate-200 text-slate-900"
    )}>
      <div className={cn(
        "flex items-center justify-between mb-8 border-b pb-4",
        theme === "dark" ? "border-slate-800" : "border-slate-200"
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
        {selectedNode.type === "ai" && renderAINodeSettings()}
        {selectedNode.type === "router" && renderRouterNodeSettings()}
        {selectedNode.type === "output" && renderOutputNodeSettings()}
      </div>
    </div>
  );
};

export default NodeSettingsSidebar;