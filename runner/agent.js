// DEVNIX runner agent: executes commands for the web app over an authenticated TCP socket.
// Protocol: client sends one JSON line {token, argv}, then raw stdin bytes (half-close = EOF).
// Agent replies with frames [type:1][len:4][payload]: 1=stdout, 2=stderr, 3=exit (int32 code).
const net = require("net");
const fs = require("fs");
const os = require("os");
const crypto = require("crypto");
const { spawn } = require("child_process");

const TOKEN = process.env.RUNNER_TOKEN || "";
if (TOKEN.length < 32) {
  console.error("RUNNER_TOKEN must be set (32+ chars)");
  process.exit(1);
}
const PORT = Number(process.env.RUNNER_PORT) || 7070;
const MAX_CONCURRENT = Number(process.env.RUNNER_MAX_CONCURRENT) || 16;
const HARD_LIMIT_MS = 60_000;
const MAX_PROCS = Number(process.env.RUNNER_MAX_PROCS) || 256;
const SANDBOX_DIR = "/tmp/sandbox";
const tokenBuf = crypto.createHash("sha256").update(TOKEN).digest();
const childEnv = {
  PATH: "/usr/local/bin:/usr/bin:/bin",
  HOME: "/tmp",
  GOCACHE: "/tmp/.gocache",
  GOPATH: "/tmp/go",
  CARGO_HOME: "/tmp/.cargo",
  LANG: "C.UTF-8",
};

fs.mkdirSync(SANDBOX_DIR, { recursive: true });
let active = 0;

function frame(type, payload) {
  const head = Buffer.alloc(5);
  head[0] = type;
  head.writeUInt32BE(payload.length, 1);
  return Buffer.concat([head, payload]);
}

function exitFrame(code) {
  const b = Buffer.alloc(4);
  b.writeInt32BE(code);
  return frame(3, b);
}

net
  .createServer({ allowHalfOpen: true }, (sock) => {
    sock.on("error", () => {});
    let header = Buffer.alloc(0);
    const headerDeadline = setTimeout(() => sock.destroy(), 5000);

    const onHeader = (data) => {
      header = Buffer.concat([header, data]);
      const nl = header.indexOf(10);
      if (nl < 0) {
        if (header.length > 1_000_000) sock.destroy();
        return;
      }
      clearTimeout(headerDeadline);
      sock.off("data", onHeader);
      sock.pause();

      let req;
      try {
        req = JSON.parse(header.subarray(0, nl).toString("utf-8"));
      } catch {
        return sock.destroy();
      }
      const given = crypto.createHash("sha256").update(String(req.token || "")).digest();
      if (!crypto.timingSafeEqual(given, tokenBuf)) return sock.destroy();
      if (!Array.isArray(req.argv) || req.argv.length === 0 || !req.argv.every((a) => typeof a === "string")) {
        return sock.destroy();
      }
      if (active >= MAX_CONCURRENT) {
        sock.write(frame(2, Buffer.from("Runner is busy, please try again.\n")));
        return sock.end(exitFrame(1));
      }

      active++;
      let finished = false;
      // Cap processes for the sandbox user so a fork bomb cannot exhaust the node's PIDs
      const child = spawn("sh", ["-c", `ulimit -u ${MAX_PROCS}; exec "$@"`, "runner", ...req.argv], {
        cwd: SANDBOX_DIR,
        env: childEnv,
        detached: true,
      });
      const killGroup = () => {
        try {
          process.kill(-child.pid, "SIGKILL");
        } catch {}
      };
      const hardLimit = setTimeout(killGroup, HARD_LIMIT_MS);
      const finish = (code) => {
        if (finished) return;
        finished = true;
        active--;
        clearTimeout(hardLimit);
        killGroup();
        sock.end(exitFrame(code));
      };

      child.stdin.on("error", () => {});
      const rest = header.subarray(nl + 1);
      if (rest.length) child.stdin.write(rest);
      sock.on("data", (d) => child.stdin.write(d));
      sock.on("end", () => child.stdin.end());
      sock.on("close", () => {
        if (!finished) killGroup();
      });
      sock.resume();

      child.stdout.on("data", (d) => sock.write(frame(1, d)));
      child.stderr.on("data", (d) => sock.write(frame(2, d)));
      child.on("error", (err) => {
        sock.write(frame(2, Buffer.from(`${err.message}\n`)));
        finish(127);
      });
      child.on("close", (code, signal) => {
        finish(code ?? 128 + (os.constants.signals[signal] || 9));
      });
    };
    sock.on("data", onHeader);
  })
  .listen(PORT, "0.0.0.0", () => console.log(`devnix runner agent listening on :${PORT}`));
