"use client";

import { Auth } from "@supabase/auth-ui-react";
import { ThemeSupa } from "@supabase/auth-ui-shared";
import { createClient } from "@/lib/supabase/client";
import { useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";

function LoginContent() {
  const supabase = createClient();
  const router = useRouter();
  const searchParams = useSearchParams();
  const message = searchParams.get("message");

  const isCollaborate = message === "collaborate";

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event) => {
        if (event === "SIGNED_IN") {
          router.push("/editor");
        }
      }
    );
    return () => subscription.unsubscribe();
  }, [supabase, router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#05070a]">
      <div className="w-full max-w-md p-8 rounded-2xl border border-slate-800 bg-slate-900/80 backdrop-blur-xl shadow-2xl shadow-indigo-500/10">
        <div className="flex items-center gap-3 mb-8">
          <div className="w-9 h-9 bg-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-500/30">
            <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="white" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          </div>
          <div>
            <h1 className="text-base font-bold text-white tracking-tight">AgentForge</h1>
            <p className="text-[10px] text-slate-500 uppercase tracking-widest font-medium">
              {isCollaborate ? "Sign in to collaborate in real-time" : "Sign in to save your agents"}
            </p>
          </div>
        </div>

        <Auth
          supabaseClient={supabase}
          appearance={{
            theme: ThemeSupa,
            variables: {
              default: {
                colors: {
                  brand: "#6366f1",
                  brandAccent: "#4f46e5",
                  brandButtonText: "white",
                  defaultButtonBackground: "#1e293b",
                  defaultButtonBackgroundHover: "#334155",
                  inputBackground: "#0b0e14",
                  inputBorder: "#334155",
                  inputBorderHover: "#6366f1",
                  inputBorderFocus: "#6366f1",
                  inputText: "white",
                  inputLabelText: "#94a3b8",
                  inputPlaceholder: "#475569",
                  messageText: "#94a3b8",
                  anchorTextColor: "#818cf8",
                  anchorTextHoverColor: "#6366f1",
                  dividerBackground: "#1e293b",
                },
                radii: {
                  borderRadiusButton: "0.75rem",
                  buttonBorderRadius: "0.75rem",
                  inputBorderRadius: "0.75rem",
                },
                fontSizes: {
                  baseBodySize: "13px",
                  baseInputSize: "13px",
                  baseLabelSize: "12px",
                  baseButtonSize: "13px",
                },
                space: {
                  buttonPadding: "10px 16px",
                  inputPadding: "10px 14px",
                },
              },
            },
          }}
          providers={['google', 'github', 'apple']}
          redirectTo={`${typeof window !== "undefined" ? window.location.origin : ""}/editor`}
        />
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center bg-[#05070a] text-white">Loading...</div>}>
      <LoginContent />
    </Suspense>
  );
}
