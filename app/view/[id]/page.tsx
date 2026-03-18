import { notFound } from "next/navigation";
import { getFlow } from "@/app/actions/flow";
import ReadOnlyCanvas from "@/components/flow/canvas/ReadOnlyCanvas";
import { Zap, Lock, Eye, Pencil } from "lucide-react";

interface ViewPageProps {
  params: Promise<{ id: string }>;
}

export default async function ViewPage({ params }: ViewPageProps) {
  const { id } = await params;
  const result = await getFlow(id);

  if (!result.success || !result.flow) {
    notFound();
  }

  const flow = result.flow as any;

  if (!flow.isPublic) {
    return (
      <div className="min-h-screen bg-[#05070a] flex items-center justify-center">
        <div className="text-center">
          <div className="w-14 h-14 bg-slate-800 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-slate-700">
            <Lock size={22} className="text-slate-500" />
          </div>
          <h1 className="text-lg font-bold text-white mb-2">Private Flow</h1>
          <p className="text-sm text-slate-500">This flow is not publicly shared.</p>
        </div>
      </div>
    );
  }

  const nodes = typeof flow.nodes === "string" ? JSON.parse(flow.nodes) : flow.nodes;
  const edges = typeof flow.edges === "string" ? JSON.parse(flow.edges) : flow.edges;
  const isEditable: boolean = !!flow.publicEditable;

  return (
    <div className="flex flex-col h-screen bg-[#0b0e14] text-white">
      {/* Header */}
      <header className="flex items-center justify-between border-b border-slate-800 px-6 py-3 bg-[#0b0e14] z-50 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center shadow-lg shadow-indigo-500/20">
            <Zap size={16} className="text-white fill-current" />
          </div>
          <span className="font-bold tracking-tight text-sm uppercase">AgentForge</span>
          <div className="h-4 w-[1px] bg-slate-800 mx-2" />
          <span className="text-slate-400 text-sm font-medium truncate max-w-xs">{flow.name}</span>
        </div>
        {isEditable ? (
          <span className="flex items-center gap-1.5 text-[10px] text-amber-400 uppercase tracking-widest font-bold px-2 py-1 bg-amber-500/10 border border-amber-500/20 rounded-md">
            <Pencil size={10} />
            Editable
          </span>
        ) : (
          <span className="flex items-center gap-1.5 text-[10px] text-slate-500 uppercase tracking-widest font-bold px-2 py-1 bg-slate-800 rounded-md">
            <Eye size={10} />
            View Only
          </span>
        )}
      </header>

      {/* Canvas */}
      <div className="flex-1 relative">
        <ReadOnlyCanvas
          nodes={nodes as any[]}
          edges={edges as any[]}
          editable={isEditable}
          flowId={flow.id}
        />
      </div>
    </div>
  );
}
