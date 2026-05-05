"use client";

import React, { useState, useRef, useEffect, useMemo, useCallback } from "react";
import { Key, Check, Eye, EyeOff } from "lucide-react";
import { useVaultStore } from "@/stores/vaultStore";
import { cn } from "@/lib/utils";

interface VaultInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  theme?: string;
  isOwner?: boolean;
}

export default function VaultInput({
  value,
  onChange,
  placeholder,
  theme = "dark",
  isOwner = true,
}: VaultInputProps) {
  const isVaultRef = value?.startsWith("{{vault.");
  const hasSavedKey = !!value && !isVaultRef;

  // isEditing: true while the field is focused.
  //   false + hasSavedKey → show literal "••••••••••••" (read-only)
  //   true               → show real value as type="password" (browser dots)
  const [isEditing, setIsEditing] = useState(false);
  // showSecret: eye-icon reveal while isEditing
  const [showSecret, setShowSecret] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [pasteGlow, setPasteGlow] = useState(false);
  const [showKeySaved, setShowKeySaved] = useState(false);

  const entries = useVaultStore((s) => s.entries);
  const keys = useMemo(() => entries.map((e) => e.key), [entries]);
  const containerRef = useRef<HTMLDivElement>(null);
  const glowTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  useEffect(() => () => { if (glowTimerRef.current) clearTimeout(glowTimerRef.current); }, []);

  const triggerPasteGlow = useCallback(() => {
    if (!isOwner) return;
    if (glowTimerRef.current) clearTimeout(glowTimerRef.current);
    setPasteGlow(true);
    setShowKeySaved(true);
    glowTimerRef.current = setTimeout(() => {
      setPasteGlow(false);
      setShowKeySaved(false);
    }, 1200);
  }, [isOwner]);

  // When showing the mask, the input is a plain text field displaying literal dots.
  // When editing, it's a password field (browser-masked) or text (eye revealed).
  const showMask = !isEditing && hasSavedKey;

  const inputType = isVaultRef
    ? "text"
    : showMask
      ? "text"
      : showSecret
        ? "text"
        : "password";

  const inputValue = showMask
    ? "••••••••••••"
    : isOwner
      ? value
      : isVaultRef
        ? value
        : "";

  const inputPlaceholder = !isOwner
    ? "Encrypted — Owner Only"
    : placeholder || "Enter value or use vault key...";

  return (
    <div ref={containerRef} className="relative">
      <input
        type={inputType}
        autoComplete="new-password"
        value={inputValue}
        placeholder={inputPlaceholder}
        readOnly={showMask || !isOwner}
        onChange={(e) => {
          if (!isOwner || showMask) return;
          onChange(e.target.value);
        }}
        onFocus={() => {
          if (!isOwner) return;
          setIsEditing(true);
          setShowSecret(false);
        }}
        onBlur={() => {
          setIsEditing(false);
          setShowSecret(false);
        }}
        onPaste={triggerPasteGlow}
        onCopy={(e) => e.preventDefault()}
        onCut={(e) => e.preventDefault()}
        className={cn(
          "w-full rounded-lg p-2 pr-16 text-sm outline-none transition-all duration-200 border focus:ring-2",
          // Masked state: subdued, cursor-pointer signals "click to edit"
          showMask
            ? theme === "dark"
              ? "bg-slate-900 border-slate-700/60 text-slate-500 cursor-pointer"
              : "bg-slate-50 border-slate-200 text-slate-400 cursor-pointer"
            : theme === "dark"
              ? "bg-slate-900 border-slate-700 text-white focus:ring-indigo-500/20 focus:border-indigo-500"
              : "bg-slate-50 border-slate-200 text-slate-900 focus:ring-indigo-500/20 focus:border-indigo-500",
          pasteGlow && "!border-emerald-500/60 !ring-2 !ring-emerald-500/30",
          isVaultRef && "!text-cyan-400 !border-cyan-500/30 !bg-cyan-500/5",
          !isOwner && "opacity-80 cursor-not-allowed"
        )}
      />

      {/* "Key Saved" badge — flashes 1.2s on paste */}
      {showKeySaved && (
        <span className="absolute left-2.5 top-1/2 -translate-y-1/2 flex items-center gap-1 text-[10px] font-bold text-emerald-400 pointer-events-none animate-in fade-in duration-150">
          <Check size={11} strokeWidth={3} />
          Key saved
        </span>
      )}

      {/* Right-side icon cluster */}
      <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-0.5">
        {/* Show/Hide eye — only while editing a saved key */}
        {isOwner && isEditing && hasSavedKey && !isVaultRef && (
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => setShowSecret((v) => !v)}
            className={cn(
              "p-1 rounded transition-all",
              showSecret
                ? "text-indigo-400 hover:text-indigo-300"
                : "text-slate-500 hover:text-slate-300"
            )}
            title={showSecret ? "Hide key" : "Reveal key"}
          >
            {showSecret ? <EyeOff size={13} /> : <Eye size={13} />}
          </button>
        )}

        {/* Vault key picker */}
        {isOwner && (
          <button
            type="button"
            onClick={() => setShowDropdown(!showDropdown)}
            className={cn(
              "p-1 rounded transition-all",
              isVaultRef
                ? "text-cyan-400 hover:text-cyan-300"
                : "text-slate-500 hover:text-indigo-400"
            )}
            title="Insert vault key"
          >
            <Key size={14} />
          </button>
        )}
      </div>

      {/* Vault key dropdown */}
      {showDropdown && (
        <div
          className={cn(
            "absolute right-0 top-full mt-1 w-full z-50 rounded-xl border shadow-2xl overflow-hidden animate-in slide-in-from-top-1 duration-150",
            theme === "dark"
              ? "bg-[#0b0e14] border-slate-700"
              : "bg-white border-slate-200"
          )}
        >
          <div className="px-3 py-2 border-b border-slate-700/50">
            <span className="text-[9px] font-black uppercase tracking-widest text-slate-500">
              Vault Keys
            </span>
          </div>
          {keys.length > 0 ? (
            keys.map((key) => (
              <button
                key={key}
                type="button"
                onClick={() => {
                  onChange(`{{vault.${key}}}`);
                  setShowDropdown(false);
                }}
                className={cn(
                  "w-full text-left px-3 py-2 text-xs font-mono transition-colors",
                  theme === "dark"
                    ? "hover:bg-slate-800 text-cyan-400"
                    : "hover:bg-slate-50 text-cyan-600"
                )}
              >
                <Key size={10} className="inline mr-2 opacity-50" />
                {key}
              </button>
            ))
          ) : (
            <div className="px-3 py-3 text-[10px] text-slate-500 italic text-center">
              No vault keys configured
            </div>
          )}
        </div>
      )}
    </div>
  );
}
