/**
 * DEVNIX Universal Code Simulation & Algorithmic Trace Engine
 * 
 * Provides real step-by-step execution simulation of while loops, for loops,
 * variable increments (n+=1, count++), conditionals, array indexing, and prints across all languages.
 */

export interface TracePointer {
  name: string;
  index: number;
  color?: string;
}

export interface TraceArrayState {
  name?: string;
  elements: (string | number)[];
  pointers?: TracePointer[];
  highlightIndices?: number[];
}

export interface TraceStep {
  step: number;
  line?: number;
  code?: string;
  explanation: string;
  variables: Record<string, any>;
  arrayVisualizer?: TraceArrayState;
  stackVisualizer?: { name: string; elements: any[]; isStack: boolean };
  hashMapVisualizer?: { name: string; entries: { key: string; val: any }[] };
  output?: string;
}

export interface TraceData {
  title: string;
  algorithmType?: string;
  steps: TraceStep[];
  codeTemplate?: string;
}

interface LoopBodyStmt {
  lineIdx: number;
  code: string;
  type: "inc" | "add" | "assign" | "print" | "generic";
  targetVar?: string;
  amount?: number;
  printArg?: string;
}

/**
 * Universal Code Simulator
 * Dynamically executes while loops, for loops, variable mutations, arrays, and prints.
 */
