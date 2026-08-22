import { spawn, ChildProcess } from "child_process";
import fs from "fs";
import path from "path";
import os from "os";
import { executeInLocalSandbox, checkCommandExists } from "@/lib/localSandbox";

interface ExecutionSession {
  id: string;
  process?: ChildProcess;
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
        args = ["-u", filePath];
        break;

      case 63: // JavaScript (Node.js)
      case 74: // TypeScript
        filePath = path.join(tmpDir, `${uniqueId}.js`);
        fs.writeFileSync(filePath, sourceCode, "utf-8");
        cleanupFiles.push(filePath);
        cmd = "node";
        args = ["--no-warnings", filePath];
        break;

      case 62: // Java
        if (checkCommandExists("javac") && checkCommandExists("java")) {
          const javaDir = path.join(tmpDir, uniqueId);
          fs.mkdirSync(javaDir, { recursive: true });
          filePath = path.join(javaDir, `Main.java`);
          fs.writeFileSync(filePath, sourceCode, "utf-8");
          cleanupFiles.push(javaDir);

          const { execSync } = require("child_process");
          try {
            execSync(`javac "${filePath}"`, { cwd: javaDir, timeout: 8000, stdio: "pipe" });
            cmd = "java";
            args = ["-cp", javaDir, "Main"];
          } catch (compileErr: any) {
            onData({ type: "stderr", text: compileErr.stderr ? compileErr.stderr.toString("utf-8") : compileErr.message });
            onData({ type: "exit", text: "", code: 1 });
            cleanupSession(sessionId);
            return true;
          }
        } else if (checkCommandExists("java")) {
          filePath = path.join(tmpDir, `${uniqueId}.java`);
          fs.writeFileSync(filePath, sourceCode, "utf-8");
          cleanupFiles.push(filePath);
          cmd = "java";
          args = [filePath];
        } else {
          // Fallback to local sandbox runner
          const res = executeInLocalSandbox(langId, sourceCode, "");
          if (res.stdout) onData({ type: "stdout", text: res.stdout });
          if (res.stderr) onData({ type: "stderr", text: res.stderr });
          if (res.compile_output) onData({ type: "stderr", text: res.compile_output });
          onData({ type: "exit", text: "", code: res.status.id === 3 ? 0 : 1 });
          return true;
        }
        break;

      case 54: // C++
      case 50: // C
        const isCpp = langId === 54;
        const compiler = isCpp ? "g++" : "gcc";
        const srcExt = isCpp ? "cpp" : "c";
        filePath = path.join(tmpDir, `${uniqueId}.${srcExt}`);
        const exePath = path.join(tmpDir, `${uniqueId}.exe`);
        fs.writeFileSync(filePath, sourceCode, "utf-8");
        cleanupFiles.push(filePath, exePath);

        if (checkCommandExists(compiler)) {
          const { execSync } = require("child_process");
          try {
            execSync(`${compiler} "${filePath}" -o "${exePath}"`, { timeout: 8000, stdio: "pipe" });
            cmd = exePath;
            args = [];
          } catch (compileErr: any) {
            onData({ type: "stderr", text: compileErr.stderr ? compileErr.stderr.toString("utf-8") : compileErr.message });
            onData({ type: "exit", text: "", code: 1 });
            cleanupSession(sessionId);
            return true;
          }
        } else {
          const res = executeInLocalSandbox(langId, sourceCode, "");
          if (res.stdout) onData({ type: "stdout", text: res.stdout });
          if (res.stderr) onData({ type: "stderr", text: res.stderr });
          onData({ type: "exit", text: "", code: res.status.id === 3 ? 0 : 1 });
          return true;
        }
        break;

      case 73: // Rust
        filePath = path.join(tmpDir, `${uniqueId}.rs`);
        const rustExe = path.join(tmpDir, `${uniqueId}.exe`);
        fs.writeFileSync(filePath, sourceCode, "utf-8");
        cleanupFiles.push(filePath, rustExe);

