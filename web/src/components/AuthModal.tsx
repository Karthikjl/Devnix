"use client";

import React, { useState } from "react";
import { X, Lock, Mail, User, ShieldCheck, ArrowRight, Sparkles } from "lucide-react";
import { SafeUser } from "@/lib/auth";

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (user: SafeUser) => void;
  selfSignupEnabled?: boolean;
}

export function AuthModal({ isOpen, onClose, onSuccess, selfSignupEnabled = true }: AuthModalProps) {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
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

        onSuccess(data.user);
        onClose();
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

        onSuccess(data.user);
        onClose();
      }
    } catch (err: any) {
      setError(err.message || "An error occurred.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-150">
      <div className="w-full max-w-md bg-[#fffdfa] border-[3px] border-black rounded-2xl shadow-[6px_6px_0px_#000] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="bg-[#ffe600] border-b-[2.5px] border-black p-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="bg-white border-2 border-black p-1.5 rounded-lg shadow-[2px_2px_0px_#000]">
              <ShieldCheck className="w-5 h-5 text-black" />
            </div>
            <div>
              <h2 className="text-base font-black uppercase tracking-tight text-black">
                {mode === "login" ? "Devnix Account Login" : "Create Devnix Account"}
              </h2>
              <p className="text-[11px] font-bold text-neutral-800">
                {mode === "login" ? "Sign in to save files & sync workspace" : "First registered user becomes Admin"}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg border-2 border-black bg-white hover:bg-red-50 text-black shadow-[2px_2px_0px_#000] hover:translate-x-[1px] hover:translate-y-[1px] transition-all"
          >
            <X className="w-4 h-4 stroke-[3]" />
          </button>
        </div>

        {/* Tab switcher */}
        <div className="p-3 bg-[#f6f3eb] border-b-2 border-black flex gap-2">
          <button
            type="button"
            onClick={() => {
              setMode("login");
              setError(null);
            }}
            className={`flex-1 py-1.5 text-xs font-black rounded-lg border-2 border-black transition-all ${
              mode === "login"
                ? "bg-white shadow-[2px_2px_0px_#000] text-black"
                : "bg-transparent text-neutral-600 border-transparent hover:bg-neutral-200"
            }`}
          >
            Sign In
          </button>
          <button
            type="button"
            onClick={() => {
              setMode("register");
              setError(null);
            }}
            className={`flex-1 py-1.5 text-xs font-black rounded-lg border-2 border-black transition-all ${
              mode === "register"
                ? "bg-[#00f0ff] shadow-[2px_2px_0px_#000] text-black"
                : "bg-transparent text-neutral-600 border-transparent hover:bg-neutral-200"
            }`}
          >
            Create Account
          </button>
        </div>

        {/* Body Form */}
        <form onSubmit={handleSubmit} className="p-5 flex flex-col gap-3.5">
          {error && (
            <div className="p-3 bg-[#ff5277] text-white border-2 border-black rounded-lg font-mono text-xs font-bold shadow-[2px_2px_0px_#000] animate-in fade-in">
              {error}
            </div>
          )}

          {mode === "register" && !selfSignupEnabled && (
            <div className="p-2.5 bg-[#ffe600] text-black border-2 border-black rounded-lg text-xs font-bold shadow-[2px_2px_0px_#000]">
              ⚠️ Public self-registration is currently disabled by Admin (unless this is the 1st account).
            </div>
          )}

          {mode === "register" && (
            <div>
              <label className="block text-[11px] font-black uppercase text-neutral-700 mb-1">
                Display Name (Optional)
              </label>
              <div className="relative">
                <User className="w-4 h-4 absolute left-3 top-2.5 text-neutral-500" />
                <input
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="Full Name (e.g. Admin)"
                  className="w-full bg-white text-black pl-9 pr-3 py-2 text-xs font-bold border-2 border-black rounded-lg shadow-[2px_2px_0px_#000] outline-none focus:shadow-[3px_3px_0px_#00f0ff]"
                />
              </div>
            </div>
          )}

          <div>
            <label className="block text-[11px] font-black uppercase text-neutral-700 mb-1">
              {mode === "login" ? "Email or Username" : "Email Address"}
            </label>
            <div className="relative">
              <Mail className="w-4 h-4 absolute left-3 top-2.5 text-neutral-500" />
              <input
                type={mode === "login" ? "text" : "email"}
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={mode === "login" ? "user@example.com or username" : "user@example.com"}
                className="w-full bg-white text-black pl-9 pr-3 py-2 text-xs font-bold border-2 border-black rounded-lg shadow-[2px_2px_0px_#000] outline-none focus:shadow-[3px_3px_0px_#00f0ff]"
              />
            </div>
          </div>

          {mode === "register" && (
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
              Password
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

          {mode === "register" && (
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
            className="mt-2 w-full py-2.5 px-4 bg-[#22c55e] text-black font-black text-xs uppercase tracking-wider rounded-xl border-2 border-black shadow-[3px_3px_0px_#000] hover:translate-x-[1px] hover:translate-y-[1px] active:translate-x-[2px] active:translate-y-[2px] transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
          >
            {loading ? (
              <span>Processing...</span>
            ) : mode === "login" ? (
              <>
                <span>Sign In to Studio</span>
                <ArrowRight className="w-4 h-4" />
              </>
            ) : (
              <>
                <span>Register & Continue</span>
                <Sparkles className="w-4 h-4" />
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
