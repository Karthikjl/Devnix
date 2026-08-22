"use client";

import React, { useState } from "react";
import { Shield, ShieldAlert, Crown, Lock, Mail, User, ArrowRight, Sparkles, Terminal, Code2 } from "lucide-react";
import { SafeUser } from "@/lib/auth";

interface AuthGatewayProps {
  isSetupNeeded: boolean;
  selfSignupEnabled: boolean;
  onSuccess: (user: SafeUser) => void;
  showToast: (type: "error" | "warning" | "success" | "info", title: string, message?: string) => void;
}

export function AuthGateway({
  isSetupNeeded,
  selfSignupEnabled,
  onSuccess,
  showToast,
}: AuthGatewayProps) {
  const [mode, setMode] = useState<"setup" | "login" | "register">(
    isSetupNeeded ? "setup" : "login"
  );

  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSetupSuperAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    if (password.length < 6) {
      setError("Master password must be at least 6 characters.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/auth/setup-superadmin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          username,
          displayName: displayName || username,
          password,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Super Admin setup failed.");

      showToast("success", "Super Admin Initialized", `Welcome @${data.user.username}! Root access configured.`);
      onSuccess(data.user);
    } catch (err: any) {
      setError(err.message || "Failed to setup Super Admin.");
    } finally {
      setLoading(false);
    }
  };

  const handleLoginOrRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      if (mode === "register") {
        if (password !== confirmPassword) {
          throw new Error("Passwords do not match.");
        }
        if (password.length < 6) {
          throw new Error("Password must be at least 6 characters.");
        }

        const res = await fetch("/api/auth/register", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email,
            username,
            displayName: displayName || username,
            password,
          }),
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Registration failed.");

        showToast("success", "Account Created", `Welcome to Devnix @${data.user.username}!`);
        onSuccess(data.user);
      } else {
        const res = await fetch("/api/auth/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            loginIdentifier: email || username,
            password,
          }),
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Login failed.");

        showToast("success", "Welcome Back", `Signed in as @${data.user.username}`);
        onSuccess(data.user);
      }
    } catch (err: any) {
      setError(err.message || "Authentication failed.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center p-4 bg-[#f6f3eb] relative overflow-hidden">
      {/* Background decoration elements */}
      <div className="absolute -top-24 -left-24 w-96 h-96 rounded-full bg-[#ffe600]/30 blur-3xl pointer-events-none" />
      <div className="absolute -bottom-24 -right-24 w-96 h-96 rounded-full bg-[#00f0ff]/30 blur-3xl pointer-events-none" />

      <div className="w-full max-w-md bg-[#fffdfa] border-[3.5px] border-black rounded-2xl shadow-[8px_8px_0px_#000] overflow-hidden flex flex-col z-10 animate-in fade-in zoom-in-95 duration-200">
        {/* Header Branding */}
        <div className={`p-5 border-b-[2.5px] border-black flex items-center justify-between ${
          mode === "setup" ? "bg-[#ffe600]" : "bg-white"
        }`}>
          <div className="flex items-center gap-3">
            <img
              src="/logo.png"
              alt="Devnix Logo"
              className="w-10 h-10 object-contain rounded-xl border-2 border-black shadow-[2.5px_2.5px_0px_#000] bg-white"
            />
            <div>
              <div className="flex items-center gap-1.5">
                <h1 className="text-xl font-black tracking-tight text-black leading-none">
                  DEVNIX
                </h1>
                <span className="bg-[#ff5277] text-white border border-black text-[9px] font-black uppercase px-1.5 py-0.2 rounded shadow-[1px_1px_0px_#000]">
                  STUDIO ⚡
                </span>
              </div>
              <p className="text-[11px] font-bold text-neutral-600 mt-0.5">
                Secure Code Engine & Live Terminal
              </p>
            </div>
          </div>

          {mode === "setup" ? (
            <div className="bg-[#ff5277] text-white border-2 border-black px-2 py-1 rounded-lg text-[10px] font-black shadow-[2px_2px_0px_#000] flex items-center gap-1">
              <Crown className="w-3.5 h-3.5 fill-white stroke-[2]" />
              <span>SETUP</span>
            </div>
          ) : (
            <div className="bg-[#00f0ff] text-black border-2 border-black px-2 py-1 rounded-lg text-[10px] font-black shadow-[2px_2px_0px_#000] flex items-center gap-1">
              <Lock className="w-3.5 h-3.5" />
              <span>LOCKED</span>
            </div>
          )}
        </div>

        {/* Setup Mode Notice Banner */}
        {mode === "setup" ? (
          <div className="bg-[#f0ede6] border-b-2 border-black p-3.5 px-4 flex items-start gap-2.5">
            <Crown className="w-5 h-5 text-[#d97706] shrink-0 mt-0.5" />
            <div>
              <p className="font-black text-xs text-black">Initial Setup: Provision Root Super Admin</p>
              <p className="text-[11px] font-medium text-neutral-600 leading-tight mt-0.5">
                This is the first launch. Register the master <strong>Super Admin</strong> account. This one-time setup screen will be locked permanently afterward.
              </p>
            </div>
          </div>
        ) : (
          /* Normal Sign In / Register Tabs */
          <div className="p-3 bg-[#f6f3eb] border-b-2 border-black flex gap-2">
            <button
              type="button"
              onClick={() => {
                setMode("login");
                setError(null);
              }}
              className={`flex-1 py-2 text-xs font-black rounded-lg border-2 border-black transition-all cursor-pointer ${
                mode === "login"
                  ? "bg-white shadow-[2px_2px_0px_#000] text-black"
                  : "bg-transparent text-neutral-600 border-transparent hover:bg-neutral-200"
              }`}
            >
              Sign In
            </button>
            {selfSignupEnabled && (
              <button
                type="button"
                onClick={() => {
                  setMode("register");
                  setError(null);
                }}
                className={`flex-1 py-2 text-xs font-black rounded-lg border-2 border-black transition-all cursor-pointer ${
                  mode === "register"
                    ? "bg-[#00f0ff] shadow-[2px_2px_0px_#000] text-black"
                    : "bg-transparent text-neutral-600 border-transparent hover:bg-neutral-200"
                }`}
              >
                Create Account
              </button>
            )}
          </div>
        )}

        {/* Form Body */}
        <form
          onSubmit={mode === "setup" ? handleSetupSuperAdmin : handleLoginOrRegister}
          className="p-5 md:p-6 flex flex-col gap-3.5"
        >
          {error && (
            <div className="p-3 bg-[#ff5277] text-white border-2 border-black rounded-lg font-mono text-xs font-bold shadow-[2px_2px_0px_#000] animate-in fade-in">
              {error}
            </div>
          )}

          {(mode === "setup" || mode === "register") && (
            <div>
              <label className="block text-[11px] font-black uppercase text-neutral-700 mb-1">
                Full Display Name
              </label>
              <div className="relative">
                <User className="w-4 h-4 absolute left-3 top-2.5 text-neutral-500" />
                <input
                  type="text"
                  required
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="Display Name (e.g. Admin)"
                  className="w-full bg-white text-black pl-9 pr-3 py-2 text-xs font-bold border-2 border-black rounded-lg shadow-[2px_2px_0px_#000] outline-none focus:shadow-[3px_3px_0px_#00f0ff]"
                />
              </div>
            </div>
          )}

          <div>
            <label className="block text-[11px] font-black uppercase text-neutral-700 mb-1">
              {mode === "login" ? "Email Address or Username" : "Email Address"}
            </label>
            <div className="relative">
              <Mail className="w-4 h-4 absolute left-3 top-2.5 text-neutral-500" />
              <input
                type={mode === "login" ? "text" : "email"}
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={mode === "login" ? "user@example.com or @username" : "admin@example.com"}
                className="w-full bg-white text-black pl-9 pr-3 py-2 text-xs font-bold border-2 border-black rounded-lg shadow-[2px_2px_0px_#000] outline-none focus:shadow-[3px_3px_0px_#00f0ff]"
              />
            </div>
          </div>

          {(mode === "setup" || mode === "register") && (
            <div>
              <label className="block text-[11px] font-black uppercase text-neutral-700 mb-1">
                Username Handle
              </label>
              <div className="relative">
                <span className="absolute left-3 top-2 text-xs font-bold text-neutral-500 font-mono">@</span>
                <input
                  type="text"
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="username"
                  className="w-full bg-white text-black pl-8 pr-3 py-2 text-xs font-bold font-mono border-2 border-black rounded-lg shadow-[2px_2px_0px_#000] outline-none focus:shadow-[3px_3px_0px_#00f0ff]"
                />
              </div>
            </div>
          )}

          <div>
            <label className="block text-[11px] font-black uppercase text-neutral-700 mb-1">
              {mode === "setup" ? "Master Password" : "Password"}
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 absolute left-3 top-2.5 text-neutral-500" />
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full bg-white text-black pl-9 pr-3 py-2 text-xs font-bold border-2 border-black rounded-lg shadow-[2px_2px_0px_#000] outline-none focus:shadow-[3px_3px_0px_#00f0ff]"
              />
            </div>
          </div>

          {(mode === "setup" || mode === "register") && (
            <div>
              <label className="block text-[11px] font-black uppercase text-neutral-700 mb-1">
                Confirm Password
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 absolute left-3 top-2.5 text-neutral-500" />
                <input
                  type="password"
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-white text-black pl-9 pr-3 py-2 text-xs font-bold border-2 border-black rounded-lg shadow-[2px_2px_0px_#000] outline-none focus:shadow-[3px_3px_0px_#00f0ff]"
                />
              </div>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className={`mt-2 w-full py-3 px-4 text-black font-black text-xs uppercase tracking-wider rounded-xl border-2 border-black shadow-[3.5px_3.5px_0px_#000] hover:translate-x-[1px] hover:translate-y-[1px] active:translate-x-[2px] active:translate-y-[2px] transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 ${
              mode === "setup"
                ? "bg-[#ffe600] hover:bg-[#ffd500]"
                : mode === "login"
                ? "bg-[#22c55e] hover:bg-[#16a34a]"
                : "bg-[#00f0ff] hover:bg-[#00d8e6]"
            }`}
          >
            {loading ? (
              <span>Authenticating...</span>
            ) : mode === "setup" ? (
              <>
                <span>Initialize Platform & Crown Super Admin</span>
                <Crown className="w-4 h-4 fill-black" />
              </>
            ) : mode === "login" ? (
              <>
                <span>Sign In to Devnix</span>
                <ArrowRight className="w-4 h-4" />
              </>
            ) : (
              <>
                <span>Create Account</span>
                <Sparkles className="w-4 h-4" />
              </>
            )}
          </button>
        </form>

        {/* Footer info */}
        <div className="bg-[#f6f3eb] p-3 text-center border-t border-neutral-200 text-[10px] font-mono text-neutral-500">
          Protected with HMAC-SHA256 JWT Authentication & SQLite
        </div>
      </div>
    </div>
  );
}
