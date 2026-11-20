import { Router } from 'express';
import { z } from 'zod';
import {
  createThread,
  getAllThreads,
  getThreadById,
  updateThreadTitle,
  deleteThread,
} from '../db/repositories/threadRepository';

export const threadRouter = Router();

const createThreadSchema = z.object({
  title: z.string().trim().min(1).max(120).optional(),
});

const updateThreadSchema = z.object({
  title: z.string().trim().min(1).max(120),
});

// GET: List all threads
threadRouter.get('/', (_req, res) => {
  const threads = getAllThreads();
  return res.status(200).json({ threads });
});

// POST: Create a new thread
threadRouter.post('/', (req, res) => {
  const parsed = createThreadSchema.safeParse(req.body ?? {});

  if (!parsed.success) {
    return res.status(400).json({
      error: 'INVALID_THREAD_DATA',
      details: parsed.error.flatten().fieldErrors,
    });
  }

  const thread = createThread(parsed.data.title);
  return res.status(201).json({ thread });
});

// GET: Get one thread
threadRouter.get('/:threadId', (req, res) => {
  const thread = getThreadById(req.params.threadId);

  if (!thread) {
    return res.status(404).json({ error: 'THREAD_NOT_FOUND' });
  }

  return res.status(200).json({ thread });
});

// PATCH: Rename a thread
threadRouter.patch('/:threadId', (req, res) => {
  const parsed = updateThreadSchema.safeParse(req.body ?? {});

  if (!parsed.success) {
    return res.status(400).json({
      error: 'INVALID_THREAD_DATA',
      details: parsed.error.flatten().fieldErrors,
    });
  }

  const thread = updateThreadTitle(req.params.threadId, parsed.data.title);

  if (!thread) {
    return res.status(404).json({ error: 'THREAD_NOT_FOUND' });
  }

  return res.status(200).json({ thread });
});

// DELETE: Delete a thread
threadRouter.delete('/:threadId', (req, res) => {
  const deleted = deleteThread(req.params.threadId);

  if (!deleted) {
    return res.status(404).json({ error: 'THREAD_NOT_FOUND' });
  }

  return res.status(200).json({ success: true });
});
