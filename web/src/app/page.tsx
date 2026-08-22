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
  Zap,
} from "lucide-react";

// Dynamically import Monaco Editor
const MonacoEditor = dynamic(() => import("@monaco-editor/react"), {
  ssr: false,
  loading: () => (
    <div className="flex-1 flex items-center justify-center bg-[#1e1e1e] text-[#ffe600] font-mono text-xs">
      <div className="flex items-center gap-2">
        <span className="w-2.5 h-2.5 rounded-full bg-[#ffe600] animate-ping" />
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
  
  // Real-time terminal state
  const [terminalLogs, setTerminalLogs] = useState<Array<{ type: "stdout" | "stderr" | "status" | "input" | "exit"; text: string }>>([]);
  const [realtimeInput, setRealtimeInput] = useState<string>("");
  const [currentSessionId, setCurrentSessionId] = useState<string>("");

  const [copiedCode, setCopiedCode] = useState<boolean>(false);
  const [copiedOutput, setCopiedOutput] = useState<boolean>(false);

  const editorRef = useRef<any>(null);
  const monacoRef = useRef<any>(null);
  const terminalEndRef = useRef<HTMLDivElement>(null);
  const realtimeInputRef = useRef<HTMLInputElement>(null);

  // Auto-scroll terminal
  useEffect(() => {
    if (terminalEndRef.current) {
      terminalEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [terminalLogs]);

  // Setup Monaco themes
  const handleEditorWillMount = (monaco: any) => {
    monacoRef.current = monaco;

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
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter, () => {
      handleRun();
    });
  };

  const handleLanguageChange = (langId: number) => {
    const lang = SUPPORTED_LANGUAGES.find((l) => l.id === langId);
    if (lang) {
      setSelectedLanguage(lang);
      setCode(lang.defaultCode);
      setResult(null);
      setTerminalLogs([]);
    }
  };

  const handleResetCode = () => {
    setCode(selectedLanguage.defaultCode);
  };

  const handleFormatCode = () => {
    if (editorRef.current) {
      editorRef.current.getAction("editor.action.formatDocument")?.run();
    }
  };

  const handleCopyCode = () => {
    navigator.clipboard.writeText(code);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

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

  const handleRun = () => {
    if (executionMode === "interactive") {
      runInteractiveStreaming();
    } else {
      runBatchCode();
    }
  };

  // 1. Interactive Streaming Mode
  const runInteractiveStreaming = async () => {
    if (isProcessRunning) return;

    const sessionId = `sess_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    setCurrentSessionId(sessionId);
    setIsProcessRunning(true);
    setIsLoading(true);
    setActiveTab("output");
    setTerminalLogs([
      { type: "status", text: `⚡ [DEVNIX TTY] Initializing ${selectedLanguage.label} runtime session...\n` },
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

  const handleSendRealtimeInput = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!realtimeInput || !isProcessRunning || !currentSessionId) return;

    const inputToSend = realtimeInput;
    setRealtimeInput("");

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
        { type: "status", text: `\n[Process terminated by user]\n` },
      ]);
    } catch {}
  };

  // 2. Batch Mode
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

  return (
    <div className="h-screen max-h-screen flex flex-col p-2 md:p-3 max-w-[1720px] mx-auto gap-2.5 overflow-hidden">
      {/* ⚡ HEADER BAR (Fixed Height) */}
      <header className="shrink-0 neo-box-lg bg-white p-2.5 px-3 md:px-4 flex flex-wrap items-center justify-between gap-3">
        {/* Brand Logo & Product Name */}
        <div className="flex items-center gap-2.5">
          <img
            src="/logo.png"
            alt="Devnix Logo"
            className="w-9 h-9 md:w-10 md:h-10 object-contain rounded-lg border-2 border-black shadow-[2px_2px_0px_#000] bg-[#fffdfa]"
          />
          <div>
            <div className="flex items-center gap-1.5">
              <h1 className="text-xl md:text-2xl font-black tracking-tight text-black leading-none">
                DEVNIX
              </h1>
              <span className="bg-[#ff5277] text-white border-[1.5px] border-black text-[9px] font-black uppercase px-1.5 py-0.5 rounded-full shadow-[1.5px_1.5px_0px_#000]">
                STUDIO ⚡
              </span>
            </div>
            <p className="text-[10px] font-bold text-neutral-500 hidden sm:block leading-tight mt-0.5">
              Neobrutalist Online Code Engine & Live Terminal
            </p>
          </div>
        </div>

        {/* Center: Mode Switcher, Language & Theme Controls */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Execution Mode Switcher */}
          <div className="flex items-center bg-[#f0ede6] border-2 border-black p-0.5 rounded-md shadow-[2px_2px_0px_#000]">
            <button
              onClick={() => setExecutionMode("interactive")}
              className={`px-2.5 py-1 text-xs font-black rounded transition-all flex items-center gap-1.5 ${
                executionMode === "interactive"
                  ? "bg-[#22c55e] text-black border border-black shadow-[1px_1px_0px_#000]"
                  : "text-neutral-600 hover:text-black"
              }`}
            >
              <Radio className="w-3 h-3" />
              <span>Real-Time Input</span>
            </button>

            <button
              onClick={() => setExecutionMode("batch")}
              className={`px-2.5 py-1 text-xs font-black rounded transition-all flex items-center gap-1.5 ${
                executionMode === "batch"
                  ? "bg-[#00f0ff] text-black border border-black shadow-[1px_1px_0px_#000]"
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
              className="neo-select text-xs py-1.5 px-2.5 pr-7 appearance-none bg-white cursor-pointer hover:bg-neutral-50 font-bold"
            >
              {SUPPORTED_LANGUAGES.map((lang) => (
                <option key={lang.id} value={lang.id}>
                  {lang.label} ({lang.version})
                </option>
              ))}
            </select>
            <ChevronDown className="w-3.5 h-3.5 absolute right-2 pointer-events-none stroke-[2.5]" />
          </div>

          {/* VS Code Theme Selector */}
          <div className="relative flex items-center">
            <Palette className="w-3.5 h-3.5 absolute left-2 pointer-events-none stroke-[2.5] text-neutral-600" />
            <select
              value={currentTheme}
              onChange={(e) => setCurrentTheme(e.target.value)}
              className="neo-select text-xs py-1.5 pl-7 pr-7 appearance-none bg-white cursor-pointer hover:bg-neutral-50 font-bold"
            >
              {THEMES.map((theme) => (
                <option key={theme.id} value={theme.id}>
                  {theme.name}
                </option>
              ))}
            </select>
            <ChevronDown className="w-3.5 h-3.5 absolute right-2 pointer-events-none stroke-[2.5]" />
          </div>

          {/* Reset Template */}
          <button
            onClick={handleResetCode}
            title="Reset code template"
            className="neo-btn bg-white hover:bg-neutral-100 p-1.5 text-xs flex items-center gap-1"
          >
            <RotateCcw className="w-3.5 h-3.5 stroke-[2.5]" />
            <span className="hidden sm:inline font-bold text-[11px]">Reset</span>
          </button>
        </div>

        {/* Right: Primary Run / Stop Action */}
        <div className="flex items-center gap-2">
          {isProcessRunning ? (
            <button
              onClick={handleStopProcess}
              className="neo-btn bg-[#ff5277] text-white hover:bg-red-600 px-4 py-2 text-xs md:text-sm font-black flex items-center gap-1.5 shadow-[3px_3px_0px_#000]"
            >
              <Square className="w-3.5 h-3.5 fill-white stroke-[2]" />
              <span>STOP PROCESS</span>
            </button>
          ) : (
            <button
              onClick={handleRun}
              disabled={isLoading}
              className="neo-btn bg-[#ffe600] hover:bg-[#ffde59] px-5 py-2 text-xs md:text-sm font-black flex items-center gap-1.5 shadow-[3px_3px_0px_#000]"
            >
              <Play
                className={`w-3.5 h-3.5 stroke-[3] fill-black ${
                  isLoading ? "animate-spin" : ""
                }`}
              />
              <span>{isLoading ? "LAUNCHING..." : "RUN CODE"}</span>
              <kbd className="hidden lg:inline-block bg-black text-white text-[9px] font-mono px-1 py-0.5 rounded border border-black ml-1">
                Ctrl+Enter
              </kbd>
            </button>
          )}
        </div>
      </header>

      {/* 🚀 MAIN SPLIT WORKSPACE: Fills 100% of remaining screen height */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-3 min-h-0 overflow-hidden">
        {/* ========================================================================= */}
        {/* LEFT COLUMN: MONACO / VS CODE EDITOR (7 Columns)                          */}
        {/* ========================================================================= */}
        <div className="lg:col-span-7 flex flex-col neo-box overflow-hidden bg-[#ffffff] h-full min-h-0">
          {/* Editor Header Bar */}
          <div className="shrink-0 bg-[#f0ede6] border-b-[2.5px] border-black p-2 px-3 flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-2">
              <div className="flex gap-1.5 mr-1">
                <div className="w-2.5 h-2.5 rounded-full border border-black bg-[#ff5277]" />
                <div className="w-2.5 h-2.5 rounded-full border border-black bg-[#ffe600]" />
                <div className="w-2.5 h-2.5 rounded-full border border-black bg-[#4ade80]" />
              </div>
              <div className="bg-white border-[1.5px] border-black px-2 py-0.5 rounded text-xs font-mono font-bold shadow-[1.5px_1.5px_0px_#000] flex items-center gap-1">
                <FileCode2 className="w-3 h-3 text-black" />
                <span>main.{selectedLanguage.extension}</span>
              </div>
              <span className="text-[9px] font-black uppercase px-1.5 py-0.5 bg-[#00f0ff] border border-black rounded shadow-[1px_1px_0px_#000]">
                VS CODE
              </span>
            </div>

            {/* Editor Quick Tools */}
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setShowMinimap(!showMinimap)}
                title={showMinimap ? "Hide Minimap" : "Show Minimap"}
                className={`neo-btn p-1 text-xs flex items-center gap-1 ${
                  showMinimap ? "bg-[#ffe600]" : "bg-white"
                }`}
              >
                {showMinimap ? (
                  <Eye className="w-3 h-3 stroke-[2.5]" />
                ) : (
                  <EyeOff className="w-3 h-3 stroke-[2.5]" />
                )}
                <span className="text-[10px] font-bold hidden xl:inline">Map</span>
              </button>

              <button
                onClick={handleFormatCode}
                title="Format Code"
                className="neo-btn bg-white hover:bg-neutral-100 p-1 text-xs flex items-center gap-1"
              >
                <AlignLeft className="w-3 h-3 stroke-[2.5]" />
                <span className="text-[10px] font-bold hidden sm:inline">Format</span>
              </button>

              <div className="flex items-center gap-1 bg-white border border-black px-1.5 py-0.5 rounded text-[11px] font-bold shadow-[1.5px_1.5px_0px_#000]">
                <span className="text-[9px] text-neutral-500 font-black">SIZE:</span>
                <button
                  onClick={() => setFontSize(Math.max(12, fontSize - 1))}
                  className="hover:text-[#ff5277] px-0.5 font-mono font-black"
                >
                  -
                </button>
                <span className="font-mono text-[11px]">{fontSize}</span>
                <button
                  onClick={() => setFontSize(Math.min(24, fontSize + 1))}
                  className="hover:text-[#ff5277] px-0.5 font-mono font-black"
                >
                  +
                </button>
              </div>

              <button
                onClick={handleCopyCode}
                title="Copy code"
                className="neo-btn bg-white hover:bg-neutral-100 p-1 text-xs flex items-center gap-1"
              >
                {copiedCode ? (
                  <Check className="w-3 h-3 text-green-600 stroke-[3]" />
                ) : (
                  <Copy className="w-3 h-3 stroke-[2.5]" />
                )}
                <span className="text-[10px] font-bold hidden sm:inline">
                  {copiedCode ? "Copied" : "Copy"}
                </span>
              </button>

              <button
                onClick={() => setCode("")}
                title="Clear code"
                className="neo-btn bg-white hover:bg-red-50 p-1 text-xs flex items-center gap-1 text-red-600"
              >
                <Trash2 className="w-3 h-3 stroke-[2.5]" />
              </button>
            </div>
          </div>

          {/* Monaco Editor Canvas (Fills exactly available height) */}
          <div className="flex-1 min-h-0 relative h-full">
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
                padding: { top: 8, bottom: 8 },
              }}
            />
          </div>

          {/* Editor Footer Status */}
          <div className="shrink-0 bg-[#f0ede6] border-t-[2px] border-black px-3 py-1 flex items-center justify-between text-[11px] font-bold font-mono text-neutral-700">
            <div className="flex items-center gap-3">
              <span>LANG: {selectedLanguage.label.toUpperCase()}</span>
              <span>THEME: {currentTheme.toUpperCase()}</span>
            </div>
            <div className="hidden sm:flex items-center gap-1 text-[10px] text-neutral-500">
              <Keyboard className="w-3 h-3" />
              <span>Ctrl+Enter to Execute</span>
            </div>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* RIGHT COLUMN: HIGH-TECH NEOBRUTALIST TERMINAL (5 Columns)                 */}
        {/* ========================================================================= */}
        <div className="lg:col-span-5 flex flex-col neo-box overflow-hidden bg-[#0e1117] border-[3px] border-black shadow-[4px_4px_0px_0px_#000] h-full min-h-0">
          {/* Retro Terminal Header */}
          <div className="shrink-0 bg-[#181c24] border-b-[2.5px] border-black p-2 px-3 flex items-center justify-between gap-2 flex-wrap">
            {/* Terminal Window Controls & Title */}
            <div className="flex items-center gap-2.5">
              <div className="flex gap-1.5">
                <div className="w-2.5 h-2.5 rounded-full border border-black bg-[#ff5277]" />
                <div className="w-2.5 h-2.5 rounded-full border border-black bg-[#ffe600]" />
                <div className="w-2.5 h-2.5 rounded-full border border-black bg-[#22c55e]" />
              </div>
              <div className="flex items-center gap-1.5 text-neutral-300 font-mono text-xs font-bold">
                <Terminal className="w-3.5 h-3.5 text-[#00f0ff]" />
                <span>devnix@tty1:~</span>
              </div>
            </div>

            {/* Terminal Status & Controls */}
            <div className="flex items-center gap-2">
              {executionMode === "interactive" ? (
                isProcessRunning ? (
                  <span className="bg-[#22c55e] text-black border border-black px-2 py-0.5 rounded text-[10px] font-black animate-pulse flex items-center gap-1 shadow-[1px_1px_0px_#000]">
                    <span className="w-1.5 h-1.5 rounded-full bg-black animate-ping" />
                    LIVE RUNNING
                  </span>
                ) : (
                  <span className="bg-[#ffe600] text-black border border-black px-2 py-0.5 rounded text-[10px] font-black shadow-[1px_1px_0px_#000]">
                    READY
                  </span>
                )
              ) : (
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setActiveTab("output")}
                    className={`px-2 py-0.5 rounded text-[10px] font-black border border-black transition-all ${
                      activeTab === "output"
                        ? "bg-[#00f0ff] text-black shadow-[1px_1px_0px_#000]"
                        : "bg-[#252b36] text-neutral-300"
                    }`}
                  >
                    OUTPUT
                  </button>
                  <button
                    onClick={() => setActiveTab("stdin")}
                    className={`px-2 py-0.5 rounded text-[10px] font-black border border-black transition-all ${
                      activeTab === "stdin"
                        ? "bg-[#ffe600] text-black shadow-[1px_1px_0px_#000]"
                        : "bg-[#252b36] text-neutral-300"
                    }`}
                  >
                    STDIN
                  </button>
                </div>
              )}

              {/* Copy & Clear Console Buttons */}
              <div className="flex items-center gap-1 border-l border-neutral-700 pl-2">
                <button
                  onClick={handleCopyOutput}
                  title="Copy Terminal Logs"
                  className="p-1 text-xs text-neutral-400 hover:text-white hover:bg-neutral-800 rounded"
                >
                  {copiedOutput ? (
                    <Check className="w-3 h-3 text-green-400" />
                  ) : (
                    <Copy className="w-3 h-3" />
                  )}
                </button>
                <button
                  onClick={() => {
                    setResult(null);
                    setTerminalLogs([]);
                  }}
                  title="Clear Console"
                  className="p-1 text-xs text-neutral-400 hover:text-red-400 hover:bg-neutral-800 rounded"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            </div>
          </div>

          {/* Terminal Screen Body (Scrollable inside, never overflows screen) */}
          <div className="flex-1 min-h-0 flex flex-col p-2.5 md:p-3 bg-[#0a0d13] text-[#e6edf3] font-mono text-xs md:text-sm overflow-hidden relative">
            <div className="absolute inset-0 bg-gradient-to-b from-cyan-500/[0.02] via-transparent to-black/[0.1] pointer-events-none" />

            {/* TAB 1: OUTPUT / INTERACTIVE TERMINAL */}
            {activeTab === "output" && (
              <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
                {/* 1A. REAL-TIME INTERACTIVE VIEW */}
                {executionMode === "interactive" ? (
                  <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
                    {/* Live Stream Screen (Internally scrollable) */}
                    <div className="flex-1 min-h-0 overflow-y-auto space-y-1 p-1.5 selection:bg-[#ffe600] selection:text-black">
                      {terminalLogs.length === 0 ? (
                        <div className="h-full flex flex-col items-center justify-center text-center p-4 text-neutral-500 gap-2">
                          <div className="w-10 h-10 rounded-xl bg-[#161b22] border border-neutral-700 flex items-center justify-center text-[#22c55e] shadow-[2px_2px_0px_#000]">
                            <Zap className="w-5 h-5" />
                          </div>
                          <div>
                            <p className="font-black text-white text-sm tracking-wide">
                              Devnix Real-Time Interactive Terminal
                            </p>
                            <p className="text-[11px] text-neutral-400 max-w-xs mt-0.5">
                              Press <strong className="text-[#ffe600]">RUN CODE</strong> or <kbd className="bg-neutral-800 text-white px-1 py-0.5 rounded border border-neutral-600">Ctrl+Enter</kbd> to execute. Type inputs in real time below!
                            </p>
                          </div>
                        </div>
                      ) : (
                        terminalLogs.map((log, idx) => {
                          if (log.type === "input") {
                            return (
                              <div key={idx} className="flex items-start gap-1.5 text-[#00f0ff] font-bold text-xs md:text-sm">
                                <span className="text-[#ffe600]">❯</span>
                                <span>{log.text}</span>
                              </div>
                            );
                          } else if (log.type === "stderr") {
                            return (
                              <div key={idx} className="p-1.5 rounded bg-red-950/40 border border-red-800 text-[#ff758f] whitespace-pre-wrap text-xs">
                                {log.text}
                              </div>
                            );
                          } else if (log.type === "status") {
                            return (
                              <div key={idx} className="text-[#ffe600] text-[11px] font-bold border-y border-neutral-800 py-0.5 my-1">
                                {log.text}
                              </div>
                            );
                          } else if (log.type === "exit") {
                            return (
                              <div key={idx} className="text-neutral-400 text-[11px] font-bold pt-1 border-t border-neutral-800">
                                {log.text}
                              </div>
                            );
                          } else {
                            return (
                              <div key={idx} className="text-[#4ade80] whitespace-pre-wrap leading-relaxed text-xs md:text-sm">
                                {log.text}
                              </div>
                            );
                          }
                        })
                      )}
                      <div ref={terminalEndRef} />
                    </div>

                    {/* Integrated Interactive Command Bar (Fixed at bottom of terminal) */}
                    <form
                      onSubmit={handleSendRealtimeInput}
                      className="shrink-0 mt-2 bg-[#12161f] border-2 border-black rounded-lg p-1 px-2.5 flex items-center gap-2 shadow-[2px_2px_0px_#000]"
                    >
                      <span className="text-[#00f0ff] font-black text-sm select-none">
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
                            ? "Type input here & press Enter..."
                            : "Waiting for code to launch..."
                        }
                        className="flex-1 bg-transparent text-white font-mono text-xs md:text-sm outline-none placeholder:text-neutral-600 disabled:opacity-40"
                      />
                      <button
                        type="submit"
                        disabled={!isProcessRunning || !realtimeInput.trim()}
                        className="neo-btn bg-[#00f0ff] hover:bg-cyan-400 text-black px-2.5 py-0.5 text-xs font-black flex items-center gap-1 disabled:opacity-30 cursor-pointer"
                      >
                        <span>Send</span>
                        <Send className="w-3 h-3 stroke-[2.5]" />
                      </button>
                    </form>
                  </div>
                ) : (
                  /* 1B. BATCH STDIN VIEW */
                  <div className="flex-1 min-h-0 flex flex-col gap-2.5 overflow-y-auto">
                    {/* Execution Metrics Header */}
                    {result && (
                      <div className="shrink-0 grid grid-cols-3 gap-2">
                        <div className="bg-[#161b22] border border-black rounded p-1.5 text-center shadow-[1.5px_1.5px_0px_#000]">
                          <span className="text-[9px] text-neutral-400 font-bold block">
                            STATUS
                          </span>
                          <span className={`text-[11px] font-black ${result.status?.id === 3 ? "text-green-400" : "text-red-400"}`}>
                            {result.status?.description || "DONE"}
                          </span>
                        </div>
                        <div className="bg-[#161b22] border border-black rounded p-1.5 text-center shadow-[1.5px_1.5px_0px_#000]">
                          <span className="text-[9px] text-neutral-400 font-bold block">
                            TIME
                          </span>
                          <span className="text-[11px] font-black text-[#00f0ff]">
                            {result.time ? `${result.time}s` : "--"}
                          </span>
                        </div>
                        <div className="bg-[#161b22] border border-black rounded p-1.5 text-center shadow-[1.5px_1.5px_0px_#000]">
                          <span className="text-[9px] text-neutral-400 font-bold block">
                            MEMORY
                          </span>
                          <span className="text-[11px] font-black text-[#ffe600]">
                            {result.memory ? `${result.memory} KB` : "--"}
                          </span>
                        </div>
                      </div>
                    )}

                    {/* Standard Output Screen */}
                    {result?.stdout && (
                      <div className="p-2.5 bg-[#11141c] border border-neutral-800 rounded-lg text-[#4ade80] whitespace-pre-wrap selection:bg-[#ffe600] selection:text-black text-xs md:text-sm">
                        <div className="text-[9px] text-neutral-400 uppercase font-black pb-1 mb-1.5 border-b border-neutral-800 flex justify-between">
                          <span>Standard Output (stdout)</span>
                          <span className="text-green-400">PASSED</span>
                        </div>
                        {result.stdout}
                      </div>
                    )}

                    {/* Standard Error (stderr) */}
                    {result?.stderr && (
                      <div className="p-2.5 bg-red-950/30 border border-red-800 rounded-lg text-[#ff758f] whitespace-pre-wrap text-xs">
                        <div className="text-[9px] text-red-400 uppercase font-black pb-1 mb-1.5 border-b border-red-800 flex items-center gap-1">
                          <AlertCircle className="w-3 h-3" />
                          <span>Error / Stderr</span>
                        </div>
                        {result.stderr}
                      </div>
                    )}

                    {/* Batch Empty State */}
                    {!result && (
                      <div className="flex-1 flex flex-col items-center justify-center text-center p-4 text-neutral-500 gap-2">
                        <Layers className="w-6 h-6 text-[#00f0ff]" />
                        <p className="font-bold text-white text-xs">Batch Stdin Mode Ready</p>
                        <p className="text-[11px] text-neutral-400 max-w-xs">
                          Inputs configured in the <strong>STDIN</strong> tab will be passed into the program upon launch.
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* TAB 2: STDIN INPUT (BATCH MODE) */}
            {activeTab === "stdin" && executionMode === "batch" && (
              <div className="flex-1 min-h-0 flex flex-col gap-2">
                <div className="shrink-0 flex items-center justify-between">
                  <span className="text-xs font-black uppercase text-neutral-300">
                    Standard Input (stdin)
                  </span>
                  <button
                    onClick={() => setStdin("")}
                    className="text-xs font-bold text-red-400 hover:underline"
                  >
                    Clear
                  </button>
                </div>
                <textarea
                  value={stdin}
                  onChange={(e) => setStdin(e.target.value)}
                  placeholder="Enter inputs here (one per line)..."
                  className="w-full flex-1 min-h-0 p-2.5 bg-[#12161f] border-2 border-black rounded-lg text-white font-mono text-xs md:text-sm resize-none outline-none focus:border-[#00f0ff] shadow-[2px_2px_0px_#000]"
                />
              </div>
            )}
          </div>

          {/* Terminal Footer Bar */}
          <div className="shrink-0 bg-[#181c24] border-t-[2px] border-black px-3 py-1 flex items-center justify-between text-[11px] font-mono text-neutral-400">
            <span className="flex items-center gap-1.5">
              <span className={`w-2 h-2 rounded-full ${isProcessRunning ? "bg-[#22c55e] animate-ping" : "bg-neutral-500"} inline-block`} />
              <span>{executionMode === "interactive" ? "LIVE SSE TTY (DEVNIX-V1)" : "JUDGE0 BATCH ENGINE"}</span>
            </span>
            <span className="text-[10px] text-neutral-500 font-bold">PORT: 2358</span>
          </div>
        </div>
      </div>
    </div>
  );
}
