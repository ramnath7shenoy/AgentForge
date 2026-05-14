"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Eye, EyeOff, Zap, CheckCircle2, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";

export default function UpdatePasswordPage() {
  const router = useRouter();
  const supabase = createClient();

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [sessionReady, setSessionReady] = useState(false);

  // Supabase fires PASSWORD_RECOVERY once the recovery session is established
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY" || (session && event === "SIGNED_IN")) {
        setSessionReady(true);
      }
    });

    // Also check if there's already an active session (page reloaded after redirect)
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) setSessionReady(true);
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirm) {
      setError("Passwords don't match.");
      return;
    }

    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);

    if (error) {
      setError(error.message);
    } else {
      setSuccess(true);
      setTimeout(() => router.push("/editor"), 2000);
    }
  };

  const strength = (() => {
    if (password.length === 0) return 0;
    let s = 0;
    if (password.length >= 8) s++;
    if (/[A-Z]/.test(password)) s++;
    if (/[0-9]/.test(password)) s++;
    if (/[^A-Za-z0-9]/.test(password)) s++;
    return s;
  })();

  const strengthLabel = ["", "Weak", "Fair", "Good", "Strong"][strength];
  const strengthColor = ["", "bg-rose-500", "bg-amber-500", "bg-yellow-400", "bg-emerald-500"][strength];

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#080b12] px-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="flex items-center gap-3 mb-8">
          <div className="w-9 h-9 bg-gradient-to-br from-indigo-600 to-violet-700 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-500/30">
            <Zap size={16} className="text-white fill-current" />
          </div>
          <div>
            <h1 className="text-base font-bold text-white tracking-tight">AgentForge</h1>
            <p className="text-[10px] text-slate-500 uppercase tracking-widest font-medium">Password Reset</p>
          </div>
        </div>

        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-8 backdrop-blur-xl shadow-2xl shadow-indigo-500/10">
          {success ? (
            <div className="flex flex-col items-center gap-4 py-4 text-center">
              <div className="w-14 h-14 rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center">
                <CheckCircle2 size={28} className="text-emerald-400" />
              </div>
              <div>
                <p className="text-base font-bold text-white">Password updated!</p>
                <p className="text-xs text-slate-400 mt-1">Redirecting you to the editor…</p>
              </div>
            </div>
          ) : (
            <>
              <h2 className="text-lg font-bold text-white mb-1">Set a new password</h2>
              <p className="text-xs text-slate-400 mb-6">
                {sessionReady
                  ? "Choose a strong password for your account."
                  : "Verifying your reset link…"}
              </p>

              <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                {/* Password field */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                    New Password
                  </label>
                  <div className="relative">
                    <input
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="At least 8 characters"
                      required
                      disabled={!sessionReady}
                      className={cn(
                        "w-full px-4 py-3 pr-10 rounded-xl text-sm text-white placeholder:text-slate-600 border outline-none transition-all",
                        "bg-[#0b0e14] border-slate-700 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20",
                        "disabled:opacity-40 disabled:cursor-not-allowed"
                      )}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((v) => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors"
                    >
                      {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                    </button>
                  </div>

                  {/* Strength bar */}
                  {password.length > 0 && (
                    <div className="flex items-center gap-2 mt-1">
                      <div className="flex-1 flex gap-1">
                        {[1, 2, 3, 4].map((i) => (
                          <div
                            key={i}
                            className={cn(
                              "h-1 flex-1 rounded-full transition-all duration-300",
                              i <= strength ? strengthColor : "bg-slate-800"
                            )}
                          />
                        ))}
                      </div>
                      <span className={cn("text-[10px] font-bold",
                        strength <= 1 ? "text-rose-400" :
                        strength === 2 ? "text-amber-400" :
                        strength === 3 ? "text-yellow-400" : "text-emerald-400"
                      )}>
                        {strengthLabel}
                      </span>
                    </div>
                  )}
                </div>

                {/* Confirm field */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                    Confirm Password
                  </label>
                  <div className="relative">
                    <input
                      type={showConfirm ? "text" : "password"}
                      value={confirm}
                      onChange={(e) => setConfirm(e.target.value)}
                      placeholder="Repeat your password"
                      required
                      disabled={!sessionReady}
                      className={cn(
                        "w-full px-4 py-3 pr-10 rounded-xl text-sm text-white placeholder:text-slate-600 border outline-none transition-all",
                        "bg-[#0b0e14] border-slate-700 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20",
                        confirm.length > 0 && confirm !== password
                          ? "border-rose-500/50 focus:border-rose-500 focus:ring-rose-500/20"
                          : confirm.length > 0 && confirm === password
                          ? "border-emerald-500/50"
                          : "",
                        "disabled:opacity-40 disabled:cursor-not-allowed"
                      )}
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirm((v) => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors"
                    >
                      {showConfirm ? <EyeOff size={15} /> : <Eye size={15} />}
                    </button>
                  </div>
                </div>

                {/* Error */}
                {error && (
                  <div className="flex items-center gap-2 px-3 py-2.5 bg-rose-500/10 border border-rose-500/20 rounded-xl">
                    <AlertCircle size={14} className="text-rose-400 flex-shrink-0" />
                    <p className="text-xs text-rose-400">{error}</p>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading || !sessionReady}
                  className={cn(
                    "w-full py-3 rounded-xl text-sm font-bold transition-all mt-1",
                    "bg-gradient-to-br from-indigo-600 to-violet-700 hover:from-indigo-500 hover:to-violet-600 text-white shadow-lg shadow-indigo-500/20",
                    "disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98]"
                  )}
                >
                  {loading ? (
                    <span className="flex items-center justify-center gap-2">
                      <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Updating…
                    </span>
                  ) : (
                    "Update Password"
                  )}
                </button>
              </form>
            </>
          )}
        </div>

        <p className="text-center text-[11px] text-slate-600 mt-6">
          Back to{" "}
          <a href="/login" className="text-indigo-400 hover:text-indigo-300 transition-colors font-semibold">
            Sign in
          </a>
        </p>
      </div>
    </div>
  );
}
