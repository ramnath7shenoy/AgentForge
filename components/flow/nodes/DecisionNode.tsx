"use client";

import React from "react";
import { Handle, Position, NodeProps } from "reactflow";
import { GitBranch } from "lucide-react";
import { NodeCard } from "@/components/flow/nodes/NodeCard";
import { useFlowStore } from "@/stores/flowStore";

const DecisionNode: React.FC<NodeProps> = ({ data, id }) => {
  const context = useFlowStore((state) => state.currentContext);
  const nodeState = context?.nodes?.[id] as
    | { result?: boolean; expression?: string }
    | undefined;

  const result = nodeState?.result;
  const expression = nodeState?.expression || data.expression || data.condition;

  return (
    <NodeCard nodeId={id}>
      <div className="flex items-center gap-2 text-xs font-medium text-slate-900 dark:text-slate-50">
        <GitBranch size={16} className="text-indigo-500" />
        <span>{data.label || "Decision"}</span>
      </div>
      {expression && (
        <div className="mt-1 text-[10px] text-gray-400 dark:text-slate-300">
          <div className="font-semibold">Condition</div>
          <div className="font-mono text-[10px]">{expression}</div>
        </div>
      )}
      {result !== undefined && (
        <div className="mt-1 text-[10px]">
          <div className="font-semibold text-gray-600 dark:text-slate-300">
            Result
          </div>
          <div
            className={
              result
                ? "font-semibold text-green-600 dark:text-green-400"
                : "font-semibold text-red-600 dark:text-red-400"
            }
          >
            {result ? "TRUE" : "FALSE"}
          </div>
        </div>
      )}
      <Handle type="target" position={Position.Top} />
      <Handle
        type="source"
        position={Position.Bottom}
        id="true"
        className={
          result === true
            ? "bg-green-500 border-green-500 animate-pulse"
            : "bg-gray-300"
        }
      />
      <Handle
        type="source"
        position={Position.Bottom}
        id="false"
        className={
          result === false
            ? "bg-red-500 border-red-500 animate-pulse"
            : "bg-gray-300"
        }
      />
    </NodeCard>
  );
};

export default DecisionNode;
