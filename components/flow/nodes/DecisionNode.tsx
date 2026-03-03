"use client";

import React from "react";
import { Handle, Position, NodeProps } from "reactflow";
import { GitBranch } from "lucide-react";
import { NodeCard } from "@/components/flow/nodes/NodeCard";

const DecisionNode: React.FC<NodeProps> = ({ data, id }) => {
  return (
    <NodeCard nodeId={id}>
      <div className="flex items-center gap-2 text-xs font-medium">
        <GitBranch size={16} />
        <span>{data.label || "Decision"}</span>
      </div>
      <Handle type="target" position={Position.Top} />
      <Handle
        type="source"
        position={Position.Bottom}
        id="true"
      />
      <Handle
        type="source"
        position={Position.Bottom}
        id="false"
      />
    </NodeCard>
  );
};

export default DecisionNode;
