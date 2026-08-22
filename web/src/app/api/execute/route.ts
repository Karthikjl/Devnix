import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const { language_id, source_code, stdin } = await req.json();

    if (!language_id || typeof source_code !== "string") {
      return NextResponse.json(
        { error: "Language ID and source code are required." },
        { status: 400 }
      );
    }

    const judge0Url = process.env.JUDGE0_URL || "http://localhost:2358";

    // Strictly forward to Judge0 REST API (No fallbacks)
    try {
      const judgeRes = await fetch(`${judge0Url}/submissions?base64_encoded=false&wait=true`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          language_id,
          source_code,
          stdin: stdin || undefined,
        }),
        signal: AbortSignal.timeout(20000),
      });

      if (!judgeRes.ok) {
        const errText = await judgeRes.text();
        return NextResponse.json(
          {
            status: { id: 13, description: "Judge0 Error" },
            stderr: `Judge0 Server Error (${judgeRes.status}): ${errText}`,
          },
          { status: judgeRes.status }
        );
      }

      const judgeData = await judgeRes.json();
      return NextResponse.json(judgeData);
    } catch (fetchErr: any) {
      return NextResponse.json(
        {
          status: { id: 13, description: "Judge0 Offline" },
          stderr: `Error: Unable to connect to Judge0 API at ${judge0Url}. Please ensure Judge0 containers are running.`,
        },
        { status: 503 }
      );
    }
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
