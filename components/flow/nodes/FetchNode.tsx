"use client";

import React from "react";
import { Handle, Position, NodeProps } from "reactflow";
import { Database } from "lucide-react";
import { NodeCard } from "@/components/flow/nodes/NodeCard";

interface FetchNodeData {
  label: string;
  apiUrl?: string;
  value?: string;
}

const FetchNode: React.FC<NodeProps<FetchNodeData>> = ({ id, data }) => {
  return (
    <NodeCard nodeId={id}>
      <div className="flex items-center gap-2 text-xs font-medium">
        <Database size={16} />
        <span>{data.label || "Fetch"}</span>
      </div>
      <Handle type="target" position={Position.Top} />
      <Handle type="source" position={Position.Bottom} />
    </NodeCard>
  );
};

export default FetchNode;
