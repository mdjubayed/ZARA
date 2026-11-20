import { Router } from 'express';
import { z } from 'zod';
import { getThreadById } from '../db/repositories/threadRepository';
import {
  createMessage,
  getMessageById,
  getMessagesByThread,
  deleteMessage,
} from '../db/repositories/messageRepository';

export const messageRouter = Router({ mergeParams: true });

const createMessageSchema = z.object({
  role: z.enum(['user', 'assistant', 'system']),
  content: z.string().trim().min(1).max(100000),
});

// GET: List messages in a thread
messageRouter.get('/', (req, res) => {
  const threadId = req.params.threadId;
  const thread = getThreadById(threadId);

  if (!thread) {
    return res.status(404).json({ error: 'THREAD_NOT_FOUND' });
  }

  const messages = getMessagesByThread(threadId);
  return res.status(200).json({ messages });
});

// POST: Create a message
messageRouter.post('/', (req, res) => {
  const threadId = req.params.threadId;
  const thread = getThreadById(threadId);

  if (!thread) {
    return res.status(404).json({ error: 'THREAD_NOT_FOUND' });
  }

  const parsed = createMessageSchema.safeParse(req.body ?? {});

  if (!parsed.success) {
    return res.status(400).json({
      error: 'INVALID_MESSAGE_DATA',
      details: parsed.error.flatten().fieldErrors,
    });
  }

  const message = createMessage(
    threadId,
    parsed.data.role,
    parsed.data.content
  );

  return res.status(201).json({ message });
});

// DELETE: Delete a message
messageRouter.delete('/:messageId', (req, res) => {
  const existing = getMessageById(req.params.messageId);

  if (!existing || existing.thread_id !== req.params.threadId) {
    return res.status(404).json({ error: 'MESSAGE_NOT_FOUND' });
  }

  const deleted = deleteMessage(req.params.messageId);

  if (!deleted) {
    return res.status(404).json({ error: 'MESSAGE_NOT_FOUND' });
  }

  return res.status(200).json({ success: true });
});