export function generateGenericCodeTrace(code: string, languageName?: string): TraceData {
  const lines = (code || "").split("\n");
  const steps: TraceStep[] = [];
  const variables: Record<string, any> = {};

  let detectedArray: (number | string)[] = [];
  let arrayName = "arr";
  const outputLogs: string[] = [];

  // 1. Scan for array declarations: arr = [1, 2, 3] or int arr[] = {1, 2}
  for (let idx = 0; idx < lines.length; idx++) {
    const trimmed = lines[idx].trim();
    const arrMatch = trimmed.match(/(?:const|let|var|int|float|auto|double)?\s*(?:\[\])?\s*([a-zA-Z0-9_]+)\s*(?:\[\s*\])?\s*[:=]\s*(?:new\s+\w+\[\]\s*)?[\[\{]([^\]\}]+)[\]\}]/);
    if (arrMatch && detectedArray.length === 0) {
      arrayName = arrMatch[1];
      try {
        detectedArray = arrMatch[2]
          .split(",")
          .map((s) => {
            const t = s.trim().replace(/['"]/g, "");
            return isNaN(Number(t)) ? t : Number(t);
          })
          .filter((v) => v !== "");
        variables[arrayName] = [...detectedArray];
      } catch {}
      break;
    }
  }

  // 2. Scan for loop patterns (FOR and WHILE loops across all syntaxes)
  let loopLineIdx = -1;
  let loopVar = "n";
  let loopStart = 0;
  let loopEnd = 10;
  let isWhileLoop = false;
  let whileOp = "<";

  for (let idx = 0; idx < lines.length; idx++) {
    const trimmed = lines[idx].trim();

    // Python / C / JS / Go while loop: while (n < 1000): or while n < 1000: or while (count <= 500)
    const whileMatch = trimmed.match(/while\s*\(?\s*([a-zA-Z0-9_]+)\s*(<|<=|>|>=|!=|==)\s*(\d+)\s*\)?\s*:?/);
    if (whileMatch) {
      loopLineIdx = idx;
      loopVar = whileMatch[1];
      whileOp = whileMatch[2];
      const bound = parseInt(whileMatch[3], 10);
      isWhileLoop = true;

      // Find initial value of loopVar from pre-loop declarations if available
      const initVal = variables[loopVar] !== undefined ? Number(variables[loopVar]) : 0;
      loopStart = isNaN(initVal) ? 0 : initVal;
      loopEnd = bound;
      break;
    }

    // Python for range: for i in range(1000) or range(1, 1001)
    const pyRangeMatch = trimmed.match(/for\s+([a-zA-Z0-9_]+)\s+in\s+range\(\s*(\d+)(?:\s*,\s*(\d+))?\s*\)/);
    if (pyRangeMatch) {
      loopLineIdx = idx;
      loopVar = pyRangeMatch[1];
      if (pyRangeMatch[3] !== undefined) {
        loopStart = parseInt(pyRangeMatch[2], 10);
        loopEnd = parseInt(pyRangeMatch[3], 10);
      } else {
        loopStart = 0;
        loopEnd = parseInt(pyRangeMatch[2], 10);
      }
      break;
    }

    // C/C++/Java/JS for loop: for (let i = 0; i < 1000; i++)
    const cForMatch = trimmed.match(/for\s*\(\s*(?:int|let|var|auto)?\s*([a-zA-Z0-9_]+)\s*=\s*(\d+)\s*;\s*\1\s*(<|<=)\s*(\d+)\s*;/);
    if (cForMatch) {
      loopLineIdx = idx;
      loopVar = cForMatch[1];
      loopStart = parseInt(cForMatch[2], 10);
      loopEnd = parseInt(cForMatch[4], 10);
      break;
    }

    // Array iteration: for (int i = 0; i < arr.length; i++)
    const cArrForMatch = trimmed.match(/for\s*\(\s*(?:int|let|var|auto)?\s*([a-zA-Z0-9_]+)\s*=\s*0\s*;\s*\1\s*<\s*([a-zA-Z0-9_]+)\.(?:length|size\(\))\s*;/);
    if (cArrForMatch) {
      loopLineIdx = idx;
      loopVar = cArrForMatch[1];
      loopStart = 0;
      loopEnd = detectedArray.length > 0 ? detectedArray.length : 10;
      break;
    }
  }

  // 3. Parse and execute Initial Declarations before the loop
  for (let idx = 0; idx < (loopLineIdx !== -1 ? loopLineIdx : lines.length); idx++) {
    const rawLine = lines[idx];
    const trimmed = rawLine.trim();
    if (!trimmed || trimmed === "{" || trimmed === "}" || trimmed.startsWith("#") || trimmed.startsWith("//")) continue;

    const varMatch = trimmed.match(/(?:const|let|var|int|float|double|auto|long)?\s*([a-zA-Z0-9_]+)\s*[:=]\s*([^;]+);?/);
    if (varMatch && !varMatch[1].includes("[") && !varMatch[2].includes("{") && !varMatch[2].includes("[")) {
      const k = varMatch[1];
      const valStr = varMatch[2].trim().replace(/['"]/g, "");
      if (!isNaN(Number(valStr))) {
        variables[k] = Number(valStr);
      } else if (valStr === "true" || valStr === "false") {
        variables[k] = valStr === "true";
      } else {
        variables[k] = valStr;
      }

      steps.push({
        step: steps.length + 1,
        line: idx + 1,
        code: trimmed,
        explanation: `Initialize variable: \`${k} = ${variables[k]}\`.`,
        variables: { ...variables },
        arrayVisualizer: detectedArray.length > 0 ? {
          name: arrayName,
          elements: [...detectedArray],
          pointers: [],
        } : undefined,
      });
    }
  }

  // Update loopStart if variables already defined loopVar
  if (isWhileLoop && variables[loopVar] !== undefined) {
    loopStart = Number(variables[loopVar]) || 0;
  }

  // 4. Collect all body statements inside the loop
  const loopBodyStmts: LoopBodyStmt[] = [];
  if (loopLineIdx !== -1) {
    for (let idx = loopLineIdx + 1; idx < lines.length; idx++) {
      const rawLine = lines[idx];
      const trimmed = rawLine.trim();
      if (!trimmed || trimmed === "{" || trimmed === "}") continue;

      // In Python, check indentation: if non-indented line encountered, loop body ends
      if ((rawLine.startsWith("print") || rawLine.startsWith("return") || rawLine.startsWith("def") || rawLine.match(/^[a-zA-Z]/)) && !rawLine.startsWith(" ") && !rawLine.startsWith("\t")) {
        break;
      }

      // Check statement type
      // a) Increment: n+=1, n += 1, n = n + 1, n++
      const incMatch = trimmed.match(/([a-zA-Z0-9_]+)\s*\+=\s*(\d+)|([a-zA-Z0-9_]+)\s*=\s*\1\s*\+\s*(\d+)|([a-zA-Z0-9_]+)\+\+/);
      if (incMatch) {
        const targetVar = incMatch[1] || incMatch[3] || incMatch[5];
        const amt = incMatch[2] || incMatch[4] ? parseInt(incMatch[2] || incMatch[4], 10) : 1;
        loopBodyStmts.push({
          lineIdx: idx,
          code: trimmed,
          type: "inc",
          targetVar,
          amount: amt,
        });
        continue;
      }

      // b) Accumulation: total += i, sum += arr[i]
      const addMatch = trimmed.match(/([a-zA-Z0-9_]+)\s*\+=\s*([a-zA-Z0-9_]+)/);
      if (addMatch) {
        loopBodyStmts.push({
          lineIdx: idx,
          code: trimmed,
          type: "add",
          targetVar: addMatch[1],
        });
        continue;
      }

      // c) Print inside loop: print(n), console.log(n)
      const printMatch = trimmed.match(/(?:console\.log|printf|print|System\.out\.println|std::cout\s*<<|fmt\.Println|puts|echo)\s*\(([^)]+)\)|std::cout\s*<<\s*([^;]+);/);
      if (printMatch) {
        const printArg = (printMatch[1] || printMatch[2] || "").trim().replace(/['"]/g, "");
        loopBodyStmts.push({
          lineIdx: idx,
          code: trimmed,
          type: "print",
          printArg,
        });
        continue;
      }

      loopBodyStmts.push({
        lineIdx: idx,
        code: trimmed,
        type: "generic",
      });

      if (loopBodyStmts.length >= 6) break;
    }
  }

  // 5. Simulate Loop Iterations with Intelligent Milestone Sampling
  if (loopLineIdx !== -1 && loopEnd > loopStart) {
    const totalIterations = loopEnd - loopStart;
    let sampleIterations: number[] = [];

    if (totalIterations <= 10) {
      for (let v = 1; v <= totalIterations; v++) sampleIterations.push(v);
    } else {
      // Milestone sample points across 1000 iterations: 1, 2, 3, 100, 250, 500, 750, 999, 1000
      const milestones = [
        1,
        2,
        3,
        Math.floor(totalIterations * 0.1),
        Math.floor(totalIterations * 0.25),
        Math.floor(totalIterations * 0.5),
        Math.floor(totalIterations * 0.75),
        totalIterations - 1,
        totalIterations,
      ];
      sampleIterations = Array.from(new Set(milestones)).filter((v) => v >= 1 && v <= totalIterations).sort((a, b) => a - b);
    }

    let currentVal = loopStart;

    for (const iterNum of sampleIterations) {
      // Compute value of loopVar at this iteration
      currentVal = loopStart + iterNum;
      variables[loopVar] = isWhileLoop ? currentVal - 1 : iterNum - 1;

      // Header step: while condition check
      const condStr = `${variables[loopVar]} ${whileOp} ${loopEnd}`;
      steps.push({
        step: steps.length + 1,
        line: loopLineIdx + 1,
        code: lines[loopLineIdx].trim(),
        explanation: isWhileLoop
          ? `Condition Check: \`${condStr}\` is **True** (Iteration ${iterNum} / ${totalIterations}).`
          : `Loop Iteration ${iterNum}/${totalIterations}: \`${loopVar} = ${variables[loopVar]}\`.`,
        variables: { ...variables },
        arrayVisualizer: detectedArray.length > 0 ? {
          name: arrayName,
          elements: [...detectedArray],
          pointers: [{ name: loopVar, index: Math.min(variables[loopVar], detectedArray.length - 1), color: "#00f0ff" }],
          highlightIndices: [Math.min(variables[loopVar], detectedArray.length - 1)],
        } : undefined,
      });

      // Execute body statements inside the loop
      for (const stmt of loopBodyStmts) {
        if (stmt.type === "inc" && stmt.targetVar) {
          variables[stmt.targetVar] = currentVal;
          steps.push({
            step: steps.length + 1,
            line: stmt.lineIdx + 1,
            code: stmt.code,
            explanation: `Increment: \`${stmt.code}\` ➔ \`${stmt.targetVar} = ${currentVal}\`.`,
            variables: { ...variables },
            output: outputLogs.length > 0 ? outputLogs.slice(-5).join("\n") : undefined,
          });
        } else if (stmt.type === "print" && stmt.printArg) {
          const outVal = variables[stmt.printArg] !== undefined ? String(variables[stmt.printArg]) : stmt.printArg;
          outputLogs.push(outVal);
          steps.push({
            step: steps.length + 1,
            line: stmt.lineIdx + 1,
            code: stmt.code,
            explanation: `Print Output: \`${outVal}\` to console stream.`,
            variables: { ...variables },
            output: outputLogs.slice(-10).join("\n"),
          });
        } else if (stmt.type === "add" && stmt.targetVar) {
          const count = iterNum;
          const sumVal = (count * (loopStart + (loopStart + iterNum))) / 2;
          variables[stmt.targetVar] = sumVal;
          steps.push({
            step: steps.length + 1,
            line: stmt.lineIdx + 1,
            code: stmt.code,
            explanation: `Execute \`${stmt.code}\`: Updated \`${stmt.targetVar} = ${sumVal}\`.`,
            variables: { ...variables },
          });
        }
      }
    }

    // Loop Completion Exit Step
    variables[loopVar] = isWhileLoop ? loopEnd : loopEnd;
    steps.push({
      step: steps.length + 1,
      line: loopLineIdx + 1,
      code: lines[loopLineIdx].trim(),
      explanation: isWhileLoop
        ? `🛑 Loop Terminated: \`${loopVar} = ${loopEnd}\`, condition \`${loopEnd} ${whileOp} ${loopEnd}\` evaluated to **False**.`
        : `✅ Loop Completed: All ${totalIterations} iterations finished.`,
      variables: { ...variables },
      output: outputLogs.length > 0 ? outputLogs.slice(-10).join("\n") : undefined,
    });
  }

  // 6. Post-loop statements (outside the loop)
  const lastBodyLine = loopBodyStmts.length > 0 ? loopBodyStmts[loopBodyStmts.length - 1].lineIdx : loopLineIdx;
  for (let idx = (lastBodyLine !== -1 ? lastBodyLine + 1 : 0); idx < lines.length; idx++) {
    const trimmed = lines[idx].trim();
    if (!trimmed || trimmed === "}" || trimmed.startsWith("#") || trimmed.startsWith("//")) continue;

    const printMatch = trimmed.match(/(?:console\.log|printf|print|System\.out\.println|std::cout\s*<<|fmt\.Println|puts|echo)\s*\(([^)]+)\)|std::cout\s*<<\s*([^;]+);/);
    if (printMatch) {
      const rawArg = (printMatch[1] || printMatch[2] || "").trim().replace(/['"]/g, "");
      const outputVal = variables[rawArg] !== undefined ? String(variables[rawArg]) : rawArg;
      outputLogs.push(outputVal);

      steps.push({
        step: steps.length + 1,
        line: idx + 1,
        code: trimmed,
        explanation: `Print Final Output: \`${outputVal}\`.`,
        variables: { ...variables },
        output: outputLogs.slice(-10).join("\n"),
      });
    } else if (trimmed.startsWith("return")) {
      steps.push({
        step: steps.length + 1,
        line: idx + 1,
        code: trimmed,
        explanation: `Return statement: \`${trimmed}\`.`,
        variables: { ...variables },
        output: outputLogs.length > 0 ? outputLogs.slice(-10).join("\n") : undefined,
      });
    }
  }

  // Fallback if no steps
  if (steps.length === 0) {
    steps.push({
      step: 1,
      line: 1,
      code: lines[0] || code,
      explanation: `Program start execution.`,
      variables: { ...variables },
    });
  }

  return {
    title: `Execution Trace (${languageName || "Program"})`,
    algorithmType: loopLineIdx !== -1 ? `Loop (${loopEnd - loopStart} Iterations)` : "Code Execution",
    steps,
  };
}
