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

    // 1. OpenRouter (Public endpoint - No API key required for listing models)
    if (provider === "openrouter") {
      try {
        const response = await fetch("https://openrouter.ai/api/v1/models", {
          method: "GET",
          headers: { Accept: "application/json" },
          signal: AbortSignal.timeout(8000),
        });

        if (response.ok) {
          const data = await response.json();
          const rawList = Array.isArray(data.data) ? data.data : [];
          const models = rawList
            .filter((m: any) => m && m.id && !m.id.includes(":free-disabled"))
            .map((m: any) => ({
              id: m.id,
              name: m.name ? `${m.name}` : m.id,
              contextLength: m.context_length,
              description: m.description,
            }))
            .sort((a: any, b: any) => a.name.localeCompare(b.name));

          return NextResponse.json({
            provider: "openrouter",
            providerName: "OpenRouter",
            models,
            status: "live",
          });
        }
      } catch (err: any) {
        return NextResponse.json({
          provider: "openrouter",
          providerName: "OpenRouter",
          models: [],
          error: `Failed to fetch live OpenRouter models: ${err.message}`,
        });
      }
    }

    // 2. Ollama (Local endpoint - No API key required)
    if (provider === "ollama") {
      const ollamaBase = (targetBaseUrl || "http://localhost:11434").replace(/\/+$/, "");
      try {
        // Try /api/tags first, then /v1/models
        let rawModels: any[] = [];
        const resTags = await fetch(`${ollamaBase}/api/tags`, {
          method: "GET",
          signal: AbortSignal.timeout(4000),
        }).catch(() => null);

        if (resTags && resTags.ok) {
          const data = await resTags.json();
          if (Array.isArray(data.models)) {
            rawModels = data.models.map((m: any) => ({ id: m.name, name: m.name }));
          }
        } else {
          const resV1 = await fetch(`${ollamaBase}/models`, {
            method: "GET",
            signal: AbortSignal.timeout(4000),
          }).catch(() => null);
          if (resV1 && resV1.ok) {
            const data = await resV1.json();
            const list = Array.isArray(data.data) ? data.data : Array.isArray(data.models) ? data.models : [];
            rawModels = list.map((m: any) => ({ id: m.id || m.name, name: m.name || m.id }));
          }
        }

        if (rawModels.length > 0) {
          return NextResponse.json({
            provider: "ollama",
            providerName: "Ollama (Local)",
            models: rawModels,
            status: "live",
          });
        }

        return NextResponse.json({
          provider: "ollama",
          providerName: "Ollama (Local)",
          models: [],
          error: "Ollama is running but no local models were found. Run `ollama pull qwen2.5-coder` or `ollama pull llama3` in terminal.",
        });
      } catch (err: any) {
        return NextResponse.json({
          provider: "ollama",
          providerName: "Ollama (Local)",
          models: [],
          error: `Ollama server is not running on ${ollamaBase}. Start Ollama to use local models.`,
        });
      }
    }

    // 3. Custom OpenAI-compatible Endpoint
    if (provider === "custom") {
      if (!targetBaseUrl) {
        return NextResponse.json({
          provider: "custom",
          providerName: "Custom Endpoint",
          models: [],
          error: "Please enter a Custom Endpoint Base URL (e.g. http://localhost:8000/v1)",
        });
      }

      const endpointUrl = `${targetBaseUrl.replace(/\/+$/, "")}/models`;
      const headers: Record<string, string> = { Accept: "application/json" };
      if (apiKey) headers["Authorization"] = `Bearer ${apiKey}`;

      try {
        const response = await fetch(endpointUrl, {
          method: "GET",
          headers,
          signal: AbortSignal.timeout(6000),
        });

        if (response.ok) {
          const data = await response.json();
          const list = Array.isArray(data.data) ? data.data : Array.isArray(data.models) ? data.models : [];
          const models = list.map((m: any) => ({
            id: typeof m === "string" ? m : m.id || m.name,
            name: typeof m === "string" ? m : m.name || m.id,
          }));

          return NextResponse.json({
            provider: "custom",
            providerName: "Custom Endpoint",
            models,
            status: "live",
          });
        } else {
          return NextResponse.json({
            provider: "custom",
            providerName: "Custom Endpoint",
            models: [],
            error: `Endpoint returned HTTP ${response.status}: ${response.statusText}`,
          });
        }
      } catch (err: any) {
        return NextResponse.json({
          provider: "custom",
          providerName: "Custom Endpoint",
          models: [],
          error: `Could not reach ${endpointUrl}: ${err.message}`,
        });
      }
    }

    // 4. Authenticated Providers when API Key is Present
    if (apiKey) {
      if (provider === "gemini") {
        try {
          const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`;
          const response = await fetch(geminiUrl, {
            method: "GET",
            headers: { Accept: "application/json" },
            signal: AbortSignal.timeout(7000),
          });

          if (response.ok) {
            const data = await response.json();
            const rawModels = Array.isArray(data.models) ? data.models : [];
            const liveModels = rawModels
              .filter((m: any) => {
                const methods = m.supportedGenerationMethods || [];
                return methods.includes("generateContent") && !m.name.includes("embedding") && !m.name.includes("aqa");
              })
              .map((m: any) => {
                const id = m.name.replace(/^models\//, "");
                return {
                  id,
                  name: m.displayName ? `${m.displayName} (${id})` : id,
                };
              })
              .sort((a: any, b: any) => a.name.localeCompare(b.name));

            if (liveModels.length > 0) {
              return NextResponse.json({
                provider: "gemini",
                providerName: "Google Gemini",
                models: liveModels,
                status: "live",
              });
            }
          }
        } catch {}
      } else {
        // Groq, OpenAI, DeepSeek via /v1/models
        try {
          const endpointUrl = `${targetBaseUrl.replace(/\/+$/, "")}/models`;
          const response = await fetch(endpointUrl, {
            method: "GET",
            headers: {
              Accept: "application/json",
              Authorization: `Bearer ${apiKey}`,
            },
            signal: AbortSignal.timeout(7000),
          });

          if (response.ok) {
            const data = await response.json();
            const rawModels = Array.isArray(data.data) ? data.data : Array.isArray(data.models) ? data.models : [];
            const liveModels = rawModels
              .map((m: any) => ({
                id: typeof m === "string" ? m : m.id || m.name,
                name: typeof m === "string" ? m : m.name || m.id,
              }))
              .filter(
                (m: any) =>
                  Boolean(m.id) &&
                  !m.id.includes("embedding") &&
                  !m.id.includes("whisper") &&
                  !m.id.includes("tts") &&
                  !m.id.includes("dall-e") &&
                  !m.id.includes("moderation") &&
                  !m.id.includes("babbage") &&
                  !m.id.includes("davinci")
              )
              .sort((a: any, b: any) => a.name.localeCompare(b.name));

            if (liveModels.length > 0) {
              return NextResponse.json({
                provider: providerConfig.id,
                providerName: providerConfig.name,
                models: liveModels,
                status: "live",
              });
            }
          }
        } catch {}
      }
    }

    // 5. Unauthenticated View Mode: Fetch Live Actual Models via Public Endpoint Filtered by Provider
    try {
      const response = await fetch("https://openrouter.ai/api/v1/models", {
        method: "GET",
        headers: { Accept: "application/json" },
        signal: AbortSignal.timeout(8000),
      });

      if (response.ok) {
        const data = await response.json();
        const rawList = Array.isArray(data.data) ? data.data : [];

        let prefixMatch = "";
        if (provider === "gemini") prefixMatch = "google/";
        else if (provider === "openai") prefixMatch = "openai/";
        else if (provider === "deepseek") prefixMatch = "deepseek/";
        else if (provider === "groq") prefixMatch = "meta-llama/";

        const filtered = rawList
          .filter((m: any) => {
            if (!m || !m.id) return false;
            if (m.id.includes(":batch") || m.id.includes("embedding") || m.id.includes("moderation")) return false;
            if (prefixMatch) {
              return m.id.startsWith(prefixMatch) || (provider === "groq" && (m.id.startsWith("groq/") || m.id.startsWith("mistralai/")));
            }
            return true;
          })
          .map((m: any) => {
            const rawId = m.id;
            const strippedId = prefixMatch && rawId.startsWith(prefixMatch) ? rawId.replace(prefixMatch, "") : rawId;
            return {
              id: strippedId,
              name: m.name ? m.name : strippedId,
            };
          })
          .sort((a: any, b: any) => a.name.localeCompare(b.name));

        if (filtered.length > 0) {
          return NextResponse.json({
            provider: providerConfig.id,
            providerName: providerConfig.name,
            models: filtered,
            status: "live",
          });
        }
      }
    } catch {}

    // If all dynamic endpoints failed, return empty models list with status
    return NextResponse.json({
      provider: providerConfig.id,
      providerName: providerConfig.name,
      models: [],
      status: "unreachable",
    });
  } catch (error: any) {
    return NextResponse.json({
      provider: "gemini",
      providerName: "Google Gemini",
      models: [],
      error: error.message,
    });
  }
}
