"use client";

import React, { useState, useRef, useEffect, useMemo } from "react";
import { Key } from "lucide-react";
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
  isOwner = true 
}: VaultInputProps) {
  const [showDropdown, setShowDropdown] = useState(false);
  const entries = useVaultStore((s) => s.entries);
  const keys = useMemo(() => entries.map(e => e.key), [entries]);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const isVaultRef = value?.startsWith("{{vault.");

  const displayValue = useMemo(() => {
    if (isOwner) return value;
    if (isVaultRef) {
      // Show just the key name for guests so they know it's connected
      return value; 
    }
    return value ? "••••••••••••" : "";
  }, [value, isOwner, isVaultRef]);

  return (
    <div ref={containerRef} className="relative">
      <input
        type="text"
        value={displayValue}
        onChange={(e) => isOwner && onChange(e.target.value)}
        placeholder={isOwner ? (placeholder || "Enter value or use vault key...") : "Encrypted - Owner Only"}
        readOnly={!isOwner}
        className={cn(
          "w-full rounded-lg p-2 pr-10 text-sm outline-none transition-all border focus:ring-2",
          theme === "dark"
            ? "bg-slate-900 border-slate-700 text-white focus:ring-indigo-500/20 focus:border-indigo-500"
            : "bg-slate-50 border-slate-200 text-slate-900 focus:ring-indigo-500/20 focus:border-indigo-500",
          isVaultRef && "!text-cyan-400 !border-cyan-500/30 !bg-cyan-500/5",
          !isOwner && "opacity-80 cursor-not-allowed"
        )}
      />

      {/* Key icon button - Only for owners */}
      {isOwner && (
        <button
          type="button"
          onClick={() => setShowDropdown(!showDropdown)}
          className={cn(
            "absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded transition-all",
            isVaultRef
              ? "text-cyan-400 hover:text-cyan-300"
              : "text-slate-500 hover:text-indigo-400"
          )}
          title="Insert vault key"
        >
          <Key size={14} />
        </button>
      )}

      {/* Dropdown menu */}
      {showDropdown && (
        <div className={cn(
          "absolute right-0 top-full mt-1 w-full z-50 rounded-xl border shadow-2xl overflow-hidden animate-in slide-in-from-top-1 duration-150",
          theme === "dark"
            ? "bg-[#0b0e14] border-slate-700"
            : "bg-white border-slate-200"
        )}>
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
