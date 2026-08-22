import { NextResponse } from "next/server";
import { SUPPORTED_LANGUAGES, Language } from "@/lib/languages";

export const dynamic = "force-dynamic";

const JUDGE0_URL = process.env.JUDGE0_URL || "http://localhost:2358";

export async function GET() {
  try {
    const response = await fetch(`${JUDGE0_URL}/languages`, {
      signal: AbortSignal.timeout(600),
      headers: { Accept: "application/json" },
      cache: "no-store",
    });

    if (response.ok) {
      const judge0Langs = await response.json();

      if (Array.isArray(judge0Langs) && judge0Langs.length > 0) {
        const dynamicLanguages: Language[] = SUPPORTED_LANGUAGES.map((localLang) => {
          const remoteMatch = judge0Langs.find((j: any) => j.id === localLang.id);
          if (remoteMatch && remoteMatch.name) {
            const match = remoteMatch.name.match(/\((.*?)\)/);
            const dynamicVersion = match ? match[1] : localLang.version;
            return {
              ...localLang,
              version: dynamicVersion,
            };
          }
          return localLang;
        });

        return NextResponse.json({
          source: "judge0_live",
          languages: dynamicLanguages,
        });
      }
    }
  } catch {
    // Graceful fallback to local presets
  }

  return NextResponse.json({
    source: "local_presets",
    languages: SUPPORTED_LANGUAGES,
  });
}
