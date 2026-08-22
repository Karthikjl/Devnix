import { NextRequest, NextResponse } from "next/server";
import { isSetupNeeded, getSetting } from "@/lib/auth";

export async function GET(req: NextRequest) {
  try {
    const needed = isSetupNeeded();
    const selfSignupEnabled = getSetting("selfSignupEnabled", "true") === "true";
    return NextResponse.json({
      isSetupNeeded: needed,
      selfSignupEnabled,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
