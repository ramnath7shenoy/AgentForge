"use client";

import React from "react";
import { Handle, Position, NodeProps } from "reactflow";
import { MessageCircle } from "lucide-react";
import { NodeCard } from "@/components/flow/nodes/NodeCard";

interface OutputNodeData {
  label: string;
  template?: string;
}

const OutputNode: React.FC<NodeProps<OutputNodeData>> = ({ id, data }) => {
  return (
    <NodeCard nodeId={id}>
      <div className="flex items-center gap-2 text-xs font-medium">
        <MessageCircle size={16} />
        <span>{data.label || "Output"}</span>
      </div>
      <Handle type="target" position={Position.Top} />
    </NodeCard>
  );
};

export default OutputNode;

