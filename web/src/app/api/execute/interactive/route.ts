import { NextRequest } from "next/server";
import { createInteractiveSession } from "@/lib/sessionManager";

export async function POST(req: NextRequest) {
  try {
    const { sessionId, language_id, source_code } = await req.json();

    if (!sessionId || !language_id || typeof source_code !== "string") {
      return new Response(
        JSON.stringify({ error: "SessionId, language_id, and source_code are required." }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    const encoder = new TextEncoder();

    const stream = new ReadableStream({
      start(controller) {
        // Send initial connected event
        controller.enqueue(
          encoder.encode(
            `data: ${JSON.stringify({ type: "status", text: "⚡ Process connected. Streaming live...\n" })}\n\n`
          )
        );

        const success = createInteractiveSession(
          sessionId,
          language_id,
          source_code,
          (chunk) => {
            try {
              controller.enqueue(
                encoder.encode(`data: ${JSON.stringify(chunk)}\n\n`)
              );
              if (chunk.type === "exit") {
                controller.close();
              }
            } catch {
              // Stream may already be closed
            }
          }
        );

        if (!success) {
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({ type: "stderr", text: "Failed to initialize interactive process.\n" })}\n\n`
            )
          );
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
      },
    });
  } catch (err: any) {
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
