import { NextRequest, NextResponse } from "next/server";
import path from "path";
import fs from "fs/promises";
import { UPLOADS_DIR, OUTPUTS_DIR, ensureDirs, assertWithinDir } from "@/lib/storage";
import { conversionQueue, ConversionJobData } from "@/lib/queue";
import { checkRateLimit, getIP } from "@/lib/rateLimit";

// 30 conversions per 15 minutes per IP
const RATE_LIMIT = 30;
const RATE_WINDOW_MS = 15 * 60 * 1000;

const IMAGE_MIME_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif", "image/bmp", "image/tiff"];
const PDF_MIME = "application/pdf";
const OFFICE_MIME_TYPES = [
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
];

type SourceCategory = "image" | "pdf" | "office";

const ALLOWED_TARGETS: Record<SourceCategory, string[]> = {
  image: ["jpg", "png", "webp", "pdf"],
  pdf: ["png"],
  office: ["pdf"],
};

function getMimeCategory(mime: string): SourceCategory | null {
  if (IMAGE_MIME_TYPES.includes(mime)) return "image";
  if (mime === PDF_MIME) return "pdf";
  if (OFFICE_MIME_TYPES.includes(mime)) return "office";
  return null;
}

async function findUploadedFile(fileId: string): Promise<string | null> {
  const entries = await fs.readdir(UPLOADS_DIR);
  const match = entries.find((e) => e.startsWith(fileId + "_"));
  if (!match) return null;
  const filePath = path.join(UPLOADS_DIR, match);
  assertWithinDir(filePath, UPLOADS_DIR);
  return filePath;
}

export async function POST(req: NextRequest) {
  const { allowed, retryAfter } = checkRateLimit(`convert:${getIP(req)}`, RATE_LIMIT, RATE_WINDOW_MS);
  if (!allowed) {
    return NextResponse.json(
      { error: "Too many conversions. Try again later." },
      { status: 429, headers: { "Retry-After": String(retryAfter) } }
    );
  }

  let body: { fileId?: string; targetExt?: string; sourceMime?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { fileId, targetExt, sourceMime } = body;

  if (!fileId || typeof fileId !== "string") {
    return NextResponse.json({ error: "Missing fileId" }, { status: 400 });
  }
  if (!sourceMime || typeof sourceMime !== "string") {
    return NextResponse.json({ error: "Missing sourceMime" }, { status: 400 });
  }

  const sourceCategory = getMimeCategory(sourceMime);
  if (!sourceCategory) {
    return NextResponse.json({ error: "Unsupported source MIME type" }, { status: 415 });
  }

  const allowed2 = ALLOWED_TARGETS[sourceCategory];
  if (!targetExt || !allowed2.includes(targetExt)) {
    return NextResponse.json(
      { error: `targetExt must be one of: ${allowed2.join(", ")} for this file type` },
      { status: 400 }
    );
  }

  await ensureDirs();

  const inputPath = await findUploadedFile(fileId);
  if (!inputPath) {
    return NextResponse.json({ error: "File not found for given fileId" }, { status: 404 });
  }

  const outputPath = path.join(OUTPUTS_DIR, `${fileId}_output.${targetExt}`);
  assertWithinDir(outputPath, OUTPUTS_DIR);

  const jobData: ConversionJobData = { fileId, sourceMime, targetExt, inputPath, outputPath };
  const job = await conversionQueue.add("convert", jobData);

  return NextResponse.json({ jobId: job.id });
}
