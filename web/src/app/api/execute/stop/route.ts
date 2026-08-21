import { NextRequest, NextResponse } from "next/server";
import { killSession } from "@/lib/sessionManager";

export async function POST(req: NextRequest) {
  try {
    const { sessionId } = await req.json();

    if (!sessionId) {
      return NextResponse.json({ error: "SessionId is required." }, { status: 400 });
    }

    const success = killSession(sessionId);
    return NextResponse.json({ success });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
