// Lightweight cross-context event bus for model-fallback toasts.
// No browser APIs — safe to import in both client and server modules.
// Subscribers register in React components; server-side emits are no-ops.

export type ToastLevel = "info" | "warn" | "error";

export interface ToastPayload {
  message: string;
  level: ToastLevel;
  /** Auto-dismiss delay in ms (default 4000) */
  duration?: number;
}

type ToastHandler = (payload: ToastPayload) => void;

const _handlers = new Set<ToastHandler>();

export const toastBus = {
  emit: (payload: ToastPayload) => _handlers.forEach((h) => h(payload)),
  subscribe: (handler: ToastHandler): (() => void) => {
    _handlers.add(handler);
    return () => _handlers.delete(handler);
  },
};
