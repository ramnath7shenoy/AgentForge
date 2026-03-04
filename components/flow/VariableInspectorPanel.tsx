"use client";

import React from "react";
import { useFlowStore } from "@/stores/flowStore";

const VariableInspectorPanel: React.FC = () => {
  const context = useFlowStore((state) => state.currentContext);
  const logs = useFlowStore((state) => state.executionLogs);

  const latestAiLog = [...logs].reverse().find((l) => l.nodeType === "ai");
  const latestDecisionLog = [...logs]
    .reverse()
    .find((l) => l.nodeType === "decision");

  const inputValue = context?.variables?.input as any;
  const userMessage =
    typeof inputValue === "string"
      ? inputValue
      : inputValue?.text ?? JSON.stringify(inputValue ?? {}, null, 2);

  return (
    <div className="p-3 text-xs max-h-80 overflow-auto border-t md:border-t-0 md:border-l border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900">
      <details open>
        <summary className="cursor-pointer flex items-center justify-between text-sm font-semibold text-gray-800 dark:text-slate-100">
          <span>Variables</span>
          <span className="text-[10px] text-gray-500 dark:text-slate-400">
            {context ? "Last run context" : "No runs yet"}
          </span>
        </summary>

        {context && (
          <div className="mt-2 space-y-3">
            <section className="rounded-lg border border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-900/80 p-2.5">
              <div className="flex items-center justify-between mb-1">
                <h4 className="text-[11px] font-semibold text-gray-800 dark:text-slate-100">
                  INPUT
                </h4>
                <button
                  type="button"
                  className="text-[10px] text-indigo-600 dark:text-indigo-300 underline-offset-2 hover:underline"
                  onClick={() => {
                    if (navigator.clipboard) {
                      navigator.clipboard.writeText(String(userMessage ?? ""));
                    }
                  }}
                >
                  Copy
                </button>
              </div>
              <div className="text-[11px] text-gray-700 dark:text-slate-200">
                <div className="font-medium mb-0.5">User Message</div>
                <div className="font-mono text-[11px]">
                  {userMessage || "—"}
                </div>
              </div>
            </section>

            {latestAiLog && (
              <section className="rounded-lg border border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-900/80 p-2.5">
                <div className="flex items-center justify-between mb-1">
                  <h4 className="text-[11px] font-semibold text-gray-800 dark:text-slate-100">
                    AI RESULT
                  </h4>
                  <button
                    type="button"
                    className="text-[10px] text-indigo-600 dark:text-indigo-300 underline-offset-2 hover:underline"
                    onClick={() => {
                      if (navigator.clipboard) {
                        navigator.clipboard.writeText(
                          JSON.stringify(latestAiLog.outputSnapshot, null, 2),
                        );
                      }
                    }}
                  >
                    Copy
                  </button>
                </div>
                <div className="text-[11px] text-gray-700 dark:text-slate-200 space-y-0.5">
                  {typeof latestAiLog.outputSnapshot === "object" &&
                  latestAiLog.outputSnapshot !== null ? (
                    <>
                      {"score" in (latestAiLog.outputSnapshot as any) && (
                        <div>
                          <span className="font-medium">Score:</span>{" "}
                          <span className="font-mono">
                            {
                              (latestAiLog.outputSnapshot as any)
                                .score as unknown as string
                            }
                          </span>
                        </div>
                      )}
                      {"summary" in (latestAiLog.outputSnapshot as any) && (
                        <div>
                          <span className="font-medium">Summary:</span>{" "}
                          <span className="font-mono">
                            {
                              (latestAiLog.outputSnapshot as any)
                                .summary as unknown as string
                            }
                          </span>
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="font-mono text-[11px]">
                      {String(latestAiLog.outputSnapshot ?? "—")}
                    </div>
                  )}
                </div>
              </section>
            )}

            {latestDecisionLog && (
              <section className="rounded-lg border border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-900/80 p-2.5">
                <div className="flex items-center justify-between mb-1">
                  <h4 className="text-[11px] font-semibold text-gray-800 dark:text-slate-100">
                    DECISION RESULT
                  </h4>
                  <button
                    type="button"
                    className="text-[10px] text-indigo-600 dark:text-indigo-300 underline-offset-2 hover:underline"
                    onClick={() => {
                      if (navigator.clipboard) {
                        navigator.clipboard.writeText(
                          JSON.stringify(
                            latestDecisionLog.outputSnapshot,
                            null,
                            2,
                          ),
                        );
                      }
                    }}
                  >
                    Copy
                  </button>
                </div>
                <div className="text-[11px] text-gray-700 dark:text-slate-200 space-y-0.5">
                  <div>
                    <span className="font-medium">Condition:</span>{" "}
                    <span className="font-mono">
                      {(latestDecisionLog.outputSnapshot as any)?.expression ??
                        "—"}
                    </span>
                  </div>
                  <div>
                    <span className="font-medium">Result:</span>{" "}
                    <span className="font-mono">
                      {(latestDecisionLog.outputSnapshot as any)?.result ===
                      true
                        ? "TRUE"
                        : (latestDecisionLog.outputSnapshot as any)?.result ===
                          false
                        ? "FALSE"
                        : "—"}
                    </span>
                  </div>
                </div>
              </section>
            )}
          </div>
        )}
        {!context && (
          <div className="mt-2 text-[11px] text-gray-500 dark:text-slate-400">
            Run a flow to inspect variables.
          </div>
        )}
      </details>
    </div>
  );
};

export default VariableInspectorPanel;

