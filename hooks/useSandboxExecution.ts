"use client";

import { useState, useCallback, useEffect } from "react";
import { useCostStore } from "@/stores/useCostStore";
import { formatCost } from "@/lib/utils/tokenCost";
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
  /** Cost incurred only in this sandbox session (never includes editor costs). */
  runCostFormatted: string;
}

export interface SandboxExecutionHook extends SandboxExecutionState {
  run: (
    nodes: SandboxNode[],
    edges: SandboxEdge[],
    input: string,
    apiKeys: SandboxApiKey[]
  ) => Promise<void>;
  clearResult: () => void;
  restoreState: (logs: SandboxLogEntry[], result: SandboxFlowPacket | null) => void;
}

const SANDBOX_RESULT_KEY = "ff_sandbox_last_result";

export function useSandboxExecution(): SandboxExecutionHook {
  const [running, setRunning] = useState(false);
  const [logs, setLogs] = useState<SandboxLogEntry[]>([]);
  const [nodeStatuses, setNodeStatuses] = useState<Record<string, SandboxNodeStatus>>({});
  const [nodeOutputs, setNodeOutputs] = useState<Record<string, SandboxFlowPacket>>({});
  const [executedNodeIds, setExecutedNodeIds] = useState<string[]>([]);
  const [finalResult, setFinalResult] = useState<SandboxFlowPacket | null>(null);
  // Local run cost — isolated from the global editor session cost
  const [runCost, setRunCost] = useState(0);

  const addGlobalCost = useCostStore((s) => s.addCost);

  // sessionStorage is written after each run (see "result" case below).
  // Callers decide whether to restore it via restoreState() — no auto-restore here
  // so stale results from a previous flow never appear on a fresh page open.

  const clearResult = useCallback(() => {
    setLogs([]);
    setNodeStatuses({});
    setNodeOutputs({});
    setExecutedNodeIds([]);
    setFinalResult(null);
    setRunCost(0);
    sessionStorage.removeItem(SANDBOX_RESULT_KEY);
  }, []);

  const restoreState = useCallback((savedLogs: SandboxLogEntry[], result: SandboxFlowPacket | null) => {
    if (savedLogs.length > 0) setLogs(savedLogs);
    if (result) setFinalResult(result);
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
    setRunCost(0);

    const addLog = (type: SandboxLogType, message: string, nodeId?: string) => {
      setLogs((prev) => [
        ...prev,
        { id: crypto.randomUUID(), timestamp: Date.now(), type, message, nodeId },
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
          try { event = JSON.parse(jsonStr); } catch { continue; }

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
              if (event.packet?.payload) {
                setFinalResult(event.packet);
                try { sessionStorage.setItem(SANDBOX_RESULT_KEY, JSON.stringify(event.packet)); } catch { /* ignore */ }
              }
              break;

            case "cost":
              if (typeof event.amount === "number" && event.amount > 0) {
                setRunCost((prev) => prev + event.amount);
                addGlobalCost(event.amount); // accumulate in editor session cost too
              }
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
  }, [addGlobalCost]);

  return {
    running,
    logs,
    nodeStatuses,
    nodeOutputs,
    executedNodeIds,
    finalResult,
    runCostFormatted: runCost > 0 ? formatCost(runCost) : "$0.00",
    run,
    clearResult,
    restoreState,
  };
}
