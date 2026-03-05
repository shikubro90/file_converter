import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { Job } from "bullmq";
import { conversionQueue } from "@/lib/queue";
import { OUTPUTS_DIR, assertWithinDir } from "@/lib/storage";

const MIME_MAP: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  gif: "image/gif",
  bmp: "image/bmp",
  tiff: "image/tiff",
  pdf: "application/pdf",
  mp4: "video/mp4",
  mp3: "audio/mpeg",
  webm: "video/webm",
  ogg: "audio/ogg",
  wav: "audio/wav",
  avi: "video/x-msvideo",
  mkv: "video/x-matroska",
  zip: "application/zip",
};

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const bullJob = await Job.fromId(conversionQueue, params.id);
  const state = bullJob ? await bullJob.getState() : null;

  if (!bullJob || state !== "completed" || !bullJob.data.outputPath) {
    return NextResponse.json({ error: "Job not found or not done" }, { status: 404 });
  }

  const outputPath = bullJob.data.outputPath;

  // Path traversal guard — outputPath comes from Redis; verify it stays within OUTPUTS_DIR
  try {
    assertWithinDir(outputPath, OUTPUTS_DIR);
  } catch {
    return NextResponse.json({ error: "Invalid output path" }, { status: 400 });
  }

  const stat = await fs.promises.stat(outputPath).catch(() => null);
  if (!stat) {
    return NextResponse.json({ error: "Output file missing" }, { status: 404 });
  }

  const ext = path.extname(outputPath).slice(1).toLowerCase();
  const contentType = MIME_MAP[ext] ?? "application/octet-stream";
  const filename = `converted.${ext}`;

  const stream = fs.createReadStream(outputPath);
  const body = new ReadableStream({
    start(controller) {
      stream.on("data", (chunk) => controller.enqueue(chunk));
      stream.on("end", () => controller.close());
      stream.on("error", (err) => controller.error(err));
    },
    cancel() {
      stream.destroy();
    },
  });

  return new NextResponse(body, {
    headers: {
      "Content-Type": contentType,
      "Content-Length": String(stat.size),
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
