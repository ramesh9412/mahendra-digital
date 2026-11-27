import crypto from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';

const FALLBACK_SESSION_SECRET = crypto.randomBytes(32).toString('hex');

function getSessionSecret(): string {
  const configured = process.env.SESSION_SECRET?.trim();
  return configured && configured.length >= 16 ? configured : FALLBACK_SESSION_SECRET;
}

export function hashSecret(plain: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(plain, salt, 64).toString('hex');
  return `${salt}:${derived}`;
}

export function verifySecret(plain: string, stored: string): boolean {
  if (!stored || !stored.includes(':')) return false;
  const [salt, expectedHex] = stored.split(':');
  if (!salt || !expectedHex) return false;
  try {
    const derived = crypto.scryptSync(plain, salt, 64);
    const expected = Buffer.from(expectedHex, 'hex');
    if (derived.length !== expected.length) return false;
    return crypto.timingSafeEqual(derived, expected);
  } catch {
    return false;
  }
}

export interface SessionPayload {
  sub: string;
  role: 'user' | 'admin';
  username?: string;
  exp: number;
  nonce: string;
}

export function signSessionToken(
  sub: string,
  role: 'user' | 'admin',
  ttlSeconds = 60 * 60 * 24 * 7,
  username?: string
): string {
  const payload: SessionPayload = {
    sub,
    role,
    username,
    exp: Math.floor(Date.now() / 1000) + ttlSeconds,
    nonce: crypto.randomBytes(8).toString('hex'),
  };
  const body = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
  const sig = crypto
    .createHmac('sha256', getSessionSecret())
    .update(body)
    .digest('base64url');
  return `${body}.${sig}`;
}

export function verifySessionToken(token: string): SessionPayload | null {
  if (!token || !token.includes('.')) return null;
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [body, sig] = parts;
  if (!body || !sig) return null;

  const expectedSig = crypto
    .createHmac('sha256', getSessionSecret())
    .update(body)
    .digest('base64url');

  const sigBuf = Buffer.from(sig);
  const expectedBuf = Buffer.from(expectedSig);
  if (sigBuf.length !== expectedBuf.length) return null;
  if (!crypto.timingSafeEqual(sigBuf, expectedBuf)) return null;

  try {
    const parsed = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as SessionPayload;
    if (!parsed.sub || !parsed.role || !parsed.exp) return null;
    if (parsed.exp < Math.floor(Date.now() / 1000)) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function extractBearerToken(req: Request): string | null {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) return null;
  return header.slice(7).trim() || null;
}

export interface AuthenticatedRequest extends Request {
  auth?: SessionPayload;
}

export function requireUserAuth(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  const token = extractBearerToken(req);
  if (!token) {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }
  const payload = verifySessionToken(token);
  if (!payload || payload.role !== 'user') {
    res.status(401).json({ error: 'Invalid or expired session' });
    return;
  }
  req.auth = payload;
  next();
}

export function requireAdminAuth(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  const token = extractBearerToken(req);
  if (!token) {
    res.status(401).json({ error: 'Admin authentication required' });
    return;
  }
  const payload = verifySessionToken(token);
  if (!payload || payload.role !== 'admin') {
    res.status(403).json({ error: 'Admin authorization required' });
    return;
  }
  req.auth = payload;
  next();
}

export function generateUniqueId(prefix: string): string {
  const random = crypto.randomBytes(4).toString('hex').toUpperCase();
  const ts = Date.now().toString(36).toUpperCase();
  return `${prefix}${ts}${random}`;
}

export function generateReferralCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let out = '';
  const bytes = crypto.randomBytes(6);
  for (let i = 0; i < 6; i++) {
    out += chars[bytes[i] % chars.length];
  }
  return out;
}

export function maskPhone(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (digits.length <= 4) return '****';
  return `${digits.slice(0, 3)}***${digits.slice(-4)}`;
}
