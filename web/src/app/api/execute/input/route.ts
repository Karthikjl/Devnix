import { NextRequest, NextResponse } from "next/server";
import { sendInputToSession } from "@/lib/sessionManager";
import { getCurrentUser } from "@/lib/auth";

export async function POST(req: NextRequest) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return NextResponse.json({ error: "Authentication required." }, { status: 401 });
    }

    const { sessionId, input } = await req.json();

    if (!sessionId || typeof input !== "string") {
      return NextResponse.json(
        { error: "SessionId and input are required." },
        { status: 400 }
      );
    }

    const cleanInput = input.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
    const success = sendInputToSession(`${currentUser.id}:${sessionId}`, cleanInput);
    return NextResponse.json({ success });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
