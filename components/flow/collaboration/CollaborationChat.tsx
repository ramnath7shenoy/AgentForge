"use client";
import { useEffect, useRef, useState } from "react";
import { useFlowStore } from "@/stores/flowStore";
import { MessageCircle, X, Send } from "lucide-react";
import { cn } from "@/lib/utils";

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
  currentUserId: string | null;
  displayName: string | null;
}

export default function CollaborationChat({ currentUserId, displayName }: Props) {
  const liveblocks = useFlowStore((s) => (s as any).liveblocks);
  const thread = useFlowStore((s) => (s as any).thread);
  const sendChatMessage = useFlowStore((s) => s.sendChatMessage);
  const collaborationUser = useFlowStore((s) => s.collaborationUser);

  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [unread, setUnread] = useState(0);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const prevLengthRef = useRef(0);

  const messages: ChatMessage[] = Array.isArray(thread) ? (thread as ChatMessage[]) : [];

  // Track unread count when panel is closed
  useEffect(() => {
    if (messages.length > prevLengthRef.current) {
      if (!open) {
        setUnread((u) => u + (messages.length - prevLengthRef.current));
      }
      prevLengthRef.current = messages.length;
    }
  }, [messages.length, open]);

  // Reset unread and scroll on open
  useEffect(() => {
    if (open) {
      setUnread(0);
      setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
      }, 50);
    }
  }, [open]);

  // Auto-scroll on new messages when open
  useEffect(() => {
    if (open) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages.length, open]);

  if (!liveblocks || liveblocks.status === "initial" || liveblocks.status === "disconnected") {
    return null;
  }

  const status = liveblocks.status ?? "disconnected";
  const isStorageLoading = liveblocks.isStorageLoading ?? false;
  if (status === "initial" || status === "disconnected") return null;

  const send = () => {
    const trimmed = text.trim();
    if (!trimmed) return;
    const name = displayName?.trim() || collaborationUser?.name || "Guest";
    const color = collaborationUser?.color ?? "#6366f1";
    const userId = currentUserId ?? `guest`;
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
    <div className="relative flex items-center">
      {/* Toggle button */}
      <button
        onClick={() => setOpen((p) => !p)}
        title="Collaboration Chat"
        className={cn(
          "relative inline-flex items-center justify-center h-8 w-8 rounded-md text-muted-foreground transition-colors",
          "hover:bg-accent hover:text-foreground",
          open && "bg-accent text-foreground"
        )}
      >
        <MessageCircle size={15} />
        {unread > 0 && (
          <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-indigo-500 text-[9px] font-bold text-white">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {/* Chat panel */}
      {open && (
        <div className="absolute right-0 top-10 z-[300] flex flex-col w-72 rounded-xl border border-border bg-popover shadow-2xl overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-3 py-2 border-b border-border bg-card">
            <span className="text-[12px] font-semibold text-foreground flex items-center gap-1.5">
              <MessageCircle size={12} className="text-indigo-400" />
              Collaboration Chat
            </span>
            <button
              onClick={() => setOpen(false)}
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              <X size={14} />
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-3 space-y-2.5 min-h-[200px] max-h-[300px]">
            {isStorageLoading ? (
              <p className="text-center text-[11px] text-muted-foreground py-4">Loading…</p>
            ) : messages.length === 0 ? (
              <p className="text-center text-[11px] text-muted-foreground py-4">
                No messages yet. Say hi!
              </p>
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
                    <div className={cn("flex flex-col gap-0.5 max-w-[180px]", isMe && "items-end")}>
                      <span className="text-[10px] text-muted-foreground">
                        {isMe ? "You" : msg.name} · {formatTime(msg.createdAt)}
                      </span>
                      <span
                        className={cn(
                          "rounded-xl px-2.5 py-1.5 text-[12px] leading-snug break-words",
                          isMe
                            ? "text-white rounded-tr-sm"
                            : "bg-accent text-foreground rounded-tl-sm"
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
      )}
    </div>
  );
}
