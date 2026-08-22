import { NextRequest, NextResponse } from "next/server";
import { registerUser, authenticateUser } from "@/lib/auth";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { email, username, displayName, password } = body;

    const user = registerUser({
      email,
      username,
      displayName: displayName || username,
      password,
    });

    // Auto log-in after registration
    const { accessToken, refreshToken } = authenticateUser(email, password);

    const response = NextResponse.json({ success: true, user, accessToken });
    response.cookies.set("devnix_access_token", accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 15 * 60,
      path: "/",
    });

    response.cookies.set("devnix_refresh_token", refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 7 * 24 * 60 * 60,
      path: "/",
    });

    return response;
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Registration failed" }, { status: 400 });
  }
}
