"use client";

import { create } from "zustand";

export type LogType = "INFO" | "SUCCESS" | "ERROR" | "WARN";

export interface LogEntry {
  id: string;
  timestamp: number;
  type: LogType;
  message: string;
  nodeId?: string;
  elapsed?: number;
}

interface LogState {
  logs: LogEntry[];
  addLog: (type: LogType, message: string, nodeId?: string, elapsed?: number) => void;
  appendLogMessage: (nodeId: string, chunk: string) => void;
  clearLogs: () => void;
}

export const useLogStore = create<LogState>((set) => ({
  logs: [],

  addLog: (type, message, nodeId, elapsed) => {
    const entry: LogEntry = {
      id: crypto.randomUUID(),
      timestamp: Date.now(),
      type,
      message,
      nodeId,
      elapsed,
    };
    set((s) => ({ logs: [...s.logs, entry] }));
  },

  appendLogMessage: (nodeId, chunk) => {
    set((s) => {
      const logs = [...s.logs];
      for (let i = logs.length - 1; i >= 0; i--) {
        if (logs[i].nodeId === nodeId) {
          logs[i] = { ...logs[i], message: logs[i].message + chunk };
          break;
        }
      }
      return { logs };
    });
  },

  clearLogs: () => set({ logs: [] }),
}));
