"use client";
import { useEffect, useRef, useState } from "react";
import { useFlowStore } from "@/stores/flowStore";
import { Send } from "lucide-react";
import { cn } from "@/lib/utils";

function getOtherUser(other: any) {
  return other?.info || other?.presence?.collaborationUser || { name: "Guest", color: "#64748b" };
}

interface ChatMessage {
  id: string;
  userId: string;
  name: string;
  color: string;
  text: string;
  createdAt: number;
}

function formatTime(ts: number) {
  return new Date(ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

interface Props {
  currentUserId?: string | null;
  displayName?: string | null;
}

export default function CollaborationStatus({ currentUserId, displayName }: Props) {
  const liveblocks = useFlowStore((s) => (s as any).liveblocks);
  const self = useFlowStore((s) => s.collaborationUser);
  const thread = useFlowStore((s) => (s as any).thread);
  const sendChatMessage = useFlowStore((s) => s.sendChatMessage);

  const [showPanel, setShowPanel] = useState(false);
  const [text, setText] = useState("");
  const [unread, setUnread] = useState(0);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const prevLengthRef = useRef(0);
  const panelRef = useRef<HTMLDivElement>(null);

  const messages: ChatMessage[] = Array.isArray(thread) ? (thread as ChatMessage[]) : [];

  // Close panel on outside click
  useEffect(() => {
    if (!showPanel) return;
    const handler = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setShowPanel(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [showPanel]);

  // Track unread when panel is closed
  useEffect(() => {
    if (messages.length > prevLengthRef.current) {
      if (!showPanel) {
        setUnread((u) => u + (messages.length - prevLengthRef.current));
      }
      prevLengthRef.current = messages.length;
    }
  }, [messages.length, showPanel]);

  // Reset unread + scroll on open
  useEffect(() => {
    if (showPanel) {
      setUnread(0);
      setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }), 80);
    }
  }, [showPanel]);

  // Auto-scroll on new messages
  useEffect(() => {
    if (showPanel) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages.length, showPanel]);

  if (!liveblocks) return null;

  const others = liveblocks.others ?? [];
  const status = liveblocks.status ?? "disconnected";
  const isStorageLoading = liveblocks.isStorageLoading ?? false;

  if (status === "initial" || status === "disconnected") return null;

  const isConnected = status === "connected" && !isStorageLoading;
  const isSyncing = status === "connecting" || status === "reconnecting" || isStorageLoading;

  const visibleOthers = others.slice(0, 4);
  const extraCount = others.length - 4;

  const send = () => {
    const trimmed = text.trim();
    if (!trimmed) return;
    const name = displayName?.trim() || self?.name || "Guest";
    const color = self?.color ?? "#6366f1";
    const userId = currentUserId ?? "guest";
    sendChatMessage({
      id: crypto.randomUUID(),
      userId,
      name,
      color,
      text: trimmed,
      createdAt: Date.now(),
    });
    setText("");
  };

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  };

  return (
    <div className="relative flex items-center gap-2" ref={panelRef}>
      {/* Live / Syncing badge */}
      {isConnected ? (
        <span className="flex items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-0.5 text-[11px] font-semibold text-emerald-400">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
          Live
        </span>
      ) : isSyncing ? (
        <span className="flex items-center gap-1 rounded-full bg-amber-500/15 px-2 py-0.5 text-[11px] font-semibold text-amber-400">
          <span className="h-1.5 w-1.5 rounded-full bg-amber-400 animate-pulse" />
          Syncing…
        </span>
      ) : null}

      {/* Avatar row — click to open panel */}
      <button
        onClick={() => setShowPanel((p) => !p)}
        className="relative flex items-center -space-x-1.5"
        title={others.length > 0 ? `${others.length} collaborator${others.length !== 1 ? "s" : ""} · click to chat` : "Open collaboration panel"}
      >
        {/* Self avatar */}
        {self && (
          <span
            className="inline-flex h-6 w-6 items-center justify-center rounded-full border-2 border-background text-[10px] font-bold text-white shadow ring-1 ring-white/20"
            style={{ backgroundColor: self.color }}
            title="You"
          >
            {self.name?.[0]?.toUpperCase() ?? "?"}
          </span>
        )}
        {visibleOthers.map((other: any, i: number) => {
          const u = getOtherUser(other);
          return (
            <span
              key={other.connectionId ?? i}
              className="inline-flex h-6 w-6 items-center justify-center rounded-full border-2 border-background text-[10px] font-bold text-white shadow"
              style={{ backgroundColor: u.color }}
              title={u.name}
            >
              {u.name?.[0]?.toUpperCase() ?? "?"}
            </span>
          );
        })}
        {extraCount > 0 && (
          <span className="inline-flex h-6 w-6 items-center justify-center rounded-full border-2 border-background bg-slate-600 text-[10px] font-bold text-white shadow">
            +{extraCount}
          </span>
        )}
        {/* Unread badge */}
        {unread > 0 && (
          <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-indigo-500 text-[9px] font-bold text-white z-10">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {/* Dropdown panel: online list + chat */}
      {showPanel && (
        <div className="absolute right-0 top-9 z-[300] w-64 rounded-xl border border-border bg-popover shadow-2xl overflow-hidden flex flex-col">

          {/* Online users */}
          <div className="px-3 pt-3 pb-2 border-b border-border">
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              Online now
            </p>
            <ul className="space-y-1.5">
              {/* Self */}
              {self && (
                <li className="flex items-center gap-2">
                  <span
                    className="inline-flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white"
                    style={{ backgroundColor: self.color }}
                  >
                    {self.name?.[0]?.toUpperCase() ?? "?"}
                  </span>
                  <p className="truncate text-[12px] font-medium text-foreground">
                    {displayName?.trim() || self.name} <span className="text-muted-foreground font-normal">(you)</span>
                  </p>
                </li>
              )}
              {others.map((other: any, i: number) => {
                const u = getOtherUser(other);
                const hoveredNodeId = other?.presence?.hoveredNodeId;
                return (
                  <li key={other.connectionId ?? i} className="flex items-center gap-2">
                    <span
                      className="inline-flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white"
                      style={{ backgroundColor: u.color }}
                    >
                      {u.name?.[0]?.toUpperCase() ?? "?"}
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-[12px] font-medium text-foreground">{u.name}</p>
                      {hoveredNodeId && (
                        <p className="truncate text-[10px] text-muted-foreground">hovering a node</p>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>

          {/* Chat */}
          <div className="flex flex-col flex-1">
            <div className="overflow-y-auto p-3 space-y-2.5 min-h-[160px] max-h-[260px]">
              {isStorageLoading ? (
                <p className="text-center text-[11px] text-muted-foreground py-4">Loading…</p>
              ) : messages.length === 0 ? (
                <p className="text-center text-[11px] text-muted-foreground py-4">No messages yet. Say hi!</p>
              ) : (
                messages.map((msg) => {
                  const isMe = msg.userId === currentUserId;
                  return (
                    <div key={msg.id} className={cn("flex gap-2", isMe && "flex-row-reverse")}>
                      <span
                        className="flex-shrink-0 inline-flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-bold text-white"
                        style={{ backgroundColor: msg.color }}
                      >
                        {msg.name?.[0]?.toUpperCase() ?? "?"}
                      </span>
                      <div className={cn("flex flex-col gap-0.5 max-w-[160px]", isMe && "items-end")}>
                        <span className="text-[10px] text-muted-foreground">
                          {isMe ? "You" : msg.name} · {formatTime(msg.createdAt)}
                        </span>
                        <span
                          className={cn(
                            "rounded-xl px-2.5 py-1.5 text-[12px] leading-snug break-words",
                            isMe ? "text-white rounded-tr-sm" : "bg-accent text-foreground rounded-tl-sm"
                          )}
                          style={isMe ? { backgroundColor: msg.color } : undefined}
                        >
                          {msg.text}
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <div className="flex items-center gap-2 px-3 py-2 border-t border-border bg-card">
              <input
                type="text"
                value={text}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={handleKey}
                placeholder="Message…"
                maxLength={500}
                className="flex-1 bg-transparent text-[12px] text-foreground placeholder:text-muted-foreground outline-none"
              />
              <button
                onClick={send}
                disabled={!text.trim()}
                className="inline-flex items-center justify-center h-6 w-6 rounded-md bg-indigo-500 text-white disabled:opacity-40 transition-opacity hover:bg-indigo-600"
              >
                <Send size={11} />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
