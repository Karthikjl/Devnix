"use client";

import React, { useState, useEffect, useRef } from "react";
import dynamic from "next/dynamic";
import {
  SUPPORTED_LANGUAGES,
  Language,
} from "@/lib/languages";
import {
  Play,
  Terminal,
  RotateCcw,
  Copy,
  Check,
  Trash2,
  Cpu,
  Clock,
  Code2,
  AlertCircle,
  FileCode2,
  Keyboard,
  ChevronDown,
  Palette,
  AlignLeft,
  Eye,
  EyeOff,
  Square,
  Send,
  Radio,
  Layers,
  Sparkles
} from "lucide-react";

// Dynamically import Monaco Editor to ensure SSR safety
const MonacoEditor = dynamic(() => import("@monaco-editor/react"), {
  ssr: false,
  loading: () => (
    <div className="flex-1 flex items-center justify-center bg-[#1e1e1e] text-[#ffe600] font-mono text-sm">
      <div className="flex items-center gap-2">
        <span className="w-3 h-3 rounded-full bg-[#ffe600] animate-ping" />
        <span>Loading VS Code Editor...</span>
      </div>
    </div>
  ),
});

interface ExecutionResult {
  stdout?: string | null;
  stderr?: string | null;
  compile_output?: string | null;
  message?: string | null;
  time?: string | null;
  memory?: number | null;
  status?: {
    id: number;
    description: string;
  };
}

interface EditorTheme {
  id: string;
  name: string;
}

const THEMES: EditorTheme[] = [
  { id: "vs-dark", name: "VS Code Dark+" },
  { id: "light", name: "VS Code Light+" },
  { id: "hc-black", name: "High Contrast Dark" },
  { id: "hc-light", name: "High Contrast Light" },
  { id: "devnix-cyberpunk", name: "⚡ Devnix Cyberpunk" },
  { id: "devnix-monokai", name: "🎨 Monokai Pro" },
  { id: "devnix-nord", name: "❄️ Nord Arctic" },
];

