import { spawn, spawnSync, ChildProcess, execSync } from "child_process";
import fs from "fs";
import path from "path";
import os from "os";

interface ExecutionSession {
  id: string;
  process?: ChildProcess;
  cleanupFiles: string[];
  containerCleanupDir?: string;
  startTime: number;
  onData: (chunk: { type: "stdout" | "stderr" | "status" | "exit"; text: string; code?: number }) => void;
}

const globalSessions = global as unknown as {
  __devnix_sessions?: Map<string, ExecutionSession>;
};

if (!globalSessions.__devnix_sessions) {
  globalSessions.__devnix_sessions = new Map<string, ExecutionSession>();
}

export const sessions = globalSessions.__devnix_sessions;

function isDockerContainerRunning(containerName: string = "judge0-workers-1"): boolean {
  try {
    const res = spawnSync("docker", ["ps", "--filter", `name=${containerName}`, "--format", "{{.Names}}"], {
      encoding: "utf-8",
      timeout: 3000,
    });
    return res.stdout ? res.stdout.includes(containerName) : false;
  } catch {
    return false;
  }
}

const CONTAINER_ENV_PATH = "export PATH=/usr/local/rust-1.40.0/bin:/usr/local/go-1.13.5/bin:/usr/local/php-7.4.1/bin:/usr/local/ruby-2.7.0/bin:/usr/local/openjdk13/bin:/usr/local/node-12.14.0/bin:/usr/local/python-3.8.1/bin:$PATH";

