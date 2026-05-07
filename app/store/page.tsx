import React from "react";
import Link from "next/link";
import { getDeployedFlows } from "@/app/actions/flow";
import Navbar from "@/components/ui/Navbar";
import { Store, Play, Clock, ArrowRight } from "lucide-react";

export const revalidate = 60;

export default async function StorePage() {
  const { flows } = await getDeployedFlows();

  return (
    <div className="flex flex-col min-h-screen bg-background text-foreground dark">
      <Navbar />

      <div className="flex-1 px-8 py-12 max-w-7xl mx-auto w-full">
        {/* Header */}
        <div className="mb-10">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2.5 bg-violet-500/10 rounded-xl border border-violet-500/20">
              <Store size={20} className="text-violet-400" />
            </div>
            <div>
              <h1 className="text-2xl font-black text-white uppercase tracking-wider">Agent Store</h1>
              <p className="text-[11px] text-slate-500 uppercase tracking-widest mt-0.5">
                Publicly deployed AI workflows
              </p>
            </div>
          </div>
          <p className="text-sm text-slate-400 mt-4 max-w-xl">
            Browse and run community-deployed agents. Click any card to open the sandbox and test the flow with your own API keys.
          </p>
        </div>

        {/* Grid */}
        {flows.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-32 text-center">
            <div className="w-16 h-16 rounded-2xl bg-slate-800 border border-slate-700 flex items-center justify-center mb-4">
              <Store size={28} className="text-slate-600" />
            </div>
            <p className="text-slate-400 font-bold text-sm uppercase tracking-widest">No agents deployed yet</p>
            <p className="text-slate-600 text-[11px] mt-2">
              Open any flow on the Publish page and click &ldquo;Deploy to Store&rdquo;.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {flows.map((flow: any) => (
              <Link
                key={flow.id}
                href={`/sandbox/${flow.id}`}
                className="group flex flex-col bg-card border border-border rounded-2xl overflow-hidden hover:border-violet-500/40 hover:shadow-xl hover:shadow-violet-500/5 transition-all duration-200"
              >
                {/* Thumbnail / Placeholder */}
                <div className="h-36 bg-gradient-to-br from-slate-900 to-slate-800 border-b border-border flex items-center justify-center relative overflow-hidden">
                  {flow.thumbnail ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={flow.thumbnail} alt={flow.name} className="w-full h-full object-cover" />
                  ) : (
                    <div className="flex flex-col items-center gap-2 opacity-30">
                      <Play size={32} className="text-violet-400" fill="currentColor" />
                      <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Agent Flow</span>
                    </div>
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-slate-900/60 to-transparent" />
                </div>

                {/* Info */}
                <div className="p-4 flex flex-col gap-2 flex-1">
                  <h3 className="text-sm font-black text-white truncate group-hover:text-violet-300 transition-colors">
                    {flow.name || "Untitled Agent"}
                  </h3>
                  {flow.description && (
                    <p className="text-[10px] text-slate-500 line-clamp-2 leading-relaxed">{flow.description}</p>
                  )}
                  <div className="mt-auto flex items-center justify-between pt-3 border-t border-border">
                    <div className="flex items-center gap-1 text-[9px] text-slate-600">
                      <Clock size={9} />
                      <span>
                        {flow.updated_at
                          ? new Date(flow.updated_at).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })
                          : "—"}
                      </span>
                    </div>
                    <span className="flex items-center gap-1 text-[9px] font-bold text-violet-400 group-hover:gap-2 transition-all">
                      Run <ArrowRight size={9} />
                    </span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
