import { NextRequest, NextResponse } from "next/server";
import { AI_PROVIDERS, buildSystemPrompt, CodeContext } from "@/lib/aiService";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      messages = [],
      context,
      provider = "gemini",
      model,
      apiKey: clientApiKey,
      baseUrl: clientBaseUrl,
    } = body;

    const providerConfig = AI_PROVIDERS[provider] || AI_PROVIDERS.gemini;

    // Resolve API Key
    let apiKey = clientApiKey;
    if (!apiKey) {
      apiKey =
        process.env.DEVNIX_AI_API_KEY ||
        process.env[providerConfig.envKeyName] ||
        process.env.OPENAI_API_KEY ||
        process.env.GEMINI_API_KEY ||
        process.env.GROQ_API_KEY ||
        process.env.DEEPSEEK_API_KEY ||
        "";
    }

    // Resolve Base URL and Model
    const targetBaseUrl = clientBaseUrl || providerConfig.baseUrl || "https://api.openai.com/v1";
    const targetModel = model || providerConfig.defaultModel;

    // Ollama does not require an API key, but other cloud providers do
    if (provider !== "ollama" && !apiKey) {
      return NextResponse.json(
        {
          error: `Missing API key for ${providerConfig.name}. Please provide an API key in the AI Assistant settings or set ${providerConfig.envKeyName} in your environment.`,
        },
        { status: 400 }
      );
    }

    const systemPrompt = buildSystemPrompt(context as CodeContext);

    // Build chat message payload
    const formattedMessages = [
      { role: "system", content: systemPrompt },
      ...messages.map((m: { role: string; content: string }) => ({
        role: m.role,
        content: m.content,
      })),
    ];

    const endpointUrl = `${targetBaseUrl.replace(/\/+$/, "")}/chat/completions`;

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      Accept: "text/event-stream",
    };

    if (apiKey) {
      headers["Authorization"] = `Bearer ${apiKey}`;
    }

    const aiResponse = await fetch(endpointUrl, {
      method: "POST",
      headers,
      body: JSON.stringify({
        model: targetModel,
        messages: formattedMessages,
        temperature: 0.4,
        stream: true,
      }),
      signal: AbortSignal.timeout(60000),
    });

    if (!aiResponse.ok) {
      const errText = await aiResponse.text();
      let errorMsg = `AI Provider Error (${aiResponse.status}): ${errText}`;
      try {
        const parsed = JSON.parse(errText);
        if (parsed.error?.message) {
          errorMsg = `${providerConfig.name} Error: ${parsed.error.message}`;
        }
      } catch {}
      return NextResponse.json({ error: errorMsg }, { status: aiResponse.status });
    }

    if (!aiResponse.body) {
      return NextResponse.json({ error: "No response stream received from AI provider." }, { status: 500 });
    }

    // Stream SSE back to client
    const reader = aiResponse.body.getReader();
    const encoder = new TextEncoder();
    const decoder = new TextDecoder();

    const stream = new ReadableStream({
      async start(controller) {
        let buffer = "";

        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split("\n");
            buffer = lines.pop() || "";

            for (const line of lines) {
              const trimmed = line.trim();
              if (!trimmed || !trimmed.startsWith("data:")) continue;

              const dataStr = trimmed.slice(5).trim();
              if (dataStr === "[DONE]") {
                controller.enqueue(encoder.encode(`data: [DONE]\n\n`));
                continue;
              }

              try {
                const parsed = JSON.parse(dataStr);
                const delta = parsed.choices?.[0]?.delta?.content || "";
                if (delta) {
                  controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text: delta })}\n\n`));
                }
              } catch {
                // Ignore chunk parse errors
              }
            }
          }

          controller.close();
        } catch (streamErr: any) {
          controller.error(streamErr);
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
  } catch (error: any) {
    return NextResponse.json(
      { error: `Internal Server Error: ${error.message}` },
      { status: 500 }
    );
  }
}
