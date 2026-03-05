import { NextRequest, NextResponse } from "next/server";
import path from "path";
import fs from "fs/promises";
import { UPLOADS_DIR, ensureDirs, isSafeExtension, safeFilename, assertWithinDir } from "@/lib/storage";
import { checkRateLimit, getIP } from "@/lib/rateLimit";

const MAX_SIZE = 100 * 1024 * 1024; // 100 MB
// 20 uploads per 15 minutes per IP
const RATE_LIMIT = 20;
const RATE_WINDOW_MS = 15 * 60 * 1000;

export async function POST(req: NextRequest) {
  const { allowed, retryAfter } = checkRateLimit(`upload:${getIP(req)}`, RATE_LIMIT, RATE_WINDOW_MS);
  if (!allowed) {
    return NextResponse.json(
      { error: "Too many uploads. Try again later." },
      { status: 429, headers: { "Retry-After": String(retryAfter) } }
    );
  }

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json({ error: "Invalid multipart/form-data" }, { status: 400 });
  }

  const file = formData.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Missing field: file" }, { status: 400 });
  }

  if (file.size > MAX_SIZE) {
    return NextResponse.json({ error: "File exceeds 100 MB limit" }, { status: 413 });
  }

  if (!isSafeExtension(file.name)) {
    return NextResponse.json({ error: "File type not allowed" }, { status: 415 });
  }

  const { fileId, filename } = safeFilename(file.name);
  const destPath = path.join(UPLOADS_DIR, filename);

  // Verify the resolved destination is inside UPLOADS_DIR
  assertWithinDir(destPath, UPLOADS_DIR);

  await ensureDirs();
  const buffer = Buffer.from(await file.arrayBuffer());
  await fs.writeFile(destPath, buffer);

  return NextResponse.json({
    fileId,
    fileName: file.name,
    mime: file.type,
    size: file.size,
  });
}
