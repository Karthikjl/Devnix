import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser, registerUser, hashPassword } from "@/lib/auth";
import { getDb } from "@/lib/db";

// GET /api/admin/users - List all registered users
export async function GET(req: NextRequest) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser || currentUser.role !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden: Admin access required" }, { status: 403 });
    }

    const db = getDb();
    const users = db.prepare(`
      SELECT id, email, username, displayName, role, isActive, mustResetPassword, failedAttempts, lockedUntil, createdAt
      FROM users
      ORDER BY createdAt ASC
    `).all() as Array<{
      id: string;
      email: string;
      username: string;
      displayName: string;
      role: "ADMIN" | "USER";
      isActive: number;
      mustResetPassword: number;
      failedAttempts: number;
      lockedUntil: number | null;
      createdAt: number;
    }>;

    return NextResponse.json({
      users: users.map((u) => ({
        id: u.id,
        email: u.email,
        username: u.username,
        displayName: u.displayName,
        role: u.role,
        isActive: Boolean(u.isActive),
        mustResetPassword: Boolean(u.mustResetPassword),
        failedAttempts: u.failedAttempts,
        isLocked: Boolean(u.lockedUntil && u.lockedUntil > Date.now()),
        createdAt: u.createdAt,
      })),
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// POST /api/admin/users - Admin directly creates a new user
export async function POST(req: NextRequest) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser || currentUser.role !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden: Admin access required" }, { status: 403 });
    }

    const { email, username, displayName, password, role } = await req.json();

    const newUser = registerUser({
      email,
      username,
      displayName: displayName || username,
      password,
      isAdminCreated: true,
    });

    if (role && (role === "ADMIN" || role === "USER")) {
      const db = getDb();
      db.prepare("UPDATE users SET role = ? WHERE id = ?").run(role, newUser.id);
      newUser.role = role;
    }

    return NextResponse.json({ success: true, user: newUser });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to create user." }, { status: 400 });
  }
}

// PATCH /api/admin/users - Update role, active status, or reset password
export async function PATCH(req: NextRequest) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser || currentUser.role !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden: Admin access required" }, { status: 403 });
    }

    const { userId, role, isActive, tempPassword, mustResetPassword, resetLockout } = await req.json();
    const db = getDb();
    const now = Date.now();

    if (!userId) {
      return NextResponse.json({ error: "User ID is required." }, { status: 400 });
    }

    // Role update
    if (role && (role === "ADMIN" || role === "USER")) {
      db.prepare("UPDATE users SET role = ?, updatedAt = ? WHERE id = ?").run(role, now, userId);
    }

    // Active status toggle
    if (typeof isActive === "boolean") {
      db.prepare("UPDATE users SET isActive = ?, updatedAt = ? WHERE id = ?").run(isActive ? 1 : 0, now, userId);
    }

    // Must reset password toggle
    if (typeof mustResetPassword === "boolean") {
      db.prepare("UPDATE users SET mustResetPassword = ?, updatedAt = ? WHERE id = ?").run(mustResetPassword ? 1 : 0, now, userId);
    }

    // Reset lockout
    if (resetLockout) {
      db.prepare("UPDATE users SET failedAttempts = 0, lockedUntil = NULL, updatedAt = ? WHERE id = ?").run(now, userId);
    }

    // Admin reset password
    if (tempPassword) {
      const newHash = hashPassword(tempPassword);
      db.prepare("UPDATE users SET passwordHash = ?, mustResetPassword = 1, failedAttempts = 0, lockedUntil = NULL, updatedAt = ? WHERE id = ?").run(newHash, now, userId);
    }

    return NextResponse.json({ success: true, message: "User updated successfully." });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to update user." }, { status: 400 });
  }
}

// DELETE /api/admin/users - Delete user
export async function DELETE(req: NextRequest) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser || currentUser.role !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden: Admin access required" }, { status: 403 });
    }

    const { userId } = await req.json();
    const db = getDb();

    if (userId === currentUser.id) {
      return NextResponse.json({ error: "You cannot delete your own active admin account." }, { status: 400 });
    }

    db.prepare("DELETE FROM users WHERE id = ?").run(userId);
    return NextResponse.json({ success: true, message: "User deleted." });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to delete user." }, { status: 400 });
  }
}
