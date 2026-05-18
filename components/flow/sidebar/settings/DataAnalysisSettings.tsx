"use client";

import React from "react";
import { BarChart2 } from "lucide-react";

interface Props {
  nodeId: string;
  data: Record<string, any>;
  updateData: (updates: Record<string, any>) => void;
}

const EXAMPLES = [
  "Bar chart of sales by category",
  "Line chart showing trends over time",
  "Pie chart of market share",
  "Scatter plot of price vs quantity",
  "Histogram of age distribution",
  "Correlation heatmap",
];

export function DataAnalysisSettings({ nodeId: _, data, updateData }: Props) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2 text-amber-400">
        <BarChart2 size={16} />
        <h3 className="text-sm font-bold uppercase tracking-tight">Data Analysis</h3>
      </div>

      <div className="rounded-md bg-amber-500/5 border border-amber-500/20 px-3 py-2 text-[10px] text-amber-300 leading-relaxed">
        Runs Python (pandas + matplotlib) in an E2B sandbox. Feed it JSON, CSV, or key:value text from upstream and describe the chart you want. Returns an image.
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-[10px] font-bold uppercase text-slate-500">Chart Instructions</label>
        <textarea
          value={data.daInstructions || ""}
          onChange={(e) => updateData({ daInstructions: e.target.value })}
          placeholder="e.g. Bar chart of sales by category"
          rows={3}
          className="w-full rounded-md px-2 py-1.5 text-xs border bg-background border-border text-foreground outline-none focus:ring-1 focus:ring-amber-500/40 focus:border-amber-500 resize-none"
        />
        <p className="text-[9px] text-slate-600">Describe the chart type and what to plot. Auto-detected if left blank.</p>
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-[10px] font-bold uppercase text-slate-500">Examples</label>
        <div className="flex flex-col gap-1">
          {EXAMPLES.map((ex) => (
            <button
              key={ex}
              onClick={() => updateData({ daInstructions: ex })}
              className="text-left text-[10px] text-amber-400 hover:text-amber-300 truncate transition-colors"
            >
              → {ex}
            </button>
          ))}
        </div>
      </div>

      <div className="rounded-md bg-slate-800/50 border border-border px-3 py-2 text-[10px] text-slate-400 leading-relaxed">
        <strong className="text-slate-300">Supported input formats:</strong><br />
        JSON array, JSON object, CSV text, or <code className="text-amber-400">key: value</code> lines.<br />
        Requires <strong className="text-slate-300">E2B_API_KEY</strong> in your server environment.
      </div>
    </div>
  );
}
