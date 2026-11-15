// DEVNIX runner client: runs one command in the runner container through the runner agent.
// Usage: node runner-client.js <argv...>  (stdin, stdout, stderr and exit code are proxied)
const net = require("net");

const host = process.env.DEVNIX_RUNNER_HOST || "runner";
const port = Number(process.env.DEVNIX_RUNNER_PORT) || 7070;
const token = process.env.DEVNIX_RUNNER_TOKEN || "";
const argv = process.argv.slice(2);

let buffer = Buffer.alloc(0);
let exited = false;

function exitWith(code) {
  exited = true;
  process.stdout.write("", () => process.stderr.write("", () => process.exit(code)));
}

const sock = net.connect({ host, port, allowHalfOpen: true }, () => {
  sock.write(JSON.stringify({ token, argv }) + "\n");
  process.stdin.pipe(sock);
});

sock.on("data", (data) => {
  buffer = Buffer.concat([buffer, data]);
  while (buffer.length >= 5) {
    const len = buffer.readUInt32BE(1);
    if (buffer.length < 5 + len) break;
    const type = buffer[0];
    const payload = buffer.subarray(5, 5 + len);
    buffer = buffer.subarray(5 + len);
    if (type === 1) process.stdout.write(payload);
    else if (type === 2) process.stderr.write(payload);
    else if (type === 3) return exitWith(payload.readInt32BE(0));
  }
});

sock.on("error", (err) => {
  if (!exited) {
    process.stderr.write(`Runner unavailable: ${err.message}\n`);
    exitWith(1);
  }
});

sock.on("close", () => {
  if (!exited) {
    process.stderr.write("Runner connection closed unexpectedly.\n");
    exitWith(1);
  }
});
