"use client";

import React, { useEffect, useState, useTransition } from "react";
import Navbar from "@/components/ui/Navbar";
import { useFlowStore } from "@/stores/flowStore";
import { APP_REGISTRY, AppDefinition, ConnectField, AppProvider } from "@/lib/providers";
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

const BRAND_ICONS: Record<AppProvider, { svg: React.ReactNode; bg: string }> = {
  x: {
    bg: "#000000",
    svg: (
      <svg viewBox="0 0 24 24" fill="white" className="w-5 h-5">
        <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.746l7.73-8.835L1.254 2.25H8.08l4.253 5.622zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
      </svg>
    ),
  },
  slack: {
    bg: "#4A154B",
    svg: (
      <svg viewBox="0 0 24 24" fill="none" className="w-5 h-5">
        <path d="M5.042 15.165a2.528 2.528 0 0 1-2.52 2.523A2.528 2.528 0 0 1 0 15.165a2.527 2.527 0 0 1 2.522-2.52h2.52v2.52zm1.271 0a2.527 2.527 0 0 1 2.521-2.52 2.527 2.527 0 0 1 2.521 2.52v6.313A2.528 2.528 0 0 1 8.834 24a2.528 2.528 0 0 1-2.521-2.522v-6.313zM8.834 5.042a2.528 2.528 0 0 1-2.521-2.52A2.528 2.528 0 0 1 8.834 0a2.528 2.528 0 0 1 2.521 2.522v2.52H8.834zm0 1.271a2.528 2.528 0 0 1 2.521 2.521 2.528 2.528 0 0 1-2.521 2.521H2.522A2.528 2.528 0 0 1 0 8.834a2.528 2.528 0 0 1 2.522-2.521h6.312zm10.122 2.521a2.528 2.528 0 0 1 2.522-2.521A2.528 2.528 0 0 1 24 8.834a2.528 2.528 0 0 1-2.522 2.521h-2.522V8.834zm-1.268 0a2.528 2.528 0 0 1-2.523 2.521 2.527 2.527 0 0 1-2.52-2.521V2.522A2.527 2.527 0 0 1 15.165 0a2.528 2.528 0 0 1 2.523 2.522v6.312zm-2.523 10.122a2.528 2.528 0 0 1 2.523 2.522A2.528 2.528 0 0 1 15.165 24a2.527 2.527 0 0 1-2.52-2.522v-2.522h2.52zm0-1.268a2.527 2.527 0 0 1-2.52-2.523 2.526 2.526 0 0 1 2.52-2.52h6.313A2.527 2.527 0 0 1 24 15.165a2.528 2.528 0 0 1-2.522 2.523h-6.313z" fill="white" />
      </svg>
    ),
  },
  discord: {
    bg: "#5865F2",
    svg: (
      <svg viewBox="0 0 24 24" fill="white" className="w-5 h-5">
        <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057c.001.022.015.04.033.05a19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z" />
      </svg>
    ),
  },
  github: {
    bg: "#24292e",
    svg: (
      <svg viewBox="0 0 24 24" fill="white" className="w-5 h-5">
        <path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12" />
      </svg>
    ),
  },
  notion: {
    bg: "#ffffff",
    svg: (
      <svg viewBox="0 0 24 24" fill="#000000" className="w-5 h-5">
        <path d="M4.459 4.208c.746.606 1.026.56 2.428.466l13.215-.793c.28 0 .047-.28-.046-.326L17.86 1.968c-.42-.326-.981-.7-2.055-.607L3.01 2.295c-.466.046-.56.28-.374.466zm.793 3.08v13.904c0 .747.373 1.027 1.214.98l14.523-.84c.841-.046.935-.56.935-1.167V6.354c0-.606-.233-.933-.748-.887l-15.177.887c-.56.047-.747.327-.747.933zm14.337.745c.093.42 0 .84-.42.888l-.7.14v10.264c-.608.327-1.168.514-1.635.514-.748 0-.935-.234-1.495-.933l-4.577-7.186v6.952L12.21 19s0 .84-1.168.84l-3.222.186c-.093-.186 0-.653.327-.746l.84-.233V9.854L7.822 9.76c-.094-.42.14-1.026.793-1.073l3.456-.233 4.764 7.279v-6.44l-1.215-.139c-.093-.514.28-.887.747-.933zM1.936 1.035l13.31-.98c1.634-.14 2.055-.047 3.082.7l4.249 2.986c.7.513.934.653.934 1.213v16.378c0 1.026-.373 1.634-1.68 1.726l-15.458.934c-.98.047-1.448-.093-1.962-.747l-3.129-4.06c-.56-.747-.793-1.306-.793-1.96V2.667c0-.839.374-1.54 1.447-1.632z" />
      </svg>
    ),
  },
  instagram: {
    bg: "#E1306C",
    svg: (
      <svg viewBox="0 0 24 24" fill="white" className="w-5 h-5">
        <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838a6.162 6.162 0 1 0 0 12.324 6.162 6.162 0 0 0 0-12.324zM12 16a4 4 0 1 1 0-8 4 4 0 0 1 0 8zm6.406-11.845a1.44 1.44 0 1 0 0 2.881 1.44 1.44 0 0 0 0-2.881z" />
      </svg>
    ),
  },
  linkedin: {
    bg: "#0077B5",
    svg: (
      <svg viewBox="0 0 24 24" fill="white" className="w-5 h-5">
        <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 0 1-2.063-2.065 2.064 2.064 0 1 1 2.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
      </svg>
    ),
  },
  medium: {
    bg: "#000000",
    svg: (
      <svg viewBox="0 0 24 24" fill="white" className="w-5 h-5">
        <path d="M13.54 12a6.8 6.8 0 0 1-6.77 6.82A6.8 6.8 0 0 1 0 12a6.8 6.8 0 0 1 6.77-6.82A6.8 6.8 0 0 1 13.54 12zm7.42 0c0 3.54-1.51 6.42-3.38 6.42-1.87 0-3.39-2.88-3.39-6.42s1.52-6.42 3.39-6.42 3.38 2.88 3.38 6.42M24 12c0 3.17-.53 5.75-1.19 5.75-.66 0-1.19-2.58-1.19-5.75s.53-5.75 1.19-5.75C23.47 6.25 24 8.83 24 12z" />
      </svg>
    ),
  },
};

