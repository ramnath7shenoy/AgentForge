"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Zap, LayoutDashboard, Cpu, HelpCircle, Lock, Shield } from "lucide-react";
import { useVaultStore } from "@/stores/vaultStore";
import { cn } from "@/lib/utils";

export default function Navbar() {
  const pathname = usePathname();
  const entries = useVaultStore((s) => s.entries);
  const vaultHealthy = entries.length > 0;

  const links = [
    { href: "/dashboard", label: "Dashboard", icon: <LayoutDashboard size={14} /> },
    { href: "/editor", label: "Editor", icon: <Cpu size={14} /> },
  ];

  return (
    <header className="flex items-center justify-between border-b border-slate-800 px-6 py-3 bg-[#0b0e14] z-50">
      <div className="flex items-center gap-6">
        <Link href="/" className="flex items-center gap-2">
          <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center shadow-lg shadow-indigo-500/20">
            <Zap size={16} className="text-white fill-current" />
          </div>
          <span className="font-bold tracking-tight text-sm uppercase text-white">AgentForge</span>
        </Link>

        <div className="h-4 w-[1px] bg-slate-800" />

        <nav className="flex items-center gap-1">
          {links.map(link => (
            <Link
              key={link.href}
              href={link.href}
              className={cn(
                "flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all",
                pathname === link.href
                  ? link.href === "/dashboard"
                    ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                    : "bg-slate-800 text-indigo-400"
                  : "text-slate-500 hover:text-slate-300 hover:bg-slate-900"
              )}
            >
              {link.icon}
              {link.label}
            </Link>
          ))}
        </nav>
      </div>

      <div className="flex items-center gap-3">
        {/* System Health */}
        <div className={cn(
          "flex items-center gap-2 px-3 py-1.5 rounded-lg border text-[10px] font-bold uppercase tracking-wider",
          vaultHealthy
            ? "border-emerald-500/20 bg-emerald-500/5 text-emerald-400"
            : "border-rose-500/20 bg-rose-500/5 text-rose-400"
        )}>
          <div className={cn(
            "w-2 h-2 rounded-full",
            vaultHealthy ? "bg-emerald-400 animate-pulse" : "bg-rose-400 animate-pulse"
          )} />
          <Shield size={10} />
          {vaultHealthy ? "Vault Active" : "No Secrets"}
        </div>
      </div>
    </header>
  );
}
