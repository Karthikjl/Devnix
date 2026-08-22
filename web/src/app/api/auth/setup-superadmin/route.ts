import { NextRequest, NextResponse } from "next/server";
import { setupSuperAdmin } from "@/lib/auth";

export async function POST(req: NextRequest) {
  try {
    const { email, username, displayName, password } = await req.json();

    const { user, accessToken, refreshToken } = setupSuperAdmin({
      email,
      username,
      displayName: displayName || username,
      password,
    });

    const response = NextResponse.json({
      success: true,
      user,
      accessToken,
      message: "Super Admin created successfully. Platform setup complete.",
    });

    // Set 15m Access Token cookie
    response.cookies.set("devnix_access_token", accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 15 * 60,
      path: "/",
    });

    // Set 7d Refresh Token cookie
    response.cookies.set("devnix_refresh_token", refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 7 * 24 * 60 * 60,
      path: "/",
    });

    return response;
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to setup Super Admin." }, { status: 400 });
  }
}
