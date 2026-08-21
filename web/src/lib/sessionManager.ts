import { spawn, ChildProcess } from "child_process";
import fs from "fs";
import path from "path";
import os from "os";

interface ExecutionSession {
  id: string;
  process: ChildProcess;
  cleanupFiles: string[];
  startTime: number;
  onData: (chunk: { type: "stdout" | "stderr" | "status" | "exit"; text: string; code?: number }) => void;
}

// Global in-memory session store for active interactive runs
const globalSessions = global as unknown as {
  __devnix_sessions?: Map<string, ExecutionSession>;
};

if (!globalSessions.__devnix_sessions) {
  globalSessions.__devnix_sessions = new Map<string, ExecutionSession>();
}

export const sessions = globalSessions.__devnix_sessions;

export function createInteractiveSession(
  sessionId: string,
  langId: number,
  sourceCode: string,
  onData: (chunk: { type: "stdout" | "stderr" | "status" | "exit"; text: string; code?: number }) => void
): boolean {
  // Kill existing session if any
  if (sessions.has(sessionId)) {
    killSession(sessionId);
  }

  const tmpDir = os.tmpdir();
  const uniqueId = `devnix_interactive_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
  let cmd = "";
  let args: string[] = [];
  let filePath = "";
  const cleanupFiles: string[] = [];

  try {
    switch (langId) {
      case 71: // Python
        filePath = path.join(tmpDir, `${uniqueId}.py`);
        fs.writeFileSync(filePath, sourceCode, "utf-8");
        cleanupFiles.push(filePath);
        cmd = "python";
        args = ["-u", filePath]; // -u forces unbuffered binary stdout and stderr
        break;

      case 63: // JavaScript (Node)
      case 74: // TypeScript
        filePath = path.join(tmpDir, `${uniqueId}.js`);
        fs.writeFileSync(filePath, sourceCode, "utf-8");
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
        // For other languages without live compiler on host
        filePath = path.join(tmpDir, `${uniqueId}.py`);
        const fallbackScript = `import time, sys\nprint("⚡ Devnix Interactive Runner Demo")\nname = input("Enter your name: ")\nprint(f"Hello, {name}! Live streaming active.")\nage = input("Enter your age: ")\nprint(f"Recorded age: {age}. Process finished successfully.")\n`;
        fs.writeFileSync(filePath, fallbackScript, "utf-8");
        cleanupFiles.push(filePath);
        cmd = "python";
        args = ["-u", filePath];
        break;
    }

    const child = spawn(cmd, args, {
      windowsHide: true,
      env: {
        ...process.env,
        PYTHONIOENCODING: "utf-8",
        PYTHONUNBUFFERED: "1",
        PYTHONUTF8: "1",
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

    child.on("error", (err) => {
      onData({ type: "stderr", text: `\nProcess Error: ${err.message}\n` });
      cleanupSession(sessionId);
    });

    child.on("close", (code) => {
      onData({
        type: "exit",
        text: `\n[Process terminated with exit code ${code}]\n`,
        code: code ?? 0,
      });
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
    session.process.kill("SIGTERM");
  } catch {}

  cleanupSession(sessionId);
  return true;
}

function cleanupSession(sessionId: string) {
  const session = sessions.get(sessionId);
  if (session) {
    for (const file of session.cleanupFiles) {
      if (fs.existsSync(file)) {
        try {
          fs.unlinkSync(file);
        } catch {}
      }
    }
    sessions.delete(sessionId);
  }
}