export default function DevnixStudio() {
  const [selectedLanguage, setSelectedLanguage] = useState<Language>(
    SUPPORTED_LANGUAGES[0]
  );
  const [code, setCode] = useState<string>(SUPPORTED_LANGUAGES[0].defaultCode);
  const [stdin, setStdin] = useState<string>("");
  const [executionMode, setExecutionMode] = useState<"interactive" | "batch">("interactive");
  const [activeTab, setActiveTab] = useState<"output" | "stdin" | "info">("output");
  const [fontSize, setFontSize] = useState<number>(14);
  const [currentTheme, setCurrentTheme] = useState<string>("vs-dark");
  const [showMinimap, setShowMinimap] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isProcessRunning, setIsProcessRunning] = useState<boolean>(false);
  const [result, setResult] = useState<ExecutionResult | null>(null);
  
  // Real-time terminal output stream & interactive input
  const [terminalLogs, setTerminalLogs] = useState<Array<{ type: "stdout" | "stderr" | "status" | "input" | "exit"; text: string }>>([]);
  const [realtimeInput, setRealtimeInput] = useState<string>("");
  const [currentSessionId, setCurrentSessionId] = useState<string>("");

  const [copiedCode, setCopiedCode] = useState<boolean>(false);
  const [copiedOutput, setCopiedOutput] = useState<boolean>(false);

  const editorRef = useRef<any>(null);
  const monacoRef = useRef<any>(null);
  const terminalEndRef = useRef<HTMLDivElement>(null);
  const realtimeInputRef = useRef<HTMLInputElement>(null);

  // Auto-scroll terminal to bottom when new logs arrive
  useEffect(() => {
    if (terminalEndRef.current) {
      terminalEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [terminalLogs]);

  // Setup Monaco themes and shortcuts on mount
  const handleEditorWillMount = (monaco: any) => {
    monacoRef.current = monaco;

    // Define Custom Cyberpunk Theme
    monaco.editor.defineTheme("devnix-cyberpunk", {
      base: "vs-dark",
      inherit: true,
      rules: [
        { token: "comment", foreground: "6272a4", fontStyle: "italic" },
        { token: "keyword", foreground: "ff5277", fontStyle: "bold" },
        { token: "identifier", foreground: "00f0ff" },
        { token: "string", foreground: "ffe600" },
        { token: "number", foreground: "4ade80" },
        { token: "type", foreground: "c084fc" },
      ],
      colors: {
        "editor.background": "#121216",
        "editor.foreground": "#f8f8f2",
        "editorCursor.foreground": "#ffe600",
        "editor.lineHighlightBackground": "#1e1e24",
        "editorLineNumber.foreground": "#505060",
        "editorLineNumber.activeForeground": "#00f0ff",
        "editor.selectionBackground": "#303050",
      },
    });

    // Define Monokai Pro Theme
    monaco.editor.defineTheme("devnix-monokai", {
      base: "vs-dark",
      inherit: true,
      rules: [
        { token: "comment", foreground: "75715e" },
        { token: "keyword", foreground: "f92672", fontStyle: "bold" },
        { token: "string", foreground: "e6db74" },
        { token: "number", foreground: "ae81ff" },
        { token: "type", foreground: "66d9ef" },
        { token: "function", foreground: "a6e22e" },
      ],
      colors: {
        "editor.background": "#272822",
        "editor.foreground": "#f8f8f2",
        "editorCursor.foreground": "#f8f8f0",
        "editor.lineHighlightBackground": "#3e3d32",
        "editorLineNumber.foreground": "#90908a",
      },
    });

    // Define Nord Theme
    monaco.editor.defineTheme("devnix-nord", {
      base: "vs-dark",
      inherit: true,
      rules: [
        { token: "comment", foreground: "616e88", fontStyle: "italic" },
        { token: "keyword", foreground: "81a1c1", fontStyle: "bold" },
        { token: "string", foreground: "a3be8c" },
        { token: "number", foreground: "b48ead" },
        { token: "type", foreground: "8fbcbb" },
        { token: "function", foreground: "88c0d0" },
      ],
      colors: {
        "editor.background": "#2e3440",
        "editor.foreground": "#d8dee9",
        "editorCursor.foreground": "#eceff4",
        "editor.lineHighlightBackground": "#3b4252",
        "editorLineNumber.foreground": "#4c566a",
      },
    });
  };

  const handleEditorDidMount = (editor: any, monaco: any) => {
    editorRef.current = editor;

    // Register Ctrl+Enter / Cmd+Enter shortcut
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter, () => {
      handleRun();
    });
  };

  // Update code boilerplate when language changes
  const handleLanguageChange = (langId: number) => {
    const lang = SUPPORTED_LANGUAGES.find((l) => l.id === langId);
    if (lang) {
      setSelectedLanguage(lang);
      setCode(lang.defaultCode);
      setResult(null);
      setTerminalLogs([]);
    }
  };

  // Reset current template
  const handleResetCode = () => {
    setCode(selectedLanguage.defaultCode);
  };

  // Format code in Monaco
  const handleFormatCode = () => {
    if (editorRef.current) {
      editorRef.current.getAction("editor.action.formatDocument")?.run();
    }
  };

  // Copy code to clipboard
  const handleCopyCode = () => {
    navigator.clipboard.writeText(code);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  // Copy output to clipboard
  const handleCopyOutput = () => {
    if (executionMode === "interactive") {
      const allText = terminalLogs.map((l) => l.text).join("");
      navigator.clipboard.writeText(allText);
    } else {
      const textToCopy =
        (result?.stdout || "") +
        (result?.stderr ? "\n" + result.stderr : "") +
        (result?.compile_output ? "\n" + result.compile_output : "");
      navigator.clipboard.writeText(textToCopy);
    }
    setCopiedOutput(true);
    setTimeout(() => setCopiedOutput(false), 2000);
  };

  // Primary Run Dispatcher
  const handleRun = () => {
    if (executionMode === "interactive") {
      runInteractiveStreaming();
    } else {
      runBatchCode();
    }
  };

  // 1. RUN IN REAL-TIME INTERACTIVE STREAMING MODE
  const runInteractiveStreaming = async () => {
    if (isProcessRunning) return;

    const sessionId = `sess_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    setCurrentSessionId(sessionId);
    setIsProcessRunning(true);
    setIsLoading(true);
    setActiveTab("output");
    setTerminalLogs([
      { type: "status", text: `⚡ Initializing ${selectedLanguage.label} in Real-Time Interactive Terminal...\n` },
    ]);

    const codeToRun = editorRef.current ? editorRef.current.getValue() : code;

    try {
      const response = await fetch("/api/execute/interactive", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId,
          language_id: selectedLanguage.id,
          source_code: codeToRun,
        }),
      });

      if (!response.ok || !response.body) {
        throw new Error(`HTTP Error ${response.status}`);
      }

      setIsLoading(false);

      const reader = response.body.getReader();
      const decoder = new TextDecoder("utf-8");
      let buffer = "";

      // Focus real-time input prompt
      setTimeout(() => {
        realtimeInputRef.current?.focus();
      }, 100);

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            try {
              const data = JSON.parse(line.substring(6));
              setTerminalLogs((prev) => [...prev, data]);
              if (data.type === "exit") {
                setIsProcessRunning(false);
              }
            } catch {}
          }
        }
      }
    } catch (err: any) {
      setTerminalLogs((prev) => [
        ...prev,
        { type: "stderr", text: `\nExecution Error: ${err.message}\n` },
      ]);
    } finally {
      setIsProcessRunning(false);
      setIsLoading(false);
    }
  };

  // Send real-time input to running process
  const handleSendRealtimeInput = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!realtimeInput || !isProcessRunning || !currentSessionId) return;

    const inputToSend = realtimeInput;
    setRealtimeInput("");

    // Show input in terminal
    setTerminalLogs((prev) => [
      ...prev,
      { type: "input", text: `${inputToSend}\n` },
    ]);

    try {
      await fetch("/api/execute/input", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId: currentSessionId,
          input: inputToSend,
        }),
      });
    } catch (err: any) {
      setTerminalLogs((prev) => [
        ...prev,
        { type: "stderr", text: `\nFailed to send input: ${err.message}\n` },
      ]);
    }
  };

  // Stop running interactive process
  const handleStopProcess = async () => {
    if (!currentSessionId) return;
    try {
      await fetch("/api/execute/stop", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId: currentSessionId }),
      });
      setIsProcessRunning(false);
      setTerminalLogs((prev) => [
        ...prev,
        { type: "status", text: `\n[Process stopped by user]\n` },
      ]);
    } catch {}
  };

  // 2. RUN IN BATCH STDIN MODE
  const runBatchCode = async () => {
    if (isLoading) return;
    setIsLoading(true);
    setActiveTab("output");
    setResult({
      status: { id: 2, description: "Executing in sandbox..." },
    });

    const codeToRun = editorRef.current ? editorRef.current.getValue() : code;

    try {
      const response = await fetch("/api/execute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          language_id: selectedLanguage.id,
          source_code: codeToRun,
          stdin: stdin,
        }),
      });

      const data = await response.json();
      setResult(data);
    } catch (err: any) {
      setResult({
        status: { id: 13, description: "Internal Error" },
        stderr: err.message || "Failed to communicate with execution server.",
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Status color helper for Neobrutalist badges
  const getStatusBadge = () => {
    if (executionMode === "interactive") {
      if (isProcessRunning) {
        return (
          <span className="bg-[#22c55e] text-black border-2 border-black px-2.5 py-0.5 rounded text-xs font-black animate-pulse shadow-[2px_2px_0px_#000] flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-black animate-ping" />
            LIVE STREAMING
          </span>
        );
      }
      return (
        <span className="bg-[#ffe600] text-black border-2 border-black px-2.5 py-0.5 rounded text-xs font-black shadow-[2px_2px_0px_#000]">
          TERMINAL IDLE
        </span>
      );
    }

    if (!result || !result.status) return null;
    const statusId = result.status.id;

    if (statusId === 3) {
      return (
        <span className="bg-[#4ade80] text-black border-2 border-black px-2.5 py-0.5 rounded text-xs font-black shadow-[2px_2px_0px_#000]">
          ✓ {result.status.description.toUpperCase()}
        </span>
      );
    } else if (statusId === 2 || statusId === 1) {
      return (
        <span className="bg-[#ffe600] text-black border-2 border-black px-2.5 py-0.5 rounded text-xs font-black animate-pulse shadow-[2px_2px_0px_#000]">
          ⏳ {result.status.description.toUpperCase()}
        </span>
      );
    } else {
      return (
        <span className="bg-[#ff5277] text-white border-2 border-black px-2.5 py-0.5 rounded text-xs font-black shadow-[2px_2px_0px_#000]">
          ✕ {result.status.description.toUpperCase()}
        </span>
      );
    }
  };

  return (
    <div className="min-h-screen flex flex-col p-3 md:p-6 max-w-[1600px] mx-auto gap-4">
      {/* ⚡ HEADER BAR */}
      <header className="neo-box-lg bg-white p-3 md:p-4 flex flex-wrap items-center justify-between gap-4">
        {/* Brand Logo & Product Name */}
        <div className="flex items-center gap-3">
          <img
            src="/logo.png"
            alt="Devnix Logo"
            className="w-11 h-11 object-contain rounded-lg border-2 border-black shadow-[3px_3px_0px_#000] bg-[#fffdfa]"
          />
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl md:text-3xl font-black tracking-tight text-black">
                DEVNIX
              </h1>
              <span className="bg-[#ff5277] text-white border-2 border-black text-[10px] font-black uppercase px-2 py-0.5 rounded-full shadow-[2px_2px_0px_#000]">
                STUDIO ⚡
              </span>
            </div>
            <p className="text-xs font-bold text-neutral-600 hidden sm:block">
              Neobrutalist Online Code Engine & Live Terminal
            </p>
          </div>
        </div>

        {/* Center: Language Selector, Theme, Mode Toggle */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Execution Mode Toggle: Interactive vs Batch */}
          <div className="flex items-center bg-[#f0ede6] border-2 border-black p-0.5 rounded-md shadow-[2px_2px_0px_#000]">
            <button
              onClick={() => setExecutionMode("interactive")}
              className={`px-2.5 py-1 text-xs font-bold rounded transition-all flex items-center gap-1.5 ${
                executionMode === "interactive"
                  ? "bg-[#22c55e] text-black font-black shadow-[1px_1px_0px_#000]"
                  : "text-neutral-600 hover:text-black"
              }`}
            >
              <Radio className="w-3 h-3" />
              <span>Real-Time Input</span>
            </button>

            <button
              onClick={() => setExecutionMode("batch")}
              className={`px-2.5 py-1 text-xs font-bold rounded transition-all flex items-center gap-1.5 ${
                executionMode === "batch"
                  ? "bg-[#00f0ff] text-black font-black shadow-[1px_1px_0px_#000]"
                  : "text-neutral-600 hover:text-black"
              }`}
            >
              <Layers className="w-3 h-3" />
              <span>Batch Stdin</span>
            </button>
          </div>

          {/* Language Selector */}
          <div className="relative flex items-center">
            <select
              value={selectedLanguage.id}
              onChange={(e) => handleLanguageChange(Number(e.target.value))}
              className="neo-select text-sm py-2 px-3 pr-8 appearance-none bg-white cursor-pointer hover:bg-neutral-50"
            >
              {SUPPORTED_LANGUAGES.map((lang) => (
                <option key={lang.id} value={lang.id}>
                  {lang.label} ({lang.version})
                </option>
              ))}
            </select>
            <ChevronDown className="w-4 h-4 absolute right-2.5 pointer-events-none stroke-[2.5]" />
          </div>

          {/* VS Code Theme Selector */}
          <div className="relative flex items-center">
            <Palette className="w-4 h-4 absolute left-2.5 pointer-events-none stroke-[2.5] text-neutral-600" />
            <select
              value={currentTheme}
              onChange={(e) => setCurrentTheme(e.target.value)}
              className="neo-select text-xs py-2 pl-8 pr-8 appearance-none bg-white cursor-pointer hover:bg-neutral-50 font-bold"
            >
              {THEMES.map((theme) => (
                <option key={theme.id} value={theme.id}>
                  {theme.name}
                </option>
              ))}
            </select>
            <ChevronDown className="w-4 h-4 absolute right-2.5 pointer-events-none stroke-[2.5]" />
          </div>

          {/* Reset Template */}
          <button
            onClick={handleResetCode}
            title="Reset code template"
            className="neo-btn bg-white hover:bg-neutral-100 p-2 text-xs flex items-center gap-1.5"
          >
            <RotateCcw className="w-4 h-4 stroke-[2.5]" />
            <span className="hidden sm:inline font-bold">Reset</span>
          </button>
        </div>

        {/* Right: Primary Run / Stop Buttons */}
        <div className="flex items-center gap-2">
          {isProcessRunning ? (
            <button
              onClick={handleStopProcess}
              className="neo-btn bg-[#ff5277] text-white hover:bg-red-600 px-5 py-2.5 text-sm md:text-base font-black flex items-center gap-2 shadow-[4px_4px_0px_#000]"
            >
              <Square className="w-4 h-4 fill-white stroke-[2]" />
              <span>STOP PROCESS</span>
            </button>
          ) : (
            <button
              onClick={handleRun}
              disabled={isLoading}
              className="neo-btn bg-[#ffe600] hover:bg-[#ffde59] px-5 py-2.5 text-sm md:text-base font-black flex items-center gap-2 shadow-[4px_4px_0px_#000]"
            >
              <Play
                className={`w-4 h-4 stroke-[3] fill-black ${
                  isLoading ? "animate-spin" : ""
                }`}
              />
              <span>{isLoading ? "LAUNCHING..." : "RUN CODE"}</span>
              <kbd className="hidden lg:inline-block bg-black text-white text-[10px] font-mono px-1.5 py-0.5 rounded border border-black ml-1">
                Ctrl+Enter
              </kbd>
            </button>
          )}
        </div>
      </header>

      {/* 🚀 MAIN SPLIT WORKSPACE: LEFT (VS CODE EDITOR) & RIGHT (OUTPUT) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 flex-1 items-stretch">
        {/* ========================================================================= */}
        {/* LEFT COLUMN: MONACO / VS CODE EDITOR (7 Columns on large screens)         */}
        {/* ========================================================================= */}
        <div className="lg:col-span-7 flex flex-col neo-box overflow-hidden bg-[#ffffff]">
          {/* Editor Header Bar */}
          <div className="bg-[#f0ede6] border-b-[3px] border-black p-2.5 px-4 flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-2">
              <div className="flex gap-1.5 mr-2">
                <div className="w-3 h-3 rounded-full border-[1.5px] border-black bg-[#ff5277]" />
                <div className="w-3 h-3 rounded-full border-[1.5px] border-black bg-[#ffe600]" />
                <div className="w-3 h-3 rounded-full border-[1.5px] border-black bg-[#4ade80]" />
              </div>
              <div className="bg-white border-2 border-black px-2.5 py-0.5 rounded text-xs font-mono font-bold shadow-[2px_2px_0px_#000] flex items-center gap-1.5">
                <FileCode2 className="w-3.5 h-3.5 text-black" />
                <span>main.{selectedLanguage.extension}</span>
              </div>
              <span className="text-[10px] font-bold uppercase px-2 py-0.5 bg-[#00f0ff] border border-black rounded shadow-[1px_1px_0px_#000]">
                VS CODE ENGINE
              </span>
            </div>

            {/* Quick Editor Actions */}
            <div className="flex items-center gap-2">
              {/* Minimap Toggle */}
              <button
                onClick={() => setShowMinimap(!showMinimap)}
                title={showMinimap ? "Hide Minimap" : "Show Minimap"}
                className={`neo-btn p-1.5 text-xs flex items-center gap-1 ${
                  showMinimap ? "bg-[#ffe600]" : "bg-white"
                }`}
              >
                {showMinimap ? (
                  <Eye className="w-3.5 h-3.5 stroke-[2.5]" />
                ) : (
                  <EyeOff className="w-3.5 h-3.5 stroke-[2.5]" />
                )}
                <span className="text-[10px] font-bold hidden xl:inline">Map</span>
              </button>

              {/* Format Code */}
              <button
                onClick={handleFormatCode}
                title="Format Code"
                className="neo-btn bg-white hover:bg-neutral-100 p-1.5 text-xs flex items-center gap-1"
              >
                <AlignLeft className="w-3.5 h-3.5 stroke-[2.5]" />
                <span className="text-[10px] font-bold hidden sm:inline">Format</span>
              </button>

              {/* Font Size Selector */}
              <div className="flex items-center gap-1 bg-white border-2 border-black px-2 py-0.5 rounded text-xs font-bold shadow-[2px_2px_0px_#000]">
                <span className="text-[10px] text-neutral-500">SIZE:</span>
                <button
                  onClick={() => setFontSize(Math.max(12, fontSize - 1))}
                  className="hover:text-[#ff5277] px-1 font-mono font-black"
                >
                  -
                </button>
                <span className="font-mono text-xs">{fontSize}</span>
                <button
                  onClick={() => setFontSize(Math.min(24, fontSize + 1))}
                  className="hover:text-[#ff5277] px-1 font-mono font-black"
                >
                  +
                </button>
              </div>

              {/* Copy Code */}
              <button
                onClick={handleCopyCode}
                title="Copy code"
                className="neo-btn bg-white hover:bg-neutral-100 p-1.5 text-xs flex items-center gap-1"
              >
                {copiedCode ? (
                  <Check className="w-3.5 h-3.5 text-green-600 stroke-[3]" />
                ) : (
                  <Copy className="w-3.5 h-3.5 stroke-[2.5]" />
                )}
                <span className="text-[11px] font-bold hidden sm:inline">
                  {copiedCode ? "Copied!" : "Copy"}
                </span>
              </button>

              {/* Clear Code */}
              <button
                onClick={() => setCode("")}
                title="Clear code"
                className="neo-btn bg-white hover:bg-red-50 p-1.5 text-xs flex items-center gap-1 text-red-600"
              >
                <Trash2 className="w-3.5 h-3.5 stroke-[2.5]" />
              </button>
            </div>
          </div>

          {/* Monaco / VS Code Editor Container */}
          <div className="flex-1 min-h-[480px] lg:min-h-[590px] relative">
            <MonacoEditor
              height="100%"
              language={selectedLanguage.monacoLang}
              theme={currentTheme}
              value={code}
              onChange={(value) => setCode(value || "")}
              beforeMount={handleEditorWillMount}
              onMount={handleEditorDidMount}
              options={{
                fontSize: fontSize,
                fontFamily: "var(--font-geist-mono), 'JetBrains Mono', 'Fira Code', Consolas, monospace",
                fontLigatures: true,
                minimap: { enabled: showMinimap },
                scrollBeyondLastLine: false,
                smoothScrolling: true,
                cursorBlinking: "smooth",
                cursorSmoothCaretAnimation: "on",
                bracketPairColorization: { enabled: true },
                autoClosingBrackets: "always",
                autoClosingQuotes: "always",
                formatOnPaste: true,
                tabSize: 4,
                lineNumbersMinChars: 3,
                padding: { top: 12, bottom: 12 },
              }}
            />
          </div>

          {/* Editor Footer / Status Bar */}
          <div className="bg-[#f0ede6] border-t-[2.5px] border-black px-4 py-1.5 flex items-center justify-between text-xs font-bold font-mono text-neutral-700">
            <div className="flex items-center gap-4">
              <span>LANG: {selectedLanguage.label.toUpperCase()}</span>
              <span>MODE: {executionMode.toUpperCase()}</span>
            </div>
            <div className="hidden sm:flex items-center gap-1.5 text-[11px] text-neutral-500">
              <Keyboard className="w-3.5 h-3.5" />
              <span>VS Code Monaco Engine (Ctrl+Enter to run)</span>
            </div>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* RIGHT COLUMN: OUTPUT & CONSOLE (5 Columns on large screens)               */}
        {/* ========================================================================= */}
        <div className="lg:col-span-5 flex flex-col neo-box overflow-hidden bg-white">
          {/* Output Header Tabs */}
          <div className="bg-[#f0ede6] border-b-[3px] border-black p-2 px-3 flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setActiveTab("output")}
                className={`px-3 py-1 text-xs font-black rounded-md border-2 border-black transition-all ${
                  activeTab === "output"
                    ? "bg-[#00f0ff] shadow-[2px_2px_0px_#000] -translate-y-0.5"
                    : "bg-white hover:bg-neutral-100"
                }`}
              >
                <div className="flex items-center gap-1">
                  <Terminal className="w-3.5 h-3.5 stroke-[2.5]" />
                  <span>{executionMode === "interactive" ? "LIVE TERMINAL" : "OUTPUT"}</span>
                </div>
              </button>

              {executionMode === "batch" && (
                <button
                  onClick={() => setActiveTab("stdin")}
                  className={`px-3 py-1 text-xs font-black rounded-md border-2 border-black transition-all ${
                    activeTab === "stdin"
                      ? "bg-[#ffe600] shadow-[2px_2px_0px_#000] -translate-y-0.5"
                      : "bg-white hover:bg-neutral-100"
                  }`}
                >
                  <span>INPUT (STDIN)</span>
                  {stdin.trim().length > 0 && (
                    <span className="ml-1 w-2 h-2 inline-block rounded-full bg-[#ff5277]" />
                  )}
                </button>
              )}

              <button
                onClick={() => setActiveTab("info")}
                className={`px-3 py-1 text-xs font-black rounded-md border-2 border-black transition-all ${
                  activeTab === "info"
                    ? "bg-[#c084fc] shadow-[2px_2px_0px_#000] -translate-y-0.5"
                    : "bg-white hover:bg-neutral-100"
                }`}
              >
                <span>INFO</span>
              </button>
            </div>

            {/* Right Tools in Output Header */}
            <div className="flex items-center gap-1.5">
              {activeTab === "output" && (
                <button
                  onClick={handleCopyOutput}
                  title="Copy Output"
                  className="neo-btn bg-white hover:bg-neutral-100 p-1.5 text-xs flex items-center gap-1"
                >
                  {copiedOutput ? (
                    <Check className="w-3.5 h-3.5 text-green-600 stroke-[3]" />
                  ) : (
                    <Copy className="w-3.5 h-3.5 stroke-[2.5]" />
                  )}
                </button>
              )}
              <button
                onClick={() => {
                  setResult(null);
                  setTerminalLogs([]);
                }}
                title="Clear Output"
                className="neo-btn bg-white hover:bg-neutral-100 p-1.5 text-xs"
              >
                <Trash2 className="w-3.5 h-3.5 stroke-[2.5]" />
              </button>
            </div>
          </div>

          {/* Output Content Area */}
          <div className="flex-1 flex flex-col p-4 bg-[#fffdfa] overflow-hidden min-h-[480px] lg:min-h-[590px]">
            {/* TAB 1: TERMINAL OUTPUT (HANDLES BOTH INTERACTIVE AND BATCH) */}
            {activeTab === "output" && (
              <div className="flex-1 flex flex-col gap-3 h-full">
                {/* Status & Metrics Bar */}
                <div className="flex items-center justify-between flex-wrap gap-2 pb-2 border-b-2 border-black/20">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-neutral-500 uppercase">
                      STATUS:
                    </span>
                    {getStatusBadge() || (
                      <span className="bg-neutral-200 text-neutral-700 border-2 border-black px-2 py-0.5 rounded text-xs font-bold">
                        READY TO RUN
                      </span>
                    )}
                  </div>

                  {executionMode === "batch" && result && (result.time || result.memory) && (
                    <div className="flex items-center gap-2">
                      {result.time && (
                        <div className="flex items-center gap-1 bg-white border-2 border-black px-2 py-0.5 rounded text-xs font-mono font-bold shadow-[2px_2px_0px_#000]">
                          <Clock className="w-3 h-3 text-neutral-600" />
                          <span>{result.time}s</span>
                        </div>
                      )}
                      {result.memory && (
                        <div className="flex items-center gap-1 bg-white border-2 border-black px-2 py-0.5 rounded text-xs font-mono font-bold shadow-[2px_2px_0px_#000]">
                          <Cpu className="w-3 h-3 text-neutral-600" />
                          <span>{result.memory} KB</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* 1A. REAL-TIME INTERACTIVE TERMINAL VIEW */}
                {executionMode === "interactive" ? (
                  <div className="flex-1 flex flex-col neo-box-sm bg-[#121212] overflow-hidden border-2 border-black">
                    {/* Live Stream Logs */}
                    <div className="flex-1 p-3 font-mono text-sm overflow-y-auto whitespace-pre-wrap selection:bg-[#ffe600] selection:text-black">
                      {terminalLogs.length === 0 ? (
                        <div className="h-full flex flex-col items-center justify-center text-center p-6 text-neutral-500 gap-2">
                          <Radio className="w-8 h-8 text-[#22c55e] animate-pulse" />
                          <p className="font-bold text-neutral-300">
                            Real-Time Interactive Terminal Ready
                          </p>
                          <p className="text-xs text-neutral-500 max-w-xs">
                            Click <strong>RUN CODE</strong> to start live execution. Any inputs requested by your code will be typed directly into the prompt below in real time!
                          </p>
                        </div>
                      ) : (
                        terminalLogs.map((log, idx) => {
                          if (log.type === "input") {
                            return (
                              <span key={idx} className="text-[#00f0ff] font-bold">
                                {log.text}
                              </span>
                            );
                          } else if (log.type === "stderr") {
                            return (
                              <span key={idx} className="text-[#ff5277]">
                                {log.text}
                              </span>
                            );
                          } else if (log.type === "status" || log.type === "exit") {
                            return (
                              <span key={idx} className="text-[#ffe600] text-xs font-bold block my-1">
                                {log.text}
                              </span>
                            );
                          } else {
                            return (
                              <span key={idx} className="text-[#4ade80]">
                                {log.text}
                              </span>
                            );
                          }
                        })
                      )}
                      <div ref={terminalEndRef} />
                    </div>

                    {/* Live Inline Input Bar */}
                    <form
                      onSubmit={handleSendRealtimeInput}
                      className="bg-[#1c1c1c] border-t-2 border-[#333333] p-2 flex items-center gap-2"
                    >
                      <span className="text-[#00f0ff] font-mono font-black text-sm pl-1">
                        ❯
                      </span>
                      <input
                        ref={realtimeInputRef}
                        type="text"
                        value={realtimeInput}
                        onChange={(e) => setRealtimeInput(e.target.value)}
                        disabled={!isProcessRunning}
                        placeholder={
                          isProcessRunning
                            ? "Type input & press Enter..."
                            : "Start program to enter input in real time..."
                        }
                        className="flex-1 bg-transparent text-[#ffffff] font-mono text-sm outline-none placeholder:text-neutral-600 disabled:opacity-40"
                      />
                      <button
                        type="submit"
                        disabled={!isProcessRunning || !realtimeInput.trim()}
                        className="bg-[#00f0ff] hover:bg-cyan-400 text-black border border-black px-3 py-1 rounded text-xs font-black flex items-center gap-1 disabled:opacity-30 cursor-pointer"
                      >
                        <span>Send</span>
                        <Send className="w-3 h-3 stroke-[2.5]" />
                      </button>
                    </form>
                  </div>
                ) : (
                  /* 1B. BATCH STDIN OUTPUT VIEW */
                  <div className="flex-1 flex flex-col gap-3 font-mono text-sm overflow-y-auto">
                    {/* Standard Output */}
                    {result?.stdout && (
                      <div className="neo-box-sm bg-[#121212] text-[#4ade80] p-3 overflow-x-auto whitespace-pre-wrap selection:bg-[#ffe600] selection:text-black">
                        <div className="text-[10px] text-neutral-400 font-bold uppercase pb-1 mb-2 border-b border-neutral-700 flex items-center justify-between">
                          <span>Standard Output (stdout)</span>
                          <span>SUCCESS</span>
                        </div>
                        {result.stdout}
                      </div>
                    )}

                    {/* Standard Error (stderr) */}
                    {result?.stderr && (
                      <div className="neo-box-sm bg-[#2b0f14] border-red-900 text-[#ff758f] p-3 overflow-x-auto whitespace-pre-wrap">
                        <div className="text-[10px] text-red-400 font-bold uppercase pb-1 mb-2 border-b border-red-800 flex items-center gap-1.5">
                          <AlertCircle className="w-3 h-3" />
                          <span>Execution / System Error (stderr)</span>
                        </div>
                        {result.stderr}
                      </div>
                    )}

                    {/* Compilation Output */}
                    {result?.compile_output && (
                      <div className="neo-box-sm bg-[#261706] border-orange-900 text-[#ffb04f] p-3 overflow-x-auto whitespace-pre-wrap">
                        <div className="text-[10px] text-orange-400 font-bold uppercase pb-1 mb-2 border-b border-orange-800">
                          Compiler Output
                        </div>
                        {result.compile_output}
                      </div>
                    )}

                    {/* Empty State */}
                    {!result && (
                      <div className="flex-1 flex flex-col items-center justify-center text-center p-8 border-2 border-dashed border-neutral-300 rounded-lg text-neutral-500 gap-3 my-auto">
                        <div className="w-12 h-12 rounded-xl bg-[#ffe600] border-2 border-black flex items-center justify-center text-black shadow-[3px_3px_0px_#000]">
                          <Play className="w-6 h-6 fill-black ml-0.5" />
                        </div>
                        <div>
                          <p className="font-black text-black text-base">
                            Batch Output Ready
                          </p>
                          <p className="text-xs font-semibold text-neutral-600 max-w-xs mt-1">
                            Click &quot;RUN CODE&quot; or press{" "}
                            <kbd className="bg-neutral-200 px-1 py-0.5 rounded border border-black text-black">
                              Ctrl+Enter
                            </kbd>{" "}
                            to execute with pre-set inputs.
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* TAB 2: STDIN INPUT (BATCH MODE) */}
            {activeTab === "stdin" && executionMode === "batch" && (
              <div className="flex-1 flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-black uppercase text-neutral-700">
                    Standard Input (stdin)
                  </label>
                  <button
                    onClick={() => setStdin("")}
                    className="text-xs font-bold text-red-600 hover:underline"
                  >
                    Clear Input
                  </button>
                </div>
                <p className="text-xs text-neutral-500 font-semibold">
                  Provide custom input data for programs that read from standard
                  input (e.g. `input()` in Python or `cin` in C++).
                </p>
                <textarea
                  value={stdin}
                  onChange={(e) => setStdin(e.target.value)}
                  placeholder="Enter inputs here (one per line)..."
                  className="w-full flex-1 p-3 neo-input font-mono text-sm resize-none"
                />
              </div>
            )}

            {/* TAB 3: SYSTEM & ENGINE INFO */}
            {activeTab === "info" && (
              <div className="flex-1 flex flex-col gap-4 text-xs overflow-y-auto">
                <div className="neo-box-sm bg-[#ffe600] p-3">
                  <h3 className="font-black text-sm uppercase text-black">
                    ⚡ DEVNIX ENGINE DUAL MODES
                  </h3>
                  <p className="font-bold text-neutral-800 mt-1">
                    Supports both Real-Time Interactive Streaming Terminal and Batch Stdin execution.
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-2 font-mono">
                  <div className="neo-box-sm bg-white p-2.5">
                    <span className="text-[10px] text-neutral-500 block font-bold">
                      ACTIVE MODE
                    </span>
                    <span className="font-bold text-sm text-black uppercase">
                      {executionMode}
                    </span>
                  </div>
                  <div className="neo-box-sm bg-white p-2.5">
                    <span className="text-[10px] text-neutral-500 block font-bold">
                      ACTIVE LANGUAGE
                    </span>
                    <span className="font-bold text-sm text-black">
                      {selectedLanguage.label}
                    </span>
                  </div>
                  <div className="neo-box-sm bg-white p-2.5">
                    <span className="text-[10px] text-neutral-500 block font-bold">
                      EDITOR THEME
                    </span>
                    <span className="font-bold text-sm text-black">
                      {THEMES.find((t) => t.id === currentTheme)?.name || currentTheme}
                    </span>
                  </div>
                  <div className="neo-box-sm bg-white p-2.5">
                    <span className="text-[10px] text-neutral-500 block font-bold">
                      LIVE STREAMING
                    </span>
                    <span className="font-bold text-sm text-green-600">
                      SSE ACTIVE
                    </span>
                  </div>
                </div>

                <div className="neo-box-sm bg-white p-3 space-y-2">
                  <h4 className="font-black uppercase text-black text-xs">
                    Editor Capabilities
                  </h4>
                  <div className="space-y-1 font-mono text-[11px]">
                    <div className="flex justify-between">
                      <span className="text-neutral-600">Run / Launch Code:</span>
                      <kbd className="bg-neutral-100 border border-black px-1.5 py-0.5 rounded font-bold">
                        Ctrl + Enter
                      </kbd>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-neutral-600">Auto Format Document:</span>
                      <kbd className="bg-neutral-100 border border-black px-1.5 py-0.5 rounded font-bold">
                        Shift + Alt + F
                      </kbd>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-neutral-600">IntelliSense Autocomplete:</span>
                      <kbd className="bg-neutral-100 border border-black px-1.5 py-0.5 rounded font-bold">
                        Ctrl + Space
                      </kbd>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Output Footer Bar */}
          <div className="bg-[#f0ede6] border-t-[2.5px] border-black px-4 py-1.5 flex items-center justify-between text-xs font-bold font-mono text-neutral-700">
            <span className="flex items-center gap-1.5">
              <span className={`w-2 h-2 rounded-full ${isProcessRunning ? "bg-[#22c55e] animate-ping" : "bg-neutral-400"} inline-block`} />
              <span>{executionMode === "interactive" ? "LIVE PTY TERMINAL" : "BATCH ENGINE"}</span>
            </span>
            <span className="text-[11px] text-neutral-500">DEVNIX v1.0</span>
          </div>
        </div>
      </div>
    </div>
  );
}
