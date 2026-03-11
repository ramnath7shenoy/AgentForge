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

  clearLogs: () => set({ logs: [] }),
}));
