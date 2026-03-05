import { NextRequest, NextResponse } from "next/server";
import path from "path";
import fs from "fs/promises";
import { UPLOADS_DIR, ensureDirs, isSafeExtension, safeFilename, assertWithinDir } from "@/lib/storage";
import { checkRateLimit, getIP } from "@/lib/rateLimit";
import { getBanInfo, trackSuspicious } from "@/lib/ipBan";

const MAX_SIZE = 100 * 1024 * 1024; // 100 MB
const RATE_LIMIT = 20;
const RATE_WINDOW_MS = 15 * 60 * 1000;
const BAN_COOKIE = "blocked_until";

function banResponse(until: number) {
  const res = NextResponse.json(
    { error: "Your IP has been blocked for 1 hour due to suspicious activity. Please try again later." },
    { status: 403 }
  );
  res.cookies.set(BAN_COOKIE, String(until), {
    path: "/",
    expires: new Date(until),
    sameSite: "lax",
  });
  return res;
}

export async function POST(req: NextRequest) {
  const ip = getIP(req);

  // Check existing ban
  const ban = getBanInfo(ip);
  if (ban.banned) return banResponse(ban.until);

  // Rate limit check
  const { allowed, retryAfter } = checkRateLimit(`upload:${ip}`, RATE_LIMIT, RATE_WINDOW_MS);
  if (!allowed) {
    const banned = trackSuspicious(ip, "rate_limit_hit");
    if (banned) {
      const b = getBanInfo(ip);
      return banResponse(b.banned ? b.until : Date.now() + 3600_000);
    }
    return NextResponse.json(
      { error: "Too many uploads. Try again later." },
      { status: 429, headers: { "Retry-After": String(retryAfter) } }
    );
  }

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    trackSuspicious(ip, "malformed_request");
    return NextResponse.json({ error: "Invalid multipart/form-data" }, { status: 400 });
  }

  const file = formData.get("file");
  if (!(file instanceof File)) {
    trackSuspicious(ip, "malformed_request");
    return NextResponse.json({ error: "Missing field: file" }, { status: 400 });
  }

  if (file.size > MAX_SIZE) {
    trackSuspicious(ip, "upload_fail");
    return NextResponse.json({ error: "File exceeds 100 MB limit" }, { status: 413 });
  }

  if (!isSafeExtension(file.name)) {
    const banned = trackSuspicious(ip, "upload_fail");
    if (banned) {
      const b = getBanInfo(ip);
      return banResponse(b.banned ? b.until : Date.now() + 3600_000);
    }
    return NextResponse.json({ error: "File type not allowed" }, { status: 415 });
  }

  const { fileId, filename } = safeFilename(file.name);
  const destPath = path.join(UPLOADS_DIR, filename);
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
