"use client";

import React, { useState, useEffect } from "react";
import { useFlowStore } from "@/stores/flowStore";
import { compileFlow } from "@/lib/flowCompiler";
import { 
  Copy, 
  CheckCircle, 
  Play, 
  FileText, 
  Download, 
  Code2, 
  Server, 
  ArrowLeft,
  Type,
  X
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useRouter } from "next/navigation";
import { NodeCard } from "@/components/flow/nodes/NodeCard";

export default function PublishPage() {
  const router = useRouter();
  const { nodes, edges, simulateFlow, finalResult, setFinalResult, theme } = useFlowStore();
  
  const [activeTab, setActiveTab] = useState<'python' | 'javascript'>('python');
  const [copied, setCopied] = useState(false);
  const [compiledCode, setCompiledCode] = useState("");

  useEffect(() => {
    setCompiledCode(compileFlow(nodes, edges, activeTab));
  }, [nodes, edges, activeTab]);

  const handleCopy = () => {
    navigator.clipboard.writeText(compiledCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleRunPreview = async () => {
    const startNode = nodes.find(n => n.type === 'input') || nodes[0];
    if (startNode) {
      await simulateFlow(startNode.id);
    }
  };

  return (
    <div className="flex h-screen w-full bg-[#0b0e14] text-white overflow-hidden">
      {/* LEFT COLUMN: Preview & Gallery */}
      <div className="w-1/2 border-r border-slate-800 flex flex-col h-full bg-[#0b0e14]">
        <header className="p-6 border-b border-slate-800 flex items-center justify-between bg-[#0b0e14]">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => router.back()}
              className="p-2 hover:bg-slate-800 rounded-lg transition-colors text-slate-400 hover:text-white border border-slate-800"
            >
              <ArrowLeft size={18} />
            </button>
            <div>
              <h1 className="text-lg font-bold text-white uppercase tracking-wider">Universal Preview</h1>
              <p className="text-[10px] text-slate-500 mt-1 uppercase tracking-widest">Environment Sandbox</p>
            </div>
          </div>
          <button 
            onClick={handleRunPreview}
            className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2.5 rounded-xl text-xs font-bold transition-all shadow-lg shadow-indigo-500/20"
          >
            <Play size={14} className="fill-current" />
            Run Sandbox
          </button>
        </header>

        <div className="p-8 flex-1 overflow-y-auto flex flex-col gap-10 scrollbar-hide">
          {/* UNIVERSAL INPUT DROPZONE */}
          <div className="flex flex-col gap-4">
            <h2 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">Universal Input</h2>
            <NodeCard nodeId="preview-input" className="min-w-full">
              <div 
                className={cn(
                  "w-full rounded-xl border-2 border-dashed p-8 flex flex-col items-center justify-center text-center transition-all",
                  "border-slate-800 bg-slate-900/30 hover:border-indigo-500/50 hover:bg-indigo-500/5"
                )}
              >
                <div className="w-12 h-12 bg-slate-800/50 rounded-2xl flex items-center justify-center mb-4 border border-slate-700">
                   <FileText size={20} className="text-slate-400" />
                </div>
                <p className="text-[11px] font-bold text-slate-300 uppercase tracking-widest">Drop files or type data</p>
                <p className="text-[10px] text-slate-500 mt-1 mb-6">Testing payload for sandbox execution.</p>
                
                <textarea 
                  data-nodrag
                  className="w-full h-24 bg-[#05070a] border border-slate-800 rounded-xl p-4 text-xs text-slate-300 resize-none focus:outline-none focus:border-indigo-500/50 transition-colors shadow-inner"
                  placeholder="Enter temporary testing data..."
                  onChange={(e) => {
                    const startNode = nodes.find(n => n.type === 'input') || nodes[0];
                    if (startNode) {
                      const updatedNodes = nodes.map(n => 
                        n.id === startNode.id 
                          ? { ...n, data: { ...n.data, packet: { type: 'text', payload: e.target.value } } }
                          : n
                      );
                      useFlowStore.setState({ nodes: updatedNodes });
                    }
                  }}
                />
              </div>
            </NodeCard>
          </div>

          {/* RESPONSE GALLERY */}
          <div className="flex flex-col gap-4">
            <h2 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">Response Gallery</h2>
            {finalResult ? (
              <NodeCard nodeId="preview-output" className="min-w-full">
                <div className="flex items-center justify-between w-full mb-4">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                    <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-500">Packet Received</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={cn(
                      "text-[9px] px-2 py-0.5 rounded-full font-bold uppercase",
                      finalResult.type === 'text' ? "bg-blue-500/10 text-blue-500" :
                      finalResult.type === 'file' ? "bg-emerald-500/10 text-emerald-500" :
                      "bg-purple-500/10 text-purple-500"
                    )}>
                      {finalResult.type}
                    </span>
                    <button onClick={() => setFinalResult(null)} className="text-slate-600 hover:text-slate-400">
                      <X size={14} />
                    </button>
                  </div>
                </div>

                <div className="w-full">
                  {finalResult.type === "text" && (
                    <pre className="text-[11px] font-mono text-slate-300 p-5 bg-[#05070a] rounded-xl border border-slate-800 whitespace-pre-wrap text-left shadow-inner leading-relaxed">
                      {finalResult.payload}
                    </pre>
                  )}

                  {finalResult.type === "file" && (
                    <div className="flex flex-col items-center gap-5 p-8 bg-[#05070a] rounded-xl border border-slate-800 shadow-inner">
                      {finalResult.meta?.mimeType?.startsWith('image/') ? (
                        <img src={finalResult.payload} alt="Preview" className="max-h-52 rounded-xl shadow-2xl border border-slate-800" />
                      ) : (
                        <div className="w-16 h-16 bg-slate-800 rounded-2xl flex items-center justify-center border border-slate-700">
                          <FileText size={32} className="text-slate-500" />
                        </div>
                      )}
                      <div className="text-center">
                        <p className="text-xs font-bold text-slate-200 uppercase tracking-widest">{finalResult.meta?.name}</p>
                        <p className="text-[10px] text-slate-500 mt-1 uppercase font-medium">{(finalResult.meta?.size || 0) / 1000} KB</p>
                      </div>
                      <a 
                        href={finalResult.payload} 
                        download={finalResult.meta?.name}
                        className="px-6 py-2.5 bg-slate-800 hover:bg-slate-700 text-white text-[10px] font-black uppercase tracking-widest rounded-xl transition-all flex items-center gap-2 border border-slate-700 shadow-lg shadow-black/20"
                      >
                        <Download size={14} />
                        Download Asset
                      </a>
                    </div>
                  )}

                  {finalResult.type === "data" && (
                    <pre className="text-[10px] font-mono text-indigo-400 p-5 bg-[#05070a] rounded-xl border border-slate-800 text-left shadow-inner">
                      {JSON.stringify(finalResult.payload, null, 2)}
                    </pre>
                  )}
                </div>
              </NodeCard>
            ) : (
              <div className="w-full bg-slate-900/20 border border-slate-800 border-dashed rounded-2xl p-16 flex flex-col items-center justify-center text-slate-600">
                <Server size={32} className="mb-4 opacity-10" />
                <p className="text-[10px] font-bold uppercase tracking-[0.2em]">Awaiting sandbox execution...</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* RIGHT COLUMN: Code Export */}
      <div className="w-1/2 flex flex-col h-full bg-[#05070a]">
        <header className="p-6 border-b border-slate-800 flex items-center justify-between bg-[#0b0e14]">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-500/10 rounded-lg">
              <Code2 size={18} className="text-indigo-500" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-white uppercase tracking-wider">Export Source</h1>
              <p className="text-[10px] text-slate-500 mt-1 uppercase tracking-widest">Compiled Production Script</p>
            </div>
          </div>
          <div className="flex bg-slate-900 border border-slate-800 rounded-xl p-1.5 shadow-inner">
            <button
              onClick={() => setActiveTab('python')}
              className={cn(
                "px-6 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all",
                activeTab === 'python' ? "bg-slate-800 text-white shadow-lg" : "text-slate-500 hover:text-slate-300"
              )}
            >
              Python
            </button>
            <button
              onClick={() => setActiveTab('javascript')}
              className={cn(
                "px-6 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all",
                activeTab === 'javascript' ? "bg-slate-800 text-white shadow-lg" : "text-slate-500 hover:text-slate-300"
              )}
            >
              Node.js
            </button>
          </div>
        </header>

        <div className="flex-1 p-8 relative flex flex-col overflow-hidden">
          <button
            onClick={handleCopy}
            className="absolute top-12 right-12 flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all shadow-xl shadow-indigo-500/20 z-10 border border-indigo-400/20"
          >
            {copied ? <CheckCircle size={14} /> : <Copy size={14} />}
            {copied ? "Copied" : "Copy Source"}
          </button>
          
          <div className="flex-1 bg-[#0b0e14] border border-slate-800 rounded-2xl p-8 overflow-hidden flex flex-col shadow-2xl">
             <div className="flex items-center gap-2 mb-6 opacity-40">
                <div className="w-2.5 h-2.5 rounded-full bg-rose-500" />
                <div className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                <div className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                <span className="ml-2 text-[9px] font-mono text-slate-500">agentforge_compiled_{activeTab}.{activeTab === 'python' ? 'py' : 'js'}</span>
             </div>
             <pre className="flex-1 overflow-y-auto w-full text-[11px] font-mono text-slate-300 scrollbar-hide selection:bg-indigo-500/30">
                <code>{compiledCode}</code>
             </pre>
          </div>
        </div>
      </div>
    </div>
  );
}
