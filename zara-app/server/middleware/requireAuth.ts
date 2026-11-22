import type { NextFunction, Request, Response } from 'express';
import { getUserForSession } from '../services/authService.js';

export const SESSION_COOKIE = 'zara_session';

function readCookie(header: string | undefined, name: string): string | null {
  if (!header) return null;
  for (const part of header.split(';')) {
    const separator = part.indexOf('=');
    if (separator < 0) continue;
    if (part.slice(0, separator).trim() === name) {
      try { return decodeURIComponent(part.slice(separator + 1).trim()); } catch { return null; }
    }
  }
  return null;
}

export function getSessionToken(request: Request): string | null {
  return readCookie(request.headers.cookie, SESSION_COOKIE);
}

export function requireAuth(request: Request, response: Response, next: NextFunction): void {
  const token = getSessionToken(request);
  if (!token) {
    response.status(401).json({ error: 'AUTHENTICATION_REQUIRED' });
    return;
  }
  const user = getUserForSession(token);
  if (!user) {
    response.clearCookie(SESSION_COOKIE, { httpOnly: true, sameSite: 'strict', path: '/' });
    response.status(401).json({ error: 'AUTHENTICATION_REQUIRED' });
    return;
  }
  response.locals.authUser = user;
  next();
}
