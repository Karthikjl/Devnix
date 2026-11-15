import { NextRequest, NextResponse } from "next/server";
import { executeInDockerContainer } from "@/lib/dockerRunner";
import { getCurrentUser } from "@/lib/auth";

export async function POST(req: NextRequest) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return NextResponse.json({ error: "Authentication required." }, { status: 401 });
    }

    const { language_id, source_code, stdin } = await req.json();

    if (!language_id || typeof source_code !== "string") {
      return NextResponse.json(
        { error: "Language ID and source code are required." },
        { status: 400 }
      );
    }

    // Normalize Windows CRLF -> LF for universal cross-platform compatibility
    const cleanSourceCode = source_code.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
    const cleanStdin = typeof stdin === "string" ? stdin.replace(/\r\n/g, "\n").replace(/\r/g, "\n") : undefined;

    // Execute inside the isolated runner container
    const result = executeInDockerContainer(language_id, cleanSourceCode, cleanStdin);
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
