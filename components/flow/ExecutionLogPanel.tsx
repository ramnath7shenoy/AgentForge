"use client";

import React from "react";
import { CheckCircle2, Loader2, AlertTriangle, Trash2 } from "lucide-react";
import { useFlowStore } from "@/stores/flowStore";
import type { ExecutionLogEntry } from "@/types/flowStoreTypes";

const formatDuration = (ms: number) => {
  if (ms < 1000) return `${ms} ms`;
  const seconds = ms / 1000;
  return `${seconds.toFixed(2)} s`;
};

const ExecutionLogPanel: React.FC = () => {
  const logs = useFlowStore((state) => state.executionLogs);
  const nodes = useFlowStore((state) => state.nodes);

  const getNodeLabel = (log: ExecutionLogEntry) => {
    const node = nodes.find((n) => n.id === log.nodeId);
    return node?.data?.label || log.nodeType || `Node ${log.nodeId}`;
  };

  const handleClearLogs = () => {
    useFlowStore.setState({ executionLogs: [] });
  };

  const renderStatusIcon = (status: ExecutionLogEntry["status"]) => {
    if (status === "success") {
      return (
        <span className="inline-flex items-center gap-1 text-[10px] font-medium text-green-700 dark:text-green-300">
          <CheckCircle2 className="w-3 h-3" />
          Success
        </span>
      );
    }
    if (status === "pending") {
      return (
        <span className="inline-flex items-center gap-1 text-[10px] font-medium text-indigo-700 dark:text-indigo-300">
          <Loader2 className="w-3 h-3 animate-spin" />
          Running
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 text-[10px] font-medium text-red-700 dark:text-red-300">
        <AlertTriangle className="w-3 h-3" />
        Error
      </span>
    );
  };

  return (
    <div className="p-3 text-xs max-h-80 overflow-auto border-t md:border-t-0 md:border-l border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900">
      <details open>
        <summary className="cursor-pointer flex items-center justify-between text-sm font-semibold text-gray-800 dark:text-slate-100">
          <span>Execution Log</span>
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-gray-500 dark:text-slate-400">
              {logs.length ? `${logs.length} steps` : "No runs yet"}
            </span>
            {logs.length > 0 && (
              <button
                onClick={(e) => { e.preventDefault(); handleClearLogs(); }}
                className="flex items-center gap-1 text-[10px] text-rose-500 hover:text-rose-400 transition-colors px-2 py-0.5 rounded-md hover:bg-rose-500/10"
                title="Clear all logs"
              >
                <Trash2 size={10} />
                Clear
              </button>
            )}
          </div>
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
              className="border rounded-lg p-2.5 bg-white dark:bg-slate-800/80 border-gray-200 dark:border-slate-700"
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex flex-col">
                  <span className="font-medium text-[11px] text-gray-900 dark:text-slate-50">
                    {getNodeLabel(log)}
                  </span>
                  <span className="text-[10px] text-gray-500 dark:text-slate-400">
                    Node ID: {log.nodeId}
                  </span>
                </div>
                {renderStatusIcon(log.status)}
              </div>
              <div className="mt-1 text-[10px] text-gray-500 dark:text-slate-400">
                Execution time: {formatDuration(log.durationMs)}
              </div>
              <details className="mt-1">
                <summary className="cursor-pointer text-[11px] text-gray-700 dark:text-slate-300">
                  Input
                </summary>
                <pre className="mt-1 bg-gray-50 dark:bg-slate-900/80 p-1.5 rounded overflow-auto text-[10px] text-gray-800 dark:text-slate-100">
                  {JSON.stringify(log.inputSnapshot, null, 2)}
                </pre>
              </details>
              <details className="mt-1">
                <summary className="cursor-pointer text-[11px] text-gray-700 dark:text-slate-300">
                  Output
                </summary>
                <pre className="mt-1 bg-gray-50 dark:bg-slate-900/80 p-1.5 rounded overflow-auto text-[10px] text-gray-800 dark:text-slate-100">
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
