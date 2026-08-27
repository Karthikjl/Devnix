import { NextRequest, NextResponse } from "next/server";
import { executeInDockerContainer } from "@/lib/dockerRunner";

export async function POST(req: NextRequest) {
  try {
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

    const judge0Url = process.env.JUDGE0_URL || "http://server:2358";

    // 1. Attempt execution via Judge0 API if online
    try {
      const judgeRes = await fetch(`${judge0Url}/submissions?base64_encoded=false&wait=true`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          language_id,
          source_code: cleanSourceCode,
          stdin: cleanStdin,
        }),
        signal: AbortSignal.timeout(6000),
      });

      if (judgeRes.ok) {
        const judgeData = await judgeRes.json();
        // If Judge0 returned a real execution result (not an internal isolate error), return it
        if (judgeData && judgeData.status && judgeData.status.id !== 13) {
          return NextResponse.json(judgeData);
        }
      }
    } catch {
      // Judge0 is offline or unavailable on this architecture -> proceed to native Docker Runner container
    }

    // 2. Execute directly inside the sandboxed native Docker Runner container
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
