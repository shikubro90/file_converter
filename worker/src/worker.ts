import path from "path";
import fs from "fs/promises";
import { spawn } from "child_process";
import { Worker, Job } from "bullmq";
import { findPlugin } from "../converters/registry";

interface ConversionJobData {
  fileId: string;
  sourceMime: string;
  targetExt: string;
  inputPath: string;
  outputPath: string;
}

const UPLOADS_DIR = path.join(process.cwd(), "storage/uploads");
const OUTPUTS_DIR = path.join(process.cwd(), "storage/outputs");

// ── Cleanup ────────────────────────────────────────────────────────────────

const MAX_FILE_AGE_MS = 30 * 60 * 1000; // 30 minutes
const CLEANUP_INTERVAL_MS = 10 * 60 * 1000; // every 10 minutes

async function cleanupOldFiles(): Promise<void> {
  const now = Date.now();
  for (const dir of [UPLOADS_DIR, OUTPUTS_DIR]) {
    let entries: string[];
    try {
      entries = await fs.readdir(dir);
    } catch {
      continue; // dir doesn't exist yet
    }
    for (const entry of entries) {
      const filePath = path.join(dir, entry);
      const stat = await fs.stat(filePath).catch(() => null);
      if (stat && now - stat.mtimeMs > MAX_FILE_AGE_MS) {
        await fs.unlink(filePath).catch(() => {}); // ignore already-deleted
        console.log(`[cleanup] deleted ${filePath}`);
      }
    }
  }
}

setInterval(cleanupOldFiles, CLEANUP_INTERVAL_MS);
cleanupOldFiles(); // run once on startup

// ── Process spawner ────────────────────────────────────────────────────────

function spawnProcess(cmd: string, args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    // spawn — never passes args through a shell; no injection risk
    const proc = spawn(cmd, args, { stdio: "pipe" });
    const stderr: Buffer[] = [];
    proc.stderr?.on("data", (chunk: Buffer) => stderr.push(chunk));
    proc.on("error", (err: NodeJS.ErrnoException) => {
      if (err.code === "ENOENT") reject(new Error(`Command not found: "${cmd}". Is the required tool installed?`));
      else reject(err);
    });
    proc.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${cmd} exited with code ${code}: ${Buffer.concat(stderr).toString().trim()}`));
    });
  });
}

// ── Job processor ──────────────────────────────────────────────────────────

async function processJob(job: Job<ConversionJobData>): Promise<void> {
  const { sourceMime, targetExt, inputPath, outputPath } = job.data;

  await fs.mkdir(OUTPUTS_DIR, { recursive: true });
  await job.updateProgress(10);

  const plugin = findPlugin(sourceMime, targetExt);
  if (!plugin) {
    throw new Error(`No converter found for ${sourceMime} → .${targetExt}`);
  }

  console.log(`[${job.id}] plugin: ${plugin.name}`);
  await job.updateProgress(60);

  const { cmd, args } = plugin.buildCommand(inputPath, outputPath, sourceMime, targetExt);
  await spawnProcess(cmd, args);

  if (plugin.afterRun) {
    await plugin.afterRun(inputPath, outputPath);
  }

  await job.updateProgress(90);
}

// ── Worker ─────────────────────────────────────────────────────────────────

// Use plain options — avoids ioredis version conflicts with BullMQ's bundled ioredis
function parseRedisUrl(url: string) {
  const u = new URL(url);
  return { host: u.hostname, port: parseInt(u.port || "6379") };
}
const connection = parseRedisUrl(process.env.REDIS_URL ?? "redis://localhost:6379");

const worker = new Worker<ConversionJobData>("conversions", processJob, {
  connection,
  concurrency: 4,
});

worker.on("completed", (job) => {
  console.log(`[done]  job ${job.id} — ${job.data.fileId} -> .${job.data.targetExt}`);
});

worker.on("failed", (job, err) => {
  console.error(`[fail]  job ${job?.id} — ${err.message}`);
});

worker.on("active", (job) => {
  console.log(`[start] job ${job.id} — ${job.data.sourceMime} -> .${job.data.targetExt}`);
});

console.log("Worker started, waiting for jobs…");

process.on("SIGTERM", async () => {
  await worker.close();
  process.exit(0);
});
