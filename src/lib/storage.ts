import fs from "fs/promises";
import path from "path";
import crypto from "crypto";

export const UPLOADS_DIR = path.join(process.cwd(), "storage/uploads");
export const OUTPUTS_DIR = path.join(process.cwd(), "storage/outputs");

export async function ensureDirs() {
  await fs.mkdir(UPLOADS_DIR, { recursive: true });
  await fs.mkdir(OUTPUTS_DIR, { recursive: true });
}

const DANGEROUS_EXTENSIONS = new Set(["exe", "dll", "apk", "bat", "sh"]);

export function isSafeExtension(filename: string): boolean {
  const ext = filename.split(".").pop()?.toLowerCase() ?? "";
  return !DANGEROUS_EXTENSIONS.has(ext);
}

export function safeFilename(originalName: string): { fileId: string; filename: string } {
  const fileId = crypto.randomUUID();
  const sanitized = path.basename(originalName).replace(/[/\\?%*:|"<>\x00]/g, "_");
  return { fileId, filename: `${fileId}_${sanitized}` };
}

/**
 * Throws if resolvedPath is not strictly inside dir.
 * Prevents path traversal (e.g. ../../etc/passwd).
 */
export function assertWithinDir(filePath: string, dir: string): void {
  const resolved = path.resolve(filePath);
  const resolvedDir = path.resolve(dir);
  if (!resolved.startsWith(resolvedDir + path.sep) && resolved !== resolvedDir) {
    throw new Error(`Path traversal detected: ${filePath}`);
  }
}
