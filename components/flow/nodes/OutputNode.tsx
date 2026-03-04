"use client";

import React from "react";
import { Handle, Position, NodeProps } from "reactflow";
import { MessageCircle } from "lucide-react";
import { NodeCard } from "@/components/flow/nodes/NodeCard";
import { useFlowStore } from "@/stores/flowStore";

interface OutputNodeData {
  label: string;
  template?: string;
}

const OutputNode: React.FC<NodeProps<OutputNodeData>> = ({ id, data }) => {
  const context = useFlowStore((state) => state.currentContext);
  const preview =
    (context?.nodes?.[id] as string | undefined) ??
    (context?.variables?.output as string | undefined);

  return (
    <NodeCard nodeId={id}>
      <div className="flex items-center gap-2 text-xs font-medium text-slate-900 dark:text-slate-50">
        <MessageCircle size={16} className="text-indigo-500" />
        <span>{data.label || "Output"}</span>
      </div>
      {preview && (
        <div className="mt-1 text-[10px] text-gray-400 dark:text-slate-300">
          <div className="font-semibold">Preview</div>
          <div className="mt-0.5 rounded bg-gray-50 dark:bg-slate-900/80 px-2 py-1 font-mono text-[10px] whitespace-pre-wrap break-all">
            {preview}
          </div>
        </div>
      )}
      <Handle type="target" position={Position.Top} />
    </NodeCard>
  );
};

export default OutputNode;

