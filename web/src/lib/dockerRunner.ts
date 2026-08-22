import { spawnSync } from "child_process";

export interface DockerExecutionResult {
  stdout: string | null;
  stderr: string | null;
  compile_output?: string | null;
  status: { id: number; description: string };
  time: string;
  memory: number;
}

function getRunnerContainer(): string | null {
  try {
    const res = spawnSync("docker", ["ps", "--format", "{{.Names}}"], {
      encoding: "utf-8",
      timeout: 3000,
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

export function executeInDockerContainer(
  languageId: number,
  sourceCode: string,
  stdin?: string
): DockerExecutionResult {
  const container = getRunnerContainer();
  if (!container) {
    return {
      stdout: null,
      stderr: "Error: No Docker runner container found. Please ensure 'runner' container is running.",
      status: { id: 13, description: "Runner Offline" },
      time: "0.000",
      memory: 0,
    };
  }

  const uniqueId = `batch_${Date.now()}_${Math.floor(Math.random() * 10000)}`;
  const containerDir = `/tmp/sandbox/${uniqueId}`;

  try {
    spawnSync("docker", ["exec", "-i", container, "mkdir", "-p", containerDir], { encoding: "utf-8", timeout: 4000 });

    const extMap: Record<number, string> = {
      50: "c", 48: "c", 49: "c",
      54: "cpp", 52: "cpp", 53: "cpp",
      73: "rs", 60: "go", 71: "py", 63: "js", 74: "js",
      72: "rb", 68: "php", 46: "sh"
    };

    let runCmd = "";
    let compileCmd = "";

    if (languageId === 62) {
      // Java: detect class name
      const classMatch = sourceCode.match(/public\s+class\s+([A-Za-z0-9_]+)/) || sourceCode.match(/class\s+([A-Za-z0-9_]+)/);
      const className = classMatch ? classMatch[1] : "Main";
      spawnSync("docker", ["exec", "-i", container, "sh", "-c", `cat > "${containerDir}/${className}.java"`], {
        input: sourceCode,
        encoding: "utf-8",
        timeout: 4000,
      });
      compileCmd = `javac "${containerDir}/${className}.java"`;
      runCmd = `java -cp "${containerDir}" ${className}`;
    } else {
      const ext = extMap[languageId] || "py";
      const filePath = `${containerDir}/prog.${ext}`;
      spawnSync("docker", ["exec", "-i", container, "sh", "-c", `cat > "${filePath}"`], {
        input: sourceCode,
        encoding: "utf-8",
        timeout: 4000,
      });

      switch (languageId) {
        case 50:
        case 48:
        case 49:
          compileCmd = `gcc -O2 "${filePath}" -o "${containerDir}/prog.exe"`;
          runCmd = `"${containerDir}/prog.exe"`;
          break;
        case 54:
        case 52:
        case 53:
          compileCmd = `g++ -O2 "${filePath}" -o "${containerDir}/prog.exe"`;
          runCmd = `"${containerDir}/prog.exe"`;
          break;
        case 73:
          compileCmd = `rustc -O "${filePath}" -o "${containerDir}/prog.exe"`;
          runCmd = `"${containerDir}/prog.exe"`;
          break;
        case 60:
          runCmd = `go run "${filePath}"`;
          break;
        case 71:
          runCmd = `python3 -u "${filePath}"`;
          break;
        case 63:
        case 74:
          runCmd = `node "${filePath}"`;
          break;
        case 72:
          runCmd = `ruby "${filePath}"`;
          break;
        case 68:
          runCmd = `php "${filePath}"`;
          break;
        case 46:
          runCmd = `bash "${filePath}"`;
          break;
        default:
          runCmd = `python3 -u "${filePath}"`;
          break;
      }
    }

    // Run compilation if needed
    if (compileCmd) {
      const compRes = spawnSync("docker", ["exec", "-i", container, "sh", "-c", compileCmd], {
        encoding: "utf-8",
        timeout: 10000,
      });
      if (compRes.status !== 0) {
        return {
          stdout: null,
          stderr: null,
          compile_output: compRes.stderr || compRes.stdout || "Compilation failed.",
          status: { id: 6, description: "Compilation Error" },
          time: "0.000",
          memory: 0,
        };
      }
    }

    // Run execution with Stdin
    const startTime = Date.now();
    const execRes = spawnSync("docker", ["exec", "-i", container, "sh", "-c", runCmd], {
      input: stdin || "",
      encoding: "utf-8",
      timeout: 15000,
    });
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(3);

    const isSuccess = execRes.status === 0;

    return {
      stdout: execRes.stdout || null,
      stderr: execRes.stderr || null,
      status: isSuccess
        ? { id: 3, description: "Accepted" }
        : { id: 11, description: "Runtime Error" },
      time: elapsed,
      memory: 2048,
    };
  } catch (err: any) {
    return {
      stdout: null,
      stderr: `Execution error: ${err.message}`,
      status: { id: 13, description: "Internal Error" },
      time: "0.000",
      memory: 0,
    };
  } finally {
    // Cleanup container sandbox dir asynchronously
    try {
      spawnSync("docker", ["exec", "-i", container, "rm", "-rf", containerDir], { timeout: 3000 });
    } catch {}
  }
}
