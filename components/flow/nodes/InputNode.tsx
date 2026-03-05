"use client";

import React from "react";
import { Handle, Position, NodeProps } from "reactflow";
import { FileJson } from "lucide-react";
import { NodeCard } from "@/components/flow/nodes/NodeCard";

interface InputNodeData {
  label: string;
}

const InputNode: React.FC<NodeProps<InputNodeData>> = ({ id, data }) => {
  return (
    <NodeCard nodeId={id}>
      <div className="flex items-center gap-2 text-xs font-medium text-slate-900 dark:text-slate-50">
        <FileJson size={16} className="text-indigo-500" />
        <span>{data.label || "Input Node"}</span>
      </div>

      <Handle
        type="source"
        position={Position.Bottom}
        style={{
          bottom: -6,
        }}
      />
    </NodeCard>
  );
};

export default InputNode;