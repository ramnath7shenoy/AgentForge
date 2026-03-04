"use client";

import React from "react";
import { Node } from "reactflow";
import { useFlowStore } from "@/stores/flowStore";

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
  const currentContext = useFlowStore((state) => state.currentContext);

  const variableKeys = React.useMemo(() => {
    if (!currentContext) return [];
    const keys = Object.keys(currentContext.variables || {});
    return keys.sort();
  }, [currentContext]);
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
    <div className="p-4 space-y-4 bg-white dark:bg-slate-900 h-full">
      <h2 className="font-bold text-lg mb-2 text-gray-900 dark:text-slate-50">
        {selectedNode.data?.label || "Node"}
      </h2>

      <div>
        <label className="block text-sm font-semibold text-gray-800 dark:text-slate-100">
          Label
        </label>
        <input
          className="border p-2 w-full rounded bg-white dark:bg-slate-900 text-sm text-gray-900 dark:text-slate-100"
          value={selectedNode.data?.label || ""}
          onChange={(e) => updateNodeData("label", e.target.value)}
        />
      </div>

      {selectedNode.type === "input" && (
        <>
          <div>
            <label className="block text-sm font-semibold text-gray-800 dark:text-slate-100">
              User Message
            </label>
            <textarea
              className="border p-2 w-full rounded text-sm bg-white dark:bg-slate-900 text-gray-900 dark:text-slate-100"
              rows={4}
              value={selectedNode.data?.inputText || ""}
              onChange={(e) => updateNodeData("inputText", e.target.value)}
              placeholder="Describe the user, request, or context in plain English..."
            />
          </div>
        </>
      )}

      {selectedNode.type === "fetch" && (
        <>
          <div>
            <label className="block text-sm font-semibold text-gray-800 dark:text-slate-100">
              API URL
            </label>
            <input
              className="border p-2 w-full rounded bg-white dark:bg-slate-900 text-sm text-gray-900 dark:text-slate-100"
              value={selectedNode.data?.url || selectedNode.data?.apiUrl || ""}
              onChange={(e) => updateNodeData("url", e.target.value)}
              placeholder="https://api.example.com/users/{{input.userId}}"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-800 dark:text-slate-100">
              Method
            </label>
            <select
              className="border p-2 w-full rounded bg-white dark:bg-slate-900 text-sm text-gray-900 dark:text-slate-100"
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
            <label className="block text-sm font-semibold text-gray-800 dark:text-slate-100">
              Headers (advanced)
            </label>
            <textarea
              className="border p-2 w-full rounded font-mono text-xs bg-white dark:bg-slate-900 text-gray-900 dark:text-slate-100"
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
            <label className="block text-sm font-semibold text-gray-800 dark:text-slate-100">
              Body (advanced, optional)
            </label>
            <textarea
              className="border p-2 w-full rounded font-mono text-xs bg-white dark:bg-slate-900 text-gray-900 dark:text-slate-100"
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
            <label className="block text-sm font-semibold text-gray-800 dark:text-slate-100">
              What should the AI do?
            </label>
            <textarea
              className="border p-2 w-full rounded bg-white dark:bg-slate-900 text-sm text-gray-900 dark:text-slate-100"
              value={selectedNode.data?.prompt || ""}
              onChange={(e) => updateNodeData("prompt", e.target.value)}
              placeholder="Describe what you want the AI to analyze, transform, or decide..."
              rows={4}
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-800 dark:text-slate-100">
              Temperature
            </label>
            <input
              type="number"
              min={0}
              max={2}
              step={0.1}
              className="border p-2 w-full rounded bg-white dark:bg-slate-900 text-sm text-gray-900 dark:text-slate-100"
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
            <label
              htmlFor="jsonMode"
              className="text-sm text-gray-800 dark:text-slate-100"
            >
              Structured output mode
            </label>
          </div>
        </>
      )}

      {selectedNode.type === "decision" && (
        <>
          <div>
            <label className="block text-sm font-semibold text-gray-800 dark:text-slate-100">
              Expression (boolean)
            </label>
            <input
              className="border p-2 w-full rounded bg-white dark:bg-slate-900 text-sm text-gray-900 dark:text-slate-100"
              value={selectedNode.data?.expression || ""}
              onChange={(e) => updateNodeData("expression", e.target.value)}
              placeholder="{{ai.score}} > 70"
            />
          </div>

          <p className="text-xs text-gray-500 dark:text-slate-400">
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
            <label className="block text-sm font-semibold text-gray-800 dark:text-slate-100">
              Output Message
            </label>
            <p className="mt-0.5 text-xs text-gray-500 dark:text-slate-400">
              Write the message the user should see. Use{" "}
              <code className="font-mono text-[11px] bg-gray-100 dark:bg-slate-800 px-1 rounded">
                {"{{variable}}"}
              </code>{" "}
              to insert dynamic values.
            </p>
            <textarea
              className="mt-1 border p-2 w-full rounded bg-white dark:bg-slate-900 text-sm text-gray-900 dark:text-slate-100"
              value={selectedNode.data?.template || ""}
              onChange={(e) => updateNodeData("template", e.target.value)}
              placeholder="User {{input.userId}} has score {{ai.score}}."
              rows={4}
            />
          </div>
          <div className="flex items-center gap-2 pt-1">
            <span className="text-xs text-gray-500 dark:text-slate-400">
              Insert variable:
            </span>
            <select
              className="border rounded px-2 py-1 text-xs bg-white dark:bg-slate-900 text-gray-800 dark:text-slate-100 disabled:opacity-60"
              defaultValue=""
              disabled={!variableKeys.length}
              onChange={(e) => {
                const token = e.target.value;
                if (!token) return;
                const current = selectedNode.data?.template || "";
                updateNodeData("template", `${current}${token}`);
                e.target.value = "";
              }}
            >
              <option value="">
                {variableKeys.length ? "Select…" : "Run the flow to see variables"}
              </option>
              {variableKeys.map((key) => (
                <option key={key} value={`{{${key}}}`}>
                  {key}
                </option>
              ))}
            </select>
          </div>
        </>
      )}
    </div>
  );
};

export default NodeEditor;
