import { Queue } from "bullmq";

export interface ConversionJobData {
  fileId: string;
  sourceMime: string;
  targetExt: string;
  inputPath: string;
  outputPath: string;
}

function parseRedisUrl(url: string) {
  const u = new URL(url);
  return { host: u.hostname, port: parseInt(u.port || "6379") };
}

const connection = parseRedisUrl(process.env.REDIS_URL ?? "redis://localhost:6379");

// Singleton — avoids duplicate Queue instances during Next.js HMR
const g = global as typeof global & { _conversionQueue?: Queue<ConversionJobData> };

if (!g._conversionQueue) {
  g._conversionQueue = new Queue<ConversionJobData>("conversions", { connection });
}

export const conversionQueue = g._conversionQueue;
