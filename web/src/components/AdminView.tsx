"use client";

import React, { useState, useEffect } from "react";
import {
  Users,
  Shield,
  ShieldAlert,
  UserPlus,
  RefreshCw,
  Lock,
  Check,
  X,
  KeyRound,
  ArrowRight,
  Trash2,
  ArrowLeft,
  Sliders,
  Settings,
} from "lucide-react";
import { SafeUser } from "@/lib/auth";

interface AdminUserItem {
  id: string;
  email: string;
  username: string;
  displayName: string;
  role: "ADMIN" | "USER";
  isActive: boolean;
  mustResetPassword: boolean;
  failedAttempts: number;
  isLocked: boolean;
  createdAt: number;
}

interface AdminSettings {
  selfSignupEnabled: boolean;
  rateLimitEnabled: boolean;
  rateLimitWindow: number;
  rateLimitMaxAttempts: number;
}

interface AdminViewProps {
  currentUser: SafeUser;
  onBack: () => void;
  onImpersonateSuccess: (targetUser: SafeUser) => void;
  showToast: (type: "error" | "warning" | "success" | "info", title: string, message?: string) => void;
  initialSelfSignupEnabled?: boolean;
}

export function AdminView({
  currentUser,
  onBack,
  onImpersonateSuccess,
  showToast,
  initialSelfSignupEnabled,
}: AdminViewProps) {
  const [users, setUsers] = useState<AdminUserItem[]>([]);
  const [settings, setSettings] = useState<AdminSettings>({
    selfSignupEnabled: initialSelfSignupEnabled ?? false,
    rateLimitEnabled: true,
    rateLimitWindow: 15,
    rateLimitMaxAttempts: 20,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isUpdatingSignup, setIsUpdatingSignup] = useState(false);
  const [isUpdatingRateLimit, setIsUpdatingRateLimit] = useState(false);

  // Reset Lockout identifier
  const [resetIdentifier, setResetIdentifier] = useState("");
  const [isResettingLockout, setIsResettingLockout] = useState(false);

  // New User Modal
  const [showNewUserModal, setShowNewUserModal] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const [newUsername, setNewUsername] = useState("");
  const [newDisplayName, setNewDisplayName] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newRole, setNewRole] = useState<"ADMIN" | "USER">("USER");
  const [isCreatingUser, setIsCreatingUser] = useState(false);

  // Reset Password Modal
  const [resetTargetUser, setResetTargetUser] = useState<AdminUserItem | null>(null);
  const [tempPassword, setTempPassword] = useState("");
  const [isSettingPassword, setIsSettingPassword] = useState(false);

  const fetchAdminData = async () => {
    setIsLoading(true);
    try {
      const [usersRes, settingsRes] = await Promise.all([
        fetch("/api/admin/users"),
        fetch("/api/admin/settings"),
      ]);

      if (usersRes.ok) {
        const data = await usersRes.json();
        setUsers(data.users || []);
      }

      if (settingsRes.ok) {
        const data = await settingsRes.json();
        if (data.settings) setSettings(data.settings);
      }
    } catch (err: any) {
      showToast("error", "Failed to load admin data", err.message);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchAdminData();
  }, []);

  const handleToggleSignup = async () => {
    if (isUpdatingSignup) return;
    setIsUpdatingSignup(true);
    const nextVal = !settings.selfSignupEnabled;
    setSettings((prev) => ({ ...prev, selfSignupEnabled: nextVal }));
    try {
      const res = await fetch("/api/admin/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ selfSignupEnabled: nextVal }),
      });
      if (!res.ok) throw new Error("Failed to update access control");
      showToast("info", "Access Control Updated", `Self-signup is now ${nextVal ? "Enabled" : "Disabled"}.`);
    } catch (err: any) {
      setSettings((prev) => ({ ...prev, selfSignupEnabled: !nextVal }));
      showToast("error", "Update Failed", err.message);
    } finally {
      setIsUpdatingSignup(false);
    }
  };

  const handleToggleRateLimit = async () => {
    if (isUpdatingRateLimit) return;
    setIsUpdatingRateLimit(true);
    const nextVal = !settings.rateLimitEnabled;
    setSettings((prev) => ({ ...prev, rateLimitEnabled: nextVal }));
    try {
      const res = await fetch("/api/admin/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rateLimitEnabled: nextVal }),
      });
      if (!res.ok) throw new Error("Failed to update rate limiting");
      showToast("info", "Rate Limiting Updated", `Rate limiting is now ${nextVal ? "Enabled" : "Disabled"}.`);
    } catch (err: any) {
      setSettings((prev) => ({ ...prev, rateLimitEnabled: !nextVal }));
      showToast("error", "Update Failed", err.message);
    } finally {
      setIsUpdatingRateLimit(false);
    }
  };

  const handleUpdateRateLimitParams = async (windowVal: number, maxAttemptsVal: number) => {
    setSettings((prev) => ({
      ...prev,
      rateLimitWindow: windowVal,
      rateLimitMaxAttempts: maxAttemptsVal,
    }));

    try {
      await fetch("/api/admin/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rateLimitWindow: windowVal,
          rateLimitMaxAttempts: maxAttemptsVal,
        }),
      });
    } catch (err: any) {
      showToast("error", "Update Failed", err.message);
    }
  };

  const handleResetLockout = async () => {
    if (!resetIdentifier.trim()) return;
    setIsResettingLockout(true);
    try {
      const res = await fetch("/api/admin/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resetLockoutIdentifier: resetIdentifier.trim() }),
      });
      const data = await res.json();
      if (res.ok) {
        showToast("success", "Lockout Reset", data.resetMessage || "User lockout cleared.");
        setResetIdentifier("");
        fetchAdminData();
      } else {
        throw new Error(data.error);
      }
    } catch (err: any) {
      showToast("error", "Reset Failed", err.message);
    } finally {
      setIsResettingLockout(false);
    }
  };

  const handleUpdateUserRole = async (userId: string, role: "ADMIN" | "USER") => {
    try {
      const res = await fetch("/api/admin/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, role }),
      });
      if (!res.ok) throw new Error("Failed to update role");
      setUsers((prev) =>
        prev.map((u) => (u.id === userId ? { ...u, role } : u))
      );
      showToast("success", "Role Updated", `User role set to ${role}.`);
    } catch (err: any) {
      showToast("error", "Update Failed", err.message);
    }
  };

  const handleToggleUserActive = async (userId: string, currentActive: boolean) => {
    try {
      const res = await fetch("/api/admin/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, isActive: !currentActive }),
      });
      if (!res.ok) throw new Error("Failed to update status");
      setUsers((prev) =>
        prev.map((u) => (u.id === userId ? { ...u, isActive: !currentActive } : u))
      );
      showToast("info", "User Status", `User has been ${!currentActive ? "Activated" : "Deactivated"}.`);
    } catch (err: any) {
      showToast("error", "Update Failed", err.message);
    }
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsCreatingUser(true);
    try {
      const res = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: newEmail,
          username: newUsername,
          displayName: newDisplayName || newUsername,
          password: newPassword,
          role: newRole,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to create user.");

      showToast("success", "User Created", `Created user @${data.user.username}`);
      setShowNewUserModal(false);
      setNewEmail("");
      setNewUsername("");
      setNewDisplayName("");
      setNewPassword("");
      fetchAdminData();
    } catch (err: any) {
      showToast("error", "Creation Failed", err.message);
    } finally {
      setIsCreatingUser(false);
    }
  };

  const handleSetTempPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetTargetUser || !tempPassword) return;
    setIsSettingPassword(true);
    try {
      const res = await fetch("/api/admin/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: resetTargetUser.id,
          tempPassword,
        }),
      });
      if (!res.ok) throw new Error("Failed to reset password.");

      showToast("success", "Password Reset", `Temporary password assigned to @${resetTargetUser.username}.`);
      setResetTargetUser(null);
      setTempPassword("");
      fetchAdminData();
    } catch (err: any) {
      showToast("error", "Password Reset Failed", err.message);
    } finally {
      setIsSettingPassword(false);
    }
  };

  const handleImpersonate = async (targetUser: AdminUserItem) => {
    try {
      const res = await fetch("/api/admin/impersonate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetUserId: targetUser.id }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to impersonate.");

      showToast("warning", "Impersonating User", `Logged in as @${targetUser.username}`);
      onImpersonateSuccess(data.targetUser);
    } catch (err: any) {
      showToast("error", "Impersonation Failed", err.message);
    }
  };

  const handleDeleteUser = async (userId: string, name: string) => {
    if (!confirm(`Are you sure you want to permanently delete @${name}?`)) return;
    try {
      const res = await fetch("/api/admin/users", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to delete.");

      showToast("info", "User Deleted", `Deleted account @${name}.`);
      fetchAdminData();
    } catch (err: any) {
      showToast("error", "Deletion Failed", err.message);
    }
  };

  return (
    <div className="flex-1 min-h-0 flex flex-col p-4 md:p-6 overflow-y-auto max-w-6xl mx-auto w-full">
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
          <div>
            <h1 className="text-2xl md:text-3xl font-black tracking-tight text-black flex items-center gap-2">
              <span>Admin</span>
              <span className="bg-[#ffe600] text-black border-2 border-black text-xs font-black px-2 py-0.5 rounded-md shadow-[1.5px_1.5px_0px_#000]">
                PANEL ⚡
              </span>
            </h1>
            <p className="text-xs font-bold text-neutral-500">
              User management and impersonation
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={fetchAdminData}
            disabled={isLoading}
            className="neo-btn bg-white hover:bg-neutral-100 p-2 text-xs font-black flex items-center gap-1.5 border-2 border-black shadow-[2px_2px_0px_#000] cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 stroke-[2.5] ${isLoading ? "animate-spin" : ""}`} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      <div className="flex flex-col gap-6">
        {/* Card 1: Access Control */}
        <div className="neo-box-lg bg-white p-5 md:p-6 flex flex-col gap-4">
          <div className="flex items-center gap-2.5 pb-3 border-b-2 border-neutral-100">
            <div className="p-2 bg-[#ecfdf5] border-2 border-black rounded-lg shadow-[2px_2px_0px_#000]">
              <Users className="w-5 h-5 text-[#059669]" />
            </div>
            <div>
              <h2 className="text-base font-black text-black">Access Control</h2>
              <p className="text-[11px] font-bold text-neutral-500">
                {settings.selfSignupEnabled
                  ? "Local self-sign-up is enabled."
                  : "Local self-sign-up is disabled."}
              </p>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-neutral-600 mb-1.5">
              Local self-sign-up
            </label>
            <button
              type="button"
              onClick={handleToggleSignup}
              className={`w-48 py-2 px-4 rounded-lg border-2 border-black font-black text-xs transition-all shadow-[2px_2px_0px_#000] cursor-pointer ${
                settings.selfSignupEnabled
                  ? "bg-[#22c55e] text-black hover:bg-[#16a34a]"
                  : "bg-white text-neutral-600 hover:bg-neutral-100"
              }`}
            >
              {settings.selfSignupEnabled ? "Enabled" : "Disabled"}
            </button>
          </div>
        </div>

        {/* Card 2: Login Rate Limiting */}
        <div className="neo-box-lg bg-white p-5 md:p-6 flex flex-col gap-4">
          <div className="flex items-center gap-2.5 pb-3 border-b-2 border-neutral-100">
            <div className="p-2 bg-[#faf5ff] border-2 border-black rounded-lg shadow-[2px_2px_0px_#000]">
              <Settings className="w-5 h-5 text-[#9333ea]" />
            </div>
            <div>
              <h2 className="text-base font-black text-black">Login Rate Limiting</h2>
              <p className="text-[11px] font-bold text-neutral-500">
                Reduce brute-force attacks; disable only for trusted environments. Changes are saved automatically.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Toggle */}
            <div>
              <label className="block text-xs font-bold text-neutral-600 mb-1.5">
                Rate Limiting
              </label>
              <button
                type="button"
                onClick={handleToggleRateLimit}
                className={`w-full py-2 px-4 rounded-lg border-2 border-black font-black text-xs transition-all shadow-[2px_2px_0px_#000] cursor-pointer ${
                  settings.rateLimitEnabled
                    ? "bg-[#22c55e] text-black hover:bg-[#16a34a]"
                    : "bg-white text-neutral-600 hover:bg-neutral-100"
                }`}
              >
                {settings.rateLimitEnabled ? "Enabled" : "Disabled"}
              </button>
            </div>

            {/* Window */}
            <div>
              <label className="block text-xs font-bold text-neutral-600 mb-1.5">
                Window (minutes)
              </label>
              <input
                type="number"
                min={1}
                max={120}
                value={settings.rateLimitWindow}
                onChange={(e) =>
                  handleUpdateRateLimitParams(
                    parseInt(e.target.value) || 15,
                    settings.rateLimitMaxAttempts
                  )
                }
                className="w-full p-2 text-xs font-bold rounded-lg border-2 border-black shadow-[2px_2px_0px_#000] bg-white outline-none focus:shadow-[3px_3px_0px_#00f0ff]"
              />
            </div>

            {/* Max attempts */}
            <div>
              <label className="block text-xs font-bold text-neutral-600 mb-1.5">
                Max attempts
              </label>
              <input
                type="number"
                min={3}
                max={100}
                value={settings.rateLimitMaxAttempts}
                onChange={(e) =>
                  handleUpdateRateLimitParams(
                    settings.rateLimitWindow,
                    parseInt(e.target.value) || 20
                  )
                }
                className="w-full p-2 text-xs font-bold rounded-lg border-2 border-black shadow-[2px_2px_0px_#000] bg-white outline-none focus:shadow-[3px_3px_0px_#00f0ff]"
              />
            </div>
          </div>

          {/* Reset Lockout Row */}
          <div className="pt-2 border-t border-neutral-100">
            <label className="block text-xs font-bold text-neutral-600 mb-1.5">
              Reset lockout (email/username)
            </label>
            <div className="flex items-center gap-3">
              <input
                type="text"
                value={resetIdentifier}
                onChange={(e) => setResetIdentifier(e.target.value)}
                placeholder="user@example.com or username"
                className="flex-1 p-2.5 text-xs font-bold rounded-lg border-2 border-black shadow-[2px_2px_0px_#000] bg-white outline-none focus:shadow-[3px_3px_0px_#00f0ff]"
              />
              <span className="text-[11px] font-bold text-neutral-400 hidden sm:inline">
                All changes saved
              </span>
              <button
                type="button"
                onClick={handleResetLockout}
                disabled={isResettingLockout || !resetIdentifier.trim()}
                className="neo-btn bg-white hover:bg-neutral-100 px-4 py-2.5 text-xs font-bold min-w-[80px]"
              >
                {isResettingLockout ? "Resetting..." : "Reset"}
              </button>
            </div>
          </div>
        </div>

        {/* Card 3: Users Table */}
        <div className="neo-box-lg bg-white p-5 md:p-6 flex flex-col gap-4 overflow-hidden">
          <div className="flex items-center justify-between pb-3 border-b-2 border-neutral-100 flex-wrap gap-2">
            <div className="flex items-center gap-2.5">
              <div className="p-2 bg-[#f0fdf4] border-2 border-black rounded-lg shadow-[2px_2px_0px_#000]">
                <Shield className="w-5 h-5 text-black" />
              </div>
              <div>
                <h2 className="text-base font-black text-black">Users ({users.length})</h2>
                <p className="text-[11px] font-bold text-neutral-500">
                  Manage user permissions, reset credentials, and switch accounts
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setShowNewUserModal(true)}
              className="neo-btn bg-[#ffe600] text-black hover:bg-[#ffd500] px-3.5 py-2 text-xs font-black flex items-center gap-1.5 border-2 border-black shadow-[2px_2px_0px_#000] cursor-pointer"
            >
              <UserPlus className="w-3.5 h-3.5 stroke-[2.5]" />
              <span>+ New User</span>
            </button>
          </div>

          {/* Responsive Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b-2 border-black text-neutral-600 font-bold uppercase text-[10px]">
                  <th className="py-2.5 px-3">User</th>
                  <th className="py-2.5 px-3">Role</th>
                  <th className="py-2.5 px-3">Active</th>
                  <th className="py-2.5 px-3">Must Reset</th>
                  <th className="py-2.5 px-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-200 font-medium">
                {users.map((u) => {
                  const isCurrent = u.id === currentUser.id;
                  return (
                    <tr key={u.id} className="hover:bg-neutral-50/80 transition-colors">
                      {/* User Column */}
                      <td className="py-3 px-3">
                        <div className="flex flex-col">
                          <span className="font-black text-black text-xs flex items-center gap-1.5">
                            {u.displayName}
                            {isCurrent && (
                              <span className="bg-[#ffe600] text-black text-[9px] font-bold px-1 rounded border border-black">
                                YOU
                              </span>
                            )}
                            {u.isLocked && (
                              <span className="bg-[#ff5277] text-white text-[9px] font-bold px-1 rounded border border-black">
                                LOCKED
                              </span>
                            )}
                          </span>
                          <span className="text-[11px] text-neutral-500 font-mono">
                            {u.email}
                          </span>
                          <span className="text-[10px] text-neutral-400 font-mono">
                            @{u.username}
                          </span>
                        </div>
                      </td>

                      {/* Role Dropdown */}
                      <td className="py-3 px-3">
                        <select
                          value={u.role}
                          onChange={(e) =>
                            handleUpdateUserRole(u.id, e.target.value as "ADMIN" | "USER")
                          }
                          disabled={isCurrent}
                          className={`p-1.5 text-xs font-black rounded-lg border-2 border-black shadow-[1.5px_1.5px_0px_#000] outline-none ${
                            u.role === "ADMIN" ? "bg-[#ff5277] text-white" : "bg-white text-black"
                          }`}
                        >
                          <option value="USER" className="bg-white text-black">
                            USER
                          </option>
                          <option value="ADMIN" className="bg-white text-black">
                            ADMIN
                          </option>
                        </select>
                      </td>

                      {/* Active Status Pill */}
                      <td className="py-3 px-3">
                        <button
                          type="button"
                          onClick={() => handleToggleUserActive(u.id, u.isActive)}
                          disabled={isCurrent}
                          className={`px-2.5 py-1 text-[11px] font-black rounded-lg border-2 border-black shadow-[1.5px_1.5px_0px_#000] transition-all ${
                            u.isActive
                              ? "bg-[#22c55e] text-black"
                              : "bg-[#ff5277] text-white"
                          }`}
                        >
                          {u.isActive ? "Active" : "Disabled"}
                        </button>
                      </td>

                      {/* Must Reset Pill */}
                      <td className="py-3 px-3">
                        <span
                          className={`px-2 py-0.5 text-[10px] font-mono font-bold rounded border border-black ${
                            u.mustResetPassword
                              ? "bg-[#ffe600] text-black"
                              : "bg-neutral-100 text-neutral-600"
                          }`}
                        >
                          {u.mustResetPassword ? "Yes" : "No"}
                        </span>
                      </td>

                      {/* Actions */}
                      <td className="py-3 px-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => handleImpersonate(u)}
                            disabled={isCurrent}
                            className="neo-btn bg-white hover:bg-neutral-100 px-2.5 py-1.5 text-[11px] font-bold flex items-center gap-1"
                            title="Sign in as this user"
                          >
                            <ArrowRight className="w-3 h-3" />
                            <span>Impersonate</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => setResetTargetUser(u)}
                            className="neo-btn bg-white hover:bg-neutral-100 px-2.5 py-1.5 text-[11px] font-bold flex items-center gap-1"
                            title="Set temporary password"
                          >
                            <KeyRound className="w-3 h-3" />
                            <span>Reset Password</span>
                          </button>

                          {!isCurrent && (
                            <button
                              type="button"
                              onClick={() => handleDeleteUser(u.id, u.username)}
                              className="neo-btn bg-white hover:bg-red-50 text-red-600 p-1.5 text-xs"
                              title="Delete user"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Modal 1: Add New User Modal */}
      {showNewUserModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in">
          <div className="w-full max-w-md bg-white border-[3px] border-black rounded-2xl shadow-[6px_6px_0px_#000] overflow-hidden flex flex-col">
            <div className="bg-[#ffe600] text-black border-b-2 border-black p-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <UserPlus className="w-4 h-4 stroke-[2.5]" />
                <h3 className="font-black text-sm uppercase text-black">Add New User</h3>
              </div>
              <button
                onClick={() => setShowNewUserModal(false)}
                className="p-1 rounded-lg border-2 border-black bg-white text-black hover:bg-neutral-100 cursor-pointer shadow-[1.5px_1.5px_0px_#000]"
              >
                <X className="w-3.5 h-3.5 stroke-[2.5]" />
              </button>
            </div>

            <form onSubmit={handleCreateUser} className="p-5 flex flex-col gap-3">
              <div>
                <label className="block text-xs font-black text-black mb-1">Email Address</label>
                <input
                  type="email"
                  required
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  placeholder="user@example.com"
                  className="w-full p-2.5 text-xs font-bold border-2 border-black rounded-lg outline-none bg-white text-black shadow-[2px_2px_0px_#000] focus:shadow-[3px_3px_0px_#00f0ff]"
                />
              </div>

              <div>
                <label className="block text-xs font-black text-black mb-1">Username Handle</label>
                <input
                  type="text"
                  required
                  value={newUsername}
                  onChange={(e) => setNewUsername(e.target.value)}
                  placeholder="username"
                  className="w-full p-2.5 text-xs font-mono font-bold border-2 border-black rounded-lg outline-none bg-white text-black shadow-[2px_2px_0px_#000] focus:shadow-[3px_3px_0px_#00f0ff]"
                />
              </div>

              <div>
                <label className="block text-xs font-black text-black mb-1">Display Name</label>
                <input
                  type="text"
                  value={newDisplayName}
                  onChange={(e) => setNewDisplayName(e.target.value)}
                  placeholder="Full Name"
                  className="w-full p-2.5 text-xs font-bold border-2 border-black rounded-lg outline-none bg-white text-black shadow-[2px_2px_0px_#000] focus:shadow-[3px_3px_0px_#00f0ff]"
                />
              </div>

              <div>
                <label className="block text-xs font-black text-black mb-1">Initial Password</label>
                <input
                  type="password"
                  required
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="At least 6 characters"
                  className="w-full p-2.5 text-xs font-bold border-2 border-black rounded-lg outline-none bg-white text-black shadow-[2px_2px_0px_#000] focus:shadow-[3px_3px_0px_#00f0ff]"
                />
              </div>

              <div>
                <label className="block text-xs font-black text-black mb-1">Assigned Role</label>
                <select
                  value={newRole}
                  onChange={(e) => setNewRole(e.target.value as "ADMIN" | "USER")}
                  className="w-full p-2.5 text-xs font-black border-2 border-black rounded-lg outline-none bg-white text-black shadow-[2px_2px_0px_#000]"
                >
                  <option value="USER">USER (Standard Member)</option>
                  <option value="ADMIN">ADMIN (Full Privileges)</option>
                </select>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowNewUserModal(false)}
                  className="neo-btn bg-white hover:bg-neutral-100 text-black px-4 py-2 text-xs font-black border-2 border-black shadow-[2px_2px_0px_#000] cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isCreatingUser}
                  className="neo-btn bg-[#22c55e] text-black hover:bg-[#16a34a] px-4 py-2 text-xs font-black border-2 border-black shadow-[2px_2px_0px_#000] cursor-pointer disabled:opacity-50"
                >
                  {isCreatingUser ? "Creating..." : "Create User"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal 2: Reset Password Modal */}
      {resetTargetUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in">
          <div className="w-full max-w-md bg-white border-[3px] border-black rounded-2xl shadow-[6px_6px_0px_#000] overflow-hidden flex flex-col">
            <div className="bg-[#ffe600] text-black border-b-2 border-black p-4 flex items-center justify-between">
              <h3 className="font-black text-sm uppercase text-black">
                Reset Password for @{resetTargetUser.username}
              </h3>
              <button
                onClick={() => setResetTargetUser(null)}
                className="p-1 rounded border-2 border-black bg-white text-black hover:bg-neutral-100 cursor-pointer shadow-[1.5px_1.5px_0px_#000]"
              >
                <X className="w-3.5 h-3.5 stroke-[2.5]" />
              </button>
            </div>

            <form onSubmit={handleSetTempPassword} className="p-5 flex flex-col gap-3">
              <p className="text-xs font-bold text-neutral-600">
                Setting a temporary password will require the user to change their password upon their next login.
              </p>
              <div>
                <label className="block text-xs font-black text-black mb-1">New Temporary Password</label>
                <input
                  type="password"
                  required
                  value={tempPassword}
                  onChange={(e) => setTempPassword(e.target.value)}
                  placeholder="Enter temporary password"
                  className="w-full p-2 text-xs font-bold text-black border-2 border-black rounded-lg outline-none shadow-[2px_2px_0px_#000] focus:shadow-[3px_3px_0px_#00f0ff]"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setResetTargetUser(null)}
                  className="neo-btn bg-white hover:bg-neutral-100 text-black px-3.5 py-1.5 text-xs font-black border-2 border-black shadow-[2px_2px_0px_#000] cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSettingPassword}
                  className="neo-btn bg-[#ffe600] text-black hover:bg-[#ffd500] px-4 py-1.5 text-xs font-black border-2 border-black shadow-[2px_2px_0px_#000] cursor-pointer disabled:opacity-50"
                >
                  {isSettingPassword ? "Saving..." : "Set Password"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
