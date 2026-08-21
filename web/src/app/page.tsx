"use client";

import React, { useState, useEffect, useRef } from "react";
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
  Sparkles,
  AlertCircle,
  FileCode2,
  Keyboard,
  Settings2,
  Sliders,
  ChevronDown
} from "lucide-react";

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

export default function DevnixStudio() {
  const [selectedLanguage, setSelectedLanguage] = useState<Language>(
    SUPPORTED_LANGUAGES[0]
  );
  const [code, setCode] = useState<string>(SUPPORTED_LANGUAGES[0].defaultCode);
  const [stdin, setStdin] = useState<string>("");
  const [activeTab, setActiveTab] = useState<"output" | "stdin" | "info">("output");
  const [fontSize, setFontSize] = useState<number>(14);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [result, setResult] = useState<ExecutionResult | null>(null);
  const [copiedCode, setCopiedCode] = useState<boolean>(false);
  const [copiedOutput, setCopiedOutput] = useState<boolean>(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Update code boilerplate when language changes
  const handleLanguageChange = (langId: number) => {
    const lang = SUPPORTED_LANGUAGES.find((l) => l.id === langId);
    if (lang) {
      setSelectedLanguage(lang);
      setCode(lang.defaultCode);
      setResult(null);
    }
  };

  // Reset current template
  const handleResetCode = () => {
    setCode(selectedLanguage.defaultCode);
  };

  // Copy code to clipboard
  const handleCopyCode = () => {
    navigator.clipboard.writeText(code);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  // Copy output to clipboard
  const handleCopyOutput = () => {
    const textToCopy =
      (result?.stdout || "") +
      (result?.stderr ? "\n" + result.stderr : "") +
      (result?.compile_output ? "\n" + result.compile_output : "");
    navigator.clipboard.writeText(textToCopy);
    setCopiedOutput(true);
    setTimeout(() => setCopiedOutput(false), 2000);
  };

  // Handle Tab key and shortcuts inside textarea
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Tab") {
      e.preventDefault();
      const target = e.currentTarget;
      const start = target.selectionStart;
      const end = target.selectionEnd;
      const newCode = code.substring(0, start) + "    " + code.substring(end);
      setCode(newCode);
      setTimeout(() => {
        target.selectionStart = target.selectionEnd = start + 4;
      }, 0);
    } else if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
      e.preventDefault();
      runCode();
    }
  };

  // Execute code via API
  const runCode = async () => {
    if (isLoading) return;
    setIsLoading(true);
    setActiveTab("output");
    setResult({
      status: { id: 2, description: "Executing in sandbox..." },
    });

    try {
      const response = await fetch("/api/execute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          language_id: selectedLanguage.id,
          source_code: code,
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

  // Line count calculations
  const lineCount = code.split("\n").length;
  const lineNumbers = Array.from({ length: lineCount }, (_, i) => i + 1);

  // Status color helper for Neobrutalist badges
  const getStatusBadge = () => {
    if (!result || !result.status) return null;
    const statusId = result.status.id;

    if (statusId === 3) {
      // Accepted
      return (
        <span className="bg-[#4ade80] text-black border-2 border-black px-2.5 py-0.5 rounded text-xs font-black shadow-[2px_2px_0px_#000]">
          ✓ {result.status.description.toUpperCase()}
        </span>
      );
    } else if (statusId === 2 || statusId === 1) {
      // In Queue / Processing
      return (
        <span className="bg-[#ffe600] text-black border-2 border-black px-2.5 py-0.5 rounded text-xs font-black animate-pulse shadow-[2px_2px_0px_#000]">
          ⏳ {result.status.description.toUpperCase()}
        </span>
      );
    } else if (statusId === 5 || statusId === 6) {
      // Time Limit / Compilation Error
      return (
        <span className="bg-[#ff9800] text-black border-2 border-black px-2.5 py-0.5 rounded text-xs font-black shadow-[2px_2px_0px_#000]">
          ⚠️ {result.status.description.toUpperCase()}
        </span>
      );
    } else {
      // Error
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
          <div className="bg-[#ffe600] border-2 border-black p-2 rounded-lg shadow-[3px_3px_0px_#000] flex items-center justify-center">
            <Code2 className="w-6 h-6 stroke-[2.5]" />
          </div>
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
              Neobrutalist Online Code Engine & Judge
            </p>
          </div>
        </div>

        {/* Center: Language Selector & Quick Controls */}
        <div className="flex items-center gap-2 flex-wrap">
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

          <button
            onClick={handleResetCode}
            title="Reset code template"
            className="neo-btn bg-white hover:bg-neutral-100 p-2 text-xs flex items-center gap-1.5"
          >
            <RotateCcw className="w-4 h-4 stroke-[2.5]" />
            <span className="hidden sm:inline font-bold">Reset</span>
          </button>
        </div>

        {/* Right: Primary Run Button */}
        <div className="flex items-center gap-2">
          <button
            onClick={runCode}
            disabled={isLoading}
            className="neo-btn bg-[#ffe600] hover:bg-[#ffde59] px-5 py-2.5 text-sm md:text-base font-black flex items-center gap-2 shadow-[4px_4px_0px_#000]"
          >
            <Play
              className={`w-4 h-4 stroke-[3] fill-black ${
                isLoading ? "animate-spin" : ""
              }`}
            />
            <span>{isLoading ? "RUNNING..." : "RUN CODE"}</span>
            <kbd className="hidden lg:inline-block bg-black text-white text-[10px] font-mono px-1.5 py-0.5 rounded border border-black ml-1">
              Ctrl+Enter
            </kbd>
          </button>
        </div>
      </header>

      {/* 🚀 MAIN SPLIT WORKSPACE: LEFT (EDITOR) & RIGHT (OUTPUT) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 flex-1 items-stretch">
        {/* ========================================================================= */}
        {/* LEFT COLUMN: CODE EDITOR (7 Columns on large screens)                     */}
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
            </div>

            {/* Quick Editor Actions */}
            <div className="flex items-center gap-2">
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
                  onClick={() => setFontSize(Math.min(22, fontSize + 1))}
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

          {/* Editor Body with Line Numbers */}
          <div className="flex-1 flex overflow-hidden min-h-[450px] lg:min-h-[580px] bg-[#1e1e1e] text-[#f8f8f2] font-mono">
            {/* Line Numbers Column */}
            <div
              className="py-4 pl-3 pr-2 text-right select-none bg-[#181818] border-r-2 border-[#333333] text-neutral-500 font-mono"
              style={{ fontSize: `${fontSize}px`, lineHeight: "1.5" }}
            >
              {lineNumbers.map((n) => (
                <div key={n} className="leading-[1.5]">
                  {n}
                </div>
              ))}
            </div>

            {/* Code Textarea */}
            <div className="flex-1 relative flex">
              <textarea
                ref={textareaRef}
                value={code}
                onChange={(e) => setCode(e.target.value)}
                onKeyDown={handleKeyDown}
                spellCheck={false}
                placeholder="Write or paste your code here..."
                style={{
                  fontSize: `${fontSize}px`,
                  lineHeight: "1.5",
                  tabSize: 4,
                }}
                className="w-full h-full p-4 bg-transparent text-[#00f0ff] font-mono resize-none outline-none leading-[1.5] selection:bg-[#ffe600] selection:text-black caret-[#ffe600]"
              />
            </div>
          </div>

          {/* Editor Footer / Status Bar */}
          <div className="bg-[#f0ede6] border-t-[2.5px] border-black px-4 py-1.5 flex items-center justify-between text-xs font-bold font-mono text-neutral-700">
            <div className="flex items-center gap-4">
              <span>LANG: {selectedLanguage.label.toUpperCase()}</span>
              <span>LINES: {lineCount}</span>
              <span>CHARS: {code.length}</span>
            </div>
            <div className="hidden sm:flex items-center gap-1.5 text-[11px] text-neutral-500">
              <Keyboard className="w-3.5 h-3.5" />
              <span>Tab = 4 spaces</span>
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
                  <span>OUTPUT</span>
                </div>
              </button>

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
              {activeTab === "output" && result && (
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
                onClick={() => setResult(null)}
                title="Clear Output"
                className="neo-btn bg-white hover:bg-neutral-100 p-1.5 text-xs"
              >
                <Trash2 className="w-3.5 h-3.5 stroke-[2.5]" />
              </button>
            </div>
          </div>

          {/* Output Content Area */}
          <div className="flex-1 flex flex-col p-4 bg-[#fffdfa] overflow-auto min-h-[450px] lg:min-h-[580px]">
            {/* TAB 1: TERMINAL OUTPUT */}
            {activeTab === "output" && (
              <div className="flex-1 flex flex-col gap-3">
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

                  {result && (result.time || result.memory) && (
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

                {/* Console Output Screen */}
                <div className="flex-1 flex flex-col gap-3 font-mono text-sm">
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

                  {/* Initial Empty State */}
                  {!result && (
                    <div className="flex-1 flex flex-col items-center justify-center text-center p-8 border-2 border-dashed border-neutral-300 rounded-lg text-neutral-500 gap-3 my-auto">
                      <div className="w-12 h-12 rounded-xl bg-[#ffe600] border-2 border-black flex items-center justify-center text-black shadow-[3px_3px_0px_#000]">
                        <Play className="w-6 h-6 fill-black ml-0.5" />
                      </div>
                      <div>
                        <p className="font-black text-black text-base">
                          No output yet
                        </p>
                        <p className="text-xs font-semibold text-neutral-600 max-w-xs mt-1">
                          Click &quot;RUN CODE&quot; or press{" "}
                          <kbd className="bg-neutral-200 px-1 py-0.5 rounded border border-black text-black">
                            Ctrl+Enter
                          </kbd>{" "}
                          to execute your program.
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* TAB 2: STDIN INPUT */}
            {activeTab === "stdin" && (
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
              <div className="flex-1 flex flex-col gap-4 text-xs">
                <div className="neo-box-sm bg-[#ffe600] p-3">
                  <h3 className="font-black text-sm uppercase text-black">
                    ⚡ DEVNIX ENGINE & JUDGE0
                  </h3>
                  <p className="font-bold text-neutral-800 mt-1">
                    Powered by high-performance Judge0 Community Edition runner
                    with multi-language isolation sandbox.
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-2 font-mono">
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
                      VERSION
                    </span>
                    <span className="font-bold text-sm text-black">
                      {selectedLanguage.version}
                    </span>
                  </div>
                  <div className="neo-box-sm bg-white p-2.5">
                    <span className="text-[10px] text-neutral-500 block font-bold">
                      LANGUAGE ID
                    </span>
                    <span className="font-bold text-sm text-black">
                      #{selectedLanguage.id}
                    </span>
                  </div>
                  <div className="neo-box-sm bg-white p-2.5">
                    <span className="text-[10px] text-neutral-500 block font-bold">
                      DEFAULT TIMEOUT
                    </span>
                    <span className="font-bold text-sm text-black">5.0s</span>
                  </div>
                </div>

                <div className="neo-box-sm bg-white p-3 space-y-2">
                  <h4 className="font-black uppercase text-black text-xs">
                    Keyboard Shortcuts
                  </h4>
                  <div className="space-y-1 font-mono text-[11px]">
                    <div className="flex justify-between">
                      <span className="text-neutral-600">Run Program:</span>
                      <kbd className="bg-neutral-100 border border-black px-1.5 py-0.5 rounded font-bold">
                        Ctrl + Enter
                      </kbd>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-neutral-600">Insert Indentation:</span>
                      <kbd className="bg-neutral-100 border border-black px-1.5 py-0.5 rounded font-bold">
                        Tab
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
              <span className="w-2 h-2 rounded-full bg-[#22c55e] inline-block animate-pulse" />
              <span>JUDGE0 SERVER: 2358</span>
            </span>
            <span className="text-[11px] text-neutral-500">DEVNIX v1.0</span>
          </div>
        </div>
      </div>
    </div>
  );
}
