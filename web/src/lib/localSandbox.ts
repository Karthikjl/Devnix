import { spawnSync, execSync } from "child_process";
import fs from "fs";
import path from "path";
import os from "os";

export interface SandboxResult {
  stdout?: string | null;
  stderr?: string | null;
  compile_output?: string | null;
  message?: string | null;
  time?: string | null;
  memory?: number | null;
  status: {
    id: number;
    description: string;
  };
}

let isDockerAvailableCache: boolean | null = null;

function isDockerContainerRunning(containerName: string = "judge0-workers-1"): boolean {
  if (isDockerAvailableCache !== null) return isDockerAvailableCache;
  try {
    const res = spawnSync("docker", ["ps", "--filter", `name=${containerName}`, "--format", "{{.Names}}"], {
      encoding: "utf-8",
      timeout: 3000,
    });
    isDockerAvailableCache = res.stdout ? res.stdout.includes(containerName) : false;
    return isDockerAvailableCache;
  } catch {
    isDockerAvailableCache = false;
    return false;
  }
}

export function checkCommandExists(cmd: string): boolean {
  try {
    const isWindows = process.platform === "win32";
    const checkCmd = isWindows ? `where ${cmd}` : `which ${cmd}`;
    execSync(checkCmd, { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

const CONTAINER_ENV_PATH = "export PATH=/usr/local/rust-1.40.0/bin:/usr/local/go-1.13.5/bin:/usr/local/php-7.4.1/bin:/usr/local/ruby-2.7.0/bin:/usr/local/openjdk13/bin:/usr/local/node-12.14.0/bin:/usr/local/python-3.8.1/bin:$PATH";

/**
 * Executes user source code inside the real Judge0 Docker container or local host environment
 */
export function executeInLocalSandbox(
  langId: number,
  sourceCode: string,
  stdin: string = ""
): SandboxResult {
  const startTime = Date.now();
  const tmpDir = os.tmpdir();
  const uniqueId = `devnix_${Date.now()}_${Math.floor(Math.random() * 10000)}`;

  // 1. If Judge0 container is running, execute inside container with real compilers
  if (isDockerContainerRunning("judge0-workers-1")) {
    try {
      const containerFile = `/tmp/${uniqueId}`;
      let compileCmd = "";
      let runCmd = "";

      switch (langId) {
        case 50: // C
        case 48:
        case 49:
          compileCmd = `${CONTAINER_ENV_PATH}; gcc -O2 "${containerFile}.c" -o "${containerFile}.exe"`;
          runCmd = `${CONTAINER_ENV_PATH}; "${containerFile}.exe"`;
          break;

        case 54: // C++
        case 52:
        case 53:
          compileCmd = `${CONTAINER_ENV_PATH}; g++ -O2 "${containerFile}.cpp" -o "${containerFile}.exe"`;
          runCmd = `${CONTAINER_ENV_PATH}; "${containerFile}.exe"`;
          break;

        case 62: // Java
          compileCmd = `${CONTAINER_ENV_PATH}; javac "${containerFile}/Main.java"`;
          runCmd = `${CONTAINER_ENV_PATH}; java -cp "${containerFile}" Main`;
          break;

        case 73: // Rust
          compileCmd = `${CONTAINER_ENV_PATH}; rustc -O "${containerFile}.rs" -o "${containerFile}.exe"`;
          runCmd = `${CONTAINER_ENV_PATH}; "${containerFile}.exe"`;
          break;

        case 60: // Go
          runCmd = `${CONTAINER_ENV_PATH}; go run "${containerFile}.go"`;
          break;

        case 71: // Python
          runCmd = `${CONTAINER_ENV_PATH}; python3 -u "${containerFile}.py"`;
          break;

        case 63: // JavaScript
          runCmd = `${CONTAINER_ENV_PATH}; node "${containerFile}.js"`;
          break;

        case 74: // TypeScript
          // For TypeScript, strip basic types or run with tsx/node
          runCmd = `${CONTAINER_ENV_PATH}; node "${containerFile}.js"`;
          break;

        case 72: // Ruby
          runCmd = `${CONTAINER_ENV_PATH}; ruby "${containerFile}.rb"`;
          break;

        case 68: // PHP
          runCmd = `${CONTAINER_ENV_PATH}; php "${containerFile}.php"`;
          break;

        case 46: // Bash
          runCmd = `${CONTAINER_ENV_PATH}; bash "${containerFile}.sh"`;
          break;

        default:
          runCmd = `${CONTAINER_ENV_PATH}; python3 -u "${containerFile}.py"`;
          break;
      }

      // Write file into container
      const extMap: Record<number, string> = {
        50: "c", 48: "c", 49: "c",
        54: "cpp", 52: "cpp", 53: "cpp",
        73: "rs", 60: "go", 71: "py", 63: "js", 74: "js",
        72: "rb", 68: "php", 46: "sh"
      };

      let codeToWrite = sourceCode;
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
            return {
              stdout: null,
              stderr: `TypeScript Compilation Error: ${msg}\n`,
              compile_output: `TypeScript Compilation Error: ${msg}\n`,
              time: "0.010",
              memory: 0,
              status: { id: 6, description: "Compilation Error" },
            };
          }
          codeToWrite = transpileResult.outputText;
        } catch (tsErr: any) {
          return {
            stdout: null,
            stderr: `TypeScript Error: ${tsErr.message}\n`,
            compile_output: `TypeScript Error: ${tsErr.message}\n`,
            time: "0.010",
            memory: 0,
            status: { id: 6, description: "Compilation Error" },
          };
        }
      }

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

      // If compilation is needed, run compiler
      if (compileCmd) {
        const compileProc = spawnSync("docker", ["exec", "-i", "judge0-workers-1", "sh", "-c", compileCmd], {
          encoding: "utf-8",
          timeout: 8000,
        });

        if (compileProc.status !== 0) {
          const errOutput = compileProc.stderr || compileProc.stdout || "Compilation failed";
          // Cleanup
          spawnSync("docker", ["exec", "judge0-workers-1", "rm", "-rf", `${containerFile}*`]);
          return {
            stdout: null,
            stderr: errOutput,
            compile_output: errOutput,
            time: ((Date.now() - startTime) / 1000).toFixed(3),
            memory: 0,
            status: { id: 6, description: "Compilation Error" },
          };
        }
      }

      // Execute binary / script
      const runProc = spawnSync("docker", ["exec", "-i", "judge0-workers-1", "sh", "-c", runCmd], {
        input: stdin || undefined,
        encoding: "utf-8",
        timeout: 10000,
      });

      // Cleanup files in container
      spawnSync("docker", ["exec", "judge0-workers-1", "rm", "-rf", `${containerFile}*`]);

      const elapsed = ((Date.now() - startTime) / 1000).toFixed(3);
      const stdout = runProc.stdout || null;
      const stderr = runProc.stderr || null;
      const isSuccess = runProc.status === 0;

      return {
        stdout: stdout ? stdout.toString() : null,
        stderr: stderr ? stderr.toString() : null,
        time: elapsed,
        memory: 12400,
        status: {
          id: isSuccess ? 3 : 11,
          description: isSuccess ? "Accepted" : "Runtime Error",
        },
      };
    } catch (dockerErr: any) {
      // Fall through to host fallback
    }
  }

  // 2. Host execution fallback (if compilers are in host PATH)
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

      case 63: // JavaScript
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
        } else if (checkCommandExists("bash")) {
          cmd = "bash";
          args = [filePath];
        } else {
          return {
            stdout: null,
            stderr: "Error: Bash is not installed on host machine and Docker container is unavailable.",
            status: { id: 13, description: "Runtime Error" },
          };
        }
        break;

      default:
        return {
          stdout: null,
          stderr: `Error: Compiler for language ID ${langId} is not installed locally and Docker container is offline.`,
          time: "0.000",
          memory: 0,
          status: { id: 13, description: "Internal Error" },
        };
    }

    const child = spawnSync(cmd, args, {
      input: stdin || undefined,
      timeout: 10000,
      encoding: "utf-8",
      windowsHide: true,
      env: {
        ...process.env,
        PYTHONIOENCODING: "utf-8",
        PYTHONUNBUFFERED: "1",
        PYTHONUTF8: "1",
      },
    });

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(3);
    const stdout = child.stdout || null;
    const stderr = child.stderr || null;
    const isSuccess = child.status === 0;

    return {
      stdout: stdout ? stdout.toString() : null,
      stderr: stderr ? stderr.toString() : null,
      time: elapsed,
      memory: 8192,
      status: {
        id: isSuccess ? 3 : 11,
        description: isSuccess ? "Accepted" : "Runtime Error",
      },
    };
  } catch (err: any) {
    return {
      stdout: null,
      stderr: err.message,
      time: "0.000",
      memory: 0,
      status: { id: 13, description: "Internal Error" },
    };
  } finally {
    for (const file of cleanupFiles) {
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
  }
}
