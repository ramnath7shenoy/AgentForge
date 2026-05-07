"use client";

import { useState, useCallback } from "react";
import type {
  SandboxApiKey,
  SandboxNode,
  SandboxEdge,
  SandboxFlowPacket,
  SandboxNodeStatus,
  SandboxLogType,
} from "@/lib/flow/serverExecutor";

export interface SandboxLogEntry {
  id: string;
  timestamp: number;
  type: SandboxLogType;
  message: string;
  nodeId?: string;
}

export interface SandboxExecutionState {
  running: boolean;
  logs: SandboxLogEntry[];
  nodeStatuses: Record<string, SandboxNodeStatus>;
  nodeOutputs: Record<string, SandboxFlowPacket>;
  executedNodeIds: string[];
  finalResult: SandboxFlowPacket | null;
}

export interface SandboxExecutionHook extends SandboxExecutionState {
  run: (
    nodes: SandboxNode[],
    edges: SandboxEdge[],
    input: string,
    apiKeys: SandboxApiKey[]
  ) => Promise<void>;
  clearResult: () => void;
}

export function useSandboxExecution(): SandboxExecutionHook {
  const [running, setRunning] = useState(false);
  const [logs, setLogs] = useState<SandboxLogEntry[]>([]);
  const [nodeStatuses, setNodeStatuses] = useState<Record<string, SandboxNodeStatus>>({});
  const [nodeOutputs, setNodeOutputs] = useState<Record<string, SandboxFlowPacket>>({});
  const [executedNodeIds, setExecutedNodeIds] = useState<string[]>([]);
  const [finalResult, setFinalResult] = useState<SandboxFlowPacket | null>(null);

  const clearResult = useCallback(() => {
    setLogs([]);
    setNodeStatuses({});
    setNodeOutputs({});
    setExecutedNodeIds([]);
    setFinalResult(null);
  }, []);

  const run = useCallback(async (
    nodes: SandboxNode[],
    edges: SandboxEdge[],
    input: string,
    apiKeys: SandboxApiKey[]
  ) => {
    setRunning(true);
    setLogs([]);
    setNodeStatuses({});
    setNodeOutputs({});
    setExecutedNodeIds([]);
    setFinalResult(null);

    const addLog = (type: SandboxLogType, message: string, nodeId?: string) => {
      setLogs((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          timestamp: Date.now(),
          type,
          message,
          nodeId,
        },
      ]);
    };

    try {
      const res = await fetch("/api/sandbox/execute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nodes, edges, input, apiKeys }),
      });

      if (!res.ok || !res.body) {
        addLog("ERROR", `Server error: ${res.status} ${res.statusText}`);
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed.startsWith("data: ")) continue;

          const jsonStr = trimmed.slice(6);
          if (!jsonStr) continue;

          let event: any;
          try {
            event = JSON.parse(jsonStr);
          } catch {
            continue;
          }

          switch (event.t) {
            case "log":
              addLog(event.type, event.message, event.nodeId);
              break;

            case "status":
              setNodeStatuses((prev) => ({ ...prev, [event.nodeId]: event.status }));
              if (event.status === "running" || event.status === "success") {
                setExecutedNodeIds((prev) =>
                  prev.includes(event.nodeId) ? prev : [...prev, event.nodeId]
                );
              }
              break;

            case "output":
              setNodeOutputs((prev) => ({ ...prev, [event.nodeId]: event.packet }));
              break;

            case "result":
              if (event.packet?.payload) setFinalResult(event.packet);
              break;

            case "error":
              addLog("ERROR", event.message);
              break;

            case "done":
              break;
          }
        }
      }
    } catch (err: any) {
      addLog("ERROR", `Network error: ${err.message}`);
    } finally {
      setRunning(false);
    }
  }, []);

  return {
    running,
    logs,
    nodeStatuses,
    nodeOutputs,
    executedNodeIds,
    finalResult,
    run,
    clearResult,
  };
}
