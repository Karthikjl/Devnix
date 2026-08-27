"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  ChevronLeft,
  ChevronRight,
  Activity,
  Code2,
  Terminal,
  Layers,
  Sparkles,
  Zap,
  CheckCircle2,
  TrendingUp,
} from "lucide-react";
import {
  TraceData,
  TraceStep,
  TraceArrayState,
  TracePointer,
} from "@/lib/traceEngine";

export type { TraceData, TraceStep, TraceArrayState, TracePointer };

interface VisualTracePlayerProps {
  trace: TraceData;
  onHighlightLine?: (lineNumber: number | null, stepCode?: string | null) => void;
  onApplyCode?: (code: string) => void;
  onAskAiInsight?: (stepData: TraceStep) => void;
}

export const VisualTracePlayer: React.FC<VisualTracePlayerProps> = ({
  trace: initialTrace,
  onHighlightLine,
  onApplyCode,
  onAskAiInsight,
}) => {
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState<1 | 1.5 | 2>(1);
  const [activeTab, setActiveTab] = useState<"visual" | "memory" | "code">("visual");

  const [prevTrace, setPrevTrace] = useState<TraceData>(initialTrace);
  if (initialTrace !== prevTrace) {
    setPrevTrace(initialTrace);
    setCurrentStepIndex(0);
    setIsPlaying(false);
  }

  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const activeTrace = initialTrace;

  const steps = activeTrace.steps || [];
  const totalSteps = steps.length;
  const currentStep = steps[currentStepIndex] || steps[0];

  // Resolve or auto-detect Array & Pointer Visualizer State
  const resolveArrayVisualizer = (step?: TraceStep): TraceArrayState | null => {
    if (!step) return null;
    if (step.arrayVisualizer && Array.isArray(step.arrayVisualizer.elements) && step.arrayVisualizer.elements.length > 0) {
      return step.arrayVisualizer;
    }

    if (step.variables) {
      let detectedArrayKey = "";
      let detectedElements: (string | number)[] = [];

      for (const [k, v] of Object.entries(step.variables)) {
        if (Array.isArray(v) && v.length > 0 && v.length <= 30 && !k.toLowerCase().includes("result")) {
          detectedArrayKey = k;
          detectedElements = v;
          break;
        }
      }

      if (detectedElements.length > 0) {
        const pointers: TracePointer[] = [];
        const pointerColors = ["#00f0ff", "#ff5277", "#ffe600", "#4ade80", "#c084fc", "#fb923c"];
        let colorIdx = 0;

        for (const [k, v] of Object.entries(step.variables)) {
          if (typeof v === "number" && Number.isInteger(v) && v >= 0 && v < detectedElements.length) {
            const lower = k.toLowerCase();
            if (
              ["left", "right", "i", "j", "k", "mid", "low", "high", "slow", "fast", "start", "end", "ptr", "head", "tail", "cur", "idx", "p"].some(
                (p) => lower.includes(p)
              ) ||
              k.length <= 4
            ) {
              pointers.push({
                name: k,
                index: v,
                color: pointerColors[colorIdx % pointerColors.length],
              });
              colorIdx++;
            }
          }
        }

        return {
          name: detectedArrayKey,
          elements: detectedElements,
          pointers,
          highlightIndices: pointers.map((p) => p.index),
        };
      }
    }

    return null;
  };

  // Resolve Hash Maps / Dictionaries in variables
  const resolveHashMaps = (step?: TraceStep) => {
    if (step?.hashMapVisualizer) {
      return [step.hashMapVisualizer];
    }
    if (!step?.variables) return [];
    const maps: { name: string; entries: { key: string; val: any }[] }[] = [];

    for (const [k, v] of Object.entries(step.variables)) {
      if (
        v &&
        typeof v === "object" &&
        !Array.isArray(v) &&
        Object.keys(v).length > 0 &&
        Object.keys(v).length <= 25
      ) {
        maps.push({
          name: k,
          entries: Object.entries(v).map(([key, val]) => ({ key, val })),
        });
      }
    }
    return maps;
  };

  // Resolve Stacks / Queues in variables
  const resolveStacks = (step?: TraceStep) => {
    if (step?.stackVisualizer) {
      return [step.stackVisualizer];
    }
    if (!step?.variables) return [];
    const stacks: { name: string; elements: any[]; isStack: boolean }[] = [];

    for (const [k, v] of Object.entries(step.variables)) {
      const lower = k.toLowerCase();
      if (Array.isArray(v) && (lower.includes("stack") || lower.includes("queue") || lower.includes("stk") || lower.includes("res"))) {
        stacks.push({
          name: k,
          elements: v,
          isStack: !lower.includes("queue"),
        });
      }
    }
    return stacks;
  };

  const arrayData = resolveArrayVisualizer(currentStep);
  const hashMaps = resolveHashMaps(currentStep);
  const stackQueues = resolveStacks(currentStep);

  // Auto playback timer
  useEffect(() => {
    if (isPlaying) {
      const delay = 1400 / playbackSpeed;
      timerRef.current = setTimeout(() => {
        setCurrentStepIndex((prev) => {
          if (prev >= totalSteps - 1) {
            setIsPlaying(false);
            return prev;
          }
          return prev + 1;
        });
      }, delay);
    } else if (timerRef.current) {
      clearTimeout(timerRef.current);
    }
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [isPlaying, currentStepIndex, totalSteps, playbackSpeed]);

  // Synchronize active trace line directly to Monaco editor
  useEffect(() => {
    if (currentStep?.line) {
      onHighlightLine?.(currentStep.line, currentStep.code);
    } else {
      onHighlightLine?.(null);
    }
  }, [currentStepIndex, currentStep?.line, currentStep?.code, onHighlightLine]);

  // Clear highlight on unmount
  useEffect(() => {
    return () => {
      onHighlightLine?.(null);
    };
  }, [onHighlightLine]);

  if (!steps || steps.length === 0) {
    return null;
  }

  const prevStep = currentStepIndex > 0 ? steps[currentStepIndex - 1] : null;

  return (
    <div className="my-3 rounded-xl border-3 border-black bg-[#fffdfa] shadow-[5px_5px_0px_#000] overflow-hidden text-black select-none flex flex-col">
      {/* 1. Header Bar: Title, Step Counter & Playback Speed */}
      <div className="px-3.5 py-2.5 bg-[#ffe600] border-b-3 border-black text-black flex-shrink-0">
        <div className="flex items-center justify-between gap-2">
          {/* Title */}
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded bg-black text-[#ffe600] flex items-center justify-center font-black text-xs border border-black shadow-[1.5px_1.5px_0px_#000]">
              <Zap className="w-3.5 h-3.5 fill-[#ffe600]" />
            </div>
            <div>
              <span className="font-black text-xs tracking-tight">
                {activeTrace.title || "VISUAL CODE TRACER"}
              </span>
            </div>
          </div>

          {/* Controls & Progress Badge */}
          <div className="flex items-center gap-2">
            <div className="bg-white text-black px-2.5 py-0.5 rounded-md text-[10px] font-mono font-black border-2 border-black shadow-[1.5px_1.5px_0px_#000]">
              STEP {currentStepIndex + 1} / {totalSteps}
            </div>

            <button
              type="button"
              onClick={() => setPlaybackSpeed((prev) => (prev === 1 ? 1.5 : prev === 1.5 ? 2 : 1))}
              className="neo-btn bg-white hover:bg-neutral-100 text-black px-2 py-0.5 rounded-md text-[10px] font-black border-2 border-black shadow-[1.5px_1.5px_0px_#000] cursor-pointer"
            >
              {playbackSpeed}x
            </button>
          </div>
        </div>
      </div>

      {/* 2. Interactive Scrubber Timeline */}
      <div className="px-3.5 pt-2 pb-1 bg-[#f5f1e8] border-b-2 border-black flex-shrink-0">
        <div className="flex items-center justify-between text-[9px] font-mono font-bold text-neutral-600 mb-1">
          <span>Start (Step 1)</span>
          <span className="text-black font-black">
            {activeTrace.algorithmType || "Execution Timeline"}
          </span>
          <span>End (Step {totalSteps})</span>
        </div>
        <input
          type="range"
          min={0}
          max={totalSteps - 1}
          value={currentStepIndex}
          onChange={(e) => {
            setIsPlaying(false);
            setCurrentStepIndex(Number(e.target.value));
          }}
          className="w-full h-2.5 bg-white rounded-lg appearance-none cursor-pointer border-2 border-black accent-[#00f0ff] shadow-[1.5px_1.5px_0px_#000]"
        />
      </div>

      {/* 3. Tab Switcher */}
      <div className="flex items-center border-b-2 border-black bg-white px-3 text-xs font-black flex-shrink-0">
        <button
          type="button"
          onClick={() => setActiveTab("visual")}
          className={`py-1.5 px-3 border-b-3 transition-colors flex items-center gap-1.5 cursor-pointer ${
            activeTab === "visual"
              ? "border-[#00f0ff] text-black bg-[#e0f7fa]"
              : "border-transparent text-neutral-600 hover:text-black"
          }`}
        >
          <Layers className="w-3.5 h-3.5" />
          <span>Visual Canvas</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("memory")}
          className={`py-1.5 px-3 border-b-3 transition-colors flex items-center gap-1.5 cursor-pointer ${
            activeTab === "memory"
              ? "border-[#ffe600] text-black bg-[#fffde7]"
              : "border-transparent text-neutral-600 hover:text-black"
          }`}
        >
          <Activity className="w-3.5 h-3.5" />
          <span>Variables & State</span>
          {currentStep.variables && (
            <span className="bg-black text-white px-1 py-0.1 rounded text-[9px] font-mono">
              {Object.keys(currentStep.variables).length}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("code")}
          className={`py-1.5 px-3 border-b-3 transition-colors flex items-center gap-1.5 cursor-pointer ${
            activeTab === "code"
              ? "border-[#4ade80] text-black bg-[#e8f5e9]"
              : "border-transparent text-neutral-600 hover:text-black"
          }`}
        >
          <Code2 className="w-3.5 h-3.5" />
          <span>Code & Console</span>
        </button>
      </div>

      {/* 4. Fixed-Height Main Step Body */}
      <div className="p-3.5 space-y-2.5 h-[300px] max-h-[300px] overflow-y-auto flex-1">
        {/* Step Explanation Callout Banner */}
        {currentStep.explanation && (
          <div className="p-2.5 rounded-lg border-2 border-black bg-[#e0f7fa] text-xs shadow-[2px_2px_0px_#000] flex-shrink-0">
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-1.5 font-black text-[11px] text-[#006064] uppercase">
                <Sparkles className="w-3.5 h-3.5 fill-[#006064]" />
                <span>Step {currentStepIndex + 1} Logic Breakdown</span>
              </div>
              {onAskAiInsight && (
                <button
                  type="button"
                  onClick={() => onAskAiInsight(currentStep)}
                  className="neo-btn bg-white hover:bg-neutral-100 text-black px-1.5 py-0.5 rounded text-[9px] font-bold border border-black shadow-[1px_1px_0px_#000] flex items-center gap-1 cursor-pointer"
                >
                  <Sparkles className="w-2.5 h-2.5 text-[#00f0ff] fill-[#00f0ff]" />
                  <span>AI Insight</span>
                </button>
              )}
            </div>
            <p className="text-neutral-900 leading-relaxed font-medium">
              {currentStep.explanation}
            </p>
          </div>
        )}

        {/* TAB 1: VISUAL CANVAS */}
        {activeTab === "visual" && (
          <div className="space-y-2.5">
            {/* 1. Dynamic Variable Value Metric Cards */}
            {currentStep.variables && Object.keys(currentStep.variables).length > 0 && (
              <div className="rounded-lg border-2 border-black bg-white overflow-hidden shadow-[2px_2px_0px_#000]">
                <div className="flex items-center justify-between px-3 py-1 bg-[#00f0ff] border-b-2 border-black text-[10px] font-black uppercase text-black">
                  <div className="flex items-center gap-1.5">
                    <Activity className="w-3.5 h-3.5 stroke-[2.5]" />
                    <span>Active State Metrics</span>
                  </div>
                  <span className="bg-black text-white px-1.5 py-0.2 rounded font-mono text-[9px]">
                    {Object.keys(currentStep.variables).length} Live
                  </span>
                </div>

                <div className="p-2.5 grid grid-cols-2 sm:grid-cols-3 gap-2 bg-[#faf8f5]">
                  {Object.entries(currentStep.variables).map(([varName, val]) => {
                    const prevVal = prevStep?.variables?.[varName];
                    const hasChanged = prevVal !== undefined && JSON.stringify(prevVal) !== JSON.stringify(val);

                    return (
                      <div
                        key={varName}
                        className={`p-2 rounded-lg border-2 border-black flex flex-col justify-between transition-all shadow-[1.5px_1.5px_0px_#000] ${
                          hasChanged ? "bg-[#ffe600] scale-102" : "bg-white"
                        }`}
                      >
                        <div className="flex items-center justify-between text-[10px] font-mono font-bold text-neutral-700 pb-0.5 border-b border-black/10">
                          <span className="uppercase">{varName}</span>
                          {hasChanged ? (
                            <span className="text-[8px] bg-black text-white px-1 rounded font-black flex items-center gap-0.5">
                              <TrendingUp className="w-2.5 h-2.5" /> MODIFIED
                            </span>
                          ) : (
                            <span className="text-[8px] text-neutral-400 font-mono">
                              {typeof val}
                            </span>
                          )}
                        </div>
                        <div className="text-sm font-mono font-black text-black my-1 truncate">
                          {typeof val === "object" ? JSON.stringify(val) : String(val)}
                        </div>
                        {prevVal !== undefined && hasChanged && (
                          <div className="text-[9px] font-mono text-neutral-600 truncate">
                            prev: {String(prevVal)}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* 2. Interactive Array & Pointer Visualizer Box (If array exists) */}
            {arrayData && arrayData.elements && arrayData.elements.length > 0 && (
              <div className="rounded-lg border-2 border-black bg-white overflow-hidden shadow-[2px_2px_0px_#000]">
                <div className="flex items-center justify-between px-3 py-1 bg-[#ffe600] border-b-2 border-black text-[10px] font-black uppercase text-black">
                  <div className="flex items-center gap-1.5">
                    <Layers className="w-3.5 h-3.5 stroke-[2.5]" />
                    <span>ARRAY: {arrayData.name ? `${arrayData.name} ` : ""}[{arrayData.elements.length} items]</span>
                  </div>
                  {arrayData.pointers && arrayData.pointers.length > 0 && (
                    <span className="bg-black text-white px-1.5 py-0.2 rounded font-mono text-[9px]">
                      {arrayData.pointers.length} Pointers
                    </span>
                  )}
                </div>

                <div className="p-3 overflow-x-auto bg-[#faf8f5]">
                  <div className="flex items-start gap-2.5 min-w-max pb-1">
                    {arrayData.elements.map((elem, idx) => {
                      const matchingPointers = (arrayData.pointers || []).filter((p) => p.index === idx);
                      const isHighlighted = (arrayData.highlightIndices || []).includes(idx) || matchingPointers.length > 0;

                      return (
                        <div key={idx} className="flex flex-col items-center min-w-[46px]">
                          {/* Value Box */}
                          <div
                            className={`w-10 h-10 rounded-lg border-2 border-black flex items-center justify-center font-mono text-xs font-black transition-all shadow-[1.5px_1.5px_0px_#000] ${
                              isHighlighted
                                ? "bg-[#ffe600] text-black scale-105"
                                : "bg-white text-neutral-900"
                            }`}
                          >
                            {String(elem)}
                          </div>

                          {/* Index Label */}
                          <div className="text-[9px] font-mono font-bold text-neutral-500 mt-0.5">
                            [{idx}]
                          </div>

                          {/* Moving Pointer Indicator */}
                          <div className="flex flex-col items-center gap-0.5 min-h-[24px]">
                            {matchingPointers.map((ptr) => (
                              <div
                                key={ptr.name}
                                className="flex flex-col items-center animate-in fade-in slide-in-from-bottom-1 duration-150"
                              >
                                <span className="text-[8px] leading-none text-black font-black">▲</span>
                                <span
                                  className="px-1.5 py-0.2 rounded border border-black text-[9px] font-mono font-black shadow-[1px_1px_0px_#000] text-black whitespace-nowrap"
                                  style={{ backgroundColor: ptr.color || "#00f0ff" }}
                                >
                                  {ptr.name}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {/* 3. Interactive Hash Map Visualizer */}
            {hashMaps.length > 0 && (
              <div className="space-y-2">
                {hashMaps.map((map) => (
                  <div
                    key={map.name}
                    className="rounded-lg border-2 border-black bg-white overflow-hidden shadow-[2px_2px_0px_#000]"
                  >
                    <div className="flex items-center justify-between px-3 py-1 bg-[#00f0ff] border-b-2 border-black text-[10px] font-black uppercase text-black">
                      <div className="flex items-center gap-1.5">
                        <Activity className="w-3.5 h-3.5 stroke-[2.5]" />
                        <span>HASH MAP: {map.name} ({map.entries.length} entries)</span>
                      </div>
                      <span className="bg-black text-white px-1.5 py-0.2 rounded font-mono text-[9px]">
                        LOOKUP TABLE
                      </span>
                    </div>
                    <div className="p-2.5 grid grid-cols-2 sm:grid-cols-3 gap-2 bg-[#faf8f5]">
                      {map.entries.map((entry) => (
                        <div
                          key={entry.key}
                          className="p-1.5 rounded-lg border-2 border-black bg-white shadow-[1.5px_1.5px_0px_#000] flex flex-col justify-between"
                        >
                          <div className="text-[10px] font-mono font-bold text-neutral-600 border-b border-neutral-200 pb-0.5 mb-1 flex items-center justify-between">
                            <span>KEY</span>
                            <span className="font-black text-black bg-[#ffe600] px-1 rounded">{String(entry.key)}</span>
                          </div>
                          <div className="text-[11px] font-mono font-black text-black text-right">
                            val: {typeof entry.val === "object" ? JSON.stringify(entry.val) : String(entry.val)}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* 3. Interactive Stack / Queue Visualizer */}
            {stackQueues.length > 0 && (
              <div className="space-y-2">
                {stackQueues.map((st) => (
                  <div
                    key={st.name}
                    className="rounded-lg border-2 border-black bg-white overflow-hidden shadow-[2px_2px_0px_#000]"
                  >
                    <div className="flex items-center justify-between px-3 py-1 bg-[#4ade80] border-b-2 border-black text-[10px] font-black uppercase text-black">
                      <div className="flex items-center gap-1.5">
                        <Layers className="w-3.5 h-3.5 stroke-[2.5]" />
                        <span>{st.isStack ? "STACK" : "QUEUE"}: {st.name} ({st.elements.length} items)</span>
                      </div>
                      <span className="bg-black text-white px-1.5 py-0.2 rounded font-mono text-[9px]">
                        {st.isStack ? "LIFO" : "FIFO"}
                      </span>
                    </div>
                    <div className="p-2.5 overflow-x-auto bg-[#faf8f5]">
                      <div className="flex items-center gap-1.5 min-w-max">
                        <span className="text-[9px] font-mono font-bold text-neutral-500 mr-1">
                          {st.isStack ? "BOTTOM ➔" : "FRONT ➔"}
                        </span>
                        {st.elements.map((el, i) => (
                          <div
                            key={i}
                            className="px-2 py-1 rounded border-2 border-black bg-white shadow-[1px_1px_0px_#000] font-mono text-xs font-black"
                          >
                            {String(el)}
                          </div>
                        ))}
                        <span className="text-[9px] font-mono font-black text-black bg-[#ffe600] px-1 py-0.5 rounded border border-black shadow-[1px_1px_0px_#000] ml-1">
                          {st.isStack ? "▲ TOP" : "▲ BACK"}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* 4. Live Output Terminal Block */}
            {currentStep.output && (
              <div className="rounded-lg border-2 border-black bg-[#121212] text-neutral-200 p-2.5 shadow-[2px_2px_0px_#000] font-mono text-[11px]">
                <div className="flex items-center gap-1 text-[10px] text-neutral-400 font-bold uppercase mb-1 pb-1 border-b border-neutral-800">
                  <Terminal className="w-3 h-3 text-[#ffe600]" />
                  <span>Live Stdout Output</span>
                </div>
                <pre className="text-green-400 whitespace-pre-wrap max-h-16 overflow-y-auto">
                  {currentStep.output}
                </pre>
              </div>
            )}
          </div>
        )}

        {/* TAB 2: VARIABLES & MEMORY STATE */}
        {activeTab === "memory" && (
          <div className="space-y-2">
            {currentStep.variables && Object.keys(currentStep.variables).length > 0 ? (
              <div className="rounded-lg border-2 border-black bg-white overflow-hidden shadow-[2px_2px_0px_#000]">
                <div className="flex items-center justify-between px-3 py-1 bg-[#f0ede6] border-b-2 border-black text-[10px] font-black uppercase">
                  <span className="flex items-center gap-1">
                    <Activity className="w-3.5 h-3.5 text-[#00f0ff]" /> Live Variables
                  </span>
                  <span className="font-mono text-neutral-500">
                    {Object.keys(currentStep.variables).length} active
                  </span>
                </div>
                <div className="p-2.5 grid grid-cols-2 sm:grid-cols-3 gap-2 font-mono text-xs max-h-[220px] overflow-y-auto">
                  {Object.entries(currentStep.variables).map(([varName, val]) => {
                    const prevVal = prevStep?.variables?.[varName];
                    const hasChanged = prevVal !== undefined && JSON.stringify(prevVal) !== JSON.stringify(val);
                    const strVal = typeof val === "object" ? JSON.stringify(val) : String(val);

                    return (
                      <div
                        key={varName}
                        className={`p-2 rounded-lg border-2 border-black flex flex-col justify-between transition-all ${
                          hasChanged
                            ? "bg-[#ffe600] shadow-[1.5px_1.5px_0px_#000] scale-102"
                            : "bg-neutral-50 shadow-[1px_1px_0px_#000]"
                        }`}
                      >
                        <div className="flex items-center justify-between text-[10px] text-neutral-600 font-bold uppercase truncate border-b border-black/10 pb-0.5">
                          <span>{varName}</span>
                          {hasChanged && (
                            <span className="text-[8px] bg-black text-white px-1 rounded font-black">
                              MODIFIED
                            </span>
                          )}
                        </div>
                        <span className="font-mono text-xs text-black font-black truncate mt-1">
                          {strVal}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="p-4 text-center text-xs font-mono text-neutral-500 border border-neutral-300 rounded-lg">
                No local variables captured on this step.
              </div>
            )}
          </div>
        )}

        {/* TAB 3: CODE & CONSOLE */}
        {activeTab === "code" && (
          <div className="space-y-2">
            {/* Active Code Line */}
            {currentStep.code && (
              <div className="rounded-lg border-2 border-black bg-[#1e1e1e] text-white p-2.5 shadow-[2px_2px_0px_#000]">
                <div className="flex items-center justify-between text-[10px] text-neutral-400 font-mono mb-1 pb-1 border-b border-neutral-700">
                  <span className="flex items-center gap-1 text-[#00f0ff] font-bold">
                    <Code2 className="w-3.5 h-3.5" />
                    {currentStep.line ? `Line ${currentStep.line}` : "Current Instruction"}
                  </span>
                  <span className="bg-neutral-800 px-1.5 py-0.2 rounded text-[9px] text-neutral-300">
                    STEP {currentStep.step}
                  </span>
                </div>
                <pre className="font-mono text-xs font-bold text-green-400 overflow-x-auto whitespace-pre-wrap">
                  <code>{currentStep.code}</code>
                </pre>
              </div>
            )}

            {/* Live Console Output */}
            {currentStep.output && (
              <div className="rounded-lg border-2 border-black bg-[#121212] text-neutral-200 p-2.5 shadow-[2px_2px_0px_#000] font-mono text-[11px]">
                <div className="flex items-center gap-1 text-[10px] text-neutral-400 font-bold uppercase mb-1">
                  <Terminal className="w-3 h-3 text-[#ffe600]" />
                  <span>Console Output</span>
                </div>
                <pre className="text-green-400 whitespace-pre-wrap max-h-20 overflow-y-auto">
                  {currentStep.output}
                </pre>
              </div>
            )}
          </div>
        )}
      </div>

      {/* 5. Fixed-Position Bottom Playback Controller Toolbar */}
      <div className="px-3.5 py-2.5 bg-[#f0ede6] border-t-3 border-black flex items-center justify-between gap-2 flex-shrink-0 h-[52px]">
        <div className="flex items-center gap-1.5">
          {/* First Step */}
          <button
            type="button"
            onClick={() => {
              setIsPlaying(false);
              setCurrentStepIndex(0);
            }}
            disabled={currentStepIndex === 0}
            title="First Step"
            className="neo-btn bg-white hover:bg-neutral-100 disabled:opacity-40 w-8 h-8 rounded-md border-2 border-black shadow-[1.5px_1.5px_0px_#000] cursor-pointer flex items-center justify-center"
          >
            <SkipBack className="w-3.5 h-3.5 stroke-[2.5]" />
          </button>

          {/* Previous Step */}
          <button
            type="button"
            onClick={() => {
              setIsPlaying(false);
              setCurrentStepIndex((prev) => Math.max(0, prev - 1));
            }}
            disabled={currentStepIndex === 0}
            title="Previous Step"
            className="neo-btn bg-white hover:bg-neutral-100 disabled:opacity-40 h-8 px-3 rounded-md text-xs font-black border-2 border-black shadow-[1.5px_1.5px_0px_#000] flex items-center justify-center gap-1 cursor-pointer min-w-[64px]"
          >
            <ChevronLeft className="w-3.5 h-3.5 stroke-[3]" />
            <span>Prev</span>
          </button>
        </div>

        {/* Play / Pause Toggle Button */}
        <button
          type="button"
          onClick={() => {
            if (currentStepIndex >= totalSteps - 1) {
              setCurrentStepIndex(0);
            }
            setIsPlaying(!isPlaying);
          }}
          className={`neo-btn h-8 px-5 rounded-lg text-xs font-black border-2 border-black shadow-[2px_2px_0px_#000] flex items-center justify-center gap-1.5 cursor-pointer text-black min-w-[96px] transition-transform active:translate-x-0.5 active:translate-y-0.5 ${
            isPlaying ? "bg-[#ff5277] hover:bg-red-400" : "bg-[#00f0ff] hover:bg-cyan-300"
          }`}
        >
          {isPlaying ? (
            <>
              <Pause className="w-3.5 h-3.5 fill-black text-black" />
              <span>PAUSE</span>
            </>
          ) : (
            <>
              <Play className="w-3.5 h-3.5 fill-black text-black" />
              <span>{currentStepIndex >= totalSteps - 1 ? "REPLAY" : "PLAY"}</span>
            </>
          )}
        </button>

        <div className="flex items-center gap-1.5">
          {/* Next Step */}
          <button
            type="button"
            onClick={() => {
              setIsPlaying(false);
              setCurrentStepIndex((prev) => Math.min(totalSteps - 1, prev + 1));
            }}
            disabled={currentStepIndex >= totalSteps - 1}
            title="Next Step"
            className="neo-btn bg-white hover:bg-neutral-100 disabled:opacity-40 h-8 px-3 rounded-md text-xs font-black border-2 border-black shadow-[1.5px_1.5px_0px_#000] flex items-center justify-center gap-1 cursor-pointer min-w-[64px]"
          >
            <span>Next</span>
            <ChevronRight className="w-3.5 h-3.5 stroke-[3]" />
          </button>

          {/* Last Step */}
          <button
            type="button"
            onClick={() => {
              setIsPlaying(false);
              setCurrentStepIndex(totalSteps - 1);
            }}
            disabled={currentStepIndex >= totalSteps - 1}
            title="Last Step"
            className="neo-btn bg-white hover:bg-neutral-100 disabled:opacity-40 w-8 h-8 rounded-md border-2 border-black shadow-[1.5px_1.5px_0px_#000] cursor-pointer flex items-center justify-center"
          >
            <SkipForward className="w-3.5 h-3.5 stroke-[2.5]" />
          </button>
        </div>
      </div>
    </div>
  );
};
