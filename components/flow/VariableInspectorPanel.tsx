"use client";

import React from "react";
import { useFlowStore } from "@/stores/flowStore";

const VariableInspectorPanel: React.FC = () => {
  const context = useFlowStore((state) => state.currentContext);

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
          <div className="mt-2 space-y-2">
            <details open>
              <summary className="cursor-pointer">context.variables</summary>
              <pre className="mt-1 bg-gray-50 dark:bg-slate-900 p-1 rounded overflow-auto max-h-32">
                {JSON.stringify(context.variables, null, 2)}
              </pre>
            </details>
            <details>
              <summary className="cursor-pointer">context.nodes</summary>
              <pre className="mt-1 bg-gray-50 dark:bg-slate-900 p-1 rounded overflow-auto max-h-32">
                {JSON.stringify(context.nodes, null, 2)}
              </pre>
            </details>
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

