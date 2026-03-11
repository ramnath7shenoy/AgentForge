"use client";

import React, { useEffect, useState } from "react";
import { ShieldAlert, Check, XCircle } from "lucide-react";
import { sendApprovalSignal, isAwaitingApproval } from "@/stores/flowStore";
import { useFlowStore } from "@/stores/flowStore";
import { cn } from "@/lib/utils";

export default function ApprovalBanner() {
  const running = useFlowStore((s) => s.running);
  const [visible, setVisible] = useState(false);

  // Poll for approval state while running
  useEffect(() => {
    if (!running) {
      setVisible(false);
      return;
    }
    const interval = setInterval(() => {
      setVisible(isAwaitingApproval());
    }, 200);
    return () => clearInterval(interval);
  }, [running]);

  if (!visible) return null;

  return (
    <div className="absolute top-4 left-1/2 -translate-x-1/2 z-50 animate-in slide-in-from-top-2 duration-300">
      <div className={cn(
        "flex items-center gap-4 px-6 py-3 rounded-2xl border shadow-2xl backdrop-blur-xl",
        "bg-amber-500/10 border-amber-500/30 shadow-amber-500/10"
      )}>
        <ShieldAlert size={20} className="text-amber-400 animate-pulse" />
        <div className="flex flex-col">
          <span className="text-xs font-bold text-amber-400 uppercase tracking-wider">Pending Approval</span>
          <span className="text-[10px] text-slate-400 mt-0.5">Flow paused at safety checkpoint</span>
        </div>
        <div className="flex items-center gap-2 ml-4">
          <button
            onClick={() => sendApprovalSignal(true)}
            className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-[10px] font-bold uppercase tracking-wider rounded-xl transition-all shadow-lg shadow-emerald-500/20"
          >
            <Check size={14} />
            Approve
          </button>
          <button
            onClick={() => sendApprovalSignal(false)}
            className="flex items-center gap-1.5 px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white text-[10px] font-bold uppercase tracking-wider rounded-xl transition-all shadow-lg shadow-rose-500/20"
          >
            <XCircle size={14} />
            Abort
          </button>
        </div>
      </div>
    </div>
  );
}
