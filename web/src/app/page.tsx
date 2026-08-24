"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
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
  FileCode2,
  Keyboard,
  ChevronDown,
  Palette,
  AlignLeft,
  Eye,
  EyeOff,
  Square,
  Radio,
  Layers,
  CornerDownLeft,
  Code2,
  Sparkles,
  Search,
  X,
  User,
  ShieldCheck,
  LogOut,
  Settings,
  ArrowRight,
  GripVertical,
} from "lucide-react";
import { AuthModal } from "@/components/AuthModal";
import { AuthGateway } from "@/components/AuthGateway";
import { MustResetPasswordModal } from "@/components/MustResetPasswordModal";
import { ProfileView } from "@/components/ProfileView";
import { AdminView } from "@/components/AdminView";
import { AiAssistantPanel } from "@/components/AiAssistantPanel";
import { SafeUser } from "@/lib/auth";
import { formatCodeUniversal } from "@/lib/codeFormatter";

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
  dotColor: string;
}

const THEMES: EditorTheme[] = [
  { id: "vs-dark", name: "VS Code Dark+", dotColor: "#1e1e1e" },
  { id: "light", name: "VS Code Light+", dotColor: "#ffffff" },
  { id: "hc-black", name: "High Contrast Dark", dotColor: "#000000" },
  { id: "hc-light", name: "High Contrast Light", dotColor: "#f3f3f3" },
  { id: "devnix-cyberpunk", name: "⚡ Devnix Cyberpunk", dotColor: "#00f0ff" },
  { id: "devnix-monokai", name: "🎨 Monokai Pro", dotColor: "#ffd866" },
  { id: "devnix-nord", name: "❄️ Nord Arctic", dotColor: "#88c0d0" },
];

interface ToastNotification {
  id: string;
  type: "error" | "warning" | "success" | "info";
  title: string;
  message?: string;
}

