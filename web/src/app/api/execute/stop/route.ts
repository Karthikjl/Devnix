import { NextRequest, NextResponse } from "next/server";
import { killSession } from "@/lib/sessionManager";
import { getCurrentUser } from "@/lib/auth";

export async function POST(req: NextRequest) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return NextResponse.json({ error: "Authentication required." }, { status: 401 });
    }

    const { sessionId } = await req.json();

    if (!sessionId) {
      return NextResponse.json({ error: "SessionId is required." }, { status: 400 });
    }

    const success = killSession(`${currentUser.id}:${sessionId}`);
    return NextResponse.json({ success });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
