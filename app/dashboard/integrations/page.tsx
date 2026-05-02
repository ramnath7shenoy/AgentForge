"use client";

import React, { useEffect, useState, useTransition } from "react";
import Navbar from "@/components/ui/Navbar";
import { useFlowStore } from "@/stores/flowStore";
import { APP_REGISTRY, AppDefinition } from "@/lib/providers";
import {
  getIntegrations,
  upsertIntegration,
  deleteIntegration,
} from "@/app/actions/integration";
import {
  Check,
  Unplug,
  ExternalLink,
  Eye,
  EyeOff,
  Loader2,
  PlugZap,
  ChevronRight,
} from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";

interface ConnectedMap {
  [provider: string]: boolean;
}

interface CardState {
  token: string;
  showToken: boolean;
  saving: boolean;
  disconnecting: boolean;
  error: string;
  success: boolean;
}

const defaultCardState = (): CardState => ({
  token: "",
  showToken: false,
  saving: false,
  disconnecting: false,
  error: "",
  success: false,
});

export default function IntegrationsPage() {
  const theme = useFlowStore((s) => s.theme);
  const [connected, setConnected] = useState<ConnectedMap>({});
  const [cardStates, setCardStates] = useState<Record<string, CardState>>(() =>
    Object.fromEntries(APP_REGISTRY.map((a) => [a.id, defaultCardState()]))
  );
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getIntegrations().then((res) => {
      const map: ConnectedMap = {};
      for (const integration of res.integrations ?? []) {
        map[integration.provider] = true;
      }
      setConnected(map);
      setLoading(false);
    });
  }, []);

  const patchCard = (provider: string, patch: Partial<CardState>) =>
    setCardStates((prev) => ({
      ...prev,
      [provider]: { ...prev[provider], ...patch },
    }));

  async function handleConnect(app: AppDefinition) {
    const state = cardStates[app.id];
    if (!state.token.trim()) {
      patchCard(app.id, { error: "Paste your token first." });
      return;
    }
    patchCard(app.id, { saving: true, error: "", success: false });
    try {
      const res = await upsertIntegration(app.id, state.token.trim());
      if ("error" in res && res.error) throw new Error(res.error);
      setConnected((prev) => ({ ...prev, [app.id]: true }));
      patchCard(app.id, { saving: false, success: true, token: "" });
      setTimeout(() => patchCard(app.id, { success: false }), 2500);
    } catch (e: any) {
      patchCard(app.id, { saving: false, error: e.message || "Failed to save." });
    }
  }

  async function handleDisconnect(app: AppDefinition) {
    patchCard(app.id, { disconnecting: true, error: "" });
    try {
      await deleteIntegration(app.id);
      setConnected((prev) => ({ ...prev, [app.id]: false }));
      patchCard(app.id, { disconnecting: false });
    } catch (e: any) {
      patchCard(app.id, { disconnecting: false, error: e.message || "Failed to disconnect." });
    }
  }

  return (
    <div
      className={cn(
        "min-h-screen flex flex-col transition-colors duration-300",
        theme === "dark" ? "bg-[#090c14] text-slate-100" : "bg-slate-50 text-slate-900"
      )}
    >
      <Navbar />

      <main className="flex-1 max-w-5xl mx-auto w-full px-6 py-10">
        {/* Breadcrumb */}
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-8">
          <Link href="/dashboard" className="hover:text-foreground transition-colors">
            Dashboard
          </Link>
          <ChevronRight size={12} />
          <span className="text-foreground font-medium">Integrations</span>
        </div>

        {/* Header */}
        <div className="flex items-start gap-4 mb-10">
          <div className="p-3 rounded-xl bg-violet-500/10 border border-violet-500/20">
            <PlugZap size={22} className="text-violet-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Integrations</h1>
            <p className="text-sm text-muted-foreground mt-1 max-w-lg">
              Connect your apps once. The{" "}
              <span className="font-semibold text-violet-400">App Action</span> node on the canvas
              will automatically use your token — no keys in your workflows.
            </p>
          </div>
        </div>

        {/* Cards grid */}
        {loading ? (
          <div className="flex items-center justify-center py-24">
            <Loader2 size={20} className="animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {APP_REGISTRY.map((app) => {
              const isConnected = !!connected[app.id];
              const state = cardStates[app.id];

              return (
                <div
                  key={app.id}
                  className={cn(
                    "rounded-2xl border p-5 flex flex-col gap-4 transition-all duration-200",
                    theme === "dark"
                      ? "bg-white/[0.03] border-white/8 hover:border-white/12"
                      : "bg-white border-slate-200 hover:border-slate-300 shadow-sm"
                  )}
                >
                  {/* App header */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="text-2xl leading-none">{app.icon}</span>
                      <div>
                        <p className="font-bold text-sm">{app.name}</p>
                        <p className="text-[10px] text-muted-foreground">
                          {app.actions.length} action{app.actions.length !== 1 ? "s" : ""} available
                        </p>
                      </div>
                    </div>

                    {isConnected ? (
                      <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20">
                        <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                        <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider">
                          Connected
                        </span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-500/10 border border-slate-500/20">
                        <div className="w-1.5 h-1.5 rounded-full bg-slate-500" />
                        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                          Not connected
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Available actions list */}
                  <div className="flex flex-wrap gap-1.5">
                    {app.actions.map((action) => (
                      <span
                        key={action.id}
                        className={cn(
                          "text-[9px] font-semibold px-2 py-0.5 rounded-full border uppercase tracking-wider",
                          theme === "dark"
                            ? "border-white/10 text-slate-400 bg-white/5"
                            : "border-slate-200 text-slate-500 bg-slate-50"
                        )}
                      >
                        {action.label}
                      </span>
                    ))}
                  </div>

                  {/* Connect / disconnect */}
                  {isConnected ? (
                    <div className="flex items-center justify-between pt-1 border-t border-border">
                      <p className="text-[10px] text-muted-foreground">
                        Token saved. Re-paste to rotate.
                      </p>
                      <button
                        onClick={() => handleDisconnect(app)}
                        disabled={state.disconnecting}
                        className="flex items-center gap-1.5 text-[10px] font-semibold text-rose-400 hover:text-rose-300 transition-colors disabled:opacity-50"
                      >
                        {state.disconnecting ? (
                          <Loader2 size={11} className="animate-spin" />
                        ) : (
                          <Unplug size={11} />
                        )}
                        Disconnect
                      </button>
                    </div>
                  ) : (
                    <div className="flex flex-col gap-2 pt-1 border-t border-border">
                      <label className="text-[10px] font-bold uppercase text-muted-foreground">
                        {app.tokenLabel}
                      </label>
                      <div className="relative flex items-center">
                        <input
                          type={state.showToken ? "text" : "password"}
                          className={cn(
                            "w-full rounded-lg px-3 pr-9 py-2 text-xs font-mono outline-none border focus:ring-2 focus:ring-violet-500/20 transition-all",
                            "bg-background border-border text-foreground focus:border-violet-500"
                          )}
                          placeholder={app.tokenPlaceholder}
                          value={state.token}
                          onChange={(e) => patchCard(app.id, { token: e.target.value, error: "" })}
                          onKeyDown={(e) => e.key === "Enter" && handleConnect(app)}
                        />
                        <button
                          type="button"
                          onClick={() => patchCard(app.id, { showToken: !state.showToken })}
                          className="absolute right-2.5 text-muted-foreground hover:text-foreground transition-colors"
                        >
                          {state.showToken ? <EyeOff size={12} /> : <Eye size={12} />}
                        </button>
                      </div>

                      {state.error && (
                        <p className="text-[10px] text-rose-400 font-medium">{state.error}</p>
                      )}

                      <div className="flex items-center justify-between gap-2">
                        <a
                          href={app.docsUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground transition-colors"
                        >
                          <ExternalLink size={10} />
                          Where to find this token
                        </a>
                        <button
                          onClick={() => handleConnect(app)}
                          disabled={state.saving || !state.token.trim()}
                          className={cn(
                            "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-bold transition-all",
                            "bg-violet-600 hover:bg-violet-500 text-white disabled:opacity-40 disabled:cursor-not-allowed"
                          )}
                        >
                          {state.saving ? (
                            <Loader2 size={11} className="animate-spin" />
                          ) : state.success ? (
                            <Check size={11} />
                          ) : (
                            <PlugZap size={11} />
                          )}
                          {state.saving ? "Saving…" : state.success ? "Connected!" : "Connect"}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Footer note */}
        <p className="text-[11px] text-muted-foreground text-center mt-10">
          Tokens are stored encrypted in your account and are never exposed to the browser after saving.
        </p>
      </main>
    </div>
  );
}
