import { NextRequest, NextResponse } from "next/server";
import { tracePythonDynamic, traceJavaScriptDynamic, traceBashDynamic, DynamicTraceEvent } from "@/lib/dynamicTracer";
import { generateGenericCodeTrace, TraceData, TraceStep, TraceArrayState, TracePointer } from "@/lib/traceEngine";

export async function POST(req: NextRequest) {
  try {
    const { language_id, source_code, stdin, language_name } = await req.json();

    if (!source_code || typeof source_code !== "string") {
      return NextResponse.json({ error: "Source code is required." }, { status: 400 });
    }

    const cleanSourceCode = source_code.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
    const langId = Number(language_id) || 71;
    const lines = cleanSourceCode.split("\n");

    let dynamicEvents: DynamicTraceEvent[] | null = null;

    // 1. For Python (Language 71), execute with real Python sys.settrace() runtime engine
    if (langId === 71) {
      dynamicEvents = tracePythonDynamic(cleanSourceCode, stdin);
    }
    // 2. For JavaScript (Language 63) / TypeScript (74), execute with dynamic Node runtime
    else if (langId === 63 || langId === 74) {
      dynamicEvents = traceJavaScriptDynamic(cleanSourceCode, stdin);
    }
    // 3. For Bash (Language 46), execute with dynamic Bash debug trap
    else if (langId === 46) {
      dynamicEvents = traceBashDynamic(cleanSourceCode, stdin);
    }

    if (dynamicEvents && dynamicEvents.length > 0) {
      const steps: TraceStep[] = [];
      let prevVariables: Record<string, any> = {};
      let prevOutput = "";

      for (let i = 0; i < dynamicEvents.length; i++) {
        const evt = dynamicEvents[i];
        const lineContent = (lines[evt.line - 1] || "").trim();
        const currVars = evt.variables || {};

        // Find modified/new variables in this step
        const changedVars: string[] = [];
        for (const [k, v] of Object.entries(currVars)) {
          if (prevVariables[k] === undefined || JSON.stringify(prevVariables[k]) !== JSON.stringify(v)) {
            changedVars.push(`${k} = ${typeof v === "object" ? JSON.stringify(v) : v}`);
          }
        }

        // New stdout output delta
        const currOutput = evt.output || "";
        const outputDelta = currOutput.length > prevOutput.length ? currOutput.slice(prevOutput.length).trim() : "";

        // Build intuitive human-readable explanation
        let explanation = `Line ${evt.line}: \`${lineContent}\``;
        if (changedVars.length > 0 && outputDelta) {
          explanation = `Executed \`${lineContent}\` ➔ Updated [${changedVars.join(", ")}], printed \`${outputDelta}\`.`;
        } else if (changedVars.length > 0) {
          explanation = `Executed \`${lineContent}\` ➔ Updated [${changedVars.join(", ")}].`;
        } else if (outputDelta) {
          explanation = `Executed \`${lineContent}\` ➔ Output: \`${outputDelta}\`.`;
        } else if (lineContent.startsWith("while") || lineContent.startsWith("for") || lineContent.startsWith("if")) {
          explanation = `Evaluating condition \`${lineContent}\` (State: ${Object.entries(currVars).map(([k, v]) => `${k}=${v}`).join(", ") || "initial"}).`;
        }

        // Detect arrays & pointer positions dynamically
        let detectedArray: TraceArrayState | undefined = undefined;
        for (const [k, v] of Object.entries(currVars)) {
          if (Array.isArray(v) && v.length > 0 && v.length <= 40) {
            const pointers: TracePointer[] = [];
            const pointerColors = ["#00f0ff", "#ff5277", "#ffe600", "#4ade80", "#c084fc"];
            let pIdx = 0;
            for (const [pk, pv] of Object.entries(currVars)) {
              if (typeof pv === "number" && pv >= 0 && pv < v.length && pk !== k) {
                pointers.push({
                  name: pk,
                  index: pv,
                  color: pointerColors[pIdx % pointerColors.length],
                });
                pIdx++;
              }
            }
            detectedArray = {
              name: k,
              elements: [...v],
              pointers,
              highlightIndices: pointers.map((p) => p.index),
            };
            break;
          }
        }

        steps.push({
          step: i + 1,
          line: evt.line,
          code: lineContent,
          explanation,
          variables: { ...currVars },
          arrayVisualizer: detectedArray,
          output: currOutput || undefined,
        });

        prevVariables = { ...currVars };
        prevOutput = currOutput;
      }

      const traceData: TraceData = {
        title: `Runtime Execution Trace (${language_name || "Live Execution"})`,
        algorithmType: `${dynamicEvents.length} Runtime Steps Captured`,
        steps,
      };

      return NextResponse.json(traceData);
    }

    // 3. Fallback to universal AST code tracer if needed
    const fallbackTrace = generateGenericCodeTrace(cleanSourceCode, language_name);
    return NextResponse.json(fallbackTrace);
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Failed to trace execution." },
      { status: 500 }
    );
  }
}
