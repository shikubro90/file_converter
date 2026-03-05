export type SuspiciousEvent =
  | "rate_limit_hit"   // hit the rate limiter
  | "upload_fail"      // bad file type / oversized
  | "malformed_request" // invalid JSON / missing fields
  | "not_found";       // repeated 404s on API routes

const BAN_DURATION_MS = 60 * 60 * 1000; // 1 hour

interface Counter {
  count: number;
  windowStart: number;
}

interface IpRecord {
  rate_limit_hit:    Counter;
  upload_fail:       Counter;
  malformed_request: Counter;
  not_found:         Counter;
  bannedUntil: number; // epoch ms, 0 = not banned
}

const THRESHOLDS: Record<SuspiciousEvent, { limit: number; windowMs: number }> = {
  rate_limit_hit:    { limit: 3,  windowMs: 10 * 60 * 1000 }, // 3 hits in 10 min
  upload_fail:       { limit: 5,  windowMs: 10 * 60 * 1000 }, // 5 bad uploads in 10 min
  malformed_request: { limit: 5,  windowMs: 10 * 60 * 1000 }, // 5 malformed reqs in 10 min
  not_found:         { limit: 20, windowMs:  5 * 60 * 1000 }, // 20 404s in 5 min
};

const store = new Map<string, IpRecord>();

function freshCounter(): Counter {
  return { count: 0, windowStart: Date.now() };
}

function getRecord(ip: string): IpRecord {
  if (!store.has(ip)) {
    store.set(ip, {
      rate_limit_hit:    freshCounter(),
      upload_fail:       freshCounter(),
      malformed_request: freshCounter(),
      not_found:         freshCounter(),
      bannedUntil: 0,
    });
  }
  return store.get(ip)!;
}

function increment(counter: Counter, windowMs: number): number {
  const now = Date.now();
  if (now - counter.windowStart > windowMs) {
    counter.count = 1;
    counter.windowStart = now;
  } else {
    counter.count++;
  }
  return counter.count;
}

/** Returns ban info if the IP is currently banned. */
export function getBanInfo(ip: string): { banned: true; until: number } | { banned: false } {
  const record = store.get(ip);
  if (record && record.bannedUntil > Date.now()) {
    return { banned: true, until: record.bannedUntil };
  }
  return { banned: false };
}

/**
 * Records a suspicious event for an IP.
 * Returns true (and bans the IP) if a threshold is crossed.
 */
export function trackSuspicious(ip: string, event: SuspiciousEvent): boolean {
  const record = getRecord(ip);

  // Already banned
  if (record.bannedUntil > Date.now()) return true;

  const { limit, windowMs } = THRESHOLDS[event];
  const count = increment(record[event], windowMs);

  if (count >= limit) {
    record.bannedUntil = Date.now() + BAN_DURATION_MS;
    console.warn(`[ipBan] Banned ${ip} for 1 hour — trigger: ${event} (${count}x)`);
    return true;
  }

  return false;
}

// Prune stale records every 30 minutes to prevent unbounded growth
setInterval(() => {
  const now = Date.now();
  for (const [ip, record] of store) {
    const allWindowsExpired = (Object.keys(THRESHOLDS) as SuspiciousEvent[]).every(
      (e) => now - record[e].windowStart > THRESHOLDS[e].windowMs * 2
    );
    if (allWindowsExpired && record.bannedUntil < now) {
      store.delete(ip);
    }
  }
}, 30 * 60 * 1000);
