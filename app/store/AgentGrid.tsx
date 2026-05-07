"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Copy,
  CheckCircle,
  Loader2,
  ImageIcon,
  ExternalLink,
  ShoppingBag,
  Code2,
  Workflow,
} from "lucide-react";
import { cloneFlow } from "@/app/actions/flow";
import { cn } from "@/lib/utils";
import AgentVisual from "@/components/store/AgentVisual";
import WorkflowLightbox from "./WorkflowLightbox";
import CodeModal from "./CodeModal";
import ManagePanel from "./ManagePanel";

export interface StoreFlow {
  id: string;
  name: string;
  description?: string | null;
  thumbnail?: string | null;
  userId?: string | null;
  updated_at: Date;
  isMultimodal: boolean;
  nodes: any[];
  edges: any[];
}

function AgentCard({ flow, currentUserId }: { flow: StoreFlow; currentUserId: string | null }) {
  const router = useRouter();
  const [cloning, setCloning] = useState(false);
  const [cloned, setCloned] = useState(false);
  const [cloneError, setCloneError] = useState<string | null>(null);
  const [workflowOpen, setWorkflowOpen] = useState(false);
  const [codeOpen, setCodeOpen] = useState(false);

  const isOwner = currentUserId && flow.userId === currentUserId;
  const creatorHandle = flow.userId ? flow.userId.slice(-8).toUpperCase() : "COMMUNITY";

  const handleClone = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (cloning || cloned) return;
    setCloning(true);
    setCloneError(null);
    try {
      const result = await cloneFlow(flow.id);
      if (result.success && result.flow) {
        setCloned(true);
        setTimeout(() => router.push(`/editor?id=${result.flow!.id}`), 700);
      } else {
        setCloneError(result.error || "Clone failed");
        setTimeout(() => setCloneError(null), 3000);
      }
    } catch {
      setCloneError("Clone failed");
      setTimeout(() => setCloneError(null), 3000);
    } finally {
      setCloning(false);
    }
  };

  return (
    <>
      <div className="group relative flex flex-col bg-card border border-border rounded-2xl overflow-hidden hover:border-violet-500/40 dark:hover:border-violet-400/30 hover:shadow-xl hover:shadow-violet-500/5 transition-all duration-200 backdrop-blur-sm">
        {/* Thumbnail */}
        <div className="relative h-36 overflow-hidden border-b border-border">
          {flow.thumbnail ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={flow.thumbnail} alt={flow.name} className="w-full h-full object-cover" />
          ) : (
            <AgentVisual agentId={flow.id} width={320} height={144} className="w-full h-full" />
          )}

          {/* Gradient overlay */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent pointer-events-none" />

          {/* Owner manage panel */}
          {isOwner && (
            <ManagePanel
              flowId={flow.id}
              flowName={flow.name}
              flowDescription={flow.description}
            />
          )}

          {/* Multimodal badge */}
          {flow.isMultimodal && (
            <div className="absolute top-2.5 right-2.5 flex items-center gap-1 px-2 py-0.5 bg-sky-500/15 border border-sky-500/30 rounded-full backdrop-blur-sm">
              <ImageIcon size={9} className="text-sky-400" />
              <span className="text-[8px] font-black uppercase tracking-wider text-sky-400">Multimodal</span>
            </div>
          )}
        </div>

        {/* Body */}
        <div className="p-4 flex flex-col gap-2 flex-1">
          <h3 className="text-sm font-black text-foreground leading-snug truncate group-hover:text-violet-600 dark:group-hover:text-violet-300 transition-colors">
            {flow.name || "Untitled Agent"}
          </h3>

          <div className="flex items-center gap-2">
            <span className="font-mono text-[9px] font-bold text-muted-foreground bg-muted border border-border px-1.5 py-0.5 rounded">
              {creatorHandle}
            </span>
            <span className="text-[9px] text-muted-foreground">
              {new Date(flow.updated_at).toLocaleDateString("en-US", {
                month: "short", day: "numeric", year: "numeric",
              })}
            </span>
          </div>

          {flow.description && (
            <p className="text-[10px] text-muted-foreground line-clamp-2 leading-relaxed">
              {flow.description}
            </p>
          )}

          {/* Actions */}
          <div className="mt-auto pt-3 border-t border-border grid grid-cols-2 gap-1.5">
            {/* Row 1 */}
            <Link
              href={`/sandbox/${flow.id}`}
              onClick={(e) => e.stopPropagation()}
              className="flex items-center justify-center gap-1.5 py-2 rounded-xl border border-border text-[10px] font-bold text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-all"
            >
              <ExternalLink size={9} />
              Sandbox
            </Link>

            <button
              onClick={handleClone}
              disabled={cloning || cloned}
              className={cn(
                "flex items-center justify-center gap-1.5 py-2 rounded-xl text-[10px] font-bold transition-all border",
                cloned
                  ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20"
                  : cloneError
                    ? "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20"
                    : "bg-violet-500/5 border-violet-500/20 text-violet-600 dark:text-violet-400 hover:bg-violet-500/10"
              )}
            >
              {cloning ? <Loader2 size={9} className="animate-spin" /> : cloned ? <CheckCircle size={9} /> : <Copy size={9} />}
              {cloned ? "Opening…" : cloneError ? "Failed" : "Clone"}
            </button>

            {/* Row 2 */}
            <button
              onClick={(e) => { e.stopPropagation(); setWorkflowOpen(true); }}
              className="flex items-center justify-center gap-1.5 py-2 rounded-xl border border-border text-[10px] font-bold text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-all"
            >
              <Workflow size={9} />
              Workflow
            </button>

            <button
              onClick={(e) => { e.stopPropagation(); setCodeOpen(true); }}
              className="flex items-center justify-center gap-1.5 py-2 rounded-xl border border-sky-500/20 bg-sky-500/5 text-[10px] font-bold text-sky-600 dark:text-sky-400 hover:bg-sky-500/10 transition-all"
            >
              <Code2 size={9} />
              Code
            </button>
          </div>
        </div>
      </div>

      <WorkflowLightbox
        open={workflowOpen}
        onClose={() => setWorkflowOpen(false)}
        flowName={flow.name}
        nodes={flow.nodes}
        edges={flow.edges}
      />

      <CodeModal
        open={codeOpen}
        onClose={() => setCodeOpen(false)}
        flowName={flow.name}
        nodes={flow.nodes}
        edges={flow.edges}
      />
    </>
  );
}

export function AgentGridEmpty() {
  return (
    <div className="flex flex-col items-center justify-center py-40 text-center">
      <div className="w-16 h-16 rounded-2xl bg-muted border border-border flex items-center justify-center mb-5">
        <ShoppingBag size={22} className="text-muted-foreground" />
      </div>
      <p className="text-sm font-black uppercase tracking-[0.15em] text-foreground">No agents deployed yet</p>
      <p className="text-[11px] text-muted-foreground mt-2 max-w-xs leading-relaxed">
        Open any flow on the Publish page, run a successful sandbox, then click &ldquo;Deploy to Store&rdquo;.
      </p>
    </div>
  );
}

export default function AgentGrid({
  flows,
  currentUserId,
}: {
  flows: StoreFlow[];
  currentUserId: string | null;
}) {
  if (flows.length === 0) return <AgentGridEmpty />;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
      {flows.map((flow) => (
        <AgentCard key={flow.id} flow={flow} currentUserId={currentUserId} />
      ))}
    </div>
  );
}
