import { NextRequest, NextResponse } from "next/server";
import { checkRateLimit, getIP } from "@/lib/rateLimit";
import { getBanInfo, trackSuspicious } from "@/lib/ipBan";

// 5 uses per hour per IP
const RATE_LIMIT = 5;
const RATE_WINDOW_MS = 60 * 60 * 1000;

export async function POST(req: NextRequest) {
  const ip = getIP(req);

  const ban = getBanInfo(ip);
  if (ban.banned) {
    return NextResponse.json(
      { error: "Your IP is blocked due to suspicious activity." },
      { status: 403 }
    );
  }

  const { allowed, retryAfter } = checkRateLimit(`pdf-edit:${ip}`, RATE_LIMIT, RATE_WINDOW_MS);
  if (!allowed) {
    trackSuspicious(ip, "rate_limit_hit");
    return NextResponse.json(
      { error: `You have used all 5 free PDF edits for this hour. Try again in ${Math.ceil((retryAfter ?? 3600) / 60)} minutes.` },
      { status: 429, headers: { "Retry-After": String(retryAfter) } }
    );
  }

  // Return remaining uses
  const used = RATE_LIMIT - (RATE_LIMIT - (5 - Math.max(0, RATE_LIMIT)));
  return NextResponse.json({ ok: true, remaining: RATE_LIMIT - 1 });
}
