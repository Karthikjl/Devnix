import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getDb } from "@/lib/db";

export async function POST(req: NextRequest) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { displayName, email, username } = await req.json();
    const db = getDb();
    const now = Date.now();

    const newEmail = email ? email.trim().toLowerCase() : currentUser.email;
    const newUsername = username ? username.trim().replace(/^@/, "") : currentUser.username;
    const newDisplayName = displayName ? displayName.trim() : currentUser.displayName;

    // Check email clash
    if (newEmail !== currentUser.email) {
      const existing = db.prepare("SELECT id FROM users WHERE email = ? AND id != ?").get(newEmail, currentUser.id);
      if (existing) {
        return NextResponse.json({ error: "Email is already taken by another account." }, { status: 400 });
      }
    }

    // Check username clash
    if (newUsername !== currentUser.username) {
      const existing = db.prepare("SELECT id FROM users WHERE username = ? COLLATE NOCASE AND id != ?").get(newUsername, currentUser.id);
      if (existing) {
        return NextResponse.json({ error: "Username is already taken by another account." }, { status: 400 });
      }
    }

    db.prepare(`
      UPDATE users SET displayName = ?, email = ?, username = ?, updatedAt = ? WHERE id = ?
    `).run(newDisplayName, newEmail, newUsername, now, currentUser.id);

    const updatedUser = {
      ...currentUser,
      displayName: newDisplayName,
      email: newEmail,
      username: newUsername,
    };

    return NextResponse.json({ success: true, user: updatedUser });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to update profile." }, { status: 400 });
  }
}
