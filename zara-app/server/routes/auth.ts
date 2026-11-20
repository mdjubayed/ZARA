import { Router } from 'express';
import { z } from 'zod';
import { clearExpiredSessions, createOwnerAndSession, getOwnerCount, loginOwner, revokeSession } from '../services/authService.js';
import { getSessionToken, requireAuth, SESSION_COOKIE } from '../middleware/requireAuth.js';

export const authRouter = Router();
const credentialsSchema = z.object({ password: z.string().min(12).max(128) }).strict();
const attempts = new Map<string, { count: number; resetAt: number }>();
const WINDOW_MS = 15 * 60 * 1000;
const MAX_ATTEMPTS = 5;

function requestKey(ip: string | undefined): string { return ip || 'unknown'; }
function isRateLimited(ip: string | undefined): boolean {
  const now = Date.now();
  const key = requestKey(ip);
  const current = attempts.get(key);
  if (!current || current.resetAt <= now) {
    attempts.set(key, { count: 0, resetAt: now + WINDOW_MS });
    return false;
  }
  return current.count >= MAX_ATTEMPTS;
}
function recordFailure(ip: string | undefined): void {
  const key = requestKey(ip);
  const current = attempts.get(key);
  if (current && current.resetAt > Date.now()) current.count += 1;
  else attempts.set(key, { count: 1, resetAt: Date.now() + WINDOW_MS });
}
function clearFailures(ip: string | undefined): void { attempts.delete(requestKey(ip)); }

function cookieOptions(request: import('express').Request) {
  const secure = request.secure || request.get('x-forwarded-proto') === 'https';
  return { httpOnly: true, secure, sameSite: 'strict' as const, path: '/', maxAge: 7 * 24 * 60 * 60 * 1000 };
}
function setSessionCookie(request: import('express').Request, response: import('express').Response, token: string) {
  response.cookie(SESSION_COOKIE, token, cookieOptions(request));
}
function clearSessionCookie(request: import('express').Request, response: import('express').Response) {
  const options = cookieOptions(request);
  response.clearCookie(SESSION_COOKIE, { httpOnly: true, secure: options.secure, sameSite: 'strict', path: '/' });
}

authRouter.get('/status', (_req, res) => {
  return res.status(200).json({ setupRequired: getOwnerCount() === 0 });
});

authRouter.post('/setup', async (req, res) => {
  if (isRateLimited(req.ip)) return res.status(429).json({ error: 'AUTH_RATE_LIMITED' });
  const parsed = credentialsSchema.safeParse(req.body ?? {});
  if (!parsed.success) return res.status(400).json({ error: 'PASSWORD_MUST_BE_12_TO_128_CHARACTERS' });
  try {
    const result = await createOwnerAndSession(parsed.data.password);
    if (!result) return res.status(409).json({ error: 'OWNER_ALREADY_CONFIGURED' });
    clearFailures(req.ip);
    setSessionCookie(req, res, result.token);
    clearExpiredSessions();
    return res.status(201).json({ authenticated: true, user: result.user });
  } catch {
    return res.status(500).json({ error: 'ACCOUNT_SETUP_FAILED' });
  }
});

authRouter.post('/login', async (req, res) => {
  if (isRateLimited(req.ip)) return res.status(429).json({ error: 'AUTH_RATE_LIMITED' });
  const parsed = credentialsSchema.safeParse(req.body ?? {});
  if (!parsed.success) {
    recordFailure(req.ip);
    return res.status(401).json({ error: 'INVALID_CREDENTIALS' });
  }
  try {
    const result = await loginOwner(parsed.data.password);
    if (!result) {
      recordFailure(req.ip);
      return res.status(401).json({ error: 'INVALID_CREDENTIALS' });
    }
    clearFailures(req.ip);
    setSessionCookie(req, res, result.token);
    clearExpiredSessions();
    return res.status(200).json({ authenticated: true, user: result.user });
  } catch {
    return res.status(500).json({ error: 'LOGIN_FAILED' });
  }
});

authRouter.get('/me', requireAuth, (_req, res) => {
  return res.status(200).json({ authenticated: true, user: res.locals.authUser });
});

authRouter.post('/logout', (req, res) => {
  const token = getSessionToken(req);
  if (token) revokeSession(token);
  clearSessionCookie(req, res);
  return res.status(200).json({ authenticated: false });
});
