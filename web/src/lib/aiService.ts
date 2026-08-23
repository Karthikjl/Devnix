export interface AiProviderConfig {
  id: string;
  name: string;
  badge: string;
  color: string;
  baseUrl: string;
  defaultModel: string;
  models: { id: string; name: string }[];
  envKeyName: string;
}

export const AI_PROVIDERS: Record<string, AiProviderConfig> = {
  gemini: {
    id: "gemini",
    name: "Google Gemini",
    badge: "Fast & Smart",
    color: "#3b82f6",
    baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai",
    defaultModel: "gemini-2.0-flash",
    models: [
      { id: "gemini-2.0-flash", name: "Gemini 2.0 Flash (Recommended)" },
      { id: "gemini-2.0-flash-lite", name: "Gemini 2.0 Flash Lite" },
      { id: "gemini-1.5-flash", name: "Gemini 1.5 Flash" },
      { id: "gemini-1.5-pro", name: "Gemini 1.5 Pro (Deep Reasoning)" },
      { id: "gemini-exp-1206", name: "Gemini Experimental" },
    ],
    envKeyName: "GEMINI_API_KEY",
  },
  groq: {
    id: "groq",
    name: "Groq LPU",
    badge: "Ultra Fast",
    color: "#f97316",
    baseUrl: "https://api.groq.com/openai/v1",
    defaultModel: "llama-3.3-70b-versatile",
    models: [
      { id: "llama-3.3-70b-versatile", name: "Llama 3.3 70B Versatile" },
      { id: "deepseek-r1-distill-llama-70b", name: "DeepSeek R1 Distill 70B" },
      { id: "llama-3.1-8b-instant", name: "Llama 3.1 8B Instant" },
      { id: "mixtral-8x7b-32768", name: "Mixtral 8x7B" },
      { id: "gemma2-9b-it", name: "Gemma 2 9B" },
    ],
    envKeyName: "GROQ_API_KEY",
  },
  openai: {
    id: "openai",
    name: "OpenAI",
    badge: "Industry Standard",
    color: "#10b981",
    baseUrl: "https://api.openai.com/v1",
    defaultModel: "gpt-4o-mini",
    models: [
      { id: "gpt-4o-mini", name: "GPT-4o Mini (Fast & Smart)" },
      { id: "gpt-4o", name: "GPT-4o (Flagship Multimodal)" },
      { id: "o3-mini", name: "o3-mini (High Reasoning)" },
      { id: "o1-mini", name: "o1-mini (Coding & Math)" },
      { id: "o1", name: "o1 (Full Reasoning)" },
      { id: "gpt-4-turbo", name: "GPT-4 Turbo" },
    ],
    envKeyName: "OPENAI_API_KEY",
  },
  deepseek: {
    id: "deepseek",
    name: "DeepSeek",
    badge: "Deep Reasoning",
    color: "#6366f1",
    baseUrl: "https://api.deepseek.com/v1",
    defaultModel: "deepseek-chat",
    models: [
      { id: "deepseek-chat", name: "DeepSeek-V3 (Chat & Code)" },
      { id: "deepseek-reasoner", name: "DeepSeek-R1 (Deep Reasoning)" },
    ],
    envKeyName: "DEEPSEEK_API_KEY",
  },
  ollama: {
    id: "ollama",
    name: "Ollama (Local / Self-Hosted)",
    badge: "Local & Free",
    color: "#8b5cf6",
    baseUrl: "http://localhost:11434/v1",
    defaultModel: "qwen2.5-coder",
    models: [
      { id: "qwen2.5-coder", name: "Qwen 2.5 Coder (Recommended)" },
      { id: "deepseek-r1", name: "DeepSeek R1 (Local)" },
      { id: "llama3.2", name: "Llama 3.2" },
      { id: "codellama", name: "Code Llama" },
      { id: "mistral", name: "Mistral 7B" },
      { id: "phi4", name: "Microsoft Phi-4" },
    ],
    envKeyName: "OLLAMA_API_KEY",
  },
  openrouter: {
    id: "openrouter",
    name: "OpenRouter",
    badge: "200+ Models",
    color: "#ec4899",
    baseUrl: "https://openrouter.ai/api/v1",
    defaultModel: "anthropic/claude-3.5-sonnet",
    models: [
      { id: "anthropic/claude-3.5-sonnet", name: "Claude 3.5 Sonnet" },
      { id: "deepseek/deepseek-r1", name: "DeepSeek R1" },
      { id: "meta-llama/llama-3.3-70b-instruct", name: "Llama 3.3 70B" },
      { id: "google/gemini-2.0-flash-001", name: "Gemini 2.0 Flash" },
      { id: "openai/gpt-4o", name: "OpenAI GPT-4o" },
    ],
    envKeyName: "OPENROUTER_API_KEY",
  },
  custom: {
    id: "custom",
    name: "Custom OpenAI Compatible",
    badge: "Custom Endpoint",
    color: "#eab308",
    baseUrl: "",
    defaultModel: "custom-model",
    models: [{ id: "custom-model", name: "Custom Model" }],
    envKeyName: "DEVNIX_AI_API_KEY",
  },
};

