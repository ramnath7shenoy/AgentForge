"use client";

import React from "react";
import { useFlowStore } from "@/stores/flowStore";
import { 
  Split, 
  Info, 
  Settings, 
  Terminal, 
  Zap, 
  Brain, 
  MessageSquare,
  Plus,
  Trash2,
  Database,
  ShieldCheck,
  Timer,
  Clock,
  Code
} from "lucide-react";
import { cn } from "@/lib/utils";

const NodeSettingsSidebar: React.FC = () => {
  const nodes = useFlowStore((state) => state.nodes);
  const selectedNodeId = useFlowStore((state) => state.selectedNodeId);
  const setNodes = useFlowStore((state) => state.setNodes);
  const theme = useFlowStore((state) => state.theme);

  const selectedNode = nodes.find((n) => n.id === selectedNodeId) || null;

  const updateNodeData = (id: string, newData: any) => {
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

  const renderTriggerNodeSettings = () => (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2 text-amber-500">
        <Clock size={16} />
        <h3 className="text-sm font-bold uppercase tracking-tight">Smart Trigger</h3>
      </div>
      <div className="flex flex-col gap-2">
        <label className="text-[10px] font-bold uppercase text-slate-500">Execution Schedule</label>
        <select
          className={cn(
            "rounded-lg p-2 text-sm focus:ring-2 focus:ring-amber-500/20 outline-none transition-all border",
            theme === "dark" ? "bg-slate-900 border-slate-700 text-white" : "bg-slate-50 border-slate-200 text-slate-900"
          )}
          value={selectedNode.data.schedule || "Event-driven"}
          onChange={(e) => updateNodeData(selectedNode.id, { schedule: e.target.value })}
        >
          <option value="Event-driven">On Event</option>
          <option value="Timer">Recurring Timer</option>
          <option value="Webhook">External Webhook</option>
        </select>
      </div>
    </div>
  );

  const renderVaultNodeSettings = () => (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2 text-cyan-500">
        <Database size={16} />
        <h3 className="text-sm font-bold uppercase tracking-tight">Knowledge Vault</h3>
      </div>
      <div className="flex flex-col gap-2">
        <label className="text-[10px] font-bold uppercase text-slate-500">Memory Persistence</label>
        <div className="grid grid-cols-2 gap-2">
          {["Short-term", "Long-term"].map((mode) => (
            <button
              key={mode}
              onClick={() => updateNodeData(selectedNode.id, { persistence: mode })}
              className={cn(
                "py-2 rounded-lg text-[10px] font-bold uppercase border transition-all",
                selectedNode.data.persistence === mode
                  ? "bg-cyan-500 border-cyan-500 text-white shadow-lg shadow-cyan-500/20"
                  : "bg-slate-100 dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-500"
              )}
            >
              {mode}
            </button>
          ))}
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
        <label className="text-[10px] font-bold uppercase text-slate-500">Verification Type</label>
        <select
          className={cn(
            "rounded-lg p-2 text-sm focus:ring-2 focus:ring-emerald-500/20 outline-none transition-all border",
            theme === "dark" ? "bg-slate-900 border-slate-700 text-white" : "bg-slate-50 border-slate-200 text-slate-900"
          )}
          value={selectedNode.data.verification || "Critic AI"}
          onChange={(e) => updateNodeData(selectedNode.id, { verification: e.target.value })}
        >
          <option value="Critic AI">Critic AI (Automatic)</option>
          <option value="Human">Human-in-the-loop</option>
          <option value="Rules">Strict Ruleset</option>
        </select>
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
        <label className="text-[10px] font-bold uppercase text-slate-500">Batch Logic</label>
        <div className="flex gap-2">
          {["Loop", "Code"].map((logic) => (
            <button
              key={logic}
              onClick={() => updateNodeData(selectedNode.id, { batchLogic: logic })}
              className={cn(
                "flex-1 py-2 rounded-lg text-[10px] font-bold uppercase border transition-all",
                selectedNode.data.batchLogic === logic
                  ? "bg-slate-600 border-slate-600 text-white shadow-lg shadow-slate-500/20"
                  : "bg-slate-100 dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-500"
              )}
            >
              {logic}
            </button>
          ))}
        </div>
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
      <div className="flex items-center gap-2 text-purple-500">
        <Brain size={16} />
        <h3 className="text-sm font-bold uppercase tracking-tight">Agent Brain</h3>
      </div>
      <div className="flex flex-col gap-2">
        <label className="text-[10px] font-bold uppercase text-slate-500">What should the brain focus on?</label>
        <textarea
          rows={8}
          placeholder="Give the brain specific instructions in plain English..."
          className={cn(
            "rounded-lg p-3 text-sm focus:ring-2 focus:ring-purple-500/20 outline-none transition-all border resize-none",
            theme === "dark"
              ? "bg-slate-900 border-slate-700 text-white focus:border-purple-500"
              : "bg-slate-50 border-slate-200 text-slate-900 focus:border-purple-500"
          )}
          value={selectedNode.data.instructions || ""}
          onChange={(e) => updateNodeData(selectedNode.id, { instructions: e.target.value })}
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