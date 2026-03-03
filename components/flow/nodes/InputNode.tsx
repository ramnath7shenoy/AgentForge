"use client";

import React from "react";
import { Handle, Position, NodeProps } from "reactflow";
import { FileJson } from "lucide-react";
import { NodeCard } from "@/components/flow/nodes/NodeCard";

interface InputNodeData {
  label: string;
  rawJson?: string;
}

const InputNode: React.FC<NodeProps<InputNodeData>> = ({ id, data }) => {
  return (
    <NodeCard nodeId={id}>
      <div className="flex items-center gap-2 text-xs font-medium">
        <FileJson size={16} />
        <span>{data.label || "Input"}</span>
      </div>
      <Handle type="source" position={Position.Bottom} />
    </NodeCard>
  );
};

export default InputNode;

