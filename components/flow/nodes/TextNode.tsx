"use client";

import React from "react";
import { NodeProps } from "reactflow";
import { NodeCard } from "./NodeCard";

const TextNode = ({ id, selected }: NodeProps) => {
  return (
    <NodeCard nodeId={id} selected={selected}>
      <div className="text-xs font-medium opacity-70">Text Node</div>
    </NodeCard>
  );
};

export default TextNode;
