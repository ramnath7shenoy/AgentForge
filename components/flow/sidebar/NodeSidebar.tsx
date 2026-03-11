"use client";

import React, { useState, useEffect } from "react";
import { 
  Zap, 
  Brain, 
  Split, 
  Play, 
  MessageSquare, 
  Save, 
  Upload,
  Trash2,
  Search,
  Database,
  ShieldCheck,
  Terminal,
  Globe,
  Briefcase,
  X,
  Lock,
  Plus,
  Layers,
  LayoutGrid
} from "lucide-react";
import { useFlowStore } from "@/stores/flowStore";
import { useRouter } from "next/navigation";
import {
  downloadFlowJson,
  parseFlowJson,
  serializeFlow,
} from "@/lib/flowPersistence";
import { getSavedAgents, saveAgent, deleteSavedAgent, SavedAgent } from "@/lib/savedAgents";
import { useVaultStore } from "@/stores/vaultStore";
import { cn } from "@/lib/utils";

const categories = [
  {
    name: "Triggers & Inputs",
    nodes: [
      { type: "input", label: "Starting Point", icon: <Play size={14} className="text-blue-500" /> },
      { type: "trigger", label: "Smart Trigger", icon: <Zap size={14} className="text-amber-400" /> },
      { type: "webhook", label: "Webhook", icon: <Globe size={14} className="text-purple-400" /> },
    ]
  },
  {
    name: "Intelligence",
    nodes: [
      { type: "ai", label: "Agent Brain", icon: <Brain size={14} className="text-purple-500" /> },
      { type: "vault", label: "Knowledge Vault", icon: <Database size={14} className="text-cyan-400" /> },
    ]
  },
  {
    name: "Logic & Safety",
    nodes: [
      { type: "router", label: "Decision", icon: <Split size={14} className="text-orange-500" /> },
      { type: "gatekeeper", label: "Safety Gatekeeper", icon: <ShieldCheck size={14} className="text-emerald-500" /> },
      { type: "approval", label: "Approval Gate", icon: <ShieldCheck size={14} className="text-amber-400" /> },
      { type: "processor", label: "Logic Processor", icon: <Terminal size={14} className="text-slate-400" /> },
    ]
  },
  {
    name: "Actions & Output",
    nodes: [
      { type: "action", label: "Integration", icon: <Zap size={14} className="text-emerald-500" /> },
      { type: "output", label: "Final Result", icon: <MessageSquare size={14} className="text-pink-500" /> },
    ]
  }
];

