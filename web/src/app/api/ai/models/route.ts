import { NextRequest, NextResponse } from "next/server";
import { AI_PROVIDERS } from "@/lib/aiService";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { provider = "gemini", apiKey: clientApiKey, baseUrl: clientBaseUrl } = body;

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

    const targetBaseUrl = clientBaseUrl || providerConfig.baseUrl;

    // Default to provider's official curated models list
    const defaultModels = providerConfig.models || [];

    if (!targetBaseUrl) {
      return NextResponse.json({
        provider: providerConfig.id,
        providerName: providerConfig.name,
        models: defaultModels,
      });
    }

    // If no API key is available (and not a keyless provider), return provider's models directly
    if (provider !== "ollama" && provider !== "openrouter" && !apiKey) {
      return NextResponse.json({
        provider: providerConfig.id,
        providerName: providerConfig.name,
        models: defaultModels,
        status: "ready",
      });
    }

    const endpointUrl = `${targetBaseUrl.replace(/\/+$/, "")}/models`;

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      Accept: "application/json",
    };

    if (apiKey) {
      headers["Authorization"] = `Bearer ${apiKey}`;
    }

    try {
      const response = await fetch(endpointUrl, {
        method: "GET",
        headers,
        signal: AbortSignal.timeout(6000),
      });

      if (response.ok) {
        const data = await response.json();
        let rawModels: any[] = [];

        if (Array.isArray(data.data)) {
          rawModels = data.data;
        } else if (Array.isArray(data.models)) {
          rawModels = data.models;
        } else if (Array.isArray(data)) {
          rawModels = data;
        }

        if (rawModels.length > 0) {
          const liveModels = rawModels
            .map((m: any) => {
              const id = typeof m === "string" ? m : m.id || m.name;
              const name = (m.name && m.name !== id) ? `${m.name} (${id})` : id;
              return { id, name };
            })
            .filter(
              (m) =>
                Boolean(m.id) &&
                !m.id.includes("embedding") &&
                !m.id.includes("whisper") &&
                !m.id.includes("tts") &&
                !m.id.includes("dall-e") &&
                !m.id.includes("moderation")
            )
            .sort((a, b) => a.id.localeCompare(b.id));

          if (liveModels.length > 0) {
            return NextResponse.json({
              provider: providerConfig.id,
              providerName: providerConfig.name,
              models: liveModels,
              status: "live",
            });
          }
        }
      }
    } catch {
      // Fallback seamlessly to default models without showing any error
    }

    return NextResponse.json({
      provider: providerConfig.id,
      providerName: providerConfig.name,
      models: defaultModels,
      status: "ready",
    });
  } catch (error: any) {
    const providerConfig = AI_PROVIDERS.gemini;
    return NextResponse.json({
      provider: providerConfig.id,
      providerName: providerConfig.name,
      models: providerConfig.models || [],
      status: "ready",
    });
  }
}
