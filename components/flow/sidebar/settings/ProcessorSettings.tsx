"use client";

import React from "react";
import { cn } from "@/lib/utils";
import { Plus, Trash2, Terminal } from "lucide-react";

export type ProcessorMode = "template" | "switch" | "transform" | "iterate" | "delay" | "set";

interface SwitchCase { match: string; output: string; }
interface Assignment { key: string; value: string; }

interface Props {
  nodeId: string;
  data: Record<string, any>;
  updateData: (updates: Record<string, any>) => void;
}

const SELECT_CLS =
  "rounded-lg p-2 text-sm focus:ring-2 focus:ring-slate-500/20 outline-none transition-all border bg-background border-border text-foreground w-full";

const INPUT_CLS =
  "rounded-lg p-2 text-sm focus:ring-2 focus:ring-slate-500/20 outline-none transition-all border w-full bg-background border-border text-foreground focus:border-slate-500";

const TEXTAREA_CLS =
  "rounded-lg p-3 text-sm focus:ring-2 focus:ring-slate-500/20 outline-none transition-all border resize-none font-mono w-full bg-background border-border text-foreground focus:border-slate-500";

export function ProcessorSettings({ data, updateData }: Props) {
  const mode: ProcessorMode = data.processorMode || "template";
  const switchCases: SwitchCase[] = data.switchCases || [{ match: "", output: "" }];
  const assignments: Assignment[] = data.assignments || [{ key: "", value: "" }];

  const addSwitchCase = () =>
    updateData({ switchCases: [...switchCases, { match: "", output: "" }] });
  const removeSwitchCase = (i: number) =>
    updateData({ switchCases: switchCases.filter((_, idx) => idx !== i) });
  const updateSwitchCase = (i: number, field: keyof SwitchCase, val: string) =>
    updateData({ switchCases: switchCases.map((c, idx) => idx === i ? { ...c, [field]: val } : c) });

  const addAssignment = () =>
    updateData({ assignments: [...assignments, { key: "", value: "" }] });
  const removeAssignment = (i: number) =>
    updateData({ assignments: assignments.filter((_, idx) => idx !== i) });
  const updateAssignment = (i: number, field: keyof Assignment, val: string) =>
    updateData({ assignments: assignments.map((a, idx) => idx === i ? { ...a, [field]: val } : a) });

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2 text-slate-400">
        <Terminal size={16} />
        <h3 className="text-sm font-bold uppercase tracking-tight">Logic Processor</h3>
      </div>

      {/* Mode selector */}
      <div className="flex flex-col gap-2">
        <label className="text-[10px] font-bold uppercase text-slate-500">Mode</label>
        <select className={SELECT_CLS} value={mode} onChange={(e) => updateData({ processorMode: e.target.value })}>
          <option value="iterate">Iterate — loop over each item</option>
          <option value="template">Template — resolve variables</option>
          <option value="switch">Switch — match input to output</option>
          <option value="transform">Transform — map / filter array</option>
          <option value="delay">Delay — pause N milliseconds</option>
          <option value="set">Set Variables — build JSON object</option>
        </select>
      </div>

      {/* ── Template ── */}
      {mode === "template" && (
        <div className="flex flex-col gap-2">
          <label className="text-[10px] font-bold uppercase text-slate-500">Template</label>
          <p className="text-[10px] text-slate-500">
            {"Use {{nodeLabel}} to reference upstream outputs."}
          </p>
          <textarea
            rows={5}
            placeholder={"e.g. Summary: {{trigger}} | Full: {{ai}}"}
            className={TEXTAREA_CLS}
            value={data.template || ""}
            onChange={(e) => updateData({ template: e.target.value })}
          />
        </div>
      )}

      {/* ── Iterate ── */}
      {mode === "iterate" && (
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-2">
            <label className="text-[10px] font-bold uppercase text-slate-500">Input Format</label>
            <select
              className={SELECT_CLS}
              value={data.iterateInputFormat || "lines"}
              onChange={(e) => updateData({ iterateInputFormat: e.target.value })}
            >
              <option value="lines">Lines (split by newline)</option>
              <option value="json">JSON array</option>
              <option value="csv">CSV (comma-separated)</option>
            </select>
          </div>
          <div className="flex flex-col gap-2">
            <label className="text-[10px] font-bold uppercase text-slate-500">Template per item</label>
            <p className="text-[10px] text-slate-500">
              {"Use {{item}} for the current item, {{index}} for its position (0-based)."}
            </p>
            <textarea
              rows={4}
              placeholder={"e.g. {{index}}. {{item}}"}
              className={TEXTAREA_CLS}
              value={data.iterateTemplate || ""}
              onChange={(e) => updateData({ iterateTemplate: e.target.value })}
            />
          </div>
          <div className="flex flex-col gap-2">
            <label className="text-[10px] font-bold uppercase text-slate-500">Join results with</label>
            <input
              className={INPUT_CLS}
              placeholder={String.raw`\n (newline), comma, etc.`}
              value={data.iterateJoin ?? "\\n"}
              onChange={(e) => updateData({ iterateJoin: e.target.value })}
            />
          </div>
        </div>
      )}

      {/* ── Switch ── */}
      {mode === "switch" && (
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-2">
            <label className="text-[10px] font-bold uppercase text-slate-500">Match Type</label>
            <select
              className={SELECT_CLS}
              value={data.switchMatchType || "contains"}
              onChange={(e) => updateData({ switchMatchType: e.target.value })}
            >
              <option value="contains">Contains</option>
              <option value="equals">Equals (exact)</option>
              <option value="startsWith">Starts with</option>
              <option value="regex">Regex</option>
            </select>
          </div>

          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <label className="text-[10px] font-bold uppercase text-slate-500">Cases</label>
              <button
                onClick={addSwitchCase}
                className="text-[10px] font-bold text-indigo-400 hover:text-indigo-300 flex items-center gap-0.5"
              >
                <Plus size={10} /> Add
              </button>
            </div>
            {switchCases.map((c, i) => (
              <div key={i} className="flex flex-col gap-1 p-2 rounded-lg border border-border bg-slate-900/30">
                <div className="flex items-center gap-1">
                  <input
                    className={cn(INPUT_CLS, "text-xs")}
                    placeholder="If input matches..."
                    value={c.match}
                    onChange={(e) => updateSwitchCase(i, "match", e.target.value)}
                  />
                  <button onClick={() => removeSwitchCase(i)} className="text-slate-600 hover:text-rose-400 flex-shrink-0">
                    <Trash2 size={12} />
                  </button>
                </div>
                <input
                  className={cn(INPUT_CLS, "text-xs font-mono")}
                  placeholder="Output when matched..."
                  value={c.output}
                  onChange={(e) => updateSwitchCase(i, "output", e.target.value)}
                />
              </div>
            ))}
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-[10px] font-bold uppercase text-slate-500">Default Output</label>
            <input
              className={INPUT_CLS}
              placeholder="Fallback if no case matches (empty = pass through)"
              value={data.switchDefault || ""}
              onChange={(e) => updateData({ switchDefault: e.target.value })}
            />
          </div>
        </div>
      )}

      {/* ── Transform ── */}
      {mode === "transform" && (
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-2">
            <label className="text-[10px] font-bold uppercase text-slate-500">Operation</label>
            <select
              className={SELECT_CLS}
              value={data.transformOp || "map"}
              onChange={(e) => updateData({ transformOp: e.target.value })}
            >
              <option value="map">Map — transform each item</option>
              <option value="filter">Filter — keep matching items</option>
              <option value="split">Split — text → array</option>
              <option value="join">Join — array → text</option>
            </select>
          </div>

          {(data.transformOp === "map" || data.transformOp === "filter" || !data.transformOp) && (
            <div className="flex flex-col gap-2">
              <label className="text-[10px] font-bold uppercase text-slate-500">
                {data.transformOp === "filter" ? "Keep item if condition is non-empty" : "Template per item"}
              </label>
              <p className="text-[10px] text-slate-500">{"Use {{item}} for the current element."}</p>
              <textarea
                rows={3}
                placeholder={data.transformOp === "filter" ? "{{item}} contains error" : "- {{item}}"}
                className={TEXTAREA_CLS}
                value={data.transformExpr || ""}
                onChange={(e) => updateData({ transformExpr: e.target.value })}
              />
            </div>
          )}

          {data.transformOp === "split" && (
            <div className="flex flex-col gap-2">
              <label className="text-[10px] font-bold uppercase text-slate-500">Split on</label>
              <input
                className={INPUT_CLS}
                placeholder={"\\n (newline), comma, space, etc."}
                value={data.splitOn ?? "\\n"}
                onChange={(e) => updateData({ splitOn: e.target.value })}
              />
            </div>
          )}

          {data.transformOp === "join" && (
            <div className="flex flex-col gap-2">
              <label className="text-[10px] font-bold uppercase text-slate-500">Join with</label>
              <input
                className={INPUT_CLS}
                placeholder={"\\n, comma, space, etc."}
                value={data.joinWith ?? "\\n"}
                onChange={(e) => updateData({ joinWith: e.target.value })}
              />
            </div>
          )}
        </div>
      )}

      {/* ── Delay ── */}
      {mode === "delay" && (
        <div className="flex flex-col gap-2">
          <label className="text-[10px] font-bold uppercase text-slate-500">Delay (ms)</label>
          <input
            type="number"
            min={0}
            max={10000}
            step={100}
            className={INPUT_CLS}
            value={data.delayMs ?? 1000}
            onChange={(e) => updateData({ delayMs: Number(e.target.value) })}
          />
          <p className="text-[10px] text-slate-500">Passes input through unchanged. Max 10 000 ms.</p>
        </div>
      )}

      {/* ── Set Variables ── */}
      {mode === "set" && (
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <label className="text-[10px] font-bold uppercase text-slate-500">Assignments</label>
            <button
              onClick={addAssignment}
              className="text-[10px] font-bold text-indigo-400 hover:text-indigo-300 flex items-center gap-0.5"
            >
              <Plus size={10} /> Add
            </button>
          </div>
          {assignments.map((a, i) => (
            <div key={i} className="flex items-center gap-1">
              <input
                className={cn(INPUT_CLS, "text-xs font-mono")}
                style={{ width: "35%" }}
                placeholder="key"
                value={a.key}
                onChange={(e) => updateAssignment(i, "key", e.target.value)}
              />
              <span className="text-slate-500 text-xs flex-shrink-0">:</span>
              <input
                className={cn(INPUT_CLS, "text-xs font-mono flex-1")}
                placeholder={"value or {{template}}"}
                value={a.value}
                onChange={(e) => updateAssignment(i, "value", e.target.value)}
              />
              <button onClick={() => removeAssignment(i)} className="text-slate-600 hover:text-rose-400 flex-shrink-0">
                <Trash2 size={12} />
              </button>
            </div>
          ))}
          <p className="text-[10px] text-slate-500">
            {"Outputs a JSON object. Use {{nodeLabel}} in values."}
          </p>
        </div>
      )}
    </div>
  );
}
