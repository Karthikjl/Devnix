import { NextRequest, NextResponse } from "next/server";
import { rotateRefreshToken } from "@/lib/auth";
import { cookies } from "next/headers";

export async function POST(req: NextRequest) {
  try {
    const cookieStore = await cookies();
    let rawRefreshToken = cookieStore.get("devnix_refresh_token")?.value;

    if (!rawRefreshToken) {
      const body = await req.json().catch(() => ({}));
      rawRefreshToken = body.refreshToken;
    }

    if (!rawRefreshToken) {
      return NextResponse.json({ error: "Refresh token is missing." }, { status: 401 });
    }

    const { user, accessToken, refreshToken } = rotateRefreshToken(rawRefreshToken);

    const response = NextResponse.json({
      success: true,
      user,
      accessToken,
    });

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
    const response = NextResponse.json({ error: err.message || "Failed to refresh token." }, { status: 401 });
    response.cookies.delete("devnix_access_token");
    response.cookies.delete("devnix_refresh_token");
    return response;
  }
}
