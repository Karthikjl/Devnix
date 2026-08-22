import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { randomBytes } from "crypto";
import { cookies } from "next/headers";

// POST /api/admin/impersonate - Admin starts impersonating a user
export async function POST(req: NextRequest) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser || currentUser.role !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden: Admin access required" }, { status: 403 });
    }

    const { targetUserId } = await req.json();
    const db = getDb();

    const targetUser = db.prepare("SELECT * FROM users WHERE id = ?").get(targetUserId) as any;
    if (!targetUser) {
      return NextResponse.json({ error: "Target user not found." }, { status: 404 });
    }

    const token = `sess_imp_${randomBytes(32).toString("hex")}`;
    const now = Date.now();
    const expiresAt = now + 4 * 60 * 60 * 1000; // 4 hours

    db.prepare(`
      INSERT INTO sessions (token, userId, impersonatedBy, expiresAt) VALUES (?, ?, ?, ?)
    `).run(token, targetUser.id, currentUser.id, expiresAt);

    const response = NextResponse.json({
      success: true,
      message: `Now impersonating ${targetUser.displayName} (@${targetUser.username})`,
      targetUser: {
        id: targetUser.id,
        email: targetUser.email,
        username: targetUser.username,
        displayName: targetUser.displayName,
        role: targetUser.role,
        impersonatedBy: currentUser.id,
      },
    });

    response.cookies.set("devnix_session", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 4 * 60 * 60,
      path: "/",
    });

    return response;
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to impersonate user." }, { status: 400 });
  }
}

// DELETE /api/admin/impersonate - Stop impersonation and restore Admin session
export async function DELETE(req: NextRequest) {
  try {
    const cookieStore = await cookies();
    const currentToken = cookieStore.get("devnix_session")?.value;
    if (!currentToken) {
      return NextResponse.json({ error: "No active session." }, { status: 400 });
    }

    const db = getDb();
    const sessionRow = db.prepare("SELECT * FROM sessions WHERE token = ?").get(currentToken) as any;

    if (!sessionRow || !sessionRow.impersonatedBy) {
      return NextResponse.json({ error: "Session is not impersonated." }, { status: 400 });
    }

    const adminId = sessionRow.impersonatedBy;
    const adminUser = db.prepare("SELECT * FROM users WHERE id = ?").get(adminId) as any;

    // Delete impersonation session
    db.prepare("DELETE FROM sessions WHERE token = ?").run(currentToken);

    if (!adminUser) {
      const resp = NextResponse.json({ success: true, message: "Impersonation ended." });
      resp.cookies.delete("devnix_session");
      return resp;
    }

    // Create fresh admin session
    const adminToken = `sess_${randomBytes(32).toString("hex")}`;
    const expiresAt = Date.now() + 7 * 24 * 60 * 60 * 1000;
    db.prepare("INSERT INTO sessions (token, userId, expiresAt) VALUES (?, ?, ?)").run(adminToken, adminUser.id, expiresAt);

    const response = NextResponse.json({
      success: true,
      message: "Returned to Admin account.",
      adminUser: {
        id: adminUser.id,
        email: adminUser.email,
        username: adminUser.username,
        displayName: adminUser.displayName,
        role: adminUser.role,
      },
    });

    response.cookies.set("devnix_session", adminToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 7 * 24 * 60 * 60,
      path: "/",
    });

    return response;
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to restore admin session." }, { status: 400 });
  }
}