const NodeSidebar: React.FC = () => {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState<"nodes" | "vault">("nodes");
  const { nodes, edges, setNodes, setEdges, clearCanvas, tutorialStep } = useFlowStore();
  const [savedAgentsList, setSavedAgentsList] = useState<SavedAgent[]>([]);
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [saveName, setSaveName] = useState("");

  // Vault state
  const { entries, addEntry, removeEntry } = useVaultStore();
  const [newKey, setNewKey] = useState("");
  const [newValue, setNewValue] = useState("");

  // Load saved agents from localStorage on mount
  useEffect(() => {
    setSavedAgentsList(getSavedAgents());
  }, []);

  const onDragStart = (event: React.DragEvent, nodeType: string) => {
    event.dataTransfer.setData("application/reactflow", nodeType);
    event.dataTransfer.effectAllowed = "move";
  };

  const onSubflowDragStart = (event: React.DragEvent, agent: SavedAgent) => {
    event.dataTransfer.setData("application/reactflow", "subflow");
    event.dataTransfer.setData("application/subflowId", agent.id);
    event.dataTransfer.setData("application/subflowName", agent.name);
    event.dataTransfer.effectAllowed = "move";
  };

  const handleSaveAgent = () => {
    if (!saveName.trim()) return;
    const newAgent = saveAgent(saveName.trim(), nodes, edges);
    setSavedAgentsList(prev => [...prev, newAgent]);
    setSaveName("");
    setShowSaveDialog(false);
  };

  const handleDeleteAgent = (id: string) => {
    deleteSavedAgent(id);
    setSavedAgentsList(prev => prev.filter(a => a.id !== id));
  };

  const handleAddVaultEntry = () => {
    if (!newKey.trim()) return;
    addEntry(newKey.trim(), newValue);
    setNewKey("");
    setNewValue("");
  };

  const filteredCategories = categories.map(cat => ({
    ...cat,
    nodes: cat.nodes.filter(n => n.label.toLowerCase().includes(search.toLowerCase()))
  })).filter(cat => cat.nodes.length > 0);

  const filteredSavedAgents = savedAgentsList.filter(a => 
    a.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="flex flex-col h-full bg-white dark:bg-[#0b0e14] transition-colors duration-300 border-r border-slate-200 dark:border-slate-800">
      {/* Dashboard shortcut */}
      <a
        href="/dashboard"
        className="flex items-center gap-2 px-4 py-2.5 text-[9px] font-bold uppercase tracking-widest text-slate-500 hover:text-emerald-400 hover:bg-emerald-500/5 transition-all border-b border-slate-200 dark:border-slate-800"
      >
        <LayoutGrid size={12} />
        Dashboard
      </a>
      {/* TABS */}
      <div className="flex border-b border-slate-200 dark:border-slate-800">
        <button
          onClick={() => setActiveTab("nodes")}
          className={cn(
            "flex-1 flex items-center justify-center gap-2 py-3 text-[10px] font-black uppercase tracking-widest transition-all",
            activeTab === "nodes"
              ? "text-indigo-500 border-b-2 border-indigo-500 bg-indigo-500/5"
              : "text-slate-500 hover:text-slate-300 hover:bg-slate-800/30"
          )}
        >
          <Layers size={14} />
          Nodes
        </button>
        <button
          onClick={() => setActiveTab("vault")}
          className={cn(
            "flex-1 flex items-center justify-center gap-2 py-3 text-[10px] font-black uppercase tracking-widest transition-all",
            activeTab === "vault"
              ? "text-cyan-400 border-b-2 border-cyan-400 bg-cyan-500/5"
              : "text-slate-500 hover:text-slate-300 hover:bg-slate-800/30"
          )}
        >
          <Lock size={14} />
          Vault
        </button>
      </div>

      {/* SEARCH (visible on both tabs) */}
      <div className="relative p-4 pb-2">
        <Search className="absolute left-7 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
        <input 
          type="text"
          placeholder={activeTab === "nodes" ? "Find a node..." : "Search keys..."}
          className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl py-2 pl-9 pr-4 text-xs focus:ring-2 focus:ring-indigo-500/20 outline-none transition-all"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {/* NODES TAB CONTENT */}
      {activeTab === "nodes" && (
        <>
          <div className="flex-1 overflow-y-auto px-4 pr-3 scrollbar-hide space-y-6 pb-4">
            {filteredCategories.map((cat) => (
              <div key={cat.name} className="flex flex-col gap-3">
                <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-400 px-1">
                  {cat.name}
                </h3>
                <div className="grid grid-cols-2 gap-2">
                  {cat.nodes.map((node) => {
                    const isTutorialTarget = 
                      (tutorialStep === 2 && node.type === "trigger") ||
                      (tutorialStep === 4 && node.type === "ai");
                    return (
                      <div
                        key={node.type}
                        id={node.type === "trigger" ? "node-trigger" : undefined}
                        draggable
                        onDragStart={(e) => onDragStart(e, node.type)}
                        className={cn(
                          "flex flex-col items-center justify-center gap-2 p-3 cursor-grab bg-slate-50 dark:bg-slate-900/50 border rounded-xl hover:border-indigo-500/50 hover:bg-indigo-500/5 transition-all group text-center",
                          isTutorialTarget 
                            ? "border-amber-500 bg-amber-500/10 ring-4 ring-amber-500/30 animate-pulse z-10" 
                            : "border-slate-200 dark:border-slate-800"
                        )}
                      >
                        <div className="p-2 bg-white dark:bg-slate-800 rounded-lg border border-slate-100 dark:border-slate-700 shadow-sm group-hover:scale-110 transition-transform">
                          {node.icon}
                        </div>
                        <span className="text-[9px] font-bold text-slate-600 dark:text-slate-300 uppercase tracking-tighter leading-none">
                          {node.label}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}

            {/* SAVED AGENTS CATEGORY */}
            {(filteredSavedAgents.length > 0 || !search) && (
              <div className="flex flex-col gap-3">
                <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-400 px-1">
                  Saved Agents
                </h3>
                {filteredSavedAgents.length > 0 ? (
                  <div className="grid grid-cols-2 gap-2">
                    {filteredSavedAgents.map((agent) => (
                      <div
                        key={agent.id}
                        draggable
                        onDragStart={(e) => onSubflowDragStart(e, agent)}
                        className="relative flex flex-col items-center justify-center gap-2 p-3 cursor-grab bg-indigo-500/5 dark:bg-indigo-500/5 border border-indigo-500/20 rounded-xl hover:border-indigo-500/50 hover:bg-indigo-500/10 transition-all group text-center"
                      >
                        <button
                          onClick={(e) => { e.stopPropagation(); handleDeleteAgent(agent.id); }}
                          className="absolute top-1.5 right-1.5 p-0.5 rounded text-slate-500 hover:text-rose-500 opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <X size={10} />
                        </button>
                        <div className="p-2 bg-white dark:bg-slate-800 rounded-lg border border-indigo-500/20 shadow-sm group-hover:scale-110 transition-transform">
                          <Briefcase size={14} className="text-indigo-400" />
                        </div>
                        <span className="text-[9px] font-bold text-indigo-400 uppercase tracking-tighter leading-none truncate w-full">
                          {agent.name}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-4 text-[10px] text-slate-500 italic border border-dashed border-slate-200 dark:border-slate-800 rounded-xl">
                    Save a workflow to reuse it here
                  </div>
                )}
              </div>
            )}
          </div>

          {/* FOOTER ACTIONS */}
          <div className={cn(
            "mt-auto p-4 pt-3 border-t border-slate-200 dark:border-slate-800 flex flex-col gap-2 transition-all",
            tutorialStep > 0 && tutorialStep < 8 && "opacity-30 pointer-events-none grayscale"
          )}>
            {showSaveDialog && (
              <div className="flex gap-2 mb-2 animate-in slide-in-from-bottom-2 duration-200">
                <input
                  type="text"
                  placeholder="Agent name..."
                  value={saveName}
                  onChange={(e) => setSaveName(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSaveAgent()}
                  className="flex-1 bg-slate-50 dark:bg-slate-900 border border-indigo-500/30 rounded-lg px-3 py-1.5 text-xs focus:ring-2 focus:ring-indigo-500/20 outline-none"
                  autoFocus
                />
                <button
                  onClick={handleSaveAgent}
                  className="px-3 py-1.5 bg-indigo-600 text-white text-[10px] font-bold rounded-lg hover:bg-indigo-500 transition-colors"
                >
                  Save
                </button>
                <button
                  onClick={() => { setShowSaveDialog(false); setSaveName(""); }}
                  className="px-2 py-1.5 text-slate-400 hover:text-white text-[10px] rounded-lg transition-colors"
                >
                  <X size={14} />
                </button>
              </div>
            )}

            <button
              className="w-full flex items-center justify-center gap-2 bg-indigo-600/10 hover:bg-indigo-600 border border-indigo-500/20 text-indigo-500 hover:text-white text-xs font-bold py-2.5 rounded-xl transition-all shadow-lg shadow-indigo-500/5"
              type="button"
              onClick={() => setShowSaveDialog(true)}
            >
              <Save size={14} />
              Save Workflow
            </button>

            <label className="w-full block">
              <span className="w-full flex items-center justify-center gap-2 bg-slate-100 dark:bg-slate-800/50 hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-400 text-xs font-bold py-2.5 rounded-xl cursor-pointer transition-all border border-slate-200 dark:border-slate-800">
                <Upload size={14} />
                Import Workflow
              </span>
              <input
                type="file"
                accept="application/json"
                className="hidden"
                onChange={async (event) => {
                  const file = event.target.files?.[0];
                  if (!file) return;
                  const text = await file.text();
                  try {
                    const flow = parseFlowJson(text);
                    setNodes(flow.nodes);
                    setEdges(flow.edges);
                  } catch (e) {
                    console.error("Failed to load workflow", e);
                  } finally {
                    event.target.value = "";
                  }
                }}
              />
            </label>

            <button
              className="w-full flex items-center justify-center gap-2 border border-rose-500/30 hover:bg-rose-500 text-rose-500 hover:text-white text-xs font-bold py-2.5 rounded-xl transition-all shadow-lg shadow-rose-500/5 group"
              type="button"
              onClick={clearCanvas}
            >
              <Trash2 size={14} className="group-hover:animate-pulse" />
              Clear Canvas
            </button>
          </div>
        </>
      )}

      {/* VAULT TAB CONTENT */}
      {activeTab === "vault" && (
        <div className="flex-1 flex flex-col overflow-hidden px-4">
          {/* Add new key */}
          <div className="flex flex-col gap-2 py-4 border-b border-slate-200 dark:border-slate-800">
            <input
              type="text"
              placeholder="KEY_NAME"
              value={newKey}
              onChange={(e) => setNewKey(e.target.value.toUpperCase().replace(/\s/g, '_'))}
              className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg px-3 py-2 text-xs font-mono focus:ring-2 focus:ring-cyan-500/20 outline-none"
            />
            <input
              type="password"
              placeholder="Secret value..."
              value={newValue}
              onChange={(e) => setNewValue(e.target.value)}
              className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg px-3 py-2 text-xs focus:ring-2 focus:ring-cyan-500/20 outline-none"
            />
            <button
              onClick={handleAddVaultEntry}
              disabled={!newKey.trim()}
              className={cn(
                "w-full flex items-center justify-center gap-2 py-2 rounded-xl text-xs font-bold transition-all",
                newKey.trim()
                  ? "bg-cyan-600 hover:bg-cyan-500 text-white shadow-lg shadow-cyan-500/20"
                  : "bg-slate-800 text-slate-600 cursor-not-allowed"
              )}
            >
              <Plus size={14} />
              Add Secret
            </button>
          </div>

          {/* Key list */}
          <div className="flex-1 overflow-y-auto scrollbar-hide py-3 space-y-2">
            {entries.filter(e => 
              e.key.toLowerCase().includes(search.toLowerCase())
            ).map((entry) => (
              <div
                key={entry.key}
                className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-xl group hover:border-cyan-500/30 transition-all"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <Lock size={12} className="text-cyan-400 flex-shrink-0" />
                  <span className="text-xs font-mono text-cyan-400 truncate">{entry.key}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-slate-600 font-mono">••••••</span>
                  <button
                    onClick={() => removeEntry(entry.key)}
                    className="p-1 rounded text-slate-500 hover:text-rose-500 opacity-0 group-hover:opacity-100 transition-all"
                  >
                    <X size={12} />
                  </button>
                </div>
              </div>
            ))}
            {entries.length === 0 && (
              <div className="text-center py-8 text-slate-500">
                <Lock size={24} className="mx-auto mb-3 opacity-20" />
                <p className="text-[10px] font-bold uppercase tracking-widest">No secrets stored</p>
                <p className="text-[10px] mt-1 italic">Add keys above to reference them in nodes</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default NodeSidebar;