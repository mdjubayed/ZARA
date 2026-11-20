import { Router } from 'express';
import { z } from 'zod';
import { sendChatMessage, ChatServiceError } from '../services/chatService.js';
import { initializeProviderAdapters } from '../services/providerAdapters.js';
import { ProviderRequestError } from '../services/providerAdapter.js';

export const chatRouter = Router();

const chatSchema = z.object({
  threadId: z.string().trim().min(1).max(100),
  content: z.string().trim().min(1).max(100000),
  clientMessageId: z.string().trim().min(1).max(80),
  providerId: z.enum(['omniroute', 'freellmapi']).optional(),
});

chatRouter.post('/stream', async (req, res) => {
  const parsed = chatSchema.safeParse(req.body ?? {});
  if (!parsed.success) return res.status(400).json({ error: 'INVALID_CHAT_REQUEST' });

  initializeProviderAdapters();
  const controller = new AbortController();
  res.on('close', () => {
    if (!res.writableEnded) controller.abort();
  });

  res.status(200);
  res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders();

  const sendEvent = (event: string, data: unknown) => {
    if (res.writableEnded) return;
    res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  };

  try {
    const result = await sendChatMessage({
      ...parsed.data,
      signal: controller.signal,
      onToken: (token) => sendEvent('token', { token }),
    });
    sendEvent('done', {
      userMessage: result.userMessage,
      assistantMessage: result.assistantMessage,
      providerId: result.providerId,
      model: result.model,
    });
  } catch (error) {
    if (error instanceof ChatServiceError) {
      sendEvent('error', { error: error.code });
    } else if (error instanceof ProviderRequestError) {
      sendEvent('error', { error: error.code, providerId: error.providerId });
    } else {
      sendEvent('error', { error: 'CHAT_REQUEST_FAILED' });
    }
  } finally {
    if (!res.writableEnded) res.end();
  }
});
