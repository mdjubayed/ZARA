
import { randomUUID } from 'node:crypto';
import { getDatabase } from '../database.js';

export type MessageRole = 'user' | 'assistant' | 'system';

export interface Message {
  id: string;
  thread_id: string;
  role: MessageRole;
  content: string;
  created_at: string;
}

export interface SearchMessageItem {
  id: string;
  thread_id: string;
  thread_title: string;
  role: MessageRole;
  content: string;
  created_at: string;
}

export interface SearchMessagesPaginatedParams {
  query: string;
  page?: number;
  limit?: number;
}

export interface SearchMessagesPaginatedResult {
  results: SearchMessageItem[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export function createMessage(
  threadId: string,
  role: MessageRole,
  content: string
): Message {
  const db = getDatabase();
  const id = randomUUID();

  const threadExists = db.prepare(
    'SELECT id FROM threads WHERE id = ?'
  ).get(threadId);

  if (!threadExists) {
    throw new Error('THREAD_NOT_FOUND');
  }

  if (!content.trim()) {
    throw new Error('MESSAGE_CONTENT_REQUIRED');
  }

  const save = db.transaction(() => {
    db.prepare(`
      INSERT INTO messages (id, thread_id, role, content)
      VALUES (?, ?, ?, ?)
    `).run(id, threadId, role, content);

    db.prepare(`
      UPDATE threads
      SET updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(threadId);
  });

  save();

  return getMessageById(id)!;
}

export function getMessageById(id: string): Message | undefined {
  return getDatabase()
    .prepare('SELECT * FROM messages WHERE id = ?')
    .get(id) as Message | undefined;
}

export function getMessagesByThread(threadId: string): Message[] {
  return getDatabase()
    .prepare(`
      SELECT * FROM messages
      WHERE thread_id = ?
      ORDER BY created_at ASC, rowid ASC
    `)
    .all(threadId) as Message[];
}

export function deleteMessage(id: string): boolean {
  const result = getDatabase()
    .prepare('DELETE FROM messages WHERE id = ?')
    .run(id);

  return result.changes > 0;
}

export function searchMessages(
  query: string,
  limit = 50
): Message[] {
  const db = getDatabase();
  const term = query.trim();

  if (!term) return [];

  const safeLimit = Math.max(1, Math.min(limit, 100));

  try {
    const words = term
      .replace(/["*(){}[\]^:+-]/g, ' ')
      .trim()
      .split(/\s+/)
      .filter(Boolean);

    if (words.length === 0) return [];

    const matchQuery = words
      .map(word => `"${word.replace(/"/g, '""')}"`)
      .join(' AND ');

    return db.prepare(`
      SELECT m.*
      FROM messages_fts f
      JOIN messages m ON m.id = f.message_id
      WHERE messages_fts MATCH ?
      ORDER BY m.created_at DESC, m.rowid DESC
      LIMIT ?
    `).all(matchQuery, safeLimit) as Message[];
  } catch {
    return db.prepare(`
      SELECT * FROM messages
      WHERE content LIKE ?
      ORDER BY created_at DESC, rowid DESC
      LIMIT ?
    `).all(`%${term}%`, safeLimit) as Message[];
  }
}

function escapeLikePattern(value: string): string {
  return value.replace(/[\\%_]/g, '\\$&');
}

export function searchMessagesPaginated(
  params: SearchMessagesPaginatedParams
): SearchMessagesPaginatedResult {
  const rawPage =
    typeof params.page === 'number' && Number.isFinite(params.page)
      ? Math.trunc(params.page)
      : 1;

  const safePage = Math.max(1, rawPage);

  const rawLimit =
    typeof params.limit === 'number' && Number.isFinite(params.limit)
      ? Math.trunc(params.limit)
      : 20;

  const safeLimit = Math.max(1, Math.min(rawLimit, 100));

  const term =
    typeof params.query === 'string' ? params.query.trim() : '';

  if (!term) {
    return {
      results: [],
      total: 0,
      page: safePage,
      limit: safeLimit,
      totalPages: 0,
    };
  }

  const words = term
    .replace(/["*(){}[\]^:+-]/g, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (words.length === 0) {
    return {
      results: [],
      total: 0,
      page: safePage,
      limit: safeLimit,
      totalPages: 0,
    };
  }

  const db = getDatabase();
  const offset = (safePage - 1) * safeLimit;

  if (!Number.isSafeInteger(offset)) {
    throw new Error('INVALID_SEARCH_PAGE');
  }

  const matchQuery = words
    .map(word => `"${word.replace(/"/g, '""')}"`)
    .join(' AND ');

  try {
    const runFtsSearch = db.transaction(() => {
      const countRow = db.prepare(`
        SELECT COUNT(*) AS total
        FROM messages_fts f
        JOIN messages m ON m.id = f.message_id
        JOIN threads t ON t.id = m.thread_id
        WHERE messages_fts MATCH ?
      `).get(matchQuery) as { total: number } | undefined;

      const total = countRow?.total ?? 0;
      const totalPages = total === 0
        ? 0
        : Math.ceil(total / safeLimit);

      if (total === 0 || offset >= total) {
        return {
          results: [] as SearchMessageItem[],
          total,
          page: safePage,
          limit: safeLimit,
          totalPages,
        };
      }

      const results = db.prepare(`
        SELECT
          m.id,
          m.thread_id,
          t.title AS thread_title,
          m.role,
          m.content,
          m.created_at
        FROM messages_fts f
        JOIN messages m ON m.id = f.message_id
        JOIN threads t ON t.id = m.thread_id
        WHERE messages_fts MATCH ?
        ORDER BY m.created_at DESC, m.rowid DESC
        LIMIT ? OFFSET ?
      `).all(matchQuery, safeLimit, offset) as SearchMessageItem[];

      return {
        results,
        total,
        page: safePage,
        limit: safeLimit,
        totalPages,
      };
    });

    return runFtsSearch();
  } catch {
    const likePattern = `%${escapeLikePattern(term)}%`;

    const runLikeFallback = db.transaction(() => {
      const countRow = db.prepare(String.raw`
        SELECT COUNT(*) AS total
        FROM messages m
        JOIN threads t ON t.id = m.thread_id
        WHERE m.content LIKE ? ESCAPE '\'
      `).get(likePattern) as { total: number } | undefined;

      const total = countRow?.total ?? 0;
      const totalPages = total === 0
        ? 0
        : Math.ceil(total / safeLimit);

      if (total === 0 || offset >= total) {
        return {
          results: [] as SearchMessageItem[],
          total,
          page: safePage,
          limit: safeLimit,
          totalPages,
        };
      }

      const results = db.prepare(String.raw`
        SELECT
          m.id,
          m.thread_id,
          t.title AS thread_title,
          m.role,
          m.content,
          m.created_at
        FROM messages m
        JOIN threads t ON t.id = m.thread_id
        WHERE m.content LIKE ? ESCAPE '\'
        ORDER BY m.created_at DESC, m.rowid DESC
        LIMIT ? OFFSET ?
      `).all(likePattern, safeLimit, offset) as SearchMessageItem[];

      return {
        results,
        total,
        page: safePage,
        limit: safeLimit,
        totalPages,
      };
    });

    return runLikeFallback();
  }
}
