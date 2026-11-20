import { getDatabase } from '../database.js';

export interface ChatRequestRecord {
  request_id: string;
  thread_id: string;
  user_message_id: string;
  assistant_message_id: string | null;
  provider_id: string | null;
  model: string | null;
  status: 'running' | 'completed';
}

export function claimChatRequest(
  requestId: string,
  threadId: string,
  userMessageId: string,
): { claimed: boolean; record: ChatRequestRecord } {
  const db = getDatabase();
  // The additive table is created by the normal database schema migration.
  db.prepare(`DELETE FROM chat_requests WHERE status = 'running' AND created_at < datetime('now', '-10 minutes')`).run();

  const result = db.prepare(`
    INSERT OR IGNORE INTO chat_requests
      (request_id, thread_id, user_message_id, status)
    VALUES (?, ?, ?, 'running')
  `).run(requestId, threadId, userMessageId);

  const record = db.prepare('SELECT * FROM chat_requests WHERE request_id = ?')
    .get(requestId) as ChatRequestRecord;
  return { claimed: result.changes === 1, record };
}

export function completeChatRequest(
  requestId: string,
  assistantMessageId: string,
  providerId: string,
  model?: string,
): void {
  getDatabase().prepare(`
    UPDATE chat_requests
    SET assistant_message_id = ?, provider_id = ?, model = ?, status = 'completed'
    WHERE request_id = ? AND status = 'running'
  `).run(assistantMessageId, providerId, model ?? null, requestId);
}

export function releaseChatRequest(requestId: string): void {
  getDatabase().prepare("DELETE FROM chat_requests WHERE request_id = ? AND status = 'running'").run(requestId);
}