interface ConnectedMap {
  [provider: string]: boolean;
}

interface CardState {
  fieldValues: Record<string, string>;
  showToken: boolean;
  saving: boolean;
  disconnecting: boolean;
  error: string;
  success: boolean;
}

const defaultCardState = (): CardState => ({
  fieldValues: {},
  showToken: false,
  saving: false,
  disconnecting: false,
  error: "",
  success: false,
});

function getConnectFields(app: AppDefinition): ConnectField[] {
  if (app.connectFields && app.connectFields.length > 0) return app.connectFields;
  return [{ key: "token", label: app.tokenLabel, placeholder: app.tokenPlaceholder, secret: true }];
}

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
    const fields = getConnectFields(app);
    const state = cardStates[app.id];

    const missing = fields.filter((f) => !state.fieldValues[f.key]?.trim());
    if (missing.length > 0) {
      patchCard(app.id, { error: `Required: ${missing.map((f) => f.label).join(", ")}` });
      return;
    }

    patchCard(app.id, { saving: true, error: "", success: false });
    try {
      // Single-field: store value directly. Multi-field: store as JSON.
      const accessToken = fields.length === 1
        ? state.fieldValues[fields[0].key].trim()
        : JSON.stringify(
            Object.fromEntries(fields.map((f) => [f.key, state.fieldValues[f.key]?.trim() ?? ""]))
          );

      const res = await upsertIntegration(app.id, accessToken);
      if ("error" in res && res.error) throw new Error(res.error);
      setConnected((prev) => ({ ...prev, [app.id]: true }));
      patchCard(app.id, { saving: false, success: true, fieldValues: {} });
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
                      <div
                        className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                        style={{ backgroundColor: BRAND_ICONS[app.id]?.bg ?? "#1e293b" }}
                      >
                        {BRAND_ICONS[app.id]?.svg ?? <span className="text-lg">{app.icon}</span>}
                      </div>
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
                        Credentials saved. Re-paste to rotate.
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
                      {getConnectFields(app).map((field, idx, fields) => {
                        const isLastSecret = field.secret && idx === fields.length - 1;
                        return (
                          <div key={field.key}>
                            <label className="text-[10px] font-bold uppercase text-muted-foreground mb-1 block">
                              {field.label}
                            </label>
                            <div className="relative flex items-center">
                              <input
                                type={field.secret && !state.showToken ? "password" : "text"}
                                className={cn(
                                  "w-full rounded-lg px-3 py-2 text-xs font-mono outline-none border focus:ring-2 focus:ring-violet-500/20 transition-all",
                                  isLastSecret ? "pr-9" : "pr-3",
                                  "bg-background border-border text-foreground focus:border-violet-500"
                                )}
                                placeholder={field.placeholder}
                                value={state.fieldValues[field.key] ?? ""}
                                onChange={(e) =>
                                  patchCard(app.id, {
                                    fieldValues: { ...state.fieldValues, [field.key]: e.target.value },
                                    error: "",
                                  })
                                }
                                onKeyDown={(e) => e.key === "Enter" && handleConnect(app)}
                              />
                              {isLastSecret && (
                                <button
                                  type="button"
                                  onClick={() => patchCard(app.id, { showToken: !state.showToken })}
                                  className="absolute right-2.5 text-muted-foreground hover:text-foreground transition-colors"
                                >
                                  {state.showToken ? <EyeOff size={12} /> : <Eye size={12} />}
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })}

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
                          disabled={state.saving || getConnectFields(app).some((f) => !state.fieldValues[f.key]?.trim())}
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
