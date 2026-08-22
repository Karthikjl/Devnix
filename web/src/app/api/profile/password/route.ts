import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser, verifyPassword, hashPassword } from "@/lib/auth";
import { getDb } from "@/lib/db";

export async function POST(req: NextRequest) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { currentPassword, newPassword } = await req.json();

    if (!newPassword || newPassword.length < 6) {
      return NextResponse.json({ error: "New password must be at least 6 characters." }, { status: 400 });
    }

    const db = getDb();
    const userRow = db.prepare("SELECT passwordHash, mustResetPassword FROM users WHERE id = ?").get(currentUser.id) as { passwordHash: string; mustResetPassword: number } | undefined;

    if (!userRow) {
      return NextResponse.json({ error: "User not found." }, { status: 404 });
    }

    // Only require current password if NOT forced to reset
    if (!userRow.mustResetPassword && !currentUser.mustResetPassword) {
      if (!currentPassword) {
        return NextResponse.json({ error: "Current password is required." }, { status: 400 });
      }
      if (!verifyPassword(currentPassword, userRow.passwordHash)) {
        return NextResponse.json({ error: "Current password is incorrect." }, { status: 400 });
      }
    }

    const newHash = hashPassword(newPassword);
    const now = Date.now();

    db.prepare(`
      UPDATE users SET passwordHash = ?, mustResetPassword = 0, updatedAt = ? WHERE id = ?
    `).run(newHash, now, currentUser.id);

    return NextResponse.json({ success: true, message: "Password updated successfully." });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to change password." }, { status: 400 });
  }
}
