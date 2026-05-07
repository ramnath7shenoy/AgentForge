"use client";

import React, { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { AlertTriangle, Info, XCircle } from "lucide-react";
import { toastBus, type ToastPayload } from "@/lib/utils/toastEvents";

type ToastItem = ToastPayload & { id: string };

export default function ModelFallbackToast() {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  useEffect(() => {
    return toastBus.subscribe((payload) => {
      const id = crypto.randomUUID();
      setToasts((prev) => [...prev, { ...payload, id }]);
      setTimeout(
        () => setToasts((prev) => prev.filter((t) => t.id !== id)),
        payload.duration ?? 4000
      );
    });
  }, []);

  return (
    <div className="fixed top-4 right-4 z-[200] flex flex-col gap-2 pointer-events-none">
      <AnimatePresence>
        {toasts.map((t) => (
          <motion.div
            key={t.id}
            initial={{ opacity: 0, x: 40, scale: 0.95 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: 40, scale: 0.95 }}
            transition={{ type: "spring", stiffness: 320, damping: 28 }}
            className={[
              "pointer-events-auto flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl border",
              "text-[12px] font-medium shadow-xl backdrop-blur-xl max-w-xs",
              t.level === "warn"
                ? "bg-amber-950/90 border-amber-500/40 text-amber-200"
                : t.level === "error"
                ? "bg-rose-950/90 border-rose-500/40 text-rose-200"
                : "bg-slate-900/90 border-slate-600/40 text-slate-200",
            ].join(" ")}
          >
            {t.level === "warn" ? (
              <AlertTriangle size={13} className="text-amber-400 shrink-0" />
            ) : t.level === "error" ? (
              <XCircle size={13} className="text-rose-400 shrink-0" />
            ) : (
              <Info size={13} className="text-slate-400 shrink-0" />
            )}
            {t.message}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
