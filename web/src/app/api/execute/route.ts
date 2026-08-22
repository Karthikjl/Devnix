import { NextRequest, NextResponse } from "next/server";
import { executeInLocalSandbox } from "@/lib/localSandbox";

export async function POST(req: NextRequest) {
  try {
    const { language_id, source_code, stdin } = await req.json();

    if (!language_id || typeof source_code !== "string") {
      return NextResponse.json(
        { error: "Language ID and source code are required." },
        { status: 400 }
      );
    }

    // Execute with real compilers in Docker container or local environment
    const result = executeInLocalSandbox(language_id, source_code, stdin || "");
    return NextResponse.json(result);
  } catch (error: any) {
    return NextResponse.json(
      {
        status: { id: 13, description: "Internal Error" },
        stderr: `Server Error: ${error.message}`,
      },
      { status: 500 }
    );
  }
}
