"use client";

import { useRef, useState, useCallback, useEffect } from "react";

export function getSchedulerIntervalMs(nodeData: any): number | null {
  if (!nodeData || nodeData.schedule !== "Schedule") return null;
  const cron = nodeData.cron || "Every Minute";
  switch (cron) {
    case "Every N Seconds":  return Math.max(5, Number(nodeData.intervalSeconds) || 5) * 1000;
    case "Every Minute":     return 60_000;
    case "Every N Minutes":  return Math.max(1, Number(nodeData.intervalMinutes) || 5) * 60_000;
    case "Hourly":           return 3_600_000;
    default:                 return null;
  }
}

/**
 * Simple recursive scheduler: runs runFn(), waits intervalMs, repeats.
 * No getRunning() guard needed — we await each run before scheduling next.
 */
export function useScheduler() {
  const [isActive, setIsActive] = useState(false);
  const isActiveRef = useRef(false);
  const timeoutIdRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const stop = useCallback(() => {
    isActiveRef.current = false;
    if (timeoutIdRef.current !== null) {
      clearTimeout(timeoutIdRef.current);
      timeoutIdRef.current = null;
    }
    setIsActive(false);
  }, []);

  const start = useCallback((
    runFn: () => Promise<void>,
    intervalMs: number,
  ) => {
    if (isActiveRef.current) return;
    isActiveRef.current = true;
    setIsActive(true);

    const loop = async () => {
      if (!isActiveRef.current) return;
      await runFn().catch(() => {});
      if (!isActiveRef.current) return;
      timeoutIdRef.current = setTimeout(loop, intervalMs);
    };

    loop();
  }, []);

  useEffect(() => {
    return () => {
      isActiveRef.current = false;
      if (timeoutIdRef.current !== null) {
        clearTimeout(timeoutIdRef.current);
        timeoutIdRef.current = null;
      }
    };
  }, []);

  return { isActive, start, stop };
}