export function createInteractiveSession(
  sessionId: string,
  langId: number,
  sourceCode: string,
  onData: (chunk: { type: "stdout" | "stderr" | "status" | "exit"; text: string; code?: number }) => void
): boolean {
  if (sessions.has(sessionId)) {
    killSession(sessionId);
  }

  const uniqueId = `devnix_interactive_${Date.now()}_${Math.floor(Math.random() * 10000)}`;
  const cleanupFiles: string[] = [];
  let containerCleanupDir = "";

  // 1. DOCKER INTERACTIVE STREAMING
  if (isDockerContainerRunning("judge0-workers-1")) {
    try {
      const containerFile = `/tmp/${uniqueId}`;
      containerCleanupDir = containerFile;
      let compileCmd = "";
      let execArgs: string[] = [];

      let codeToWrite = sourceCode;

      // Handle TypeScript transpilation
      if (langId === 74) {
        try {
          const ts = require("typescript");
          const transpileResult = ts.transpileModule(sourceCode, {
            compilerOptions: {
              module: ts.ModuleKind.CommonJS,
              target: ts.ScriptTarget.ES2022,
              esModuleInterop: true,
            },
            reportDiagnostics: true,
          });

          if (transpileResult.diagnostics && transpileResult.diagnostics.length > 0) {
            const err = transpileResult.diagnostics[0];
            const msg = typeof err.messageText === "string" ? err.messageText : err.messageText.messageText;
            onData({ type: "stderr", text: `TypeScript Compilation Error: ${msg}\n` });
            onData({ type: "exit", text: "", code: 1 });
            return true;
          }
          codeToWrite = transpileResult.outputText;
        } catch (tsErr: any) {
          onData({ type: "stderr", text: `TypeScript Error: ${tsErr.message}\n` });
          onData({ type: "exit", text: "", code: 1 });
          return true;
        }
      }

      switch (langId) {
        case 50: // C
        case 48:
        case 49:
          compileCmd = `${CONTAINER_ENV_PATH}; gcc -O2 "${containerFile}.c" -o "${containerFile}.exe"`;
          execArgs = ["exec", "-i", "judge0-workers-1", `${containerFile}.exe`];
          break;

        case 54: // C++
        case 52:
        case 53:
          compileCmd = `${CONTAINER_ENV_PATH}; g++ -O2 "${containerFile}.cpp" -o "${containerFile}.exe"`;
          execArgs = ["exec", "-i", "judge0-workers-1", `${containerFile}.exe`];
          break;

        case 62: // Java
          compileCmd = `${CONTAINER_ENV_PATH}; javac "${containerFile}/Main.java"`;
          execArgs = ["exec", "-i", "judge0-workers-1", "sh", "-c", `${CONTAINER_ENV_PATH}; java -cp "${containerFile}" Main`];
          break;

        case 73: // Rust
          compileCmd = `${CONTAINER_ENV_PATH}; rustc -O "${containerFile}.rs" -o "${containerFile}.exe"`;
          execArgs = ["exec", "-i", "judge0-workers-1", `${containerFile}.exe`];
          break;

        case 60: // Go
          execArgs = ["exec", "-i", "judge0-workers-1", "sh", "-c", `${CONTAINER_ENV_PATH}; go run "${containerFile}.go"`];
          break;

        case 71: // Python
          execArgs = ["exec", "-i", "judge0-workers-1", "sh", "-c", `${CONTAINER_ENV_PATH}; python3 -u "${containerFile}.py"`];
          break;

        case 63: // JavaScript
        case 74: // TypeScript
          execArgs = ["exec", "-i", "judge0-workers-1", "sh", "-c", `${CONTAINER_ENV_PATH}; node "${containerFile}.js"`];
          break;

        case 72: // Ruby
          execArgs = ["exec", "-i", "judge0-workers-1", "sh", "-c", `${CONTAINER_ENV_PATH}; ruby "${containerFile}.rb"`];
          break;

        case 68: // PHP
          execArgs = ["exec", "-i", "judge0-workers-1", "sh", "-c", `${CONTAINER_ENV_PATH}; php "${containerFile}.php"`];
          break;

        case 46: // Bash
          execArgs = ["exec", "-i", "judge0-workers-1", "bash", `${containerFile}.sh`];
          break;

        default:
          execArgs = ["exec", "-i", "judge0-workers-1", "sh", "-c", `${CONTAINER_ENV_PATH}; python3 -u "${containerFile}.py"`];
          break;
      }

      // Write code into container
      const extMap: Record<number, string> = {
        50: "c", 48: "c", 49: "c",
        54: "cpp", 52: "cpp", 53: "cpp",
        73: "rs", 60: "go", 71: "py", 63: "js", 74: "js",
        72: "rb", 68: "php", 46: "sh"
      };

      if (langId === 62) {
        spawnSync("docker", ["exec", "-i", "judge0-workers-1", "mkdir", "-p", containerFile], { encoding: "utf-8" });
        spawnSync("docker", ["exec", "-i", "judge0-workers-1", "sh", "-c", `cat > "${containerFile}/Main.java"`], {
          input: codeToWrite,
          encoding: "utf-8",
          timeout: 4000,
        });
      } else {
        const ext = extMap[langId] || "py";
        spawnSync("docker", ["exec", "-i", "judge0-workers-1", "sh", "-c", `cat > "${containerFile}.${ext}"`], {
          input: codeToWrite,
          encoding: "utf-8",
          timeout: 4000,
        });
      }

      // If compilation step required, run it
      if (compileCmd) {
        const compileProc = spawnSync("docker", ["exec", "-i", "judge0-workers-1", "sh", "-c", compileCmd], {
          encoding: "utf-8",
          timeout: 8000,
        });

        if (compileProc.status !== 0) {
          const errOutput = compileProc.stderr || compileProc.stdout || "Compilation failed";
          spawnSync("docker", ["exec", "judge0-workers-1", "rm", "-rf", `${containerFile}*`]);
          onData({ type: "stderr", text: errOutput });
          onData({ type: "exit", text: "", code: 1 });
          return true;
        }
      }

      // Spawn interactive child process
      const child = spawn("docker", execArgs, {
        windowsHide: true,
        env: {
          ...process.env,
          PYTHONIOENCODING: "utf-8",
          PYTHONUNBUFFERED: "1",
        },
      });

      const session: ExecutionSession = {
        id: sessionId,
        process: child,
        cleanupFiles,
        containerCleanupDir,
        startTime: Date.now(),
        onData,
      };

      sessions.set(sessionId, session);

      child.stdout?.on("data", (data) => {
        onData({ type: "stdout", text: data.toString("utf-8") });
      });

      child.stderr?.on("data", (data) => {
        onData({ type: "stderr", text: data.toString("utf-8") });
      });

      child.on("error", (err) => {
        onData({ type: "stderr", text: `\nProcess Error: ${err.message}\n` });
        cleanupSession(sessionId);
      });

      child.on("close", (code) => {
        onData({
          type: "exit",
          text: "",
          code: code ?? 0,
        });
        cleanupSession(sessionId);
      });

      return true;
    } catch (dockerErr: any) {
      // Fall through to host fallback
    }
  }

  // 2. LOCAL HOST FALLBACK
  const tmpDir = os.tmpdir();
  let cmd = "";
  let args: string[] = [];
  let filePath = "";

  try {
    switch (langId) {
      case 71: // Python
        filePath = path.join(tmpDir, `${uniqueId}.py`);
        fs.writeFileSync(filePath, sourceCode, "utf-8");
        cleanupFiles.push(filePath);
        cmd = "python";
        args = ["-u", filePath];
        break;

      case 63: // JavaScript
        filePath = path.join(tmpDir, `${uniqueId}.js`);
        fs.writeFileSync(filePath, sourceCode, "utf-8");
        cleanupFiles.push(filePath);
        cmd = "node";
        args = ["--no-warnings", filePath];
        break;

      case 74: // TypeScript
        const ts = require("typescript");
        const transpileResult = ts.transpileModule(sourceCode, {
          compilerOptions: { module: ts.ModuleKind.CommonJS },
        });
        filePath = path.join(tmpDir, `${uniqueId}.js`);
        fs.writeFileSync(filePath, transpileResult.outputText, "utf-8");
        cleanupFiles.push(filePath);
        cmd = "node";
        args = ["--no-warnings", filePath];
        break;

      case 46: // Bash
        filePath = path.join(tmpDir, `${uniqueId}.sh`);
        fs.writeFileSync(filePath, sourceCode.replace(/\r\n/g, "\n"), "utf-8");
        cleanupFiles.push(filePath);
        if (fs.existsSync("C:\\Program Files\\Git\\bin\\bash.exe")) {
          cmd = "C:\\Program Files\\Git\\bin\\bash.exe";
          args = [filePath];
        } else {
          cmd = "bash";
          args = [filePath];
        }
        break;

      default:
        onData({ type: "stderr", text: `Error: Language ID ${langId} requires Docker container to be running.\n` });
        onData({ type: "exit", text: "", code: 1 });
        return true;
    }

    const child = spawn(cmd, args, {
      windowsHide: true,
      env: {
        ...process.env,
        PYTHONIOENCODING: "utf-8",
        PYTHONUNBUFFERED: "1",
      },
    });

    const session: ExecutionSession = {
      id: sessionId,
      process: child,
      cleanupFiles,
      startTime: Date.now(),
      onData,
    };

    sessions.set(sessionId, session);

    child.stdout?.on("data", (data) => {
      onData({ type: "stdout", text: data.toString("utf-8") });
    });

    child.stderr?.on("data", (data) => {
      onData({ type: "stderr", text: data.toString("utf-8") });
    });

    child.on("close", (code) => {
      onData({ type: "exit", text: "", code: code ?? 0 });
      cleanupSession(sessionId);
    });

    return true;
  } catch (err: any) {
    onData({ type: "stderr", text: `Failed to start process: ${err.message}` });
    return false;
  }
}

export function sendInputToSession(sessionId: string, input: string): boolean {
  const session = sessions.get(sessionId);
  if (!session || !session.process || !session.process.stdin) {
    return false;
  }

  try {
    session.process.stdin.write(input + "\n");
    return true;
  } catch {
    return false;
  }
}

export function killSession(sessionId: string): boolean {
  const session = sessions.get(sessionId);
  if (!session) return false;

  try {
    session.process?.kill("SIGTERM");
  } catch {}

  cleanupSession(sessionId);
  return true;
}

function cleanupSession(sessionId: string) {
  const session = sessions.get(sessionId);
  if (session) {
    if (session.containerCleanupDir) {
      spawnSync("docker", ["exec", "judge0-workers-1", "rm", "-rf", `${session.containerCleanupDir}*`]);
    }
    for (const file of session.cleanupFiles) {
      if (fs.existsSync(file)) {
        try {
          const stat = fs.statSync(file);
          if (stat.isDirectory()) {
            fs.rmSync(file, { recursive: true, force: true });
          } else {
            fs.unlinkSync(file);
          }
        } catch {}
      }
    }
    sessions.delete(sessionId);
  }
}
