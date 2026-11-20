import { randomUUID } from 'node:crypto';
import { getDatabase } from '../database.js';

export interface Thread {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
}

export function createThread(title = 'New Chat'): Thread {
  const db = getDatabase();
  const id = randomUUID();

  db.prepare(`
    INSERT INTO threads (id, title)
    VALUES (?, ?)
  `).run(id, title.trim() || 'New Chat');

  return getThreadById(id)!;
}

export function getThreadById(id: string): Thread | undefined {
  return getDatabase()
    .prepare('SELECT * FROM threads WHERE id = ?')
    .get(id) as Thread | undefined;
}

export function getAllThreads(): Thread[] {
  return getDatabase()
    .prepare('SELECT * FROM threads ORDER BY updated_at DESC')
    .all() as Thread[];
}

export function updateThreadTitle(
  id: string,
  title: string
): Thread | undefined {
  const db = getDatabase();

  const result = db.prepare(`
    UPDATE threads
    SET title = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(title.trim(), id);

  return result.changes > 0 ? getThreadById(id) : undefined;
}

export function deleteThread(id: string): boolean {
  const result = getDatabase()
    .prepare('DELETE FROM threads WHERE id = ?')
    .run(id);

  return result.changes > 0;
}
