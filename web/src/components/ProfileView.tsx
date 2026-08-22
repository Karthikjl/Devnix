"use client";

import React, { useState } from "react";
import { User, Lock, Save, ArrowLeft, Check, AlertCircle, ShieldAlert } from "lucide-react";
import { SafeUser } from "@/lib/auth";

interface ProfileViewProps {
  user: SafeUser;
  onUpdateUser: (updated: SafeUser) => void;
  onBack: () => void;
  showToast: (type: "error" | "warning" | "success" | "info", title: string, message?: string) => void;
}

export function ProfileView({ user, onUpdateUser, onBack, showToast }: ProfileViewProps) {
  const [displayName, setDisplayName] = useState(user.displayName);
  const [email, setEmail] = useState(user.email);
  const [username, setUsername] = useState(user.username);
  const [isEditingEmail, setIsEditingEmail] = useState(false);
  const [isSavingProfile, setIsSavingProfile] = useState(false);

  // Change Password state
  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isSavingPassword, setIsSavingPassword] = useState(false);

  const handleSaveProfile = async () => {
    setIsSavingProfile(true);
    try {
      const res = await fetch("/api/profile/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ displayName, email, username }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to update profile");

      onUpdateUser(data.user);
      setIsEditingEmail(false);
      showToast("success", "Profile Updated", "Your information was saved successfully.");
    } catch (err: any) {
      showToast("error", "Update Failed", err.message);
    } finally {
      setIsSavingProfile(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      showToast("error", "Password Mismatch", "New passwords do not match.");
      return;
    }
    if (newPassword.length < 6) {
      showToast("error", "Weak Password", "Password must be at least 6 characters.");
      return;
    }

    setIsSavingPassword(true);
    try {
      const res = await fetch("/api/profile/password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to change password");

      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setShowPasswordForm(false);
      showToast("success", "Password Changed", "Your password has been securely updated.");
    } catch (err: any) {
      showToast("error", "Password Change Failed", err.message);
    } finally {
      setIsSavingPassword(false);
    }
  };

  return (
    <div className="flex-1 min-h-0 flex flex-col p-4 md:p-6 overflow-y-auto max-w-4xl mx-auto w-full">
      {/* Top Header */}
      <div className="flex items-center justify-between mb-6 pb-4 border-b-2 border-black">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="neo-btn bg-white hover:bg-neutral-100 p-2 text-xs flex items-center gap-1.5"
          >
            <ArrowLeft className="w-4 h-4 stroke-[2.5]" />
            <span>Back to Studio</span>
          </button>
          <h1 className="text-2xl md:text-3xl font-black tracking-tight text-black">
            Profile
          </h1>
        </div>

        <div className="flex items-center gap-2">
          <span className={`px-2.5 py-1 text-xs font-black rounded-lg border-2 border-black shadow-[2px_2px_0px_#000] uppercase text-black ${
            user.role === "ADMIN" ? "bg-[#ffe600]" : "bg-[#00f0ff]"
          }`}>
            {user.isSuperAdmin ? "👑 SUPER ADMIN" : user.role}
          </span>
        </div>
      </div>

      <div className="flex flex-col gap-6">
        {/* Card 1: Personal Information */}
        <div className="neo-box-lg bg-white p-5 md:p-6 flex flex-col gap-4">
          <div className="flex items-center gap-2.5 pb-3 border-b-2 border-neutral-100">
            <div className="p-2 bg-[#f0f9ff] border-2 border-black rounded-lg shadow-[2px_2px_0px_#000]">
              <User className="w-5 h-5 text-black" />
            </div>
            <h2 className="text-base font-black text-black">Personal Information</h2>
          </div>

          {/* Email Address */}
          <div>
            <label className="block text-xs font-bold text-neutral-600 mb-1.5">
              Email Address
            </label>
            <div className="flex items-center gap-3">
              <input
                type="email"
                disabled={!isEditingEmail}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={`flex-1 p-2.5 text-xs font-mono font-bold rounded-lg border-2 border-black shadow-[2px_2px_0px_#000] outline-none text-black ${
                  isEditingEmail ? "bg-white focus:shadow-[3px_3px_0px_#00f0ff]" : "bg-[#f8fafc] text-neutral-600 cursor-not-allowed"
                }`}
              />
              <button
                type="button"
                onClick={() => {
                  if (isEditingEmail) {
                    handleSaveProfile();
                  } else {
                    setIsEditingEmail(true);
                  }
                }}
                disabled={isSavingProfile}
                className="neo-btn bg-white hover:bg-neutral-100 text-black px-4 py-2.5 text-xs font-black shrink-0 min-w-[80px] border-2 border-black shadow-[2px_2px_0px_#000]"
              >
                {isEditingEmail ? "Save" : "Change"}
              </button>
            </div>
          </div>

          {/* Display Name */}
          <div>
            <label className="block text-xs font-bold text-neutral-600 mb-1.5">
              Display Name
            </label>
            <div className="flex items-center gap-3">
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className="flex-1 p-2.5 text-xs font-bold rounded-lg border-2 border-black shadow-[2px_2px_0px_#000] bg-white text-black outline-none focus:shadow-[3px_3px_0px_#00f0ff]"
              />
              <button
                type="button"
                onClick={handleSaveProfile}
                disabled={isSavingProfile}
                className="neo-btn bg-[#ffe600] hover:bg-[#ffd500] text-black px-4 py-2.5 text-xs font-black shrink-0 flex items-center gap-1.5 min-w-[80px] border-2 border-black shadow-[2px_2px_0px_#000]"
              >
                <Save className="w-3.5 h-3.5 stroke-[2.5]" />
                <span>Save</span>
              </button>
            </div>
          </div>

          {/* Username Handle */}
          <div>
            <label className="block text-xs font-bold text-neutral-600 mb-1.5">
              Username Handle
            </label>
            <div className="flex items-center gap-3">
              <div className="relative flex-1">
                <span className="absolute left-3 top-2.5 text-xs font-mono font-bold text-neutral-400">@</span>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full p-2.5 pl-7 text-xs font-mono font-bold rounded-lg border-2 border-black shadow-[2px_2px_0px_#000] bg-white text-black outline-none focus:shadow-[3px_3px_0px_#00f0ff]"
                />
              </div>
              <button
                type="button"
                onClick={handleSaveProfile}
                disabled={isSavingProfile}
                className="neo-btn bg-[#00f0ff] hover:bg-[#00d8e6] text-black px-4 py-2.5 text-xs font-black shrink-0 min-w-[80px] border-2 border-black shadow-[2px_2px_0px_#000]"
              >
                Update
              </button>
            </div>
          </div>
        </div>

        {/* Card 2: Change Password */}
        <div className="neo-box-lg bg-white p-5 md:p-6 flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="p-2 bg-[#fdf2f8] border-2 border-black rounded-lg shadow-[2px_2px_0px_#000]">
                <Lock className="w-5 h-5 text-black" />
              </div>
              <div>
                <h2 className="text-base font-black text-black">Change Password</h2>
                <p className="text-[11px] font-bold text-neutral-500">Update your account authentication credentials</p>
              </div>
            </div>

            {!showPasswordForm && (
              <button
                type="button"
                onClick={() => setShowPasswordForm(true)}
                className="neo-btn bg-[#ffe600] text-black hover:bg-[#ffd500] px-4 py-2 text-xs font-black border-2 border-black shadow-[2px_2px_0px_#000]"
              >
                Change Password
              </button>
            )}
          </div>

          {showPasswordForm && (
            <form onSubmit={handleChangePassword} className="pt-3 border-t-2 border-neutral-100 flex flex-col gap-3.5 animate-in fade-in">
              <div>
                <label className="block text-xs font-bold text-neutral-600 mb-1">
                  Current Password
                </label>
                <input
                  type="password"
                  required
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  placeholder="Enter current password"
                  className="w-full p-2.5 text-xs font-bold rounded-lg border-2 border-black shadow-[2px_2px_0px_#000] bg-white outline-none focus:shadow-[3px_3px_0px_#00f0ff]"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-neutral-600 mb-1">
                    New Password
                  </label>
                  <input
                    type="password"
                    required
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="At least 6 characters"
                    className="w-full p-2.5 text-xs font-bold rounded-lg border-2 border-black shadow-[2px_2px_0px_#000] bg-white outline-none focus:shadow-[3px_3px_0px_#00f0ff]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-neutral-600 mb-1">
                    Confirm New Password
                  </label>
                  <input
                    type="password"
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Repeat new password"
                    className="w-full p-2.5 text-xs font-bold rounded-lg border-2 border-black shadow-[2px_2px_0px_#000] bg-white outline-none focus:shadow-[3px_3px_0px_#00f0ff]"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowPasswordForm(false)}
                  className="neo-btn bg-white hover:bg-neutral-100 px-4 py-2 text-xs font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSavingPassword}
                  className="neo-btn bg-[#22c55e] text-black hover:bg-[#16a34a] px-4 py-2 text-xs font-bold"
                >
                  {isSavingPassword ? "Updating..." : "Update Password"}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
