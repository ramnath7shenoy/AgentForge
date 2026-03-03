"use client";

import React from "react";
import { useFlowStore } from "@/stores/flowStore";

const ExecutionLogPanel: React.FC = () => {
  const logs = useFlowStore((state) => state.executionLogs);

  return (
    <div className="p-3 text-xs max-h-80 overflow-auto border-t md:border-t-0 md:border-l border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900">
      <details open>
        <summary className="cursor-pointer flex items-center justify-between text-sm font-semibold text-gray-800 dark:text-slate-100">
          <span>Execution Log</span>
          <span className="text-[10px] text-gray-500 dark:text-slate-400">
            {logs.length ? `${logs.length} steps` : "No runs yet"}
          </span>
        </summary>

        <div className="mt-2 space-y-2">
          {!logs.length && (
            <div className="text-[11px] text-gray-500 dark:text-slate-400">
              Run a flow to see execution details.
            </div>
          )}

          {logs.map((log) => (
            <div
              key={log.startedAt + log.nodeId}
              className="border rounded p-2 bg-white dark:bg-slate-800 border-gray-200 dark:border-slate-700"
            >
              <div className="flex items-center justify-between">
                <div className="font-medium text-[11px] text-gray-800 dark:text-slate-100">
                  {log.nodeType} ({log.nodeId})
                </div>
                <span
                  className={`px-2 py-0.5 rounded text-[10px] uppercase ${
                    log.status === "success"
                      ? "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300"
                      : "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300"
                  }`}
                >
                  {log.status}
                </span>
              </div>
              <div className="text-[10px] text-gray-500 dark:text-slate-400 mt-1">
                {log.durationMs} ms
              </div>
              <details className="mt-1">
                <summary className="cursor-pointer">Input</summary>
                <pre className="mt-1 bg-gray-50 dark:bg-slate-900 p-1 rounded overflow-auto">
                  {JSON.stringify(log.inputSnapshot, null, 2)}
                </pre>
              </details>
              <details className="mt-1">
                <summary className="cursor-pointer">Output</summary>
                <pre className="mt-1 bg-gray-50 dark:bg-slate-900 p-1 rounded overflow-auto">
                  {JSON.stringify(log.outputSnapshot, null, 2)}
                </pre>
              </details>
              {log.error && (
                <div className="mt-1 text-[10px] text-red-600 dark:text-red-400">
                  Error: {log.error}
                </div>
              )}
            </div>
          ))}
        </div>
      </details>
    </div>
  );
};

export default ExecutionLogPanel;