export default function DevnixStudio() {
  const [availableLanguages, setAvailableLanguages] = useState<Language[]>(SUPPORTED_LANGUAGES);
  const [selectedLanguage, setSelectedLanguage] = useState<Language>(
    SUPPORTED_LANGUAGES[0]
  );
  const selectedLanguageRef = useRef<Language>(SUPPORTED_LANGUAGES[0]);

  // Toast notification state (Max 2 with smooth animations)
  const [toasts, setToasts] = useState<ToastNotification[]>([]);
  const [exitingToastIds, setExitingToastIds] = useState<Set<string>>(new Set());

  const dismissToast = (id: string) => {
    setExitingToastIds((prev) => new Set(prev).add(id));
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
      setExitingToastIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }, 280);
  };

  const showToast = (type: "error" | "warning" | "success" | "info", title: string, message?: string) => {
    const id = `toast_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    // Keep max 2 active toasts (take the last 1, append new 1)
    setToasts((prev) => [...prev.slice(-1), { id, type, title, message }]);
    setTimeout(() => {
      dismissToast(id);
    }, 4000);
  };

  // Keep ref continuously synchronized
  useEffect(() => {
    selectedLanguageRef.current = selectedLanguage;
  }, [selectedLanguage]);
  const [code, setCode] = useState<string>(SUPPORTED_LANGUAGES[0].defaultCode);
  const [stdin, setStdin] = useState<string>("");
  const [executionMode, setExecutionMode] = useState<"interactive" | "batch">("interactive");
  const [activeTab, setActiveTab] = useState<"output" | "stdin">("output");
  const [fontSize, setFontSize] = useState<number>(14);
  const [currentTheme, setCurrentTheme] = useState<string>("vs-dark");
  const [showMinimap, setShowMinimap] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isProcessRunning, setIsProcessRunning] = useState<boolean>(false);
  const [isFormatting, setIsFormatting] = useState<boolean>(false);
  const [result, setResult] = useState<ExecutionResult | null>(null);
  
  // User Authentication & Top Views
  const [currentUser, setCurrentUser] = useState<SafeUser | null>(null);
  const [activeView, setActiveView] = useState<"editor" | "profile" | "admin">("editor");
  const [isAuthModalOpen, setIsAuthModalOpen] = useState<boolean>(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState<boolean>(false);
  const [isAiPanelOpen, setIsAiPanelOpen] = useState<boolean>(false);
  const [selfSignupEnabled, setSelfSignupEnabled] = useState<boolean>(true);
  const [isSetupNeeded, setIsSetupNeeded] = useState<boolean>(false);
  const [isCheckingAuth, setIsCheckingAuth] = useState<boolean>(true);
  const userMenuRef = useRef<HTMLDivElement>(null);

  const fetchCurrentUser = async () => {
    try {
      const res = await fetch("/api/auth/me");
      if (res.ok) {
        const data = await res.json();
        setCurrentUser(data.user || null);
        setIsSetupNeeded(Boolean(data.isSetupNeeded));
        if (data.selfSignupEnabled !== undefined) {
          setSelfSignupEnabled(data.selfSignupEnabled);
        }
      }
    } catch {} finally {
      setIsCheckingAuth(false);
    }
  };

  useEffect(() => {
    fetchCurrentUser();
  }, []);

  const handleLogout = async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      setCurrentUser(null);
      setActiveView("editor");
      setIsUserMenuOpen(false);
      showToast("info", "Signed Out", "You have been signed out.");
    } catch {}
  };

  const handleStopImpersonation = async () => {
    try {
      const res = await fetch("/api/admin/impersonate", { method: "DELETE" });
      const data = await res.json();
      if (res.ok) {
        setCurrentUser(data.adminUser || null);
        showToast("success", "Returned to Admin", data.message || "Admin session restored.");
        fetchCurrentUser();
      }
    } catch {}
  };

  // Custom dropdown open states
  const [isLangOpen, setIsLangOpen] = useState<boolean>(false);
  const [isThemeOpen, setIsThemeOpen] = useState<boolean>(false);
  const [langSearch, setLangSearch] = useState<string>("");

  // Real-time terminal state
  const [terminalLogs, setTerminalLogs] = useState<Array<{ type: "stdout" | "stderr" | "input"; text: string }>>([]);
  const [realtimeInput, setRealtimeInput] = useState<string>("");
  const [currentSessionId, setCurrentSessionId] = useState<string>("");

  const [copiedCode, setCopiedCode] = useState<boolean>(false);
  const [copiedOutput, setCopiedOutput] = useState<boolean>(false);

  const editorRef = useRef<any>(null);
  const monacoRef = useRef<any>(null);
  const terminalEndRef = useRef<HTMLDivElement>(null);
  const realtimeInputRef = useRef<HTMLInputElement>(null);
  const langDropdownRef = useRef<HTMLDivElement>(null);
  const themeDropdownRef = useRef<HTMLDivElement>(null);
  const langSearchInputRef = useRef<HTMLInputElement>(null);

  // Click outside listener for custom dropdowns
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (langDropdownRef.current && !langDropdownRef.current.contains(event.target as Node)) {
        setIsLangOpen(false);
      }
      if (themeDropdownRef.current && !themeDropdownRef.current.contains(event.target as Node)) {
        setIsThemeOpen(false);
      }
      if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
        setIsUserMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const isSwitchingLanguageRef = useRef<boolean>(false);
  const activeTraceDecorationsRef = useRef<string[]>([]);

  // Live Visual Trace Line Highlighter in Monaco Editor
  const handleHighlightTraceLine = useCallback((lineNumber?: number | null) => {
    if (!editorRef.current || !monacoRef.current) return;
    const editor = editorRef.current;
    const monaco = monacoRef.current;

    const currentEditorCode = editor.getValue();
    const lineCount = currentEditorCode ? currentEditorCode.split("\n").length : 0;

    // Strict Guard: If editor has no code or lineNumber is invalid / out of bounds, clear highlight immediately!
    if (!currentEditorCode.trim() || !lineNumber || lineNumber < 1 || lineNumber > lineCount) {
      activeTraceDecorationsRef.current = editor.deltaDecorations(
        activeTraceDecorationsRef.current,
        []
      );
      return;
    }

    try {
      editor.revealLineInCenter(lineNumber, 0);

      const newDecorations = [
        {
          range: new monaco.Range(lineNumber, 1, lineNumber, 1),
          options: {
            isWholeLine: true,
            className: "devnix-trace-active-line",
            glyphMarginClassName: "devnix-trace-glyph-marker",
            overviewRuler: {
              color: "#ffe600",
              position: monaco.editor.OverviewRulerLane.Full,
            },
            minimap: {
              color: "#00f0ff",
              position: monaco.editor.MinimapPosition.Inline,
            },
          },
        },
      ];

      activeTraceDecorationsRef.current = editor.deltaDecorations(
        activeTraceDecorationsRef.current,
        newDecorations
      );
    } catch {}
  }, []);

  // Split Resizers State for 2-panel and 3-panel mode
  const [editorSplitPercent, setEditorSplitPercent] = useState<number>(58);
  const [panel1Percent, setPanel1Percent] = useState<number>(38);
  const [panel2Percent, setPanel2Percent] = useState<number>(32);
  const [activeDraggingResizer, setActiveDraggingResizer] = useState<1 | 2 | null>(null);
  const activeDraggingResizerRef = useRef<1 | 2 | null>(null);
  const workspaceContainerRef = useRef<HTMLDivElement>(null);

  // Load saved split percent on mount
  useEffect(() => {
    try {
      const savedSplit = localStorage.getItem("devnix_editor_split");
      if (savedSplit) {
        const num = Number(savedSplit);
        if (!isNaN(num) && num >= 25 && num <= 75) setEditorSplitPercent(num);
      }
      const savedP1 = localStorage.getItem("devnix_panel1_width");
      if (savedP1) {
        const num = Number(savedP1);
        if (!isNaN(num) && num >= 20 && num <= 60) setPanel1Percent(num);
      }
      const savedP2 = localStorage.getItem("devnix_panel2_width");
      if (savedP2) {
        const num = Number(savedP2);
        if (!isNaN(num) && num >= 20 && num <= 50) setPanel2Percent(num);
      }
      const savedAiOpen = localStorage.getItem("devnix_ai_panel_open");
      if (savedAiOpen !== null) {
        setIsAiPanelOpen(savedAiOpen === "true");
      }
    } catch {}
  }, []);

  const handleToggleAiPanel = () => {
    setIsAiPanelOpen((prev) => {
      const next = !prev;
      try {
        localStorage.setItem("devnix_ai_panel_open", String(next));
      } catch {}
      return next;
    });
  };

  const handleResizer1MouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    activeDraggingResizerRef.current = 1;
    setActiveDraggingResizer(1);
    document.body.style.userSelect = "none";
    document.body.style.cursor = "col-resize";
  };

  const handleResizer2MouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    activeDraggingResizerRef.current = 2;
    setActiveDraggingResizer(2);
    document.body.style.userSelect = "none";
    document.body.style.cursor = "col-resize";
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      const dragging = activeDraggingResizerRef.current;
      if (!dragging || !workspaceContainerRef.current) return;
      const rect = workspaceContainerRef.current.getBoundingClientRect();
      const rawPercent = ((e.clientX - rect.left) / rect.width) * 100;

      if (dragging === 1) {
        if (!isAiPanelOpen) {
          const clamped = Math.max(25, Math.min(75, rawPercent));
          setEditorSplitPercent(clamped);
        } else {
          // Panel 1 min 22%, max 58% (strictly reserves min 20% for Terminal and 22% for AI)
          const newP1 = Math.max(22, Math.min(58, rawPercent));
          setPanel1Percent(newP1);
          const maxAllowedP2 = 100 - newP1 - 22;
          if (panel2Percent > maxAllowedP2) {
            setPanel2Percent(Math.max(20, maxAllowedP2));
          }
        }
      } else if (dragging === 2) {
        // Dragging boundary between Panel 2 & Panel 3 (P1 + P2 = rawPercent)
        // Strictly guarantees Panel 3 receives at least 22% and never overflows
        const maxAllowedP2 = 100 - panel1Percent - 22;
        const targetP2 = rawPercent - panel1Percent;
        const newP2 = Math.max(20, Math.min(maxAllowedP2, targetP2));
        setPanel2Percent(newP2);
      }
    };

    const handleMouseUp = () => {
      if (activeDraggingResizerRef.current) {
        activeDraggingResizerRef.current = null;
        setActiveDraggingResizer(null);
        document.body.style.userSelect = "";
        document.body.style.cursor = "";
        try {
          localStorage.setItem("devnix_editor_split", String(editorSplitPercent));
          localStorage.setItem("devnix_panel1_width", String(panel1Percent));
          localStorage.setItem("devnix_panel2_width", String(panel2Percent));
        } catch {}
      }
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [editorSplitPercent, panel1Percent, panel2Percent, isAiPanelOpen]);

  // Load saved preferences and language-wise code on client mount
  useEffect(() => {
    isSwitchingLanguageRef.current = true;
    try {
      const savedLangId = localStorage.getItem("devnix_selected_lang_id");
      const savedTheme = localStorage.getItem("devnix_theme");
      const savedMode = localStorage.getItem("devnix_mode");

      if (savedTheme) setCurrentTheme(savedTheme);
      if (savedMode === "interactive" || savedMode === "batch") setExecutionMode(savedMode);

      if (savedLangId) {
        const lang = SUPPORTED_LANGUAGES.find((l) => l.id === Number(savedLangId));
        if (lang) {
          setSelectedLanguage(lang);
          selectedLanguageRef.current = lang;
          const savedCode = localStorage.getItem(`devnix_code_${lang.id}`);
          const codeToSet = savedCode !== null ? savedCode : lang.defaultCode;
          setCode(codeToSet);
          if (editorRef.current) {
            editorRef.current.setValue(codeToSet);
          }
          const savedStdin = localStorage.getItem(`devnix_stdin_${lang.id}`);
          if (savedStdin !== null) {
            setStdin(savedStdin);
          }
        }
      } else {
        const savedCode = localStorage.getItem(`devnix_code_${SUPPORTED_LANGUAGES[0].id}`);
        if (savedCode !== null) {
          setCode(savedCode);
          if (editorRef.current) {
            editorRef.current.setValue(savedCode);
          }
        }
      }
    } catch {}
    setTimeout(() => {
      isSwitchingLanguageRef.current = false;
    }, 150);
  }, []);

  // Fetch dynamic languages from Judge0 API on mount
  useEffect(() => {
    fetch("/api/languages")
      .then((res) => res.json())
      .then((data) => {
        if (data?.languages?.length) {
          setAvailableLanguages(data.languages);
          setSelectedLanguage((prev) => {
            const updated = data.languages.find((l: Language) => l.id === prev.id);
            if (updated) {
              selectedLanguageRef.current = updated;
            }
            return updated || prev;
          });
        }
      })
      .catch(() => {});
  }, []);

  // Auto-scroll terminal
  useEffect(() => {
    if (terminalEndRef.current) {
      terminalEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [terminalLogs]);

  // Handle Code Change with Auto-Save
  const handleCodeChange = (newCode: string) => {
    setCode(newCode);
    if (isSwitchingLanguageRef.current) return;
    try {
      const activeId = selectedLanguageRef.current?.id || selectedLanguage.id;
      localStorage.setItem(`devnix_code_${activeId}`, newCode);
    } catch {}
  };

  // Handle Stdin Change with Auto-Save
  const handleStdinChange = (newStdin: string) => {
    setStdin(newStdin);
    if (isSwitchingLanguageRef.current) return;
    try {
      const activeId = selectedLanguageRef.current?.id || selectedLanguage.id;
      localStorage.setItem(`devnix_stdin_${activeId}`, newStdin);
    } catch {}
  };

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
    monacoRef.current = monaco;
    if (code) {
      editor.setValue(code);
    }
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter, () => {
      handleRun();
    });

    // Register universal formatting providers for all supported languages
    availableLanguages.forEach((lang) => {
      try {
        monaco.languages.registerDocumentFormattingEditProvider(lang.monacoLang, {
          provideDocumentFormattingEdits(model: any) {
            const raw = model.getValue();
            const formatted = formatCodeUniversal(raw, lang.name || lang.monacoLang);
            return [
              {
                range: model.getFullModelRange(),
                text: formatted,
              },
            ];
          },
        });
      } catch {}
    });
  };

  // Language Switch with per-language code restoration & Monaco buffer sync
  const handleLanguageChange = (lang: Language) => {
    isSwitchingLanguageRef.current = true;
    setSelectedLanguage(lang);
    selectedLanguageRef.current = lang;
    let targetCode = lang.defaultCode;
    try {
      localStorage.setItem("devnix_selected_lang_id", String(lang.id));
      const savedCode = localStorage.getItem(`devnix_code_${lang.id}`);
      targetCode = savedCode !== null ? savedCode : lang.defaultCode;

      const savedStdin = localStorage.getItem(`devnix_stdin_${lang.id}`);
      setStdin(savedStdin !== null ? savedStdin : "");
    } catch {}

    setCode(targetCode);
    if (editorRef.current) {
      editorRef.current.setValue(targetCode);
    }

    setResult(null);
    setTerminalLogs([]);
    setIsLangOpen(false);

    setTimeout(() => {
      isSwitchingLanguageRef.current = false;
    }, 100);
  };

  const handleThemeChange = (themeId: string) => {
    setCurrentTheme(themeId);
    try {
      localStorage.setItem("devnix_theme", themeId);
    } catch {}
    setIsThemeOpen(false);
  };

  const handleModeChange = (mode: "interactive" | "batch") => {
    setExecutionMode(mode);
    try {
      localStorage.setItem("devnix_mode", mode);
    } catch {}
  };

  const handleResetCode = () => {
    isSwitchingLanguageRef.current = true;
    const activeLang = selectedLanguageRef.current || selectedLanguage;
    const defaultCode = activeLang.defaultCode;
    setCode(defaultCode);
    if (editorRef.current) {
      editorRef.current.setValue(defaultCode);
    }
    try {
      localStorage.setItem(`devnix_code_${activeLang.id}`, defaultCode);
    } catch {}
    showToast("info", "Template Reset", `Restored default ${activeLang.label} code.`);
    setTimeout(() => {
      isSwitchingLanguageRef.current = false;
    }, 100);
  };

  const handleFormatCode = () => {
    if (!editorRef.current) return;
    const editor = editorRef.current;
    const currentCode = editor.getValue();
    if (!currentCode || !currentCode.trim()) {
      showToast("info", "Empty Code", "Write or paste some code first to format.");
      return;
    }

    const activeLang = selectedLanguageRef.current || selectedLanguage;
    const formatted = formatCodeUniversal(currentCode, activeLang.name || activeLang.monacoLang);

    if (formatted !== currentCode) {
      const model = editor.getModel();
      if (model) {
        editor.executeEdits("devnix-formatter", [
          {
            range: model.getFullModelRange(),
            text: formatted,
          },
        ]);
        editor.pushUndoStop();
      } else {
        editor.setValue(formatted);
      }
      setCode(formatted);
      try {
        localStorage.setItem(`devnix_code_${activeLang.id}`, formatted);
      } catch {}
      setIsFormatting(true);
      setTimeout(() => setIsFormatting(false), 1200);
      showToast("success", "Code Formatted", `Formatted ${activeLang.label} successfully.`);
    } else {
      setIsFormatting(true);
      setTimeout(() => setIsFormatting(false), 800);
      showToast("info", "Already Formatted", `${activeLang.label} code is already clean.`);
    }
  };

  const safeCopyToClipboard = async (text: string) => {
    if (!text) return;
    try {
      if (typeof navigator !== "undefined" && navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(text);
        return true;
      }
    } catch {}

    // Fallback for LAN IP / non-secure contexts
    try {
      const textArea = document.createElement("textarea");
      textArea.value = text;
      textArea.style.position = "fixed";
      textArea.style.left = "-999999px";
      textArea.style.top = "-999999px";
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();
      const successful = document.execCommand("copy");
      document.body.removeChild(textArea);
      return successful;
    } catch {
      return false;
    }
  };

  const handleCopyCode = async () => {
    const codeToCopy = editorRef.current ? editorRef.current.getValue() : code;
    if (codeToCopy) {
      await safeCopyToClipboard(codeToCopy);
      setCopiedCode(true);
      showToast("success", "Code Copied", "Source code copied to clipboard.");
      setTimeout(() => setCopiedCode(false), 2000);
    }
  };

  const handleCopyOutput = async () => {
    let textToCopy = "";
    if (executionMode === "interactive") {
      textToCopy = terminalLogs.map((l) => l.text).join("");
    } else {
      textToCopy =
        (result?.stdout || "") +
        (result?.stderr ? (result.stdout ? "\n" : "") + result.stderr : "") +
        (result?.compile_output ? "\n" + result.compile_output : "");
    }
    if (textToCopy.trim()) {
      await safeCopyToClipboard(textToCopy);
      setCopiedOutput(true);
      showToast("success", "Output Copied", "Console output copied to clipboard.");
      setTimeout(() => setCopiedOutput(false), 2000);
    }
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

    const activeLang = selectedLanguageRef.current || selectedLanguage;
    const sessionId = `sess_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    setCurrentSessionId(sessionId);
    setIsProcessRunning(true);
    setIsLoading(true);
    setActiveTab("output");
    setTerminalLogs([]);

    const codeToRun = editorRef.current ? editorRef.current.getValue() : code;

    try {
      const response = await fetch("/api/execute/interactive", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId,
          language_id: activeLang.id,
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
              if (data.type === "stdout" || data.type === "stderr") {
                setTerminalLogs((prev) => [...prev, data]);
                if (data.type === "stderr" && data.text.trim()) {
                  showToast("error", "Execution Error", data.text.trim().substring(0, 100));
                }
              }
              if (data.type === "exit") {
                setIsProcessRunning(false);
                if (data.code !== 0) {
                  showToast("error", "Process Exited with Error", `Exit code ${data.code}`);
                }
              }
            } catch {}
          }
        }
      }
    } catch (err: any) {
      setTerminalLogs((prev) => [
        ...prev,
        { type: "stderr", text: `\nError: ${err.message}\n` },
      ]);
      showToast("error", "Execution Failed", err.message);
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
      showToast("error", "Input Error", err.message);
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
      showToast("warning", "Process Stopped", "Interactive execution terminated.");
    } catch {}
  };

  // 2. Batch Mode
  const runBatchCode = async () => {
    if (isLoading) return;
    const activeLang = selectedLanguageRef.current || selectedLanguage;
    setIsLoading(true);
    setActiveTab("output");
    setResult({
      status: { id: 2, description: "Running..." },
    });

    const codeToRun = editorRef.current ? editorRef.current.getValue() : code;

    try {
      const response = await fetch("/api/execute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          language_id: activeLang.id,
          source_code: codeToRun,
          stdin: stdin,
        }),
      });

      const data = await response.json();
      setResult(data);

      if (data.status?.id !== 3) {
        showToast(
          "error",
          data.status?.description || "Compilation Error",
          (data.stderr || data.compile_output || data.message || "Execution failed").substring(0, 100)
        );
      }
    } catch (err: any) {
      setResult({
        status: { id: 13, description: "Execution Error" },
        stderr: err.message || "Failed to communicate with execution server.",
      });
      showToast("error", "Server Error", err.message);
    } finally {
      setIsLoading(false);
    }
  };

  // 1. Initial Checking Authentication Screen
  if (isCheckingAuth) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-[#f6f3eb]">
        <div className="p-6 neo-box-lg bg-white flex items-center gap-3 border-[3px] border-black shadow-[6px_6px_0px_#000]">
          <span className="w-4 h-4 rounded-full bg-[#ffe600] animate-ping" />
          <span className="font-black text-sm uppercase tracking-wide">Authenticating Devnix...</span>
        </div>
      </div>
    );
  }

  // 2. Mandatory Auth Gateway if not authenticated (Blocks all access to code editor & terminal)
  if (!currentUser) {
    return (
      <>
        <AuthGateway
          isSetupNeeded={isSetupNeeded}
          selfSignupEnabled={selfSignupEnabled}
          onSuccess={(user) => {
            setCurrentUser(user);
            setIsSetupNeeded(false);
          }}
          showToast={showToast}
        />

        {/* 🔔 Right-Side Corner Neobrutalist Toast Notification Stack */}
        <div className="fixed top-4 right-4 z-50 flex flex-col gap-2.5 pointer-events-none max-w-sm w-full">
          {toasts.map((toast) => {
            const isExiting = exitingToastIds.has(toast.id);
            return (
              <div
                key={toast.id}
                className={`pointer-events-auto border-[2.5px] border-black rounded-lg p-3 shadow-[4px_4px_0px_#000] flex items-start justify-between gap-2.5 transition-all ${
                  isExiting ? "neo-toast-exit" : "neo-toast-enter"
                } ${
                  toast.type === "error"
                    ? "bg-[#ff5277] text-white"
                    : toast.type === "warning"
                    ? "bg-[#ffe600] text-black font-bold"
                    : toast.type === "success"
                    ? "bg-[#22c55e] text-black font-bold"
                    : "bg-[#00f0ff] text-black font-bold"
                }`}
              >
                <div className="flex flex-col gap-0.5 min-w-0 flex-1">
                  <span className="font-black text-xs uppercase tracking-wide truncate">{toast.title}</span>
                  {toast.message && (
                    <span className="text-[11px] font-mono leading-tight opacity-95 line-clamp-2 break-words">
                      {toast.message}
                    </span>
                  )}
                </div>
                <button
                  onClick={() => dismissToast(toast.id)}
                  className="text-current opacity-70 hover:opacity-100 p-0.5 shrink-0 transition-opacity"
                >
                  <X className="w-3.5 h-3.5 stroke-[3]" />
                </button>
              </div>
            );
          })}
        </div>
      </>
    );
  }

  return (
    <div className="h-screen max-h-screen flex flex-col p-2.5 md:p-3 max-w-[1720px] mx-auto gap-2.5 overflow-hidden">
      {/* Impersonation Banner */}
      {currentUser?.impersonatedBy && (
        <div className="shrink-0 bg-[#ff5277] text-white border-2 border-black rounded-xl p-2 px-4 shadow-[3px_3px_0px_#000] flex items-center justify-between z-40 animate-in fade-in">
          <div className="flex items-center gap-2 text-xs font-black">
            <ShieldCheck className="w-4 h-4" />
            <span>
              IMPERSONATING: <u>{currentUser.displayName}</u> (@{currentUser.username})
            </span>
          </div>
          <button
            onClick={handleStopImpersonation}
            className="bg-white text-black border-2 border-black font-black text-xs px-3 py-1 rounded-lg shadow-[2px_2px_0px_#000] hover:bg-neutral-100 cursor-pointer"
          >
            Stop Impersonating
          </button>
        </div>
      )}

      {/* ⚡ 1. CLEAN TOP GLOBAL HEADER (Brand & Profile Only) */}
      <header className="shrink-0 neo-box-lg bg-white p-2.5 px-3 md:px-4 flex items-center justify-between gap-3 relative z-30">
        {/* Left: Brand Logo & Product Name */}
        <div
          onClick={() => setActiveView("editor")}
          className="flex items-center gap-2.5 cursor-pointer select-none"
        >
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
              Online Code Engine & Live Terminal
            </p>
          </div>
        </div>

        {/* Right: User Profile Controls */}
        <div className="flex items-center gap-2.5">

          {currentUser && (
            <div className="relative" ref={userMenuRef}>
              <button
                type="button"
                onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
                className="neo-btn py-1.5 px-3 text-xs font-black flex items-center gap-2 border-2 border-black shadow-[2px_2px_0px_#000] bg-[#ffe600] text-black hover:bg-[#ffd500] cursor-pointer"
              >
                <div className="w-5 h-5 rounded-full bg-black text-white flex items-center justify-center text-[10px] font-black border border-black">
                  {currentUser.displayName.charAt(0).toUpperCase()}
                </div>
                <span className="max-w-[120px] truncate text-black font-black">{currentUser.displayName}</span>
                <ChevronDown
                  className={`w-3.5 h-3.5 stroke-[3] text-black transition-transform ${
                    isUserMenuOpen ? "rotate-180" : ""
                  }`}
                />
              </button>

              {/* User Dropdown Menu */}
              {isUserMenuOpen && (
                <div className="absolute right-0 top-full mt-2 w-52 bg-white border-[2.5px] border-black rounded-xl shadow-[4px_4px_0px_#000] z-50 p-1.5 flex flex-col gap-1 animate-in fade-in slide-in-from-top-2">
                  <div className="p-2 bg-[#f6f3eb] rounded-lg border border-black/20 text-left">
                    <p className="font-black text-xs text-black truncate">{currentUser.displayName}</p>
                    <p className="font-mono text-[10px] text-neutral-500 truncate">@{currentUser.username}</p>
                    <span className="inline-block mt-1 text-[9px] font-mono font-black uppercase px-1.5 py-0.2 rounded border border-black bg-[#ffe600] text-black">
                      {currentUser.isSuperAdmin ? "👑 SUPER ADMIN" : currentUser.role}
                    </span>
                  </div>

                  <button
                    onClick={() => {
                      setActiveView("editor");
                      setIsUserMenuOpen(false);
                    }}
                    className={`w-full text-left p-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2 ${
                      activeView === "editor"
                        ? "bg-[#00f0ff] text-black border border-black shadow-[1.5px_1.5px_0px_#000]"
                        : "hover:bg-neutral-100 text-neutral-800"
                    }`}
                  >
                    <Code2 className="w-3.5 h-3.5 stroke-[2.5]" />
                    <span>Code Studio</span>
                  </button>

                  <button
                    onClick={() => {
                      setActiveView("profile");
                      setIsUserMenuOpen(false);
                    }}
                    className={`w-full text-left p-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2 ${
                      activeView === "profile"
                        ? "bg-[#ffe600] text-black border border-black shadow-[1.5px_1.5px_0px_#000]"
                        : "hover:bg-neutral-100 text-neutral-800"
                    }`}
                  >
                    <User className="w-3.5 h-3.5 stroke-[2.5]" />
                    <span>Profile Settings</span>
                  </button>

                  {currentUser.role === "ADMIN" && (
                    <button
                      onClick={() => {
                        setActiveView("admin");
                        setIsUserMenuOpen(false);
                      }}
                      className={`w-full text-left p-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2 ${
                        activeView === "admin"
                          ? "bg-[#ffe600] text-black border border-black shadow-[1.5px_1.5px_0px_#000]"
                          : "hover:bg-neutral-100 text-neutral-800"
                      }`}
                    >
                      <ShieldCheck className="w-3.5 h-3.5 stroke-[2.5] text-black" />
                      <span>Admin Panel</span>
                    </button>
                  )}

                  <div className="h-[1px] bg-neutral-200 my-0.5" />

                  <button
                    onClick={handleLogout}
                    className="w-full text-left p-2 rounded-lg text-xs font-bold text-red-600 hover:bg-red-50 transition-all flex items-center gap-2 cursor-pointer"
                  >
                    <LogOut className="w-3.5 h-3.5 stroke-[2.5]" />
                    <span>Sign Out</span>
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </header>

      {/* 🚀 DYNAMIC MAIN WORKSPACE / VIEWS */}
      {activeView === "profile" && currentUser ? (
        <ProfileView
          user={currentUser}
          onUpdateUser={setCurrentUser}
          onBack={() => setActiveView("editor")}
          showToast={showToast}
        />
      ) : activeView === "admin" && currentUser?.role === "ADMIN" ? (
        <AdminView
          currentUser={currentUser}
          onBack={() => setActiveView("editor")}
          initialSelfSignupEnabled={selfSignupEnabled}
          onImpersonateSuccess={(targetUser) => {
            setCurrentUser(targetUser);
            setActiveView("editor");
          }}
          showToast={showToast}
        />
      ) : (
        /* 🚀 MAIN SPLIT WORKSPACE: Resizable Split Pane between Editor and Terminal */
        <div
          ref={workspaceContainerRef}
          className="flex-1 flex flex-col lg:flex-row items-stretch gap-0 min-h-0 overflow-hidden relative p-1 pb-1.5"
        >
        {/* ========================================================================= */}
        {/* LEFT COLUMN: MONACO / VS CODE EDITOR                                      */}
        {/* ========================================================================= */}
        <div
          style={{ width: isAiPanelOpen ? `${panel1Percent}%` : `${editorSplitPercent}%` }}
          className={`w-full lg:w-auto flex flex-col neo-box overflow-hidden bg-[#ffffff] h-full min-h-0 min-w-0 shrink-0 box-border ${
            activeDraggingResizer ? "select-none pointer-events-none" : ""
          }`}
        >
          {/* Editor Header Bar with Integrated Language, Theme, and Editor Tools */}
          <div className="shrink-0 bg-[#f0ede6] border-b-[2.5px] border-black p-2 px-3 flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-2 flex-wrap">
              <div className="flex gap-1.5 mr-0.5">
                <div className="w-2.5 h-2.5 rounded-full border border-black bg-[#ff5277]" />
                <div className="w-2.5 h-2.5 rounded-full border border-black bg-[#ffe600]" />
                <div className="w-2.5 h-2.5 rounded-full border border-black bg-[#4ade80]" />
              </div>

              {/* 🌟 Custom Neobrutalist Language Selector */}
              <div className="relative" ref={langDropdownRef}>
                <button
                  type="button"
                  onClick={() => {
                    const nextState = !isLangOpen;
                    setIsLangOpen(nextState);
                    setIsThemeOpen(false);
                    if (nextState) {
                      setTimeout(() => langSearchInputRef.current?.focus(), 50);
                    } else {
                      setLangSearch("");
                    }
                  }}
                  className="neo-btn bg-white hover:bg-neutral-50 py-1 px-2.5 text-xs font-black flex items-center gap-1.5 border-2 border-black shadow-[2px_2px_0px_#000] cursor-pointer"
                >
                  <Code2 className="w-3.5 h-3.5 text-black stroke-[2.5]" />
                  <span>{selectedLanguage.label}</span>
                  <span className="bg-[#ffe600] border border-black text-[9px] px-1 py-0.2 rounded font-mono font-black">
                    {selectedLanguage.version}
                  </span>
                  <ChevronDown
                    className={`w-3 h-3 stroke-[3] transition-transform duration-150 ${
                      isLangOpen ? "rotate-180" : ""
                    }`}
                  />
                </button>

                {/* Custom Neobrutalist Language Menu */}
                {isLangOpen && (
                  <div className="absolute top-full left-0 mt-1.5 w-72 bg-[#fffdfa] border-[2.5px] border-black rounded-xl shadow-[5px_5px_0px_#000] z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-150">
                    {/* 🔍 Premium Neobrutalist Search Bar Header */}
                    <div className="bg-[#f6f3eb] p-2.5 border-b-[2px] border-black">
                      <div className="flex items-center justify-between mb-1.5 px-0.5">
                        <span className="text-[10px] font-black uppercase tracking-wider text-neutral-600">
                          Select Compiler
                        </span>
                        <span className="bg-[#ffe600] text-black border border-black text-[9px] font-black font-mono px-1.5 py-0.5 rounded shadow-[1px_1px_0px_#000]">
                          {availableLanguages.length} RUNTIMES
                        </span>
                      </div>

                      <div className="relative flex items-center">
                        <Search className="w-3.5 h-3.5 absolute left-2.5 text-black pointer-events-none stroke-[2.5]" />
                        <input
                          ref={langSearchInputRef}
                          type="text"
                          value={langSearch}
                          onChange={(e) => setLangSearch(e.target.value)}
                          placeholder="Search (e.g. py, java, c, rust)..."
                          className="w-full bg-white text-black font-mono text-xs font-bold pl-8 pr-7 py-1.5 rounded-lg border-[2px] border-black shadow-[2px_2px_0px_#000] outline-none transition-all placeholder:text-neutral-400 focus:shadow-[3px_3px_0px_#00f0ff]"
                        />
                        {langSearch && (
                          <button
                            type="button"
                            onClick={() => {
                              setLangSearch("");
                              langSearchInputRef.current?.focus();
                            }}
                            className="absolute right-2 text-neutral-400 hover:text-black p-0.5"
                          >
                            <X className="w-3.5 h-3.5 stroke-[2.5]" />
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Filtered Languages List */}
                    <div className="p-1.5 max-h-64 overflow-y-auto space-y-1">
                      {availableLanguages
                        .filter((lang) => {
                          if (!langSearch.trim()) return true;
                          const q = langSearch.toLowerCase();
                          return (
                            lang.label.toLowerCase().includes(q) ||
                            lang.name.toLowerCase().includes(q) ||
                            lang.extension.toLowerCase().includes(q) ||
                            lang.version.toLowerCase().includes(q)
                          );
                        })
                        .map((lang) => {
                          const isSelected = lang.id === selectedLanguage.id;
                          return (
                            <button
                              key={lang.id}
                              onClick={() => {
                                handleLanguageChange(lang);
                                setLangSearch("");
                                setIsLangOpen(false);
                              }}
                              className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all text-left border-[2px] cursor-pointer ${
                                isSelected
                                  ? "bg-[#ffe600] text-black font-black border-black shadow-[2px_2px_0px_#000]"
                                  : "border-transparent hover:border-black hover:bg-[#00f0ff]/25 hover:shadow-[2px_2px_0px_#000] text-neutral-900 bg-white"
                              }`}
                            >
                              <div className="flex items-center gap-2 min-w-0">
                                <span
                                  className="w-2.5 h-2.5 rounded-full border-[1.5px] border-black shrink-0 shadow-[1px_1px_0px_#000]"
                                  style={{ backgroundColor: lang.badgeColor || "#00f0ff" }}
                                />
                                <span className="truncate">{lang.label}</span>
                                <span className="text-[9px] font-mono opacity-60 bg-neutral-100 border border-neutral-300 px-1 rounded">
                                  .{lang.extension}
                                </span>
                              </div>
                              <span className="text-[10px] font-mono font-bold bg-neutral-50 border border-black/40 px-1.5 py-0.5 rounded shadow-[1px_1px_0px_#000] shrink-0 ml-1">
                                {lang.version}
                              </span>
                            </button>
                          );
                        })}
                    </div>
                  </div>
                )}
              </div>

              {/* 🌟 Custom Neobrutalist Theme Selector */}
              <div className="relative" ref={themeDropdownRef}>
                <button
                  type="button"
                  onClick={() => {
                    setIsThemeOpen(!isThemeOpen);
                    setIsLangOpen(false);
                  }}
                  className="neo-btn bg-white hover:bg-neutral-50 py-1 px-2.5 text-xs font-black flex items-center gap-1.5 border-2 border-black shadow-[2px_2px_0px_#000] cursor-pointer"
                >
                  <Palette className="w-3.5 h-3.5 text-neutral-700 stroke-[2.5]" />
                  <span className="max-w-[95px] truncate">
                    {THEMES.find((t) => t.id === currentTheme)?.name || currentTheme}
                  </span>
                  <ChevronDown
                    className={`w-3 h-3 stroke-[3] transition-transform duration-150 ${
                      isThemeOpen ? "rotate-180" : ""
                    }`}
                  />
                </button>

                {/* Custom Neobrutalist Theme Menu */}
                {isThemeOpen && (
                  <div className="absolute top-full left-0 mt-1.5 w-52 bg-white border-[2.5px] border-black rounded-lg shadow-[4px_4px_0px_#000] z-50 p-1.5 max-h-72 overflow-y-auto">
                    <div className="text-[10px] font-black uppercase text-neutral-400 px-2 py-1 border-b border-neutral-200 mb-1">
                      VS Code Theme
                    </div>
                    {THEMES.map((theme) => {
                      const isSelected = theme.id === currentTheme;
                      return (
                        <button
                          key={theme.id}
                          onClick={() => handleThemeChange(theme.id)}
                          className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded text-xs font-bold transition-all text-left mb-0.5 cursor-pointer ${
                            isSelected
                              ? "bg-[#00f0ff] text-black font-black border border-black shadow-[1.5px_1.5px_0px_#000]"
                              : "hover:bg-[#ffe600] hover:text-black text-neutral-800"
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <span
                              className="w-2.5 h-2.5 rounded-full border border-black shadow-[1px_1px_0px_#000]"
                              style={{ backgroundColor: theme.dotColor }}
                            />
                            <span>{theme.name}</span>
                          </div>
                          {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Reset Template */}
              <button
                onClick={handleResetCode}
                title="Reset code template"
                className="neo-btn bg-white hover:bg-neutral-100 p-1 text-xs flex items-center gap-1 cursor-pointer border-2 border-black shadow-[1.5px_1.5px_0px_#000]"
              >
                <RotateCcw className="w-3.5 h-3.5 stroke-[2.5]" />
                <span className="hidden xl:inline font-bold text-[11px]">Reset</span>
              </button>
            </div>

            {/* Editor Quick Tools */}
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setShowMinimap(!showMinimap)}
                title={showMinimap ? "Hide Minimap" : "Show Minimap"}
                className={`neo-btn p-1 text-xs flex items-center gap-1 border-2 border-black shadow-[1.5px_1.5px_0px_#000] cursor-pointer ${
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
                title="Format Code (Shift+Alt+F)"
                className={`neo-btn p-1 text-xs flex items-center gap-1 border-2 border-black shadow-[1.5px_1.5px_0px_#000] cursor-pointer transition-colors ${
                  isFormatting
                    ? "bg-[#22c55e] text-black font-black"
                    : "bg-white hover:bg-neutral-100"
                }`}
              >
                {isFormatting ? (
                  <Check className="w-3 h-3 stroke-[3]" />
                ) : (
                  <AlignLeft className="w-3 h-3 stroke-[2.5]" />
                )}
                <span className="text-[10px] font-bold hidden sm:inline">
                  {isFormatting ? "Formatted!" : "Format"}
                </span>
              </button>

              <div className="flex items-center gap-1 bg-white border-2 border-black px-1.5 py-0.5 rounded text-[11px] font-bold shadow-[1.5px_1.5px_0px_#000]">
                <span className="text-[9px] text-neutral-500 font-black">SIZE:</span>
                <button
                  onClick={() => setFontSize(Math.max(12, fontSize - 1))}
                  className="hover:text-[#ff5277] px-0.5 font-mono font-black cursor-pointer"
                >
                  -
                </button>
                <span className="font-mono text-[11px]">{fontSize}</span>
                <button
                  onClick={() => setFontSize(Math.min(24, fontSize + 1))}
                  className="hover:text-[#ff5277] px-0.5 font-mono font-black cursor-pointer"
                >
                  +
                </button>
              </div>

              <button
                onClick={handleCopyCode}
                title="Copy code"
                className="neo-btn bg-white hover:bg-neutral-100 p-1 text-xs flex items-center gap-1 border-2 border-black shadow-[1.5px_1.5px_0px_#000] cursor-pointer"
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
                className="neo-btn bg-white hover:bg-red-50 p-1 text-xs flex items-center gap-1 text-red-600 border-2 border-black shadow-[1.5px_1.5px_0px_#000] cursor-pointer"
              >
                <Trash2 className="w-3 h-3 stroke-[2.5]" />
              </button>
            </div>
          </div>

          {/* Monaco Editor Canvas */}
          <div className="flex-1 min-h-0 relative h-full">
            <MonacoEditor
              height="100%"
              language={selectedLanguage.monacoLang}
              theme={currentTheme}
              value={code}
              onChange={(value) => handleCodeChange(value || "")}
              beforeMount={handleEditorWillMount}
              onMount={handleEditorDidMount}
              options={{
                fontSize: fontSize,
                fontFamily: "var(--font-geist-mono), 'JetBrains Mono', 'Fira Code', Consolas, monospace",
                fontLigatures: true,
                automaticLayout: true,
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

        {/* 🌟 RESIZABLE SPLIT BAR BETWEEN EDITOR AND TERMINAL */}
        <div
          onMouseDown={handleResizer1MouseDown}
          title="Drag left/right to resize Code Editor & Terminal"
          className={`hidden lg:flex w-3.5 cursor-col-resize z-20 shrink-0 items-center justify-center group relative select-none transition-colors mx-0.5 ${
            activeDraggingResizer === 1 ? "bg-[#ffe600]/30" : "hover:bg-[#ffe600]/20"
          }`}
        >
          {/* Center Vertical Divider Line */}
          <div className="w-[2px] h-full bg-black shadow-[1px_0px_0px_#000]" />
          {/* Grip Pill */}
          <div
            className={`absolute w-3.5 h-12 rounded-full border-2 border-black shadow-[1.5px_1.5px_0px_#000] flex items-center justify-center transition-colors ${
              activeDraggingResizer === 1 ? "bg-[#ffe600]" : "bg-white group-hover:bg-[#ffe600]"
            }`}
          >
            <GripVertical className="w-2.5 h-2.5 text-black stroke-[3]" />
          </div>
        </div>

        {/* ========================================================================= */}
        {/* RIGHT COLUMN: CLEAN, SLEEK, MINIMALIST CONSOLE & TERMINAL                 */}
        {/* ========================================================================= */}
        <div
          style={{ width: isAiPanelOpen ? `${panel2Percent}%` : `calc(${100 - editorSplitPercent}% - 6px)` }}
          className={`w-full lg:w-auto flex flex-col neo-box overflow-hidden bg-[#ffffff] border-[2.5px] border-black shadow-[3.5px_3.5px_0px_0px_#000] h-full min-h-0 min-w-0 relative shrink-0 box-border ${
            activeDraggingResizer ? "select-none pointer-events-none" : ""
          }`}
        >
          {/* Terminal Header Bar with Integrated Mode Switcher and Primary RUN Button */}
          <div className="shrink-0 bg-[#f0ede6] border-b-[2.5px] border-black p-2 px-3 flex items-center justify-between gap-2 flex-wrap">
            {/* Left: Terminal Tab & Execution Mode Switcher */}
            <div className="flex items-center gap-2 flex-wrap">
              <div className="flex gap-1.5 mr-0.5">
                <div className="w-2.5 h-2.5 rounded-full border border-black bg-[#ff5277]" />
                <div className="w-2.5 h-2.5 rounded-full border border-black bg-[#ffe600]" />
                <div className="w-2.5 h-2.5 rounded-full border border-black bg-[#22c55e]" />
              </div>

              {/* Execution Mode Switcher */}
              <div className="flex items-center bg-white border-2 border-black p-0.5 rounded-lg shadow-[1.5px_1.5px_0px_#000]">
                <button
                  onClick={() => handleModeChange("interactive")}
                  className={`px-2.5 py-1 text-[11px] font-black rounded-md transition-all flex items-center gap-1 cursor-pointer ${
                    executionMode === "interactive"
                      ? "bg-[#22c55e] text-black shadow-[1px_1px_0px_#000]"
                      : "text-neutral-600 hover:text-black"
                  }`}
                >
                  <Radio className="w-3 h-3" />
                  <span>Real-Time</span>
                </button>

                <button
                  onClick={() => handleModeChange("batch")}
                  className={`px-2.5 py-1 text-[11px] font-black rounded-md transition-all flex items-center gap-1 cursor-pointer ${
                    executionMode === "batch"
                      ? "bg-[#00f0ff] text-black shadow-[1px_1px_0px_#000]"
                      : "text-neutral-600 hover:text-black"
                  }`}
                >
                  <Layers className="w-3 h-3" />
                  <span>Batch</span>
                </button>
              </div>

              {/* Batch Mode Tabs (Output / Stdin) */}
              {executionMode === "batch" && (
                <div className="flex items-center gap-0.5 bg-neutral-200/80 p-0.5 rounded border border-black text-[10px] font-bold">
                  <button
                    onClick={() => setActiveTab("output")}
                    className={`px-2 py-0.5 rounded transition-all cursor-pointer ${
                      activeTab === "output"
                        ? "bg-white text-black shadow-[1px_1px_0px_#000] font-black"
                        : "text-neutral-600 hover:text-black"
                    }`}
                  >
                    Output
                  </button>
                  <button
                    onClick={() => setActiveTab("stdin")}
                    className={`px-2 py-0.5 rounded transition-all cursor-pointer ${
                      activeTab === "stdin"
                        ? "bg-[#ffe600] text-black shadow-[1px_1px_0px_#000] font-black"
                        : "text-neutral-600 hover:text-black"
                    }`}
                  >
                    Stdin {stdin.trim() ? "•" : ""}
                  </button>
                </div>
              )}
            </div>

            {/* Right: Quick Terminal Actions & Primary RUN CODE Button */}
            <div className="flex items-center gap-1.5">
              {isProcessRunning && (
                <span className="flex items-center gap-1 text-[10px] font-mono text-emerald-700 font-black bg-emerald-100 border border-emerald-500 px-1.5 py-0.5 rounded shadow-[1px_1px_0px_#000]">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping" />
                  Running
                </span>
              )}

              <button
                onClick={handleCopyOutput}
                title="Copy output"
                className="neo-btn bg-white hover:bg-neutral-100 p-1.5 text-xs text-neutral-700 border-2 border-black shadow-[1.5px_1.5px_0px_#000] cursor-pointer"
              >
                {copiedOutput ? (
                  <Check className="w-3.5 h-3.5 text-green-600 stroke-[3]" />
                ) : (
                  <Copy className="w-3.5 h-3.5" />
                )}
              </button>

              <button
                onClick={() => {
                  setResult(null);
                  setTerminalLogs([]);
                }}
                title="Clear console"
                className="neo-btn bg-white hover:bg-red-50 text-neutral-700 hover:text-red-600 p-1.5 text-xs border-2 border-black shadow-[1.5px_1.5px_0px_#000] cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>

              {/* Primary Run / Stop Action docked in Terminal Header */}
              {isProcessRunning ? (
                <button
                  onClick={handleStopProcess}
                  className="neo-btn bg-[#ff5277] text-white hover:bg-red-600 px-3.5 py-1 text-xs font-black flex items-center gap-1 border-2 border-black shadow-[2px_2px_0px_#000] cursor-pointer"
                >
                  <Square className="w-3.5 h-3.5 fill-white stroke-[2]" />
                  <span>STOP</span>
                </button>
              ) : (
                <button
                  onClick={handleRun}
                  disabled={isLoading}
                  className="neo-btn bg-[#ffe600] text-black hover:bg-[#ffde59] px-3.5 py-1 text-xs font-black flex items-center gap-1.5 border-2 border-black shadow-[2px_2px_0px_#000] cursor-pointer disabled:opacity-50"
                >
                  <Play
                    className={`w-3.5 h-3.5 stroke-[3] fill-black ${
                      isLoading ? "animate-spin" : ""
                    }`}
                  />
                  <span>{isLoading ? "RUNNING..." : "RUN"}</span>
                  <kbd className="hidden xl:inline-block bg-black text-white text-[8px] font-mono px-1 py-0.2 rounded border border-black">
                    Ctrl+Enter
                  </kbd>
                </button>
              )}
            </div>
          </div>

          {/* Clean Terminal Canvas */}
          <div className="flex-1 min-h-0 flex flex-col p-3 bg-[#13151b] text-[#e2e8f0] font-mono text-xs md:text-[13px] leading-relaxed overflow-hidden">
            {/* TAB 1: OUTPUT */}
            {activeTab === "output" && (
              <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
                {/* 1A. REAL-TIME STREAMING VIEW */}
                {executionMode === "interactive" ? (
                  <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
                    {/* Log Stream */}
                    <div className="flex-1 min-h-0 overflow-y-auto space-y-1 pr-1 selection:bg-[#ffe600] selection:text-black">
                      {terminalLogs.length === 0 ? (
                        <div className="h-full flex items-center justify-center text-center text-neutral-500 text-xs font-mono">
                          <span>Console ready. Click <strong className="text-neutral-300">Run Code</strong> to execute.</span>
                        </div>
                      ) : (
                        terminalLogs.map((log, idx) => {
                          if (log.type === "input") {
                            return (
                              <div key={idx} className="text-[#38bdf8] font-bold">
                                <span>{log.text}</span>
                              </div>
                            );
                          } else if (log.type === "stderr") {
                            return (
                              <div key={idx} className="text-[#f87171] whitespace-pre-wrap">
                                {log.text}
                              </div>
                            );
                          } else {
                            return (
                              <div key={idx} className="text-[#f1f5f9] whitespace-pre-wrap">
                                {log.text}
                              </div>
                            );
                          }
                        })
                      )}
                      <div ref={terminalEndRef} />
                    </div>

                    {/* Minimalist Command Input Line */}
                    <form
                      onSubmit={handleSendRealtimeInput}
                      className="shrink-0 mt-2 pt-2 border-t border-neutral-800 flex items-center gap-2"
                    >
                      <span className="text-[#38bdf8] font-bold select-none text-sm">
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
                            : "Waiting for code to run..."
                        }
                        className="flex-1 bg-transparent text-white font-mono text-xs md:text-sm outline-none placeholder:text-neutral-600 disabled:opacity-40"
                      />
                      {isProcessRunning && realtimeInput.trim() && (
                        <button
                          type="submit"
                          className="text-[11px] bg-[#38bdf8] text-black font-bold px-2 py-0.5 rounded hover:bg-cyan-300 flex items-center gap-1"
                        >
                          <span>Send</span>
                          <CornerDownLeft className="w-3 h-3" />
                        </button>
                      )}
                    </form>
                  </div>
                ) : (
                  /* 1B. BATCH OUTPUT VIEW */
                  <div className="flex-1 min-h-0 flex flex-col gap-2 overflow-y-auto pr-1">
                    {/* Clean Status Pill */}
                    {result && (
                      <div className="shrink-0 flex items-center justify-between text-[11px] text-neutral-400 pb-1.5 border-b border-neutral-800">
                        <span className={`font-bold ${result.status?.id === 3 ? "text-emerald-400" : "text-red-400"}`}>
                          ● {result.status?.description || "Executed"}
                        </span>
                        <div className="flex items-center gap-3 text-neutral-400 font-mono">
                          {result.time && <span>{result.time}s</span>}
                          {result.memory && <span>{result.memory} KB</span>}
                        </div>
                      </div>
                    )}

                    {/* Standard Output */}
                    {result?.stdout && (
                      <div className="whitespace-pre-wrap text-[#f1f5f9]">
                        {result.stdout}
                      </div>
                    )}

                    {/* Standard Error */}
                    {result?.stderr && (
                      <div className="whitespace-pre-wrap text-[#f87171]">
                        {result.stderr}
                      </div>
                    )}

                    {/* Compilation Output */}
                    {result?.compile_output && (
                      <div className="whitespace-pre-wrap text-[#fbbf24]">
                        {result.compile_output}
                      </div>
                    )}

                    {/* Empty State */}
                    {!result && (
                      <div className="h-full flex items-center justify-center text-center text-neutral-500 text-xs font-mono">
                        <span>No output yet. Click <strong className="text-neutral-300">Run Code</strong> to execute.</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* TAB 2: STDIN INPUT (BATCH MODE) */}
            {activeTab === "stdin" && executionMode === "batch" && (
              <div className="flex-1 min-h-0 flex flex-col gap-2">
                <div className="shrink-0 flex items-center justify-between text-[11px] text-neutral-400">
                  <span>Standard Input (one line per input):</span>
                  <button
                    onClick={() => handleStdinChange("")}
                    className="text-red-400 hover:underline"
                  >
                    Clear
                  </button>
                </div>
                <textarea
                  value={stdin}
                  onChange={(e) => handleStdinChange(e.target.value)}
                  placeholder="Paste or type inputs here..."
                  className="w-full flex-1 min-h-0 p-2 bg-[#1a1d26] text-white rounded border border-neutral-700 font-mono text-xs resize-none outline-none focus:border-[#38bdf8]"
                />
              </div>
            )}
          </div>

          {/* Clean Minimal Footer */}
          <div className="shrink-0 bg-[#f0ede6] border-t-[1.5px] border-black/60 px-3 py-1 flex items-center justify-between text-[10px] font-mono text-neutral-600">
            <span>{executionMode === "interactive" ? "Terminal (PTY Stream)" : "Batch Runner"}</span>
            <span>UTF-8 · Ready</span>
          </div>

          {/* 🤖 Overlay Ribbon AI Button on the right of Terminal */}
          {!isAiPanelOpen && (
            <button
              onClick={handleToggleAiPanel}
              title="Open AI Companion (3-Panel Workspace)"
              className="hidden lg:flex absolute top-1/2 -translate-y-1/2 -right-1 z-30 bg-[#ffe600] hover:bg-[#ffd700] text-black border-2 border-black shadow-[-2px_2px_0px_#000] px-1.5 py-3 rounded-l-md font-black text-xs cursor-pointer flex-col items-center gap-1.5 transition-all hover:translate-x-[-2px] select-none"
            >
              <Sparkles className="w-3.5 h-3.5 fill-black" />
              <span className="text-[9px] uppercase font-black [writing-mode:vertical-lr] tracking-widest">
                AI ASSIST
              </span>
            </button>
          )}
        </div>

        {/* 🌟 RESIZABLE SPLIT BAR BETWEEN TERMINAL AND AI COMPANION */}
        {isAiPanelOpen && (
          <div
            onMouseDown={handleResizer2MouseDown}
            title="Drag left/right to resize Terminal & AI Companion"
            className={`hidden lg:flex w-3.5 cursor-col-resize z-20 shrink-0 items-center justify-center group relative select-none transition-colors mx-0.5 ${
              activeDraggingResizer === 2 ? "bg-[#ffe600]/30" : "hover:bg-[#ffe600]/20"
            }`}
          >
            {/* Center Vertical Divider Line */}
            <div className="w-[2px] h-full bg-black shadow-[1px_0px_0px_#000]" />
            {/* Grip Pill */}
            <div
              className={`absolute w-3.5 h-12 rounded-full border-2 border-black shadow-[1.5px_1.5px_0px_#000] flex items-center justify-center transition-colors ${
                activeDraggingResizer === 2 ? "bg-[#ffe600]" : "bg-white group-hover:bg-[#ffe600]"
              }`}
            >
              <GripVertical className="w-2.5 h-2.5 text-black stroke-[3]" />
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* 3RD COLUMN: DEVNIX AI COMPANION (EMBEDDED RESIZABLE 3RD PANEL)            */}
        {/* ========================================================================= */}
        {isAiPanelOpen && (
          <div
            style={{ width: `${100 - panel1Percent - panel2Percent}%` }}
            className={`hidden lg:flex flex-col h-full min-h-0 min-w-0 overflow-hidden box-border ${
              activeDraggingResizer ? "select-none pointer-events-none" : ""
            }`}
          >
            <AiAssistantPanel
              embedded={true}
              isOpen={true}
              onClose={handleToggleAiPanel}
              context={{
                languageName: selectedLanguage.label,
                languageVersion: selectedLanguage.version,
                code: code,
                stdin: stdin,
                stdout: result?.stdout,
                stderr: result?.stderr,
                compileOutput: result?.compile_output,
                exitStatus: result?.status?.description,
                executionTime: result?.time,
              }}
              onApplyCode={(newCode) => {
                setCode(newCode);
                showToast("success", "Code Applied", "Updated Monaco Editor with AI code.");
              }}
              onHighlightLine={handleHighlightTraceLine}
            />
          </div>
        )}
      </div>
      )}

      {/* Mobile / Small Screen AI Companion Drawer Overlay Fallback */}
      <div className="lg:hidden">
        <AiAssistantPanel
          embedded={false}
          isOpen={isAiPanelOpen}
          onClose={handleToggleAiPanel}
          context={{
            languageName: selectedLanguage.label,
            languageVersion: selectedLanguage.version,
            code: code,
            stdin: stdin,
            stdout: result?.stdout,
            stderr: result?.stderr,
            compileOutput: result?.compile_output,
            exitStatus: result?.status?.description,
            executionTime: result?.time,
          }}
          onApplyCode={(newCode) => {
            setCode(newCode);
            showToast("success", "Code Applied", "Updated Monaco Editor with AI code.");
          }}
          onHighlightLine={handleHighlightTraceLine}
        />
      </div>

      {/* 🔔 Right-Side Corner Neobrutalist Toast Notification Stack (Max 2 with Smooth Fade In/Out) */}
      <div className="fixed top-4 right-4 z-50 flex flex-col gap-2.5 pointer-events-none max-w-sm w-full">
        {toasts.map((toast) => {
          const isExiting = exitingToastIds.has(toast.id);
          return (
            <div
              key={toast.id}
              className={`pointer-events-auto border-[2.5px] border-black rounded-lg p-3 shadow-[4px_4px_0px_#000] flex items-start justify-between gap-2.5 transition-all ${
                isExiting ? "neo-toast-exit" : "neo-toast-enter"
              } ${
                toast.type === "error"
                  ? "bg-[#ff5277] text-white"
                  : toast.type === "warning"
                  ? "bg-[#ffe600] text-black font-bold"
                  : toast.type === "success"
                  ? "bg-[#22c55e] text-black font-bold"
                  : "bg-[#00f0ff] text-black font-bold"
              }`}
            >
              <div className="flex flex-col gap-0.5 min-w-0 flex-1">
                <span className="font-black text-xs uppercase tracking-wide truncate">{toast.title}</span>
                {toast.message && (
                  <span className="text-[11px] font-mono leading-tight opacity-95 line-clamp-2 break-words">
                    {toast.message}
                  </span>
                )}
              </div>
              <button
                onClick={() => dismissToast(toast.id)}
                className="text-current opacity-70 hover:opacity-100 p-0.5 shrink-0 transition-opacity"
              >
                <X className="w-3.5 h-3.5 stroke-[3]" />
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
