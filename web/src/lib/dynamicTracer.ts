import { runnerSpawn, runnerSpawnSync, RUNNER_NAME } from "./runner";

export interface DynamicTraceEvent {
  line: number;
  variables: Record<string, any>;
  output?: string;
  explanation?: string;
}

function getRunnerContainer(): string | null {
  return RUNNER_NAME;
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
import sys, json, io, time

trace_events = []
captured_stdout = io.StringIO()
orig_stdout = sys.stdout
sys.stdout = captured_stdout

start_time = time.time()
MAX_EVENTS = 3000
MAX_TIME_SEC = 3.0

def devnix_tracer(frame, event, arg):
    if event == 'line':
        if len(trace_events) >= MAX_EVENTS or (time.time() - start_time) > MAX_TIME_SEC:
            sys.settrace(None)
            return None
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

  // Always run in the isolated runner container (never inside the web container)
  const container = getRunnerContainer();
  if (container) {
    const containerDir = `/tmp/sandbox/${uniqueId}`;
    try {
      runnerSpawnSync(["mkdir", "-p", containerDir], { encoding: "utf-8", timeout: 3000 });
      runnerSpawnSync(["sh", "-c", `cat > "${containerDir}/user_code.py"`], {
        input: cleanSourceCode,
        encoding: "utf-8",
        timeout: 3000,
      });
      runnerSpawnSync(["sh", "-c", `cat > "${containerDir}/runner.py"`], {
        input: traceWrapper,
        encoding: "utf-8",
        timeout: 3000,
      });
      const res = runnerSpawnSync(["sh", "-c", `cd "${containerDir}" && timeout --kill-after=1s 5s python3 runner.py`], {
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
    } catch {} finally {
      try {
        runnerSpawnSync([
          "sh",
          "-c",
          `pkill -9 -f "${containerDir}" 2>/dev/null || true; rm -rf "${containerDir}"`
        ], { timeout: 3000 });
      } catch {}
    }
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

const start_time = Date.now();
const MAX_EVENTS = 3000;
const MAX_TIME_MS = 3000;

function __trace__(lineNum) {
  if (trace_events.length >= MAX_EVENTS || Date.now() - start_time > MAX_TIME_MS) {
    return;
  }
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

  const container = getRunnerContainer();
  if (!container) return null;
  const containerDir = `/tmp/sandbox/${uniqueId}`;

  try {
    runnerSpawnSync(["mkdir", "-p", containerDir], { encoding: "utf-8", timeout: 3000 });
    runnerSpawnSync(["sh", "-c", `cat > "${containerDir}/runner.js"`], {
      input: runnerCode,
      encoding: "utf-8",
      timeout: 3000,
    });
    const res = runnerSpawnSync(["sh", "-c", `timeout --kill-after=1s 5s node "${containerDir}/runner.js"`], {
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
  } catch {} finally {
    try {
      runnerSpawnSync(["sh", "-c", `rm -rf "${containerDir}"`], { timeout: 3000 });
    } catch {}
  }

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
    runnerSpawnSync(["mkdir", "-p", containerDir], { encoding: "utf-8", timeout: 3000 });
    runnerSpawnSync(["sh", "-c", `cat > "${containerDir}/user_script.sh"`], {
      input: cleanSourceCode,
      encoding: "utf-8",
      timeout: 3000,
    });
    runnerSpawnSync(["sh", "-c", `cat > "${containerDir}/runner.sh"`], {
      input: bashWrapper,
      encoding: "utf-8",
      timeout: 3000,
    });

    const res = runnerSpawnSync(["bash", `${containerDir}/runner.sh`], {
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
