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
  LayoutGrid,
  ChevronsUpDown,
  Check,
  FolderKanban
} from "lucide-react";
import { useFlowStore } from "@/stores/flowStore";
import { useRouter } from "next/navigation";
import { parseFlowJson } from "@/lib/flowPersistence";
import { getProjects, createProject, deleteProject } from "@/app/actions/project";
import { motion, AnimatePresence } from "framer-motion";
import ProjectModal from "@/components/ui/modals/ProjectModal";
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
      { type: "ai", label: "Agent Configuration", icon: <Brain size={14} className="text-purple-500" /> },
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

interface NodeSidebarProps {
  onClearCanvas?: () => void;
  isOwner?: boolean;
}

const NodeSidebar: React.FC<NodeSidebarProps> = ({ onClearCanvas, isOwner = true }) => {
  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState<"nodes" | "vault">("nodes");
  const { nodes, edges, setNodes, setEdges, clearCanvas, tutorialStep, activeProject, setActiveProject, clearActiveProject } = useFlowStore();
  const [savedAgentsList, setSavedAgentsList] = useState<SavedAgent[]>([]);
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [saveName, setSaveName] = useState("");
  const [showProjectSelector, setShowProjectSelector] = useState(false);
  const [projectSearch, setProjectSearch] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [projects, setProjects] = useState<{id: string, name: string}[]>([]);
  const [deletingProjectId, setDeletingProjectId] = useState<string | null>(null);

  useEffect(() => {
    async function loadProjects() {
      const res = await getProjects();
      if (!res.error && res.projects) {
        setProjects(res.projects);
      }
    }
    loadProjects();
  }, [showProjectSelector]);

  const handleDeleteProject = async (id: string) => {
    const res = await deleteProject(id);
    if (res.success) {
      setProjects(prev => prev.filter(p => p.id !== id));
      if (activeProject?.id === id) {
        clearActiveProject();
        clearCanvas();
      }
      setDeletingProjectId(null);
      // toast notification logic would go here if a toast provider was available
      // For now we'll rely on the UI feedback (item disappearing)
    } else {
      alert(res.error || "Failed to delete project");
    }
  };

  const handleCreateProject = async (name: string) => {
    const res = await createProject(name);
    if (res.project) {
      setProjects(prev => [res.project, ...prev]);
      setActiveProject({ id: res.project.id, name: res.project.name });
      clearCanvas();
      setShowProjectSelector(false);
      setIsModalOpen(false);
    } else {
      alert(res.error || "Failed to create project");
    }
  };

  // Ensure non-owners can't see vault even if state is manipulated
  useEffect(() => {
    if (!isOwner && activeTab === "vault") {
      setActiveTab("nodes");
    }
  }, [isOwner, activeTab]);

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
    <div className="flex flex-col h-full bg-card backdrop-blur-xl transition-colors duration-300 border-r border-border relative">
      
      {/* --- TOP NAVIGATION BLOCK --- */}
      <div className="flex flex-col gap-1 p-3 border-b border-border">
        
        {/* Dashboard Link */}
        <button
          onClick={() => window.location.href = '/dashboard'}
          className="flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs font-semibold text-muted-foreground hover:text-foreground hover:bg-muted transition-all w-full text-left"
        >
          <LayoutGrid size={14} className="text-slate-500" />
          Dashboard
        </button>

        {/* Project Selector Toggle */}
        <div className="relative">
          <button
            onClick={() => setShowProjectSelector(!showProjectSelector)}
            className={cn(
              "flex items-center justify-between w-full px-2 py-1.5 rounded-lg text-xs font-semibold transition-all border border-transparent",
              showProjectSelector 
                ? "bg-muted text-foreground border-border"
                : "text-muted-foreground hover:bg-muted border-transparent"
            )}
          >
            <div className="flex items-center gap-2 overflow-hidden">
              <FolderKanban size={14} className="text-indigo-400 flex-shrink-0" />
              <span className="truncate">{activeProject?.name || "Select Project"}</span>
            </div>
            <ChevronsUpDown size={12} className="text-muted-foreground flex-shrink-0 ml-2" />
          </button>

          {/* Project Selector Dropdown */}
          <AnimatePresence>
            {showProjectSelector && (
              <>
                {/* Invisible overlay to close dropdown */}
                <div 
                  className="fixed inset-0 z-[100]" 
                  onClick={() => setShowProjectSelector(false)}
                />
                
                <motion.div 
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.15 }}
                  className="absolute top-full left-0 mt-1 w-[240px] bg-popover/95 backdrop-blur-xl border border-border rounded-xl shadow-2xl z-[101] overflow-hidden flex flex-col pt-2"
                >
                  <div className="px-2 pb-2 border-b border-border">
                    <div className="relative">
                      <Search size={12} className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-500" />
                      <input 
                        autoFocus
                        type="text"
                        placeholder="Search projects..."
                        value={projectSearch}
                        onChange={(e) => setProjectSearch(e.target.value)}
                        className="w-full bg-background border border-border rounded-md py-1.5 pl-7 pr-3 text-[11px] text-foreground focus:outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/50"
                      />
                    </div>
                  </div>

                  <div className="max-h-48 overflow-y-auto p-1 scrollbar-hide">
                    <AnimatePresence mode="popLayout">
                      {projects
                        .filter(p => p.name.toLowerCase().includes(projectSearch.toLowerCase()))
                        .map(project => (
                          <motion.div
                            layout
                            key={project.id}
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: 20 }}
                            transition={{ duration: 0.2 }}
                            className="group relative"
                          >
                            <div
                              role="button"
                              tabIndex={0}
                              onClick={() => {
                                setActiveProject({ id: project.id, name: project.name });
                                setShowProjectSelector(false);
                              }}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter' || e.key === ' ') {
                                  setActiveProject({ id: project.id, name: project.name });
                                  setShowProjectSelector(false);
                                }
                              }}
                              className="w-full flex items-center justify-between px-2 py-1.5 rounded-lg text-[11px] hover:bg-muted transition-colors text-left cursor-pointer outline-none focus:bg-muted"
                            >
                              <span className={project.id === activeProject?.id ? "text-indigo-500 font-bold" : "text-muted-foreground"}>
                                {project.name}
                              </span>
                              
                              <div className="flex items-center gap-1">
                                {project.id === activeProject?.id && <Check size={12} className="text-indigo-500" />}
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setDeletingProjectId(project.id);
                                  }}
                                  className="p-1 rounded opacity-0 group-hover:opacity-100 hover:bg-rose-500/20 text-slate-500 hover:text-rose-500 transition-all focus:opacity-100"
                                >
                                  <Trash2 size={10} />
                                </button>
                              </div>
                            </div>

                            {/* Delete Confirmation Overlay */}
                            <AnimatePresence>
                              {deletingProjectId === project.id && (
                                <motion.div 
                                  initial={{ opacity: 0 }}
                                  animate={{ opacity: 1 }}
                                  exit={{ opacity: 0 }}
                                  className="absolute inset-0 bg-background/95 flex items-center justify-between px-2 rounded-lg z-10"
                                >
                                  <span className="text-[9px] font-bold text-rose-500 uppercase tracking-tighter">Delete Project?</span>
                                  <div className="flex gap-1">
                                    <button 
                                      onClick={(e) => { e.stopPropagation(); setDeletingProjectId(null); }}
                                      className="px-1.5 py-0.5 rounded bg-slate-800 text-[9px] font-bold text-slate-400 hover:text-white"
                                    >
                                      No
                                    </button>
                                    <button 
                                      onClick={(e) => { e.stopPropagation(); handleDeleteProject(project.id); }}
                                      className="px-1.5 py-0.5 rounded bg-rose-600 text-[9px] font-bold text-white hover:bg-rose-500"
                                    >
                                      Yes
                                    </button>
                                  </div>
                                </motion.div>
                              )}
                            </AnimatePresence>
                          </motion.div>
                        ))}
                    </AnimatePresence>
                    {projects.length === 0 && (
                      <div className="text-center py-3 text-[10px] text-muted-foreground">
                        No projects found.
                      </div>
                    )}
                  </div>

                  <div className="p-1 border-t border-border bg-muted/50">
                    <button 
                      onClick={() => setIsModalOpen(true)}
                      className="w-full flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-lg text-[11px] font-bold text-muted-foreground hover:text-foreground hover:bg-background transition-colors"
                    >
                      <Plus size={12} />
                      New Project
                    </button>
                  </div>
                </motion.div>
              </>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* TABS */}
      <div className="flex border-b border-border">
        <button
          onClick={() => setActiveTab("nodes")}
          className={cn(
            "flex-1 flex items-center justify-center gap-2 py-3 text-[10px] font-black uppercase tracking-widest transition-all",
            activeTab === "nodes"
              ? "text-indigo-500 border-b-2 border-indigo-500 bg-indigo-500/5"
              : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
          )}
        >
          <Layers size={14} />
          Nodes
        </button>
        {isOwner && (
          <button
            onClick={() => setActiveTab("vault")}
            className={cn(
              "flex-1 flex items-center justify-center gap-2 py-3 text-[10px] font-black uppercase tracking-widest transition-all",
              activeTab === "vault"
                ? "text-cyan-500 border-b-2 border-cyan-500 bg-cyan-500/5"
                : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
            )}
          >
            <Lock size={14} />
            Vault
          </button>
        )}
      </div>

      {/* SEARCH (visible on both tabs) */}
      <div className="relative p-4 pb-2">
        <Search className="absolute left-7 top-1/2 -translate-y-1/2 text-muted-foreground" size={14} />
        <input 
          type="text"
          placeholder={activeTab === "nodes" ? "Find a node..." : "Search keys..."}
          className="w-full bg-background border border-border rounded-xl py-2 pl-9 pr-4 text-xs focus:ring-2 focus:ring-indigo-500/20 outline-none transition-all"
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
                <h3 className="text-[10px] font-black uppercase tracking-widest text-muted-foreground px-1">
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
                          "flex flex-col items-center justify-center gap-2 p-3 cursor-grab bg-background max-h-24 border rounded-xl hover:border-indigo-500/50 hover:bg-indigo-500/5 transition-all group text-center",
                          isTutorialTarget 
                            ? "border-amber-500 bg-amber-500/10 ring-4 ring-amber-500/30 animate-pulse z-10" 
                            : "border-border"
                        )}
                      >
                        <div className="p-2 bg-card rounded-lg border border-border shadow-sm group-hover:scale-110 transition-transform">
                          {node.icon}
                        </div>
                        <span className="text-[9px] font-bold text-foreground uppercase tracking-tighter leading-none">
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
                <h3 className="text-[10px] font-black uppercase tracking-widest text-muted-foreground px-1">
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
                          className="absolute top-1.5 right-1.5 p-0.5 rounded text-muted-foreground hover:text-rose-500 opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <X size={10} />
                        </button>
                        <div className="p-2 bg-card rounded-lg border border-indigo-500/20 shadow-sm group-hover:scale-110 transition-transform">
                          <Briefcase size={14} className="text-indigo-400" />
                        </div>
                        <span className="text-[9px] font-bold text-indigo-400 uppercase tracking-tighter leading-none truncate w-full">
                          {agent.name}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-4 text-[10px] text-muted-foreground italic border border-dashed border-border rounded-xl">
                    Save a workflow to reuse it here
                  </div>
                )}
              </div>
            )}
          </div>
        </>
      )}

      {/* FOOTER ACTIONS */}
      {activeTab === "nodes" && isOwner && (
        <div className={cn(
          "mt-auto p-4 pt-3 border-t border-border flex flex-col gap-2 transition-all",
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
                  className="flex-1 bg-background border border-border rounded-lg px-3 py-1.5 text-xs focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500/30 outline-none"
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
                  className="px-2 py-1.5 text-muted-foreground hover:text-foreground text-[10px] rounded-lg transition-colors"
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
              <span className="w-full flex items-center justify-center gap-2 bg-muted hover:bg-muted/80 text-foreground text-xs font-bold py-2.5 rounded-xl cursor-pointer transition-all border border-border">
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
              onClick={onClearCanvas || clearCanvas}
            >
              <Trash2 size={14} className="group-hover:animate-pulse" />
              Clear Canvas
            </button>
          </div>
      )}

      {/* VAULT TAB CONTENT */}
      {activeTab === "vault" && (
        <div className="flex-1 flex flex-col overflow-hidden px-4">
          {/* Add new key */}
          <div className="flex flex-col gap-2 py-4 border-b border-border">
            <input
              type="text"
              placeholder="KEY_NAME"
              value={newKey}
              onChange={(e) => setNewKey(e.target.value.toUpperCase().replace(/\s/g, '_'))}
              className="w-full bg-background border border-border rounded-lg px-3 py-2 text-xs font-mono focus:ring-2 focus:ring-cyan-500/20 outline-none"
            />
            <input
              type="password"
              placeholder="Secret value..."
              value={newValue}
              onChange={(e) => setNewValue(e.target.value)}
              className="w-full bg-background border border-border rounded-lg px-3 py-2 text-xs focus:ring-2 focus:ring-cyan-500/20 outline-none"
            />
            <button
              onClick={handleAddVaultEntry}
              disabled={!newKey.trim()}
              className={cn(
                "w-full flex items-center justify-center gap-2 py-2 rounded-xl text-xs font-bold transition-all",
                newKey.trim()
                  ? "bg-cyan-600 hover:bg-cyan-500 text-white shadow-lg shadow-cyan-500/20"
                  : "bg-muted text-muted-foreground cursor-not-allowed"
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
                className="flex items-center justify-between p-3 bg-background border border-border rounded-xl group hover:border-cyan-500/30 transition-all"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <Lock size={12} className="text-cyan-400 flex-shrink-0" />
                  <span className="text-xs font-mono text-cyan-400 truncate">{entry.key}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-muted-foreground font-mono">••••••</span>
                  <button
                    onClick={() => removeEntry(entry.key)}
                    className="p-1 rounded text-muted-foreground hover:text-rose-500 opacity-0 group-hover:opacity-100 transition-all"
                  >
                    <X size={12} />
                  </button>
                </div>
              </div>
            ))}
            {entries.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                <Lock size={24} className="mx-auto mb-3 opacity-20" />
                <p className="text-[10px] font-bold uppercase tracking-widest">No secrets stored</p>
                <p className="text-[10px] mt-1 italic">Add keys above to reference them in nodes</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* MODALS */}
      <ProjectModal 
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSubmit={handleCreateProject}
      />
    </div>
  );
};

export default NodeSidebar;