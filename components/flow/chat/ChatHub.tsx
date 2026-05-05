"use client";

import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  MessageSquare,
  X,
  Send,
  Sparkles,
  User,
  BrainCircuit,
  Terminal,
  Trash2,
} from "lucide-react";
import { useFlowStore } from "@/stores/flowStore";
import { isApprovalPending, resolveApproval } from "@/lib/approvalGate";
import { cn } from "@/lib/utils";

export default function ChatHub() {
  const {
    chatHistory,
    clearChatHistory,
    runClientFlow,
    addMessage,
    isRunning,
    isChatOpen: isOpen,
    setIsChatOpen: setIsOpen,
    nodes,
    updateNodeData,
    theme,
  } = useFlowStore();

  const [inputText, setInputText] = useState("");
  const [awaitingApproval, setAwaitingApproval] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const inputNode = nodes.find((n) => n.type === "input");

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  // Scroll to bottom whenever history grows or panel opens
  useEffect(() => {
    if (isOpen) scrollToBottom();
  }, [chatHistory.length, isOpen]);

  // Poll the approval gate so the input unlocks while the flow is paused
  useEffect(() => {
    if (!isRunning) { setAwaitingApproval(false); return; }
    const id = setInterval(() => setAwaitingApproval(isApprovalPending()), 150);
    return () => clearInterval(id);
  }, [isRunning]);

  // Focus input when panel opens
  useEffect(() => {
    if (isOpen && (!isRunning || awaitingApproval)) {
      setTimeout(() => inputRef.current?.focus(), 120);
    }
  }, [isOpen, isRunning, awaitingApproval]);

  // Keep input box in sync with the canvas input node (canvas → chat direction)
  useEffect(() => {
    if (inputNode) {
      const nodeText =
        inputNode.data?.packet?.payload || inputNode.data?.instructions || "";
      if (typeof nodeText === "string" && nodeText !== inputText && !isRunning) {
        setInputText(nodeText);
      }
    }
  }, [inputNode, isRunning]);

  const APPROVAL_WORDS = ['go', 'post', 'yes', 'approve', 'send', 'confirm', 'publish', 'proceed', 'ok'];

  const handleSend = async () => {
    if (!inputText.trim()) return;
    if (isRunning && !awaitingApproval) return;

    const submittedText = inputText.trim();
    setInputText(""); // clear immediately so UI feels responsive

    // Flow is paused at an approval/gatekeeper node — route to gate
    if (awaitingApproval) {
      addMessage("user", submittedText);
      const words = submittedText.toLowerCase().split(/\W+/);
      const isApproval = APPROVAL_WORDS.some((w) => words.includes(w));
      resolveApproval(isApproval);
      return;
    }

    // Normal turn — sync text to input node then run flow
    if (inputNode) {
      updateNodeData(inputNode.id, {
        packet: { type: "text", payload: submittedText },
      });
    }
    await runClientFlow(submittedText);
    // Guard: canvas-sync useEffect fires when isRunning goes false. If the
    // node packet is briefly non-empty at that moment, it would restore the
    // old text. Explicitly clear again so the box stays empty.
    setInputText("");
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const turnCount = Math.ceil(
    chatHistory.filter((m) => m.role === "user").length
  );

  return (
    <>
      {/* ── Floating Action Button ── */}
      <motion.button
        onClick={() => setIsOpen(true)}
        className={cn(
          "fixed bottom-20 right-6 z-[60] p-3 rounded-full border transition-all shadow-2xl group active:scale-95",
          "bg-[#0a0a0a]/90 backdrop-blur-xl border-violet-500/50 hover:bg-violet-900/50 hover:border-violet-400",
          "focus:outline-none focus:ring-2 focus:ring-violet-500",
          isOpen ? "hidden" : "flex items-center justify-center pointer-events-auto"
        )}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
      >
        <MessageSquare size={22} className="text-violet-400 group-hover:text-white" />

        {/* Running pulse */}
        {isRunning && (
          <span className="absolute -top-1 -right-1 flex h-3 w-3">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-violet-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-3 w-3 bg-violet-500" />
          </span>
        )}

        {/* Unread turn badge */}
        {!isRunning && turnCount > 0 && (
          <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-violet-600 text-[9px] font-bold text-white border border-black">
            {turnCount > 99 ? "99+" : turnCount}
          </span>
        )}
      </motion.button>

      {/* ── Floating Chat Panel ── */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 50, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 50, scale: 0.95 }}
            transition={{ type: "spring", stiffness: 300, damping: 25 }}
            className="fixed bottom-24 right-6 w-80 sm:w-96 h-[520px] max-h-[75vh] z-[60] flex flex-col rounded-2xl shadow-2xl overflow-hidden border border-white/10 bg-[#050505]/95 backdrop-blur-2xl"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-white/10 bg-gradient-to-r from-violet-900/20 to-transparent shrink-0">
              <div className="flex items-center gap-2">
                <div className="flex h-6 w-6 items-center justify-center rounded-md bg-violet-500/20 border border-violet-500/40">
                  <BrainCircuit size={13} className="text-violet-400" />
                </div>
                <h3 className="text-[11px] font-bold uppercase tracking-widest text-slate-200">
                  Agent Hub
                </h3>
                {chatHistory.length > 0 && (
                  <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded-full bg-violet-500/15 border border-violet-500/20 text-violet-400">
                    {turnCount} turn{turnCount !== 1 ? "s" : ""}
                  </span>
                )}
              </div>

              <div className="flex items-center gap-1">
                {/* Clear conversation */}
                {chatHistory.length > 0 && (
                  <button
                    onClick={() => {
                      if (confirm("Clear conversation history?")) clearChatHistory();
                    }}
                    className="p-1.5 rounded-md text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
                    title="Clear conversation"
                  >
                    <Trash2 size={13} />
                  </button>
                )}
                <button
                  onClick={() => setIsOpen(false)}
                  className="p-1.5 rounded-md text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
                >
                  <X size={15} />
                </button>
              </div>
            </div>

            {/* Message List */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-thin scrollbar-thumb-white/10">
              {chatHistory.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-slate-500 gap-3">
                  <Sparkles size={22} className="opacity-20 text-violet-400" />
                  <p className="text-xs text-center border px-4 py-2 rounded-xl border-white/5 bg-white/5">
                    Connect an AI node and run the flow to start the conversation.
                  </p>
                </div>
              ) : (
                // Render the FULL chatHistory — no slicing, no filtering
                chatHistory.map((msg, index) => (
                  <motion.div
                    key={index}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.2 }}
                    className={cn(
                      "flex gap-2.5 max-w-[88%]",
                      msg.role === "user" ? "ml-auto flex-row-reverse" : "mr-auto"
                    )}
                  >
                    {/* Avatar */}
                    <div
                      className={cn(
                        "flex-shrink-0 h-6 w-6 rounded-full flex items-center justify-center border shadow-sm mt-0.5",
                        msg.role === "user"
                          ? "bg-slate-800 border-slate-700"
                          : "bg-violet-900/40 border-violet-500/40"
                      )}
                    >
                      {msg.role === "user" ? (
                        <User size={11} className="text-slate-300" />
                      ) : (
                        <Terminal size={11} className="text-violet-300" />
                      )}
                    </div>

                    {/* Bubble */}
                    <div
                      className={cn(
                        "px-3 py-2 rounded-2xl text-[13px] leading-relaxed break-words whitespace-pre-wrap",
                        msg.role === "user"
                          ? "bg-slate-800 text-slate-100 rounded-tr-sm"
                          : "bg-white/5 border border-white/10 text-slate-200 rounded-tl-sm shadow-inner"
                      )}
                    >
                      {msg.content}
                    </div>
                  </motion.div>
                ))
              )}

              {/* Typing / running indicator */}
              {isRunning && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="flex gap-2.5 mr-auto items-center"
                >
                  <div className="relative flex-shrink-0 h-6 w-6 rounded-full flex items-center justify-center bg-violet-900/40 border border-violet-500/40">
                    <Terminal size={11} className="text-violet-300 relative z-10" />
                    <span className="absolute inset-0 rounded-full border border-violet-500 animate-ping opacity-40" />
                  </div>
                  <div className="bg-white/5 border border-white/10 px-4 py-2.5 rounded-2xl rounded-tl-sm shadow-inner flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-violet-400 animate-bounce" style={{ animationDelay: "0ms" }} />
                    <span className="w-1.5 h-1.5 rounded-full bg-violet-400 animate-bounce" style={{ animationDelay: "120ms" }} />
                    <span className="w-1.5 h-1.5 rounded-full bg-violet-400 animate-bounce" style={{ animationDelay: "240ms" }} />
                  </div>
                </motion.div>
              )}

              <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <div className="shrink-0 p-3 bg-black/60 border-t border-white/10">
              <div className="relative flex items-center gap-2">
                <input
                  ref={inputRef}
                  type="text"
                  value={inputText}
                  disabled={isRunning && !awaitingApproval}
                  onChange={(e) => {
                    setInputText(e.target.value);
                    if (!awaitingApproval && inputNode) {
                      updateNodeData(inputNode.id, {
                        packet: { type: "text", payload: e.target.value },
                      });
                    }
                  }}
                  onKeyDown={handleKeyDown}
                  placeholder={
                    awaitingApproval
                      ? "Type \"go\" to approve or \"abort\" to cancel…"
                      : isRunning
                      ? "Agent resolving…"
                      : "Type a message…"
                  }
                  className="w-full bg-[#0a0a0a] border border-white/10 rounded-full pl-4 pr-10 py-2.5 text-[13px] text-white placeholder-slate-500 outline-none focus:border-violet-500/50 focus:ring-1 focus:ring-violet-500/50 transition-all disabled:opacity-50"
                  autoComplete="off"
                />
                <button
                  disabled={!inputText.trim() || (isRunning && !awaitingApproval)}
                  onClick={handleSend}
                  className="absolute right-1 p-2 rounded-full bg-violet-600 text-white disabled:opacity-40 disabled:bg-slate-800 disabled:text-slate-500 hover:bg-violet-500 transition-colors shadow-lg shadow-violet-500/20"
                >
                  {isRunning ? (
                    <Sparkles size={13} className="animate-pulse" />
                  ) : (
                    <Send size={13} className="ml-0.5" />
                  )}
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
