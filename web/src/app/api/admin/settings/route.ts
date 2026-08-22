import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser, getAllSettings, setSetting } from "@/lib/auth";
import { getDb } from "@/lib/db";

// GET /api/admin/settings
export async function GET(req: NextRequest) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser || currentUser.role !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden: Admin access required" }, { status: 403 });
    }

    const settings = getAllSettings();
    return NextResponse.json({ settings });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// POST /api/admin/settings
export async function POST(req: NextRequest) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser || currentUser.role !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden: Admin access required" }, { status: 403 });
    }

    const {
      selfSignupEnabled,
      rateLimitEnabled,
      rateLimitWindow,
      rateLimitMaxAttempts,
      resetLockoutIdentifier,
    } = await req.json();

    if (typeof selfSignupEnabled === "boolean") {
      setSetting("selfSignupEnabled", String(selfSignupEnabled));
    }

    if (typeof rateLimitEnabled === "boolean") {
      setSetting("rateLimitEnabled", String(rateLimitEnabled));
    }

    if (rateLimitWindow !== undefined) {
      setSetting("rateLimitWindow", String(rateLimitWindow));
    }

    if (rateLimitMaxAttempts !== undefined) {
      setSetting("rateLimitMaxAttempts", String(rateLimitMaxAttempts));
    }

    // Reset lockout for specific identifier if provided
    let resetMessage = "";
    if (resetLockoutIdentifier) {
      const db = getDb();
      const identifier = resetLockoutIdentifier.trim().toLowerCase();
      const res = db.prepare(`
        UPDATE users SET failedAttempts = 0, lockedUntil = NULL WHERE email = ? OR username = ? COLLATE NOCASE
      `).run(identifier, identifier);

      if (res.changes > 0) {
        resetMessage = `Lockout reset for ${resetLockoutIdentifier}.`;
      } else {
        resetMessage = `User ${resetLockoutIdentifier} not found.`;
      }
    }

    const updated = getAllSettings();
    return NextResponse.json({ success: true, settings: updated, resetMessage });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to update settings." }, { status: 400 });
  }
}
