"use client";

import React from "react";
import { Node } from "reactflow";

interface NodeEditorProps {
  selectedNode: Node | null;
  setNodes: (nodes: Node[]) => void;
  nodes: Node[];
}

const NodeEditor: React.FC<NodeEditorProps> = ({
  selectedNode,
  setNodes,
  nodes,
}) => {
  if (!selectedNode) {
    return (
      <div className="p-4 text-gray-500">
        Select a node to edit its settings
      </div>
    );
  }

  const updateNodeData = (field: string, value: any) => {
    if (!selectedNode) return;

    const updatedNodes = nodes.map((n) =>
      n.id === selectedNode.id
        ? { ...n, data: { ...n.data, [field]: value } }
        : n
    );

    setNodes(updatedNodes);
  };

  return (
    <div className="p-4 space-y-4">
      <h2 className="font-bold text-lg mb-2">
        {selectedNode.data?.label || "Node"}
      </h2>

      <div>
        <label className="block text-sm font-semibold">Label</label>
        <input
          className="border p-2 w-full rounded"
          value={selectedNode.data?.label || ""}
          onChange={(e) => updateNodeData("label", e.target.value)}
        />
      </div>

      {selectedNode.type === "input" && (
        <>
          <div>
            <label className="block text-sm font-semibold">
              Describe your input
            </label>
            <textarea
              className="border p-2 w-full rounded text-sm"
              rows={4}
              value={selectedNode.data?.inputText || ""}
              onChange={(e) => updateNodeData("inputText", e.target.value)}
              placeholder="Describe the user, request, or context you want to start with..."
            />
          </div>

          <div className="flex items-center gap-2">
            <input
              id="input-json-mode"
              type="checkbox"
              checked={selectedNode.data?.inputMode === "json"}
              onChange={(e) =>
                updateNodeData("inputMode", e.target.checked ? "json" : "text")
              }
            />
            <label htmlFor="input-json-mode" className="text-sm">
              Advanced JSON mode
            </label>
          </div>

          {selectedNode.data?.inputMode === "json" && (
            <div>
              <label className="block text-sm font-semibold">JSON Input</label>
              <textarea
                className="border p-2 w-full rounded font-mono text-xs"
                rows={6}
                value={selectedNode.data?.rawJson || ""}
                onChange={(e) => updateNodeData("rawJson", e.target.value)}
                placeholder='{\n  "userId": "123",\n  "amount": 42\n}'
              />
            </div>
          )}
        </>
      )}

      {selectedNode.type === "fetch" && (
        <>
          <div>
            <label className="block text-sm font-semibold">API URL</label>
            <input
              className="border p-2 w-full rounded"
              value={selectedNode.data?.url || selectedNode.data?.apiUrl || ""}
              onChange={(e) => updateNodeData("url", e.target.value)}
              placeholder="https://api.example.com/users/{{input.userId}}"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold">Method</label>
            <select
              className="border p-2 w-full rounded"
              value={selectedNode.data?.method || "GET"}
              onChange={(e) => updateNodeData("method", e.target.value)}
            >
              <option>GET</option>
              <option>POST</option>
              <option>PUT</option>
              <option>DELETE</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-semibold">
              Headers (JSON)
            </label>
            <textarea
              className="border p-2 w-full rounded font-mono text-xs"
              rows={4}
              value={
                selectedNode.data?.headers
                  ? JSON.stringify(selectedNode.data.headers, null, 2)
                  : ""
              }
              onChange={(e) => {
                try {
                  const parsed = JSON.parse(e.target.value || "{}");
                  updateNodeData("headers", parsed);
                } catch {
                  updateNodeData("headers", undefined);
                }
              }}
              placeholder='{\n  "Authorization": "Bearer {{input.token}}"\n}'
            />
          </div>

          <div>
            <label className="block text-sm font-semibold">
              Body (JSON, optional)
            </label>
            <textarea
              className="border p-2 w-full rounded font-mono text-xs"
              rows={4}
              value={
                selectedNode.data?.body
                  ? JSON.stringify(selectedNode.data.body, null, 2)
                  : ""
              }
              onChange={(e) => {
                try {
                  const parsed = JSON.parse(e.target.value || "null");
                  updateNodeData("body", parsed);
                } catch {
                  updateNodeData("body", undefined);
                }
              }}
              placeholder='{\n  "userId": "{{input.userId}}"\n}'
            />
          </div>
        </>
      )}

      {selectedNode.type === "ai" && (
        <>
          <div>
            <label className="block text-sm font-semibold">
              What should the AI do?
            </label>
            <textarea
              className="border p-2 w-full rounded"
              value={selectedNode.data?.prompt || ""}
              onChange={(e) => updateNodeData("prompt", e.target.value)}
              placeholder="Describe what you want the AI to analyze, transform, or decide..."
              rows={4}
            />
          </div>

          <div>
            <label className="block text-sm font-semibold">Temperature</label>
            <input
              type="number"
              min={0}
              max={2}
              step={0.1}
              className="border p-2 w-full rounded"
              value={
                selectedNode.data?.temperature !== undefined
                  ? selectedNode.data.temperature
                  : 0.7
              }
              onChange={(e) =>
                updateNodeData("temperature", parseFloat(e.target.value))
              }
            />
          </div>

          <div className="flex items-center gap-2">
            <input
              id="jsonMode"
              type="checkbox"
              checked={Boolean(selectedNode.data?.jsonMode)}
              onChange={(e) => updateNodeData("jsonMode", e.target.checked)}
            />
            <label htmlFor="jsonMode" className="text-sm">
              Structured output mode
            </label>
          </div>
        </>
      )}

      {selectedNode.type === "decision" && (
        <>
          <div>
            <label className="block text-sm font-semibold">
              Expression (boolean)
            </label>
            <input
              className="border p-2 w-full rounded"
              value={selectedNode.data?.expression || ""}
              onChange={(e) => updateNodeData("expression", e.target.value)}
              placeholder="{{ai.score}} > 70"
            />
          </div>

          <p className="text-xs text-gray-500">
            Example:{" "}
            <code>
              {"{{ai.score}} > 70"}
            </code>
          </p>
        </>
      )}

      {selectedNode.type === "output" && (
        <>
          <div>
            <label className="block text-sm font-semibold">
              Output Template
            </label>
            <textarea
              className="border p-2 w-full rounded"
              value={selectedNode.data?.template || ""}
              onChange={(e) => updateNodeData("template", e.target.value)}
              placeholder="User {{input.userId}} has score {{ai.score}}."
              rows={4}
            />
          </div>
        </>
      )}
    </div>
  );
};

export default NodeEditor;
