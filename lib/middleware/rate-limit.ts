/**
 * Simple in-memory sliding-window rate limiter.
 * No external dependencies — sufficient for a single-instance hackathon demo.
 * In production, swap this for Upstash Redis or Vercel KV.
 */
const hits = new Map<string, { count: number; resetAt: number }>();

export interface RateLimitConfig {
  /** Window size in milliseconds. */
  windowMs: number;
  /** Max requests per window. */
  max: number;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetMs: number;
}

export function rateLimit(
  key: string,
  config: RateLimitConfig
): RateLimitResult {
  const now = Date.now();
  const entry = hits.get(key);

  if (!entry || now > entry.resetAt) {
    hits.set(key, { count: 1, resetAt: now + config.windowMs });
    return { allowed: true, remaining: config.max - 1, resetMs: config.windowMs };
  }

  entry.count++;
  if (entry.count > config.max) {
    return {
      allowed: false,
      remaining: 0,
      resetMs: entry.resetAt - now,
    };
  }

  return {
    allowed: true,
    remaining: config.max - entry.count,
    resetMs: entry.resetAt - now,
  };
}

/** Extract a rate-limit key from a request (IP-based). */
export function getClientIp(request: Request): string {
  const xf = request.headers.get("x-forwarded-for");
  if (xf) return xf.split(",")[0].trim();
  const real = request.headers.get("x-real-ip");
  if (real) return real.trim();
  return "unknown";
}

/** Apply a rate limit and return a 429 Response if exceeded, or null if ok. */
export function enforceRateLimit(
  request: Request,
  route: string,
  config: RateLimitConfig
): Response | null {
  const ip = getClientIp(request);
  const key = `${route}:${ip}`;
  const result = rateLimit(key, config);

  if (!result.allowed) {
    return Response.json(
      {
        success: false,
        error: {
          code: "RATE_LIMITED",
          message: `Too many requests. Try again in ${Math.ceil(result.resetMs / 1000)}s.`,
        },
      },
      {
        status: 429,
        headers: {
          "Retry-After": String(Math.ceil(result.resetMs / 1000)),
          "X-RateLimit-Remaining": "0",
        },
      }
    );
  }

  return null;
}

/** Shared rate-limit configs for different route types. */
export const RATE_LIMITS = {
  /** GET endpoints — generous (cache-friendly). */
  read: { windowMs: 60_000, max: 60 },
  /** POST endpoints — moderate. */
  write: { windowMs: 60_000, max: 10 },
  /** LLM-backed endpoints — strict (cost protection). */
  llm: { windowMs: 60_000, max: 2 },
} as const;
