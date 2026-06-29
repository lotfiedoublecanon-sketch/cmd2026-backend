import { timingSafeEqual } from 'crypto';
import { NextFunction, Request, RequestHandler, Response } from 'express';

interface RateLimitOptions {
  windowMs: number;
  maxRequests: number;
}

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const PROJECT_ORIGINS = new Set([
  'https://cmd2026-backend-1.onrender.com',
  'https://lotfiedoublecanon-sketch.github.io',
]);

function configuredOrigins(): Set<string> {
  const values = [process.env.CORS_ORIGIN, process.env.ALLOWED_ORIGINS]
    .filter((value): value is string => Boolean(value))
    .flatMap((value) => value.split(/[;,\s]+/));

  return new Set(values.flatMap((value) => {
    const candidate = value.trim();
    if (!candidate || candidate === '*') {
      return [];
    }

    try {
      return [new URL(candidate).origin];
    } catch {
      return [];
    }
  }));
}

export function isAllowedOrigin(origin?: string): boolean {
  if (!origin) {
    return true;
  }

  let parsedOrigin: URL;
  try {
    parsedOrigin = new URL(origin);
  } catch {
    return false;
  }

  return PROJECT_ORIGINS.has(parsedOrigin.origin)
    || configuredOrigins().has(parsedOrigin.origin);
}

export function createRateLimiter({ windowMs, maxRequests }: RateLimitOptions): RequestHandler {
  const clients = new Map<string, RateLimitEntry>();
  let nextCleanupAt = Date.now() + windowMs;

  return (req: Request, res: Response, next: NextFunction): void => {
    const now = Date.now();
    if (now >= nextCleanupAt) {
      for (const [key, entry] of clients) {
        if (entry.resetAt <= now) {
          clients.delete(key);
        }
      }
      nextCleanupAt = now + windowMs;
    }

    const key = req.ip || req.socket.remoteAddress || 'unknown';
    const current = clients.get(key);
    const entry = !current || current.resetAt <= now
      ? { count: 0, resetAt: now + windowMs }
      : current;

    entry.count += 1;
    clients.set(key, entry);

    res.setHeader('RateLimit-Limit', maxRequests.toString());
    res.setHeader('RateLimit-Remaining', Math.max(0, maxRequests - entry.count).toString());
    res.setHeader('RateLimit-Reset', Math.ceil(entry.resetAt / 1000).toString());

    if (entry.count > maxRequests) {
      res.setHeader('Retry-After', Math.max(1, Math.ceil((entry.resetAt - now) / 1000)).toString());
      res.status(429).json({
        success: false,
        error: 'Too many requests',
        timestamp: new Date().toISOString(),
      });
      return;
    }

    next();
  };
}

function tokensMatch(provided: string, expected: string): boolean {
  const providedBuffer = Buffer.from(provided);
  const expectedBuffer = Buffer.from(expected);
  return providedBuffer.length === expectedBuffer.length
    && timingSafeEqual(providedBuffer, expectedBuffer);
}

export function requireAdminToken(req: Request, res: Response, next: NextFunction): void {
  const expectedToken = process.env.ADMIN_API_TOKEN?.trim();
  if (!expectedToken) {
    res.status(503).json({ success: false, error: 'Service unavailable' });
    return;
  }

  const providedToken = req.get('x-admin-token');
  if (!providedToken || !tokensMatch(providedToken, expectedToken)) {
    res.status(401).json({ success: false, error: 'Unauthorized' });
    return;
  }

  next();
}
