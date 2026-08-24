"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  Sparkles,
  X,
  Send,
  Square,
  Bot,
  User,
  Copy,
  Check,
  ArrowDownToLine,
  Settings2,
  Trash2,
  Code2,
  Zap,
  Bug,
  LineChart,
  HelpCircle,
  KeyRound,
  ExternalLink,
  ChevronDown,
  Search,
  GripVertical,
} from "lucide-react";
import { AI_PROVIDERS, CodeContext } from "@/lib/aiService";
import { VisualTracePlayer, TraceData } from "@/components/VisualTracePlayer";

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: string;
}

interface AiAssistantPanelProps {
  isOpen: boolean;
  onClose: () => void;
  context: CodeContext;
  onApplyCode: (newCode: string) => void;
  onHighlightLine?: (lineNumber: number | null) => void;
  embedded?: boolean;
}

export const AiAssistantPanel: React.FC<AiAssistantPanelProps> = ({
  isOpen,
  onClose,
  context,
  onApplyCode,
  onHighlightLine,
  embedded = false,
}) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showContextPreview, setShowContextPreview] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [appliedId, setAppliedId] = useState<string | null>(null);

  // Settings State (persisted in localStorage per provider)
  const [selectedProvider, setSelectedProvider] = useState<string>("gemini");
  const [providerModels, setProviderModels] = useState<Record<string, string>>({});
  const [selectedModel, setSelectedModel] = useState<string>("gemini-2.0-flash");
  const [apiKeys, setApiKeys] = useState<Record<string, string>>({});
  const [apiKey, setApiKey] = useState<string>("");
  const [customBaseUrl, setCustomBaseUrl] = useState<string>("");

  // Dynamic Endpoint Models State & Custom Dropdown State
  const [availableModels, setAvailableModels] = useState<{ id: string; name: string }[]>([]);
  const [isLoadingModels, setIsLoadingModels] = useState(false);
  const [isKeySaved, setIsKeySaved] = useState(false);
  const [modelFetchError, setModelFetchError] = useState<string | null>(null);
  const [isModelDropdownOpen, setIsModelDropdownOpen] = useState(false);
  const [modelSearch, setModelSearch] = useState("");
  const [isProviderDropdownOpen, setIsProviderDropdownOpen] = useState(false);

  const modelDropdownRef = useRef<HTMLDivElement>(null);
  const providerDropdownRef = useRef<HTMLDivElement>(null);
  const modelSearchInputRef = useRef<HTMLInputElement>(null);

  // Resizable Panel State & Limits (Min: 380px, Max: 850px)
  const [panelWidth, setPanelWidth] = useState<number>(500);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const isDraggingRef = useRef<boolean>(false);
  const startXRef = useRef<number>(0);
  const startWidthRef = useRef<number>(500);

  const MIN_WIDTH = 380;
  const MAX_WIDTH = typeof window !== "undefined" ? Math.min(window.innerWidth * 0.85, 900) : 850;

  // Load saved panel width on mount
  useEffect(() => {
    try {
      const savedWidth = localStorage.getItem("devnix_ai_panel_width");
      if (savedWidth) {
        const num = Number(savedWidth);
        if (!isNaN(num) && num >= MIN_WIDTH && num <= MAX_WIDTH) {
          setPanelWidth(num);
        }
      }
    } catch {}
  }, [MAX_WIDTH]);

  // Handle Drag / Resize Mouse Events
  const handleResizeMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    isDraggingRef.current = true;
    setIsDragging(true);
    startXRef.current = e.clientX;
    startWidthRef.current = panelWidth;
    document.body.style.userSelect = "none";
    document.body.style.cursor = "col-resize";
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDraggingRef.current) return;
      // Dragging cursor to the left increases the panel width (since panel is pinned to right)
      const deltaX = startXRef.current - e.clientX;
      const targetWidth = startWidthRef.current + deltaX;
      const clampedWidth = Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, targetWidth));
      setPanelWidth(clampedWidth);
    };

    const handleMouseUp = () => {
      if (isDraggingRef.current) {
        isDraggingRef.current = false;
        setIsDragging(false);
        document.body.style.userSelect = "";
        document.body.style.cursor = "";
        try {
          localStorage.setItem("devnix_ai_panel_width", String(panelWidth));
        } catch {}
      }
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [panelWidth, MAX_WIDTH]);

  // Close dropdowns on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (modelDropdownRef.current && !modelDropdownRef.current.contains(e.target as Node)) {
        setIsModelDropdownOpen(false);
      }
      if (providerDropdownRef.current && !providerDropdownRef.current.contains(e.target as Node)) {
        setIsProviderDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Dynamic model fetcher directly from provider endpoint
  const fetchEndpointModels = async (
    provKey: string,
    key?: string,
    baseUrl?: string,
    preferredModel?: string
  ) => {
    setIsLoadingModels(true);
    setModelFetchError(null);
    try {
      const res = await fetch("/api/ai/models", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider: provKey,
          apiKey: key || undefined,
          baseUrl: baseUrl || undefined,
        }),
      });
      const data = await res.json();
      if (data.models && data.models.length > 0) {
        setAvailableModels(data.models);
        const target = preferredModel || selectedModel;
        if (target) {
          setSelectedModel(target);
        } else {
          setSelectedModel(data.models[0].id);
        }
      } else {
        setAvailableModels([]);
        if (data.error) {
          setModelFetchError(data.error);
        }
      }
    } catch (err: any) {
      setAvailableModels([]);
      setModelFetchError(`Failed to load models: ${err.message}`);
    } finally {
      setIsLoadingModels(false);
    }
  };

  // Load settings and chat history from localStorage
  useEffect(() => {
    try {
      const savedProvider = localStorage.getItem("devnix_ai_provider");
      const savedBaseUrl = localStorage.getItem("devnix_ai_base_url");
      const savedMessages = localStorage.getItem("devnix_ai_history");

      // 1. Load all provider-specific API keys
      let loadedKeys: Record<string, string> = {};
      try {
        const parsed = JSON.parse(localStorage.getItem("devnix_ai_keys") || "{}");
        if (typeof parsed === "object" && parsed !== null) {
          loadedKeys = parsed;
        }
      } catch {}

      Object.keys(AI_PROVIDERS).forEach((pKey) => {
        const indKey = localStorage.getItem(`devnix_ai_key_${pKey}`);
        if (indKey && !loadedKeys[pKey]) {
          loadedKeys[pKey] = indKey;
        }
      });
      const legacyKey = localStorage.getItem("devnix_ai_key");
      if (legacyKey && !loadedKeys.gemini) {
        loadedKeys.gemini = legacyKey;
      }
      setApiKeys(loadedKeys);

      // 2. Load all provider-specific selected models
      let loadedModels: Record<string, string> = {};
      try {
        const parsedM = JSON.parse(localStorage.getItem("devnix_ai_models") || "{}");
        if (typeof parsedM === "object" && parsedM !== null) {
          loadedModels = parsedM;
        }
      } catch {}

      Object.keys(AI_PROVIDERS).forEach((pKey) => {
        const indModel = localStorage.getItem(`devnix_ai_model_${pKey}`);
        if (indModel && !loadedModels[pKey]) {
          loadedModels[pKey] = indModel;
        }
      });
      setProviderModels(loadedModels);

      const initialProv = savedProvider && AI_PROVIDERS[savedProvider] ? savedProvider : "gemini";
      setSelectedProvider(initialProv);
      const provObj = AI_PROVIDERS[initialProv] || AI_PROVIDERS.gemini;

      // Active API key for the current initial provider
      const activeKeyForProv = loadedKeys[initialProv] || "";
      setApiKey(activeKeyForProv);

      // Active Model for the current initial provider
      const activeModelForProv =
        loadedModels[initialProv] ||
        localStorage.getItem("devnix_ai_model") ||
        provObj.defaultModel;
      setSelectedModel(activeModelForProv);

      if (savedBaseUrl) {
        setCustomBaseUrl(savedBaseUrl);
      }

      // Fetch live models from endpoint
      fetchEndpointModels(initialProv, activeKeyForProv || undefined, savedBaseUrl || undefined, activeModelForProv);

      if (savedMessages) {
        setMessages(JSON.parse(savedMessages));
      } else {
        // Initial welcome message
        setMessages([
          {
            id: "welcome",
            role: "assistant",
            content: `👋 **Hi! I'm your DEVNIX AI Companion.**\n\nI have full real-time awareness of your **${
              context.languageName || "code"
            }** workspace. You can ask me to explain logic, fix syntax or runtime errors, optimize performance, or generate complete functions. Click any quick prompt below or type your question!`,
            timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
          },
        ]);
      }
    } catch {}
  }, []);

  // Save settings when changed
  useEffect(() => {
    try {
      localStorage.setItem("devnix_ai_provider", selectedProvider);
      localStorage.setItem("devnix_ai_base_url", customBaseUrl);
    } catch {}
  }, [selectedProvider, customBaseUrl]);

  // Handle Model change (saved per provider)
  const handleModelChange = (newModel: string, forProvider?: string) => {
    const targetProv = forProvider || selectedProvider;
    setSelectedModel(newModel);
    setProviderModels((prev) => {
      const updated = { ...prev, [targetProv]: newModel };
      try {
        localStorage.setItem("devnix_ai_models", JSON.stringify(updated));
        localStorage.setItem(`devnix_ai_model_${targetProv}`, newModel);
        localStorage.setItem("devnix_ai_model", newModel);
      } catch {}
      return updated;
    });
  };

  // Handle API Key input change (saved per provider)
  const handleApiKeyChange = (newVal: string) => {
    setApiKey(newVal);
    setApiKeys((prev) => {
      const updated = { ...prev, [selectedProvider]: newVal };
      try {
        localStorage.setItem("devnix_ai_keys", JSON.stringify(updated));
        localStorage.setItem(`devnix_ai_key_${selectedProvider}`, newVal);
      } catch {}
      return updated;
    });
  };

  // Save API Key strictly to localStorage without triggering network requests
  const handleSaveApiKey = () => {
    const trimmedKey = apiKey.trim();
    setApiKeys((prev) => {
      const updated = { ...prev, [selectedProvider]: trimmedKey };
      try {
        localStorage.setItem("devnix_ai_keys", JSON.stringify(updated));
        localStorage.setItem(`devnix_ai_key_${selectedProvider}`, trimmedKey);
      } catch {}
      return updated;
    });
    if (customBaseUrl) {
      try {
        localStorage.setItem("devnix_ai_base_url", customBaseUrl);
      } catch {}
    }
    setIsKeySaved(true);
    setTimeout(() => setIsKeySaved(false), 1500);
  };

  // Provider change handler
  const handleProviderChange = (provKey: string) => {
    setSelectedProvider(provKey);
    const prov = AI_PROVIDERS[provKey] || AI_PROVIDERS.gemini;

    // Retrieve the stored API key specifically for this selected provider
    const provApiKey = apiKeys[provKey] || localStorage.getItem(`devnix_ai_key_${provKey}`) || "";
    setApiKey(provApiKey);

    // Retrieve the stored model specifically for this selected provider
    const provModel =
      providerModels[provKey] ||
      localStorage.getItem(`devnix_ai_model_${provKey}`) ||
      prov.defaultModel;
    setSelectedModel(provModel);

    const targetBaseUrl = prov?.baseUrl && provKey !== "custom" ? prov.baseUrl : customBaseUrl;
    if (prov && provKey !== "custom") {
      setCustomBaseUrl(prov.baseUrl);
    }
    // Fetch live models from the actual endpoint
    fetchEndpointModels(provKey, provApiKey || undefined, targetBaseUrl || undefined, provModel);
  };

  const handleClearHistory = () => {
    setMessages([
      {
        id: `welcome_${Date.now()}`,
        role: "assistant",
        content: `👋 Chat cleared. Ready for your **${context.languageName || "code"}** questions!`,
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      },
    ]);
    localStorage.removeItem("devnix_ai_history");
  };

  const handleCopyText = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleApply = (codeToApply: string, id: string) => {
    onApplyCode(codeToApply);
    setAppliedId(id);
    setTimeout(() => setAppliedId(null), 2500);
  };

  const handleSendMessage = async (customPrompt?: string) => {
    const textToSend = (customPrompt || input).trim();
    if (!textToSend || isGenerating) return;

    const userMessage: ChatMessage = {
      id: `user_${Date.now()}`,
      role: "user",
      content: textToSend,
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };

    const assistantMsgId = `asst_${Date.now()}`;
    const initialAssistantMessage: ChatMessage = {
      id: assistantMsgId,
      role: "assistant",
      content: "",
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };

    const updatedMessages = [...messages, userMessage];
    setMessages([...updatedMessages, initialAssistantMessage]);
    setInput("");
    setIsGenerating(true);

    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      const res = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: updatedMessages.map((m) => ({ role: m.role, content: m.content })),
          context,
          provider: selectedProvider,
          model: selectedModel,
          apiKey: apiKey || undefined,
          baseUrl: customBaseUrl || undefined,
        }),
        signal: controller.signal,
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === assistantMsgId
              ? {
                  ...msg,
                  content: `❌ **Error:** ${errorData.error || "Failed to generate AI response."}\n\n*Click the gear icon ⚙️ at top right to enter or verify your API Key.*`,
                }
              : msg
          )
        );
        setIsGenerating(false);
        return;
      }

      if (!res.body) {
        throw new Error("No response body received");
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let accumulatedText = "";

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
          if (dataStr === "[DONE]") continue;

          try {
            const parsed = JSON.parse(dataStr);
            if (parsed.text) {
              accumulatedText += parsed.text;
              setMessages((prev) =>
                prev.map((msg) =>
                  msg.id === assistantMsgId ? { ...msg, content: accumulatedText } : msg
                )
              );
            }
          } catch {}
        }
      }
    } catch (err: any) {
      if (err.name !== "AbortError") {
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === assistantMsgId
              ? {
                  ...msg,
                  content: `⚠️ **Connection Error:** ${err.message || "Failed to reach AI service."}`,
                }
              : msg
          )
        );
      }
    } finally {
      setIsGenerating(false);
      abortControllerRef.current = null;
    }
  };

  const handleStop = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      setIsGenerating(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  // Quick Action Handler
  const handleQuickAction = (actionType: "explain" | "debug" | "optimize" | "visual" | "docs") => {
    let prompt = "";
    switch (actionType) {
      case "explain":
        prompt = `Explain how my current ${context.languageName || "code"} works step-by-step. What is the logic and time/space complexity?`;
        break;
      case "debug":
        if (context.compileOutput || context.stderr) {
          prompt = `I got this error during execution:\n\`\`\`\n${context.compileOutput || context.stderr}\n\`\`\`\nWhat caused this error and how do I fix it? Provide the complete corrected code.`;
        } else {
          prompt = `Analyze my ${context.languageName || "code"} for any potential bugs, edge cases, off-by-one errors, or runtime pitfalls.`;
        }
        break;
      case "optimize":
        prompt = `How can I optimize this ${context.languageName || "code"} for maximum speed and minimal memory footprint? Provide an optimized alternative.`;
        break;
      case "visual":
        if (context.code && context.code.trim()) {
          prompt = `Please generate an interactive step-by-step visual trace of my current ${context.languageName || "code"} execution using the \`\`\`trace block format. Make sure step line numbers match my exact editor lines. If there are long loops (e.g. 50+ iterations), condense them into 5 to 8 key representative steps (initial state, first iterations, key condition branches, final step) rather than repeating hundreds of steps. Use my input/variables to explain each step clearly.`;
        } else {
          prompt = `My code editor is currently empty. Please provide a classic algorithm solution (such as Two Sum, Binary Search, or Valid Palindrome) in ${context.languageName || "Python"}, explain it, and generate a complete interactive step-by-step visual trace using the \`\`\`trace format with line numbers matching the code so I can step through and play it.`;
        }
        break;
      case "docs":
        prompt = `Add clean comments, docstrings, and type annotations to my ${context.languageName || "code"}.`;
        break;
    }
    handleSendMessage(prompt);
  };

  // Inline Markdown parser (Bold, Italic, Inline Code, Links)
  const renderInlineMarkdown = (text: string): React.ReactNode => {
    // Regex for inline code, bold, italic, and links
    const tokens = text.split(/(`[^`]+`|\*\*[^*]+\*\*|\*[^*]+\*|\[[^\]]+\]\([^)]+\))/g);

    return tokens.map((token, i) => {
      if (!token) return null;

      // Inline code
      if (token.startsWith("`") && token.endsWith("`") && token.length > 2) {
        return (
          <code
            key={i}
            className="bg-neutral-200 text-neutral-900 border border-neutral-400 px-1 py-0.2 rounded font-mono text-[11px] font-bold mx-0.5"
          >
            {token.slice(1, -1)}
          </code>
        );
      }

      // Bold
      if (token.startsWith("**") && token.endsWith("**") && token.length > 4) {
        return (
          <strong key={i} className="font-black text-black">
            {token.slice(2, -2)}
          </strong>
        );
      }

      // Italic
      if (token.startsWith("*") && token.endsWith("*") && token.length > 2) {
        return (
          <em key={i} className="italic text-neutral-800">
            {token.slice(1, -1)}
          </em>
        );
      }

      // Markdown Link
      const linkMatch = token.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
      if (linkMatch) {
        return (
          <a
            key={i}
            href={linkMatch[2]}
            target="_blank"
            rel="noreferrer"
            className="text-blue-600 underline font-bold hover:text-blue-800"
          >
            {linkMatch[1]}
          </a>
        );
      }

      return <span key={i}>{token}</span>;
    });
  };

  // Block Markdown Parser (Headings, Lists, Blockquotes, Tables, Paragraphs)
  const renderMarkdownBlock = (blockText: string, blockKey: string): React.ReactNode => {
    const lines = blockText.split("\n");
    const elements: React.ReactNode[] = [];
    let inList = false;
    let listType: "ul" | "ol" = "ul";
    let listItems: string[] = [];
    let inTable = false;
    let tableRows: string[][] = [];

    const flushList = () => {
      if (inList && listItems.length > 0) {
        if (listType === "ul") {
          elements.push(
            <ul key={`list_${elements.length}`} className="my-2 space-y-1 pl-3 text-xs">
              {listItems.map((item, idx) => (
                <li key={idx} className="flex items-start gap-1.5 leading-snug">
                  <span className="w-1.5 h-1.5 rounded-full bg-black mt-1.5 flex-shrink-0" />
                  <div>{renderInlineMarkdown(item)}</div>
                </li>
              ))}
            </ul>
          );
        } else {
          elements.push(
            <ol key={`list_${elements.length}`} className="my-2 space-y-1 pl-1 text-xs">
              {listItems.map((item, idx) => (
                <li key={idx} className="flex items-start gap-1.5 leading-snug">
                  <span className="w-4 h-4 rounded bg-[#ffe600] text-black border border-black text-[9px] font-mono font-black flex items-center justify-center flex-shrink-0 mt-0.5">
                    {idx + 1}
                  </span>
                  <div>{renderInlineMarkdown(item)}</div>
                </li>
              ))}
            </ol>
          );
        }
        listItems = [];
        inList = false;
      }
    };

    const flushTable = () => {
      if (inTable && tableRows.length > 0) {
        const headerRow = tableRows[0];
        const dataRows = tableRows.slice(1);
        elements.push(
          <div key={`table_${elements.length}`} className="my-2.5 overflow-x-auto rounded border-2 border-black">
            <table className="w-full text-left text-xs font-mono border-collapse bg-white">
              <thead className="bg-[#ffe600] border-b-2 border-black text-black">
                <tr>
                  {headerRow.map((cell, cIdx) => (
                    <th key={cIdx} className="p-1.5 px-2 border-r border-black font-black last:border-r-0">
                      {renderInlineMarkdown(cell)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {dataRows.map((row, rIdx) => (
                  <tr key={rIdx} className={rIdx % 2 === 1 ? "bg-neutral-50" : "bg-white"}>
                    {row.map((cell, cIdx) => (
                      <td key={cIdx} className="p-1.5 px-2 border-r border-b border-black/30 last:border-r-0">
                        {renderInlineMarkdown(cell)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
        tableRows = [];
        inTable = false;
      }
    };

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmed = line.trim();

      if (!trimmed) {
        flushList();
        flushTable();
        continue;
      }

      // Markdown Table (| ... |)
      if (trimmed.startsWith("|") && trimmed.endsWith("|")) {
        // Skip table separator line (| --- | --- |)
        if (/^\|[-:\s|]+\|$/.test(trimmed)) {
          continue;
        }
        flushList();
        inTable = true;
        const cells = trimmed
          .slice(1, -1)
          .split("|")
          .map((c) => c.trim());
        tableRows.push(cells);
        continue;
      } else {
        flushTable();
      }

      // Unordered list (- or * )
      if (/^[-*]\s+/.test(trimmed)) {
        if (!inList || listType !== "ul") {
          flushList();
          inList = true;
          listType = "ul";
        }
        listItems.push(trimmed.replace(/^[-*]\s+/, ""));
        continue;
      }

      // Ordered list (1. 2. 3.)
      if (/^\d+\.\s+/.test(trimmed)) {
        if (!inList || listType !== "ol") {
          flushList();
          inList = true;
          listType = "ol";
        }
        listItems.push(trimmed.replace(/^\d+\.\s+/, ""));
        continue;
      }

      flushList();

      // Heading 1 (# ...)
      if (trimmed.startsWith("# ")) {
        elements.push(
          <h1 key={`h1_${i}`} className="font-black text-sm uppercase tracking-wide my-2 border-b-2 border-black pb-1">
            {renderInlineMarkdown(trimmed.slice(2))}
          </h1>
        );
        continue;
      }

      // Heading 2 (## ...)
      if (trimmed.startsWith("## ")) {
        elements.push(
          <h2 key={`h2_${i}`} className="font-black text-xs uppercase tracking-wide mt-3 mb-1 text-[#008da6]">
            {renderInlineMarkdown(trimmed.slice(3))}
          </h2>
        );
        continue;
      }

      // Heading 3 (### ...)
      if (trimmed.startsWith("### ")) {
        elements.push(
          <h3 key={`h3_${i}`} className="font-black text-xs uppercase mt-2.5 mb-1 text-neutral-900">
            {renderInlineMarkdown(trimmed.slice(4))}
          </h3>
        );
        continue;
      }

      // Blockquote (> ...)
      if (trimmed.startsWith("> ")) {
        elements.push(
          <blockquote
            key={`quote_${i}`}
            className="my-2 border-l-4 border-[#00f0ff] bg-cyan-50 text-neutral-800 p-2 rounded-r text-xs italic font-medium"
          >
            {renderInlineMarkdown(trimmed.slice(2))}
          </blockquote>
        );
        continue;
      }

      // Horizontal rule (--- or ***)
      if (trimmed === "---" || trimmed === "***") {
        elements.push(<hr key={`hr_${i}`} className="border-t-2 border-black/20 my-2.5" />);
        continue;
      }

      // Normal paragraph line
      elements.push(
        <p key={`p_${i}`} className="leading-relaxed text-xs my-1 text-neutral-900">
          {renderInlineMarkdown(line)}
        </p>
      );
    }

    flushList();
    flushTable();

    return <div key={blockKey} className="space-y-1">{elements}</div>;
  };

  // Helper to validate and parse TraceData JSON
  const tryParseTrace = (text: string): TraceData | null => {
    try {
      const trimmed = text.trim();
      if (!trimmed.includes('"steps"') && !trimmed.includes("'steps'")) return null;
      const parsed = JSON.parse(trimmed);
      if (
        parsed &&
        typeof parsed === "object" &&
        Array.isArray(parsed.steps) &&
        parsed.steps.length > 0 &&
        typeof parsed.steps[0].step !== "undefined"
      ) {
        return parsed;
      }
    } catch {}
    return null;
  };

  // Code Block Extractor & Rich Formatter
  const renderMessageContent = (content: string, msgId: string) => {
    // 1. Direct check: If entire message is a raw JSON trace
    const directTrace = tryParseTrace(content);
    if (directTrace) {
      return (
        <VisualTracePlayer
          key={msgId}
          trace={directTrace}
          onHighlightLine={onHighlightLine}
          onApplyCode={(code) => handleApply(code, `${msgId}_direct`)}
        />
      );
    }

    const parts: React.ReactNode[] = [];
    const codeBlockRegex = /```([a-zA-Z0-9_-]*)\n([\s\S]*?)```/g;
    let lastIndex = 0;
    let match;
    let codeIndex = 0;

    while ((match = codeBlockRegex.exec(content)) !== null) {
      // Markdown Text before code block
      if (match.index > lastIndex) {
        const textBlock = content.substring(lastIndex, match.index);
        const textTrace = tryParseTrace(textBlock);
        if (textTrace) {
          parts.push(
            <VisualTracePlayer
              key={`${msgId}_raw_${lastIndex}`}
              trace={textTrace}
              onHighlightLine={onHighlightLine}
              onApplyCode={(code) => handleApply(code, `${msgId}_raw_${lastIndex}`)}
            />
          );
        } else {
          parts.push(renderMarkdownBlock(textBlock, `${msgId}_text_${lastIndex}`));
        }
      }

      const lang = (match[1] || "").toLowerCase().trim();
      const code = match[2].trim();
      const currentCodeIndex = codeIndex++;
      const blockId = `${msgId}_code_${currentCodeIndex}`;

      // Check if this is an interactive execution trace block (whether labeled ```trace, ```json, or raw JSON)
      const traceObj = tryParseTrace(code);
      if (traceObj) {
        parts.push(
          <VisualTracePlayer
            key={blockId}
            trace={traceObj}
            onHighlightLine={onHighlightLine}
            onApplyCode={(code) => handleApply(code, blockId)}
          />
        );
        lastIndex = match.index + match[0].length;
        continue;
      }

      const displayLang = lang || context.languageName?.toLowerCase() || "code";

      parts.push(
        <div
          key={`code_${match.index}`}
          className="my-3 rounded border-2 border-black bg-[#121212] overflow-hidden shadow-[2px_2px_0px_#000]"
        >
          <div className="flex items-center justify-between px-3 py-1.5 bg-[#1e1e1e] border-b border-neutral-800 text-xs">
            <span className="font-mono text-[11px] font-bold text-cyan-400 uppercase tracking-wider">
              {displayLang}
            </span>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => handleCopyText(code, blockId)}
                className="neo-btn bg-white hover:bg-neutral-100 text-black px-2 py-0.5 text-[10px] font-bold flex items-center gap-1 rounded border border-neutral-700 cursor-pointer"
              >
                {copiedId === blockId ? (
                  <Check className="w-3 h-3 text-green-600 stroke-[3]" />
                ) : (
                  <Copy className="w-3 h-3" />
                )}
                <span>{copiedId === blockId ? "Copied" : "Copy"}</span>
              </button>

              <button
                type="button"
                onClick={() => handleApply(code, blockId)}
                title="Apply code directly to Monaco Editor"
                className="neo-btn bg-[#ffe600] text-black hover:bg-yellow-400 px-2 py-0.5 text-[10px] font-black flex items-center gap-1 rounded border border-black shadow-[1px_1px_0px_#000] cursor-pointer"
              >
                {appliedId === blockId ? (
                  <Check className="w-3 h-3 stroke-[3]" />
                ) : (
                  <ArrowDownToLine className="w-3 h-3 stroke-[2.5]" />
                )}
                <span>{appliedId === blockId ? "Applied!" : "Apply to Editor"}</span>
              </button>
            </div>
          </div>
          <pre className="p-3 text-xs font-mono text-neutral-100 overflow-x-auto selection:bg-cyan-500 selection:text-black">
            <code>{code}</code>
          </pre>
        </div>
      );

      lastIndex = match.index + match[0].length;
    }

    // Remaining Markdown text after last code block
    if (lastIndex < content.length) {
      const textBlock = content.substring(lastIndex);
      parts.push(renderMarkdownBlock(textBlock, `${msgId}_text_${lastIndex}`));
    }

    return parts.length > 0 ? parts : <div className="text-xs">{content}</div>;
  };

  if (!isOpen) return null;

  const currentProvider = AI_PROVIDERS[selectedProvider] || AI_PROVIDERS.gemini;
  const lineCount = context.code ? context.code.split("\n").length : 0;
  const hasErrors = Boolean(context.compileOutput || context.stderr);

  return (
    <aside
      aria-label="Devnix AI Companion Panel"
      style={embedded ? undefined : { width: `${panelWidth}px`, maxWidth: "90vw" }}
      className={`${
        embedded
          ? "w-full h-full flex flex-col bg-[#fbfbfa] neo-box border-[2.5px] border-black shadow-[3.5px_3.5px_0px_0px_#000] overflow-hidden select-text relative min-w-0"
          : `fixed inset-y-0 right-0 z-50 bg-[#fbfbfa] text-black border-l-4 border-black shadow-[-8px_0px_0px_rgba(0,0,0,0.15)] flex flex-col select-text ${
              isDragging ? "transition-none select-none" : "transition-all duration-150"
            }`
      }`}
    >
      {/* 🌟 Left Border Resizer Drag Handle (Only in overlay mode) */}
      {!embedded && (
        <div
          onMouseDown={handleResizeMouseDown}
          title="Drag to resize AI Companion (Min: 380px, Max: 850px)"
          className={`absolute top-0 bottom-0 -left-3 w-6 cursor-col-resize z-50 flex items-center justify-center group select-none transition-colors ${
            isDragging ? "bg-[#ffe600]/30" : "hover:bg-[#ffe600]/20"
          }`}
        >
          <div
            className={`w-3.5 h-12 rounded-full border-2 border-black shadow-[1.5px_1.5px_0px_#000] flex items-center justify-center transition-colors ${
              isDragging ? "bg-[#ffe600]" : "bg-white group-hover:bg-[#ffe600]"
            }`}
          >
            <GripVertical className="w-2.5 h-2.5 text-black stroke-[3]" />
          </div>
        </div>
      )}

      {/* 1. Header */}
      <div className="flex items-center justify-between px-3 py-2.5 bg-[#f0ede6] border-b-[2.5px] border-black text-black select-none shrink-0 min-w-0">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-7 h-7 rounded bg-[#ffe600] text-black flex items-center justify-center border-2 border-black shadow-[1.5px_1.5px_0px_#000] shrink-0">
            <Sparkles className="w-3.5 h-3.5 fill-black text-black" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 min-w-0">
              <h2 className="font-black text-xs sm:text-sm tracking-wide text-black truncate">DEVNIX AI COMPANION</h2>
              <span className="bg-[#ffe600] text-black border border-black text-[9px] font-black px-1.5 py-0.2 rounded shadow-[1px_1px_0px_#000] shrink-0">
                PRO
              </span>
            </div>
            <p className="text-[10px] font-bold text-neutral-600 truncate">Context-Aware Code & Debug Engine</p>
          </div>
        </div>

        <div className="flex items-center gap-1 shrink-0 ml-1">
          <button
            onClick={() => setShowSettings(!showSettings)}
            title="Configure AI Provider & API Key"
            className={`p-1.5 rounded border-2 border-black shadow-[1.5px_1.5px_0px_#000] cursor-pointer transition-colors ${
              showSettings ? "bg-black text-[#ffe600]" : "bg-white hover:bg-neutral-100 text-black font-black"
            }`}
          >
            <Settings2 className="w-3.5 h-3.5 stroke-[2.5]" />
          </button>

          <button
            onClick={handleClearHistory}
            title="Clear Chat History"
            className="p-1.5 rounded bg-white hover:bg-red-100 text-black border-2 border-black shadow-[1.5px_1.5px_0px_#000] cursor-pointer"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>

          <button
            onClick={onClose}
            title="Close Assistant"
            className="p-1.5 rounded bg-white hover:bg-red-400 text-black border-2 border-black shadow-[1.5px_1.5px_0px_#000] cursor-pointer"
          >
            <X className="w-3.5 h-3.5 stroke-[3]" />
          </button>
        </div>
      </div>

      {/* 2. Provider / Settings Drawer */}
      {showSettings && (
        <div className="p-4 bg-yellow-100 border-b-3 border-black text-xs space-y-3 animate-in slide-in-from-top duration-150">
          <div className="flex items-center justify-between font-black text-sm border-b-2 border-black pb-1">
            <span className="flex items-center gap-1.5 text-black">
              <KeyRound className="w-4 h-4" /> AI Provider Configuration
            </span>
            <span className="text-[10px] bg-[#ffe600] text-black border border-black font-black px-1.5 py-0.2 rounded shadow-[1px_1px_0px_#000]">
              Multi-Engine
            </span>
          </div>

          <div className="space-y-2">
            <div className="grid grid-cols-2 gap-2">
              {/* 🌟 Custom Neobrutalist Provider Selector */}
              <div className="relative" ref={providerDropdownRef}>
                <label className="block text-[10px] font-black uppercase mb-1">AI Provider</label>
                <button
                  type="button"
                  onClick={() => {
                    setIsProviderDropdownOpen(!isProviderDropdownOpen);
                    setIsModelDropdownOpen(false);
                  }}
                  className="w-full bg-white hover:bg-neutral-50 border-2 border-black p-1.5 px-2 font-bold rounded shadow-[2px_2px_0px_#000] flex items-center justify-between gap-1 text-xs cursor-pointer text-left"
                >
                  <div className="flex items-center gap-1.5 truncate">
                    <span
                      className="w-2 h-2 rounded-full border border-black flex-shrink-0"
                      style={{ backgroundColor: currentProvider.color }}
                    />
                    <span className="truncate font-black">{currentProvider.name}</span>
                  </div>
                  <ChevronDown
                    className={`w-3 h-3 stroke-[3] flex-shrink-0 transition-transform ${
                      isProviderDropdownOpen ? "rotate-180" : ""
                    }`}
                  />
                </button>

                {isProviderDropdownOpen && (
                  <div className="absolute top-full left-0 mt-1 w-56 bg-white border-2 border-black rounded-lg shadow-[4px_4px_0px_#000] z-50 p-1 max-h-60 overflow-y-auto animate-in fade-in slide-in-from-top-1 duration-150">
                    <div className="text-[9px] font-black uppercase text-neutral-400 px-2 py-0.5 border-b border-neutral-200 mb-1">
                      Choose Engine
                    </div>
                    {Object.values(AI_PROVIDERS).map((p) => {
                      const isSelected = p.id === selectedProvider;
                      return (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => {
                            handleProviderChange(p.id);
                            setIsProviderDropdownOpen(false);
                          }}
                          className={`w-full flex items-center justify-between px-2 py-1.5 rounded text-xs transition-all text-left mb-0.5 cursor-pointer ${
                            isSelected
                              ? "bg-[#00f0ff] text-black font-black border border-black shadow-[1px_1px_0px_#000]"
                              : "hover:bg-[#ffe600] hover:text-black text-neutral-800 font-bold"
                          }`}
                        >
                          <div className="flex items-center gap-1.5 truncate">
                            <span
                              className="w-2 h-2 rounded-full border border-black flex-shrink-0"
                              style={{ backgroundColor: p.color }}
                            />
                            <span className="truncate">{p.name}</span>
                          </div>
                          {isSelected && <Check className="w-3 h-3 stroke-[3] flex-shrink-0" />}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* 🌟 Custom Neobrutalist Model Selector with Live Search */}
              <div className="relative" ref={modelDropdownRef}>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-[10px] font-black uppercase">
                    Model {availableModels.length > 0 && `(${availableModels.length})`}
                  </label>
                  <button
                    type="button"
                    onClick={() =>
                      fetchEndpointModels(
                        selectedProvider,
                        apiKey || undefined,
                        customBaseUrl || undefined
                      )
                    }
                    disabled={isLoadingModels}
                    title="Refresh live models from provider endpoint"
                    className="text-[10px] font-bold text-neutral-800 hover:text-black underline flex items-center gap-0.5 cursor-pointer disabled:opacity-50"
                  >
                    <span>{isLoadingModels ? "Fetching..." : "Refresh 🔄"}</span>
                  </button>
                </div>

                {isLoadingModels ? (
                  <div className="w-full bg-white border-2 border-black p-1.5 font-mono text-[11px] font-bold text-neutral-500 rounded shadow-[2px_2px_0px_#000] flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-[#00f0ff] animate-ping" />
                    <span>Querying endpoint...</span>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      const nextState = !isModelDropdownOpen;
                      setIsModelDropdownOpen(nextState);
                      setIsProviderDropdownOpen(false);
                      if (nextState) {
                        setTimeout(() => modelSearchInputRef.current?.focus(), 50);
                      } else {
                        setModelSearch("");
                      }
                    }}
                    className="w-full bg-white hover:bg-neutral-50 border-2 border-black p-1.5 px-2 font-mono text-xs font-bold rounded shadow-[2px_2px_0px_#000] flex items-center justify-between gap-1 cursor-pointer text-left"
                  >
                    <span className="truncate max-w-[140px]">{selectedModel || "Select Model"}</span>
                    <ChevronDown
                      className={`w-3 h-3 stroke-[3] flex-shrink-0 transition-transform ${
                        isModelDropdownOpen ? "rotate-180" : ""
                      }`}
                    />
                  </button>
                )}

                {isModelDropdownOpen && (
                  <div className="absolute top-full right-0 mt-1 w-64 bg-white border-2 border-black rounded-lg shadow-[4px_4px_0px_#000] z-50 p-1.5 max-h-72 overflow-y-auto animate-in fade-in slide-in-from-top-1 duration-150">
                    {/* Search Bar Header */}
                    <div className="relative flex items-center mb-1.5">
                      <Search className="w-3 h-3 absolute left-2 text-neutral-500 pointer-events-none stroke-[2.5]" />
                      <input
                        ref={modelSearchInputRef}
                        type="text"
                        value={modelSearch}
                        onChange={(e) => setModelSearch(e.target.value)}
                        placeholder="Filter models..."
                        className="w-full bg-[#f6f3eb] text-black font-mono text-[11px] font-bold pl-7 pr-6 py-1 rounded border border-black outline-none placeholder:text-neutral-400 focus:bg-white"
                      />
                      {modelSearch && (
                        <button
                          type="button"
                          onClick={() => {
                            setModelSearch("");
                            modelSearchInputRef.current?.focus();
                          }}
                          className="absolute right-1.5 text-neutral-500 hover:text-black p-0.5 cursor-pointer"
                        >
                          <X className="w-3 h-3 stroke-[2.5]" />
                        </button>
                      )}
                    </div>

                    <div className="text-[9px] font-black uppercase text-neutral-400 px-1 py-0.5 border-b border-neutral-200 mb-1 flex items-center justify-between">
                      <span>Available Models</span>
                      <span className="font-mono text-neutral-600">{availableModels.length} models</span>
                    </div>

                    {/* Filtered Models List */}
                    <div className="space-y-0.5 max-h-48 overflow-y-auto">
                      {availableModels
                        .filter((m) => {
                          if (!modelSearch.trim()) return true;
                          const q = modelSearch.toLowerCase();
                          return m.id.toLowerCase().includes(q) || m.name.toLowerCase().includes(q);
                        })
                        .map((m) => {
                          const isSelected = m.id === selectedModel;
                          return (
                            <button
                              key={m.id}
                              type="button"
                              onClick={() => {
                                handleModelChange(m.id);
                                setModelSearch("");
                                setIsModelDropdownOpen(false);
                              }}
                              className={`w-full flex items-center justify-between px-2 py-1 rounded font-mono text-[11px] transition-all text-left cursor-pointer ${
                                isSelected
                                  ? "bg-[#00f0ff] text-black font-black border border-black shadow-[1px_1px_0px_#000]"
                                  : "hover:bg-[#ffe600] hover:text-black text-neutral-800 font-bold"
                              }`}
                            >
                              <span className="truncate pr-1">{m.name || m.id}</span>
                              {isSelected && <Check className="w-3 h-3 stroke-[3] flex-shrink-0" />}
                            </button>
                          );
                        })}

                      {availableModels.length === 0 && (
                        <div className="p-2 text-center text-[10px] text-neutral-500 font-mono">
                          No models found. Enter an API key and click Fetch.
                        </div>
                      )}
                    </div>

                    {/* Custom Input Direct Entry */}
                    <div className="mt-1.5 pt-1.5 border-t border-neutral-200">
                      <div className="text-[9px] font-black uppercase text-neutral-500 mb-1">
                        Or Type Custom Model
                      </div>
                      <input
                        type="text"
                        value={selectedModel}
                        onChange={(e) => handleModelChange(e.target.value)}
                        placeholder="Custom model ID..."
                        className="w-full bg-white text-black font-mono text-[11px] font-bold p-1 rounded border border-black outline-none focus:bg-yellow-50"
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>

            {modelFetchError && (
              <div className="p-1.5 bg-yellow-200 border border-black/40 rounded text-[10px] font-bold text-neutral-800 flex items-start gap-1">
                <span className="text-yellow-700 font-black">ℹ️</span>
                <span>{modelFetchError}</span>
              </div>
            )}
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-[10px] font-black uppercase">
                {currentProvider.name} API Key
              </label>
              {selectedProvider === "gemini" && (
                <a
                  href="https://aistudio.google.com/app/apikey"
                  target="_blank"
                  rel="noreferrer"
                  className="text-[10px] font-bold text-blue-700 underline flex items-center gap-0.5"
                >
                  Get Free Key <ExternalLink className="w-2.5 h-2.5" />
                </a>
              )}
              {selectedProvider === "groq" && (
                <a
                  href="https://console.groq.com/keys"
                  target="_blank"
                  rel="noreferrer"
                  className="text-[10px] font-bold text-orange-700 underline flex items-center gap-0.5"
                >
                  Get Free Key <ExternalLink className="w-2.5 h-2.5" />
                </a>
              )}
            </div>
            <div className="flex items-center gap-1.5">
              <input
                type="password"
                value={apiKey}
                onChange={(e) => handleApiKeyChange(e.target.value)}
                placeholder={`Enter ${currentProvider.envKeyName} (or leave empty if set in server env)`}
                className="w-full bg-white border-2 border-black p-2 font-mono text-xs rounded shadow-[2px_2px_0px_#000] outline-none"
              />
              <button
                type="button"
                onClick={handleSaveApiKey}
                disabled={isLoadingModels}
                title="Save API Key to browser storage"
                className={`neo-btn px-3 py-2 text-[10px] font-black rounded border-2 border-black shadow-[1.5px_1.5px_0px_#000] cursor-pointer flex-shrink-0 transition-colors flex items-center gap-1 ${
                  isKeySaved
                    ? "bg-[#22c55e] text-black"
                    : "bg-[#ffe600] hover:bg-[#ffd700] text-black"
                } disabled:opacity-50`}
              >
                {isKeySaved ? (
                  <>
                    <Check className="w-3 h-3 stroke-[3]" />
                    <span>Saved!</span>
                  </>
                ) : (
                  <span>Save</span>
                )}
              </button>
            </div>
          </div>

          {selectedProvider === "custom" && (
            <div>
              <label className="block text-[10px] font-black uppercase mb-1">Custom Base URL</label>
              <input
                type="text"
                value={customBaseUrl}
                onChange={(e) => setCustomBaseUrl(e.target.value)}
                placeholder="https://api.your-provider.com/v1"
                className="w-full bg-white border-2 border-black p-1.5 font-mono text-xs rounded shadow-[2px_2px_0px_#000] outline-none"
              />
            </div>
          )}

          <p className="text-[10px] text-neutral-700 leading-tight font-medium">
            💡 API keys are saved locally in your browser and sent securely only during chat completions.
          </p>
        </div>
      )}

      {/* 3. Live Context Ribbon */}
      <div className="px-3 py-1.5 bg-white border-b-2 border-black flex items-center justify-between text-xs select-none shrink-0 min-w-0">
        <div className="flex items-center gap-1.5 overflow-hidden min-w-0 mr-2">
          <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse flex-shrink-0" />
          <div className="truncate font-mono text-[11px]">
            <span className="font-black text-black">
              {context.languageName || "No Language"}
            </span>
            <span className="text-neutral-500 mx-1">•</span>
            <span className="text-neutral-600 font-bold">{lineCount} lines</span>
            {hasErrors && (
              <>
                <span className="text-neutral-500 mx-1">•</span>
                <span className="bg-[#ff5277] text-black border border-black text-[9px] font-black px-1.5 py-0.2 rounded shadow-[1px_1px_0px_#000]">
                  ERROR
                </span>
              </>
            )}
          </div>
        </div>

        <button
          onClick={() => setShowContextPreview(!showContextPreview)}
          className="text-[10px] font-bold text-neutral-600 hover:text-black flex items-center gap-0.5 underline cursor-pointer flex-shrink-0"
        >
          <span>Context</span>
          <ChevronDown
            className={`w-3 h-3 transition-transform ${showContextPreview ? "rotate-180" : ""}`}
          />
        </button>
      </div>

      {/* Context Preview Drawer */}
      {showContextPreview && (
        <div className="p-3 bg-neutral-900 text-neutral-300 font-mono text-[10px] border-b-2 border-black max-h-40 overflow-y-auto space-y-2">
          <div>
            <span className="text-cyan-400 font-bold">Language:</span> {context.languageName}{" "}
            {context.languageVersion}
          </div>
          {context.code && (
            <div>
              <span className="text-yellow-400 font-bold">Current Code ({lineCount} lines):</span>
              <pre className="text-neutral-400 mt-1 whitespace-pre-wrap truncate max-h-16">
                {context.code}
              </pre>
            </div>
          )}
          {context.compileOutput && (
            <div>
              <span className="text-red-400 font-bold">Compile Output:</span>
              <pre className="text-red-300 mt-0.5 whitespace-pre-wrap">{context.compileOutput}</pre>
            </div>
          )}
          {context.stderr && (
            <div>
              <span className="text-red-400 font-bold">Stderr:</span>
              <pre className="text-red-300 mt-0.5 whitespace-pre-wrap">{context.stderr}</pre>
            </div>
          )}
        </div>
      )}

      {/* 4. Quick Prompt Action Buttons */}
      <div className="px-2.5 py-1.5 bg-neutral-100 border-b-2 border-black flex items-center gap-1.5 overflow-x-auto no-scrollbar shrink-0 min-w-0">
        <button
          onClick={() => handleQuickAction("explain")}
          disabled={isGenerating}
          className="neo-btn bg-white hover:bg-[#ffe600] text-black px-2 py-1 rounded text-[11px] font-black border-2 border-black shadow-[1.5px_1.5px_0px_#000] flex items-center gap-1 flex-shrink-0 cursor-pointer disabled:opacity-50"
        >
          <Zap className="w-3 h-3 fill-[#ffe600]" />
          <span>Explain</span>
        </button>

        <button
          onClick={() => handleQuickAction("debug")}
          disabled={isGenerating}
          className={`neo-btn px-2 py-1 rounded text-[11px] font-black border-2 border-black shadow-[1.5px_1.5px_0px_#000] flex items-center gap-1 flex-shrink-0 cursor-pointer disabled:opacity-50 ${
            hasErrors
              ? "bg-[#ff5277] text-black hover:bg-red-400 animate-pulse"
              : "bg-white hover:bg-red-50 text-black"
          }`}
        >
          <Bug className="w-3 h-3" />
          <span>{hasErrors ? "Fix Error!" : "Debug"}</span>
        </button>

        <button
          onClick={() => handleQuickAction("optimize")}
          disabled={isGenerating}
          className="neo-btn bg-white hover:bg-[#00f0ff] text-black px-2 py-1 rounded text-[11px] font-black border-2 border-black shadow-[1.5px_1.5px_0px_#000] flex items-center gap-1 flex-shrink-0 cursor-pointer disabled:opacity-50"
        >
          <LineChart className="w-3 h-3" />
          <span>Optimize</span>
        </button>

        <button
          onClick={() => handleQuickAction("visual")}
          disabled={isGenerating}
          className="neo-btn bg-white hover:bg-purple-100 text-black px-2 py-1 rounded text-[11px] font-black border-2 border-black shadow-[1.5px_1.5px_0px_#000] flex items-center gap-1 flex-shrink-0 cursor-pointer disabled:opacity-50"
        >
          <Code2 className="w-3 h-3 text-purple-600" />
          <span>Visual Trace</span>
        </button>
      </div>

      {/* 5. Messages Feed */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-[#f8f8f7]">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex gap-2.5 ${msg.role === "user" ? "justify-end" : "justify-start"}`}
          >
            {msg.role === "assistant" && (
              <div className="w-7 h-7 rounded bg-black text-[#00f0ff] flex items-center justify-center border-2 border-black flex-shrink-0 mt-0.5 shadow-[1.5px_1.5px_0px_#000]">
                <Bot className="w-4 h-4" />
              </div>
            )}

            <div
              className={`max-w-[88%] min-w-0 break-words rounded-lg p-2.5 sm:p-3 border-2 border-black shadow-[2px_2px_0px_#000] text-sm box-border ${
                msg.role === "user"
                  ? "bg-[#ffe600] text-black font-medium"
                  : "bg-white text-neutral-900"
              }`}
            >
              <div className="flex items-center justify-between gap-2 mb-1.5 pb-1 border-b border-black/10 text-[10px] font-bold text-neutral-600">
                <span>{msg.role === "user" ? "You" : `Devnix AI (${selectedModel})`}</span>
                <span className="font-mono">{msg.timestamp}</span>
              </div>

              {renderMessageContent(msg.content, msg.id)}
            </div>

            {msg.role === "user" && (
              <div className="w-7 h-7 rounded bg-[#ffe600] text-black flex items-center justify-center border-2 border-black flex-shrink-0 mt-0.5 shadow-[1.5px_1.5px_0px_#000]">
                <User className="w-4 h-4 stroke-[2.5]" />
              </div>
            )}
          </div>
        ))}

        {isGenerating && (
          <div className="flex gap-2.5 items-center text-xs font-bold text-neutral-600">
            <div className="w-7 h-7 rounded bg-black text-[#00f0ff] flex items-center justify-center border-2 border-black shadow-[1.5px_1.5px_0px_#000] animate-spin">
              <Sparkles className="w-3.5 h-3.5" />
            </div>
            <span className="animate-pulse">Thinking & analyzing code...</span>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* 6. Input Area */}
      <div className="p-2.5 bg-white border-t-[2.5px] border-black shrink-0 min-w-0">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSendMessage();
          }}
          className="relative"
        >
          <textarea
            ref={textareaRef}
            rows={2}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={`Ask Devnix AI about your ${
              context.languageName || "code"
            }... (Shift+Enter for newline)`}
            className="w-full bg-[#fbfbfa] text-black placeholder:text-neutral-400 border-2 border-black rounded p-2 pr-18 text-xs font-mono outline-none shadow-[1.5px_1.5px_0px_#000] resize-none focus:bg-white focus:shadow-[2px_2px_0px_#000] box-border"
          />

          <div className="absolute right-2 bottom-2.5 flex items-center gap-1">
            {isGenerating ? (
              <button
                type="button"
                onClick={handleStop}
                className="neo-btn bg-[#ff5277] text-black hover:bg-red-400 px-2 py-1 text-xs font-black rounded border-2 border-black shadow-[1.5px_1.5px_0px_#000] flex items-center gap-1 cursor-pointer"
              >
                <Square className="w-3 h-3 fill-black text-black" />
                <span>STOP</span>
              </button>
            ) : (
              <button
                type="submit"
                disabled={!input.trim()}
                className="neo-btn bg-[#00f0ff] text-black hover:bg-cyan-300 disabled:opacity-40 px-2.5 py-1 text-xs font-black rounded border-2 border-black shadow-[1.5px_1.5px_0px_#000] flex items-center gap-1 cursor-pointer"
              >
                <span>SEND</span>
                <Send className="w-3 h-3 stroke-[2.5]" />
              </button>
            )}
          </div>
        </form>

        <div className="flex items-center justify-between text-[10px] text-neutral-500 font-bold mt-1 px-0.5 min-w-0">
          <span className="truncate mr-2">Engine: {currentProvider.name}</span>
          <span className="shrink-0">Press Enter ↵ to send</span>
        </div>
      </div>
    </aside>
  );
};