        if (checkCommandExists("rustc")) {
          const { execSync } = require("child_process");
          try {
            execSync(`rustc "${filePath}" -o "${rustExe}"`, { timeout: 8000, stdio: "pipe" });
            cmd = rustExe;
            args = [];
          } catch (compileErr: any) {
            onData({ type: "stderr", text: compileErr.stderr ? compileErr.stderr.toString("utf-8") : compileErr.message });
            onData({ type: "exit", text: "", code: 1 });
            cleanupSession(sessionId);
            return true;
          }
        } else {
          const res = executeInLocalSandbox(langId, sourceCode, "");
          if (res.stdout) onData({ type: "stdout", text: res.stdout });
          if (res.stderr) onData({ type: "stderr", text: res.stderr });
          onData({ type: "exit", text: "", code: res.status.id === 3 ? 0 : 1 });
          return true;
        }
        break;

      case 60: // Go
        filePath = path.join(tmpDir, `${uniqueId}.go`);
        fs.writeFileSync(filePath, sourceCode, "utf-8");
        cleanupFiles.push(filePath);

        if (checkCommandExists("go")) {
          cmd = "go";
          args = ["run", filePath];
        } else {
          const res = executeInLocalSandbox(langId, sourceCode, "");
          if (res.stdout) onData({ type: "stdout", text: res.stdout });
          if (res.stderr) onData({ type: "stderr", text: res.stderr });
          onData({ type: "exit", text: "", code: res.status.id === 3 ? 0 : 1 });
          return true;
        }
        break;

      case 72: // Ruby
        filePath = path.join(tmpDir, `${uniqueId}.rb`);
        fs.writeFileSync(filePath, sourceCode, "utf-8");
        cleanupFiles.push(filePath);

        if (checkCommandExists("ruby")) {
          cmd = "ruby";
          args = [filePath];
        } else {
          const res = executeInLocalSandbox(langId, sourceCode, "");
          if (res.stdout) onData({ type: "stdout", text: res.stdout });
          if (res.stderr) onData({ type: "stderr", text: res.stderr });
          onData({ type: "exit", text: "", code: res.status.id === 3 ? 0 : 1 });
          return true;
        }
        break;

      case 68: // PHP
        filePath = path.join(tmpDir, `${uniqueId}.php`);
        fs.writeFileSync(filePath, sourceCode, "utf-8");
        cleanupFiles.push(filePath);

        if (checkCommandExists("php")) {
          cmd = "php";
          args = [filePath];
        } else {
          const res = executeInLocalSandbox(langId, sourceCode, "");
          if (res.stdout) onData({ type: "stdout", text: res.stdout });
          if (res.stderr) onData({ type: "stderr", text: res.stderr });
          onData({ type: "exit", text: "", code: res.status.id === 3 ? 0 : 1 });
          return true;
        }
        break;

      case 46: // Bash
        filePath = path.join(tmpDir, `${uniqueId}.sh`);
        fs.writeFileSync(filePath, sourceCode.replace(/\r\n/g, "\n"), "utf-8");
        cleanupFiles.push(filePath);

        if (fs.existsSync("C:\\Program Files\\Git\\bin\\bash.exe")) {
          cmd = "C:\\Program Files\\Git\\bin\\bash.exe";
          args = [filePath];
        } else if (checkCommandExists("bash")) {
          cmd = "bash";
          args = [filePath];
        } else {
          const res = executeInLocalSandbox(langId, sourceCode, "");
          if (res.stdout) onData({ type: "stdout", text: res.stdout });
          if (res.stderr) onData({ type: "stderr", text: res.stderr });
          onData({ type: "exit", text: "", code: res.status.id === 3 ? 0 : 1 });
          return true;
        }
        break;

      default:
        const res = executeInLocalSandbox(langId, sourceCode, "");
        if (res.stdout) onData({ type: "stdout", text: res.stdout });
        if (res.stderr) onData({ type: "stderr", text: res.stderr });
        onData({ type: "exit", text: "", code: res.status.id === 3 ? 0 : 1 });
        return true;
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
        text: "",
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
    session.process?.kill("SIGTERM");
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
