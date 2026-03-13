type RateLimitBucket = {
  count: number;
  resetAt: number;
};

const buckets = new Map<string, RateLimitBucket>();
const WINDOW_MS = 60_000;
const MAX_BUCKETS_BEFORE_SWEEP = 5000;

function sweepExpiredBuckets(now: number) {
  if (buckets.size < MAX_BUCKETS_BEFORE_SWEEP) return;
  for (const [key, bucket] of buckets.entries()) {
    if (bucket.resetAt <= now) {
      buckets.delete(key);
    }
  }
}

export function getClientIp(request: Request): string {
  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) {
    const first = forwardedFor.split(",")[0]?.trim();
    if (first) return first;
  }

  const realIp = request.headers.get("x-real-ip")?.trim();
  if (realIp) {
    return realIp;
  }

  return "unknown";
}

export function consumeRateLimit(key: string, limit: number) {
  const now = Date.now();
  sweepExpiredBuckets(now);

  const current = buckets.get(key);
  if (!current || current.resetAt <= now) {
    const fresh: RateLimitBucket = {
      count: 1,
      resetAt: now + WINDOW_MS
    };
    buckets.set(key, fresh);
    return {
      allowed: true,
      remaining: Math.max(limit - fresh.count, 0),
      resetAt: fresh.resetAt
    };
  }

  if (current.count >= limit) {
    return {
      allowed: false,
      remaining: 0,
      resetAt: current.resetAt
    };
  }

  current.count += 1;
  buckets.set(key, current);

  return {
    allowed: true,
    remaining: Math.max(limit - current.count, 0),
    resetAt: current.resetAt
  };
}
