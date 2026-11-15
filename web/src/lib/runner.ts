import { spawn, spawnSync, SpawnOptions, SpawnSyncOptionsWithStringEncoding } from "child_process";
import path from "path";

// All user code runs in the isolated runner container, reached through the runner agent.
const RUNNER_CLIENT = process.env.DEVNIX_RUNNER_CLIENT || path.join(process.cwd(), "runner-client.js");

export const RUNNER_NAME = "runner";

export function runnerSpawnSync(args: string[], options: Omit<SpawnSyncOptionsWithStringEncoding, "encoding"> & { encoding?: "utf-8" } = {}) {
  return spawnSync(process.execPath, [RUNNER_CLIENT, ...args], { encoding: "utf-8", ...options });
}

export function runnerSpawn(args: string[], options: SpawnOptions = {}) {
  return spawn(process.execPath, [RUNNER_CLIENT, ...args], options);
}
