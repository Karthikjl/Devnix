import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { revokeRefreshToken } from "@/lib/auth";

export async function POST(req: NextRequest) {
  const cookieStore = await cookies();
  const refreshToken = cookieStore.get("devnix_refresh_token")?.value;
  if (refreshToken) {
    revokeRefreshToken(refreshToken);
  }

  const response = NextResponse.json({ success: true });
  response.cookies.delete("devnix_access_token");
  response.cookies.delete("devnix_refresh_token");
  response.cookies.delete("devnix_session");
  return response;
}
