import { NextResponse } from "next/server";
import { SUPPORTED_LANGUAGES } from "@/lib/languages";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({
    source: "local_presets",
    languages: SUPPORTED_LANGUAGES,
  });
}
