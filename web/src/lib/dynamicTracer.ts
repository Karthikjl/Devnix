import { spawnSync } from "child_process";
import fs from "fs";
import path from "path";
import os from "os";

export interface DynamicTraceEvent {
  line: number;
  variables: Record<string, any>;
  output?: string;
  explanation?: string;
}

function getRunnerContainer(): string | null {
  try {
    const res = spawnSync("docker", ["ps", "--format", "{{.Names}}"], {
      encoding: "utf-8",
      timeout: 2000,
    });
    if (res.stdout) {
      const names = res.stdout.trim().split(/\r?\n/).map((n) => n.trim()).filter(Boolean);
      const runner = names.find((n) => n.includes("runner"));
      if (runner) return runner;
      const worker = names.find((n) => n.includes("worker") || n.includes("server") || n.includes("judge0"));
      if (worker) return worker;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Universal Python Runtime Tracer
 * Uses Python standard library sys.settrace() to capture exact line executions,
 * local variables, and stdout with zero hardcoding.
 * Tries local host Python first (instant, 20ms), falls back to Docker container.
 */
export function tracePythonDynamic(sourceCode: string, stdin?: string): DynamicTraceEvent[] | null {
  const cleanSourceCode = (sourceCode || "").replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const uniqueId = `trace_${Date.now()}_${Math.floor(Math.random() * 10000)}`;

  const traceWrapper = `
import sys, json, io

trace_events = []
captured_stdout = io.StringIO()
orig_stdout = sys.stdout
sys.stdout = captured_stdout

def devnix_tracer(frame, event, arg):
    if event == 'line':
        fn = frame.f_code.co_filename
        if fn.endswith('user_code.py') or fn == '<string>':
            locs = {}
            for k, v in frame.f_locals.items():
                if not k.startswith('__') and not callable(v):
                    try:
                        if isinstance(v, (int, float, str, bool, list, dict)):
                            if isinstance(v, list):
                                locs[k] = list(v[:50])
                            elif isinstance(v, dict):
                                locs[k] = dict(list(v.items())[:50])
                            else:
                                locs[k] = v
                        else:
                            locs[k] = str(v)
                    except:
                        pass
            out_val = captured_stdout.getvalue()
            trace_events.append({
                "line": frame.f_lineno,
                "variables": locs,
                "output": out_val if out_val else ""
            })
    return devnix_tracer

try:
    with open('user_code.py', encoding='utf-8') as f:
        src = f.read()
    code_obj = compile(src, 'user_code.py', 'exec')
    sys.settrace(devnix_tracer)
    exec(code_obj, {'__name__': '__main__'})
except Exception as e:
    captured_stdout.write(f"\\nError: {e}")
finally:
    sys.settrace(None)
    sys.stdout = orig_stdout

    print("__DEVNIX_TRACE_START__")
    print(json.dumps(trace_events))
    print("__DEVNIX_TRACE_END__")
`;

  // 1. Try local host Python first (Instant, zero latency)
  try {
    const tmpDir = path.join(os.tmpdir(), "devnix_trace", uniqueId);
    fs.mkdirSync(tmpDir, { recursive: true });
    fs.writeFileSync(path.join(tmpDir, "user_code.py"), cleanSourceCode, "utf-8");
    fs.writeFileSync(path.join(tmpDir, "runner.py"), traceWrapper, "utf-8");

    const pythonCmd = process.platform === "win32" ? "python" : "python3";
    const res = spawnSync(pythonCmd, ["runner.py"], {
      cwd: tmpDir,
      input: stdin || "",
      encoding: "utf-8",
      timeout: 5000,
    });

    try {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    } catch {}

    const out = res.stdout || "";
    if (out.includes("__DEVNIX_TRACE_START__") && out.includes("__DEVNIX_TRACE_END__")) {
      const jsonStr = out.split("__DEVNIX_TRACE_START__")[1].split("__DEVNIX_TRACE_END__")[0].trim();
      const events: DynamicTraceEvent[] = JSON.parse(jsonStr);
      if (events.length > 0) return events;
    }
  } catch {}

  // 2. Fallback to Docker Container if host Python is not present
  const container = getRunnerContainer();
  if (container) {
    const containerDir = `/tmp/sandbox/${uniqueId}`;
    try {
      spawnSync("docker", ["exec", "-i", container, "mkdir", "-p", containerDir], { encoding: "utf-8", timeout: 3000 });
      spawnSync("docker", ["exec", "-i", container, "sh", "-c", `cat > "${containerDir}/user_code.py"`], {
        input: cleanSourceCode,
        encoding: "utf-8",
        timeout: 3000,
      });
      spawnSync("docker", ["exec", "-i", container, "sh", "-c", `cat > "${containerDir}/runner.py"`], {
        input: traceWrapper,
        encoding: "utf-8",
        timeout: 3000,
      });
      const res = spawnSync("docker", ["exec", "-i", container, "python3", `${containerDir}/runner.py`], {
        input: stdin || "",
        encoding: "utf-8",
        timeout: 6000,
      });
      const out = res.stdout || "";
      if (out.includes("__DEVNIX_TRACE_START__") && out.includes("__DEVNIX_TRACE_END__")) {
        const jsonStr = out.split("__DEVNIX_TRACE_START__")[1].split("__DEVNIX_TRACE_END__")[0].trim();
        const events: DynamicTraceEvent[] = JSON.parse(jsonStr);
        if (events.length > 0) return events;
      }
    } catch {}
  }

  return null;
}

/**
 * Universal JavaScript/Node.js Dynamic Runtime Tracer
 */
export function traceJavaScriptDynamic(sourceCode: string, stdin?: string): DynamicTraceEvent[] | null {
  const cleanSourceCode = (sourceCode || "").replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const uniqueId = `trace_${Date.now()}_${Math.floor(Math.random() * 10000)}`;

  const lines = cleanSourceCode.split("\n");
  const instrumentedLines = lines.map((line, idx) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("//") || trimmed.startsWith("/*") || trimmed === "{" || trimmed === "}") {
      return line;
    }
    return `__trace__(${idx + 1}); ${line}`;
  });

  const runnerCode = `
const trace_events = [];
let captured_stdout = "";
const orig_log = console.log;
console.log = (...args) => {
  const str = args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' ') + '\\n';
  captured_stdout += str;
};

function __trace__(lineNum) {
  trace_events.push({
    line: lineNum,
    variables: {},
    output: captured_stdout
  });
}

try {
  ${instrumentedLines.join("\n")}
} catch (e) {
  captured_stdout += e.toString();
} finally {
  console.log = orig_log;
  process.stdout.write("\\n__DEVNIX_TRACE_START__\\n" + JSON.stringify(trace_events) + "\\n__DEVNIX_TRACE_END__\\n");
}
`;

  try {
    const tmpDir = path.join(os.tmpdir(), "devnix_trace", uniqueId);
    fs.mkdirSync(tmpDir, { recursive: true });
    const scriptPath = path.join(tmpDir, "runner.js");
    const res = spawnSync(process.execPath, [scriptPath], {
      cwd: tmpDir,
      input: stdin || "",
      encoding: "utf-8",
      timeout: 5000,
    });

    try {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    } catch {}

    const out = res.stdout || "";
    if (out.includes("__DEVNIX_TRACE_START__") && out.includes("__DEVNIX_TRACE_END__")) {
      const jsonStr = out.split("__DEVNIX_TRACE_START__")[1].split("__DEVNIX_TRACE_END__")[0].trim();
      const events: DynamicTraceEvent[] = JSON.parse(jsonStr);
      if (events.length > 0) return events;
    }
  } catch {}

  return null;
}

/**
 * Universal Bash Runtime Tracer
 * Uses Bash DEBUG trap (trap '...' DEBUG) inside Linux container or local shell
 * to record real-time command execution, line numbers, and output streams.
 */
export function traceBashDynamic(sourceCode: string, stdin?: string): DynamicTraceEvent[] | null {
  const cleanSourceCode = (sourceCode || "").replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const container = getRunnerContainer();
  if (!container) return null;

  const uniqueId = `trace_${Date.now()}_${Math.floor(Math.random() * 10000)}`;
  const containerDir = `/tmp/sandbox/${uniqueId}`;

  // Bash Debug Hook Wrapper
  const bashWrapper = `#!/bin/bash
export DEVNIX_TRACING=1
trap 'echo "__DEVNIX_LINE__:$LINENO"' DEBUG
source "${containerDir}/user_script.sh"
`;

  try {
    spawnSync("docker", ["exec", "-i", container, "mkdir", "-p", containerDir], { encoding: "utf-8", timeout: 3000 });
    spawnSync("docker", ["exec", "-i", container, "sh", "-c", `cat > "${containerDir}/user_script.sh"`], {
      input: cleanSourceCode,
      encoding: "utf-8",
      timeout: 3000,
    });
    spawnSync("docker", ["exec", "-i", container, "sh", "-c", `cat > "${containerDir}/runner.sh"`], {
      input: bashWrapper,
      encoding: "utf-8",
      timeout: 3000,
    });

    const res = spawnSync("docker", ["exec", "-i", container, "bash", `${containerDir}/runner.sh`], {
      input: stdin || "",
      encoding: "utf-8",
      timeout: 6000,
    });

    const out = (res.stdout || "") + (res.stderr || "");
    const lines = out.split("\n");
    const events: DynamicTraceEvent[] = [];
    let curOutput = "";

    for (const l of lines) {
      if (l.startsWith("__DEVNIX_LINE__:")) {
        const lineNum = parseInt(l.split(":")[1], 10);
        if (!isNaN(lineNum) && lineNum > 0) {
          events.push({
            line: lineNum,
            variables: {},
            output: curOutput.trim(),
          });
        }
      } else {
        curOutput += l + "\n";
      }
    }

    return events.length > 0 ? events : null;
  } catch {}

  return null;
}
