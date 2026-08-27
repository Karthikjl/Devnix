import { NextRequest, NextResponse } from "next/server";
import { sendInputToSession } from "@/lib/sessionManager";

export async function POST(req: NextRequest) {
  try {
    const { sessionId, input } = await req.json();

    if (!sessionId || typeof input !== "string") {
      return NextResponse.json(
        { error: "SessionId and input are required." },
        { status: 400 }
      );
    }

    const cleanInput = input.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
    const success = sendInputToSession(sessionId, cleanInput);
    return NextResponse.json({ success });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
