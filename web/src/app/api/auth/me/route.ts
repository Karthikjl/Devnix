import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser, isSetupNeeded, getSetting } from "@/lib/auth";

export async function GET(req: NextRequest) {
  try {
    const needed = isSetupNeeded();
    const selfSignupEnabled = getSetting("selfSignupEnabled", "true") === "true";
    const user = await getCurrentUser();

    return NextResponse.json({
      user,
      isSetupNeeded: needed,
      selfSignupEnabled,
    });
  } catch (err: any) {
    return NextResponse.json({ user: null, isSetupNeeded: false, error: err.message });
  }
}
