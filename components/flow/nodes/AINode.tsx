"use client";

import React from "react";
import { Handle, Position, NodeProps } from "reactflow";
import { Cpu } from "lucide-react";
import { NodeCard } from "@/components/flow/nodes/NodeCard";

const AINode: React.FC<NodeProps> = ({ id, data }) => {
  return (
    <NodeCard nodeId={id}>
      <div className="flex items-center gap-2 text-xs font-medium">
        <Cpu size={16} />
        <span>{data.label || "AI"}</span>
      </div>
      <Handle type="target" position={Position.Top} />
      <Handle type="source" position={Position.Bottom} />
    </NodeCard>
  );
};

export default AINode;