export interface CodeContext {
  languageName?: string | null;
  languageVersion?: string | null;
  code?: string | null;
  stdin?: string | null;
  stdout?: string | null;
  stderr?: string | null;
  compileOutput?: string | null;
  exitStatus?: string | null;
  executionTime?: string | null;
}

export function buildSystemPrompt(context?: CodeContext): string {
  let prompt = `You are DEVNIX AI, an expert programming companion, debugger, algorithm teacher, and code architect embedded inside Devnix Online Code Studio.

Devnix features a Neobrutalist design with multi-language execution and live terminals.
Your goal is to provide concise, accurate, and actionable assistance to developers.

RULES:
1. Provide direct, high-value answers. Avoid fluff or excessive boilerplate greetings.
2. When suggesting code, always provide clean, production-grade, bug-free code blocks with syntax highlighting (e.g. \`\`\`python, \`\`\`cpp, \`\`\`java).
3. If explaining algorithms, use step-by-step breakdowns, ascii tables, or structured bullet points to make logic crystal clear.
4. When debugging runtime errors, compilation errors, or logic bugs, clearly state:
   - What went wrong
   - Why it failed
   - The exact fix
5. Keep your output formatted in beautiful GitHub Flavored Markdown.
6. INTERACTIVE ALGORITHMIC VISUAL TRACE (Condensed & User-Input Driven):
When the user asks for a "visual trace", "step-by-step trace", or uses the Visual Trace quick action:
- CODE MATCHING: Trace the EXACT code currently in the editor. The "line" number in each step MUST match the exact 1-based line number of the code in the user's editor so Monaco Editor can highlight the active line in real-time.
- CONDENSED & SMART ITERATIONS: If a loop runs many times (e.g. 100 or 500 times), DO NOT output 500 repetitive steps! Instead, generate 5 to 9 concise, representative key steps (e.g., initialization, first iteration, pointer shift, key condition branch, and final termination).
- USER INPUT DRIVEN: If the user provided \`stdin\` inputs or sample test cases, trace the execution using their concrete inputs so they can see how their data flows through the algorithm.
- Track active pointers (e.g. \`left\`, \`right\`, \`mid\`, \`i\`, \`j\`), variables, array/hashmap states in the \`variables\` object for every step.
- Explain each step with clear algorithmic intuition (e.g. why a condition evaluates to true/false, why a pointer moved, or what was computed).
- If the editor is completely empty, ask the user to write code in the editor or provide a clean algorithm template.

Output format MUST be a valid JSON block inside \`\`\`trace:
\`\`\`trace
{
  "title": "Algorithm Execution Trace",
  "steps": [
    {
      "step": 1,
      "line": 1,
      "code": "left, right = 0, len(nums) - 1",
      "explanation": "Initialize pointers: left at index 0 and right at index 3",
      "variables": { "left": 0, "right": 3, "target": 9 },
      "arrayVisualizer": {
        "name": "nums",
        "elements": [2, 7, 11, 15],
        "pointers": [
          { "name": "left", "index": 0, "color": "#00f0ff" },
          { "name": "right", "index": 3, "color": "#ff5277" }
        ],
        "highlightIndices": [0, 3]
      },
      "output": ""
    }
  ]
}
\`\`\``;

  if (context) {
    prompt += `\n\n--- ACTIVE WORKSPACE CONTEXT ---`;
    if (context.languageName) {
      prompt += `\n- Language: ${context.languageName} ${context.languageVersion ? `(Version: ${context.languageVersion})` : ""}`;
    }
    if (context.code) {
      prompt += `\n- Current Code in Editor:\n\`\`\`${context.languageName?.toLowerCase() || ""}\n${context.code}\n\`\`\``;
    }
    if (context.stdin) {
      prompt += `\n- Stdin Inputs Provided:\n\`\`\`\n${context.stdin}\n\`\`\``;
    }
    if (context.compileOutput) {
      prompt += `\n- Compilation Error Output:\n\`\`\`\n${context.compileOutput}\n\`\`\``;
    }
    if (context.stderr) {
      prompt += `\n- Runtime Stderr / Error:\n\`\`\`\n${context.stderr}\n\`\`\``;
    }
    if (context.stdout) {
      prompt += `\n- Terminal Stdout Result:\n\`\`\`\n${context.stdout}\n\`\`\``;
    }
    if (context.exitStatus) {
      prompt += `\n- Execution Status: ${context.exitStatus} ${context.executionTime ? `(${context.executionTime}s)` : ""}`;
    }
    prompt += `\n-------------------------------`;
  }

  return prompt;
}
