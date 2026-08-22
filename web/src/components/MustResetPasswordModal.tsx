"use client";

import React, { useState } from "react";
import { Lock, ShieldAlert, KeyRound, Check } from "lucide-react";
import { SafeUser } from "@/lib/auth";

interface MustResetPasswordModalProps {
  isOpen: boolean;
  user: SafeUser;
  onSuccess: (updatedUser: SafeUser) => void;
  showToast: (type: "error" | "warning" | "success" | "info", title: string, message?: string) => void;
}

export function MustResetPasswordModal({
  isOpen,
  user,
  onSuccess,
  showToast,
}: MustResetPasswordModalProps) {
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (newPassword.length < 6) {
      setError("New password must be at least 6 characters.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch("/api/profile/password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          newPassword,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to update password.");

      showToast("success", "Password Updated", "Your new password has been set. Welcome to Devnix!");
      onSuccess({
        ...user,
        mustResetPassword: false,
      });
    } catch (err: any) {
      setError(err.message || "Failed to update password.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-xs p-4 animate-in fade-in">
      <div className="w-full max-w-md bg-white border-[3.5px] border-black rounded-2xl shadow-[8px_8px_0px_#000] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="bg-[#ffe600] text-black border-b-[2.5px] border-black p-4 flex items-center gap-2.5">
          <div className="p-1.5 bg-white border-2 border-black rounded-lg shadow-[1.5px_1.5px_0px_#000]">
            <KeyRound className="w-5 h-5 text-black stroke-[2.5]" />
          </div>
          <div>
            <h3 className="font-black text-sm uppercase tracking-wide text-black leading-tight">
              Password Reset Required
            </h3>
            <p className="text-[11px] font-bold text-neutral-700">
              Please choose a new password for your account
            </p>
          </div>
        </div>

        {/* Notice Info */}
        <div className="bg-[#f6f3eb] p-3.5 border-b-2 border-black text-xs font-medium text-neutral-700 leading-tight">
          Your account was flagged for a mandatory password update. Set a new password below to unlock Devnix Studio.
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-5 flex flex-col gap-3.5">
          {error && (
            <div className="p-3 bg-[#ff5277] text-white border-2 border-black rounded-lg text-xs font-black shadow-[2px_2px_0px_#000] animate-in fade-in">
              {error}
            </div>
          )}

          <div>
            <label className="block text-xs font-black text-black mb-1">
              New Password
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 absolute left-3 top-2.5 text-neutral-500" />
              <input
                type="password"
                required
                autoFocus
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="At least 6 characters"
                className="w-full bg-white text-black pl-9 pr-3 py-2 text-xs font-bold border-2 border-black rounded-lg shadow-[2px_2px_0px_#000] outline-none focus:shadow-[3px_3px_0px_#00f0ff]"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-black text-black mb-1">
              Confirm New Password
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 absolute left-3 top-2.5 text-neutral-500" />
              <input
                type="password"
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Repeat new password"
                className="w-full bg-white text-black pl-9 pr-3 py-2 text-xs font-bold border-2 border-black rounded-lg shadow-[2px_2px_0px_#000] outline-none focus:shadow-[3px_3px_0px_#00f0ff]"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="mt-2 w-full py-2.5 px-4 bg-[#ffe600] text-black hover:bg-[#ffd500] font-black text-xs uppercase tracking-wider rounded-xl border-2 border-black shadow-[3px_3px_0px_#000] hover:translate-x-[1px] hover:translate-y-[1px] transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
          >
            {isSubmitting ? (
              <span className="text-black font-black">Updating Password...</span>
            ) : (
              <>
                <span className="text-black font-black">Set New Password & Enter Studio</span>
                <Check className="w-4 h-4 stroke-[3] text-black" />
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
