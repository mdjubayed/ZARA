import { createHash, randomBytes, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import { getDatabase } from '../db/database.js';

const scrypt = promisify(scryptCallback);
const SESSION_DAYS = 7;
const PASSWORD_BYTES = 64;

export type AuthUser = { id: number; created_at: string };
export type AuthResult = { user: AuthUser; token: string; expiresAt: number };

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const derived = await scrypt(password, salt, PASSWORD_BYTES) as Buffer;
  return `scrypt:${salt.toString('hex')}:${derived.toString('hex')}`;
}

async function verifyPassword(password: string, encoded: string): Promise<boolean> {
  const [algorithm, saltHex, hashHex] = encoded.split(':');
  if (algorithm !== 'scrypt' || !saltHex || !hashHex) return false;
  const expected = Buffer.from(hashHex, 'hex');
  if (expected.length !== PASSWORD_BYTES) return false;
  const actual = await scrypt(password, Buffer.from(saltHex, 'hex'), expected.length) as Buffer;
  return timingSafeEqual(actual, expected);
}

export function getOwnerCount(): number {
  return (getDatabase().prepare('SELECT COUNT(*) AS count FROM auth_users').get() as { count: number }).count;
}

export async function createOwnerAndSession(password: string): Promise<AuthResult | null> {
  const passwordHash = await hashPassword(password);
  const token = randomBytes(32).toString('base64url');
  const expiresAt = Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000;
  const db = getDatabase();
  const create = db.transaction(() => {
    const existing = db.prepare('SELECT id FROM auth_users LIMIT 1').get();
    if (existing) return null;
    const result = db.prepare('INSERT INTO auth_users (password_hash) VALUES (?)').run(passwordHash);
    const user = db.prepare('SELECT id, created_at FROM auth_users WHERE id = ?').get(Number(result.lastInsertRowid)) as AuthUser;
    db.prepare('INSERT INTO auth_sessions (token_hash, user_id, expires_at) VALUES (?, ?, ?)').run(hashToken(token), user.id, expiresAt);
    return { user, token, expiresAt };
  });
  return create.immediate();
}

export async function loginOwner(password: string): Promise<AuthResult | null> {
  const db = getDatabase();
  const row = db.prepare('SELECT id, password_hash, created_at FROM auth_users LIMIT 1').get() as
    | { id: number; password_hash: string; created_at: string }
    | undefined;
  if (!row || !(await verifyPassword(password, row.password_hash))) return null;

  const token = randomBytes(32).toString('base64url');
  const expiresAt = Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000;
  db.prepare('INSERT INTO auth_sessions (token_hash, user_id, expires_at) VALUES (?, ?, ?)').run(hashToken(token), row.id, expiresAt);
  return { user: { id: row.id, created_at: row.created_at }, token, expiresAt };
}

export function getUserForSession(token: string): AuthUser | null {
  const db = getDatabase();
  const row = db.prepare(`
    SELECT users.id, users.created_at, sessions.expires_at
    FROM auth_sessions sessions
    INNER JOIN auth_users users ON users.id = sessions.user_id
    WHERE sessions.token_hash = ?
  `).get(hashToken(token)) as (AuthUser & { expires_at: number }) | undefined;
  if (!row) return null;
  if (row.expires_at <= Date.now()) {
    db.prepare('DELETE FROM auth_sessions WHERE token_hash = ?').run(hashToken(token));
    return null;
  }
  return { id: row.id, created_at: row.created_at };
}

export function revokeSession(token: string): void {
  getDatabase().prepare('DELETE FROM auth_sessions WHERE token_hash = ?').run(hashToken(token));
}

export function clearExpiredSessions(): void {
  getDatabase().prepare('DELETE FROM auth_sessions WHERE expires_at <= ?').run(Date.now());
}
