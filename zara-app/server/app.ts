import express from 'express';
import type { ErrorRequestHandler } from 'express';
import cors from 'cors';
import path from 'node:path';
import { config } from './config.js';
import { authRouter } from './routes/auth.js';
import { requireAuth } from './middleware/requireAuth.js';
import { threadRouter } from './routes/threads.js';
import { messageRouter } from './routes/messages.js';
import { settingsRouter } from './routes/settings.js';
import { providerRouter } from './routes/providers.js';
import { chatRouter } from './routes/chat.js';
import searchRouter from './routes/search.js';

export const app = express();
app.disable('x-powered-by');

const corsMiddleware = cors({
  credentials: true,
  origin(origin, callback) {
    if (!origin) return callback(null, true);
    const isLocalOrigin = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin);
    const isCodespacesOrigin = /^https:\/\/[a-zA-Z0-9-]+\.app\.github\.dev$/.test(origin);
    const isAllowed = config.corsOrigins.includes(origin) || (!config.isProduction && (isLocalOrigin || isCodespacesOrigin));
    if (isAllowed) return callback(null, true);
    return callback(new Error('CORS_ORIGIN_NOT_ALLOWED'));
  },
});

// Same-origin requests do not need CORS. Cross-origin Android requests still
// pass through the exact-origin allowlist above.
app.use((req, res, next) => {
  const origin = req.get('origin');
  const requestHost = req.get('host');
  if (origin && requestHost) {
    try {
      if (new URL(origin).host === requestHost) {
        next();
        return;
      }
    } catch {
      // Invalid origins are rejected by the CORS middleware below.
    }
  }
  corsMiddleware(req, res, next);
});

app.use(express.json({ limit: '1mb' }));

app.get('/api/v1/health', (_req, res) => {
  return res.status(200).json({ status: 'ok', service: 'zara-api', timestamp: new Date().toISOString() });
});

app.use('/api/v1/auth', authRouter);

// All application data and provider operations require the owner session.
app.use('/api/v1', requireAuth);
app.use('/api/v1/threads', threadRouter);
app.use('/api/v1/threads/:threadId/messages', messageRouter);
app.use('/api/v1/settings', settingsRouter);
app.use('/api/v1/providers', providerRouter);
app.use('/api/v1/chat', chatRouter);
app.use('/api/v1/search', searchRouter);

if (config.serveFrontend) {
  const frontendDirectory = path.resolve(process.env.ZARA_FRONTEND_DIR || path.join(process.cwd(), 'dist'));
  app.use(express.static(frontendDirectory, { index: false }));
  app.use((req, res, next) => {
    if (req.method !== 'GET' || req.path.startsWith('/api/')) {
      next();
      return;
    }
    res.sendFile(path.join(frontendDirectory, 'index.html'), (error) => {
      if (error) next(error);
    });
  });
}

const apiErrorHandler: ErrorRequestHandler = (error, _req, res, _next) => {
  if (res.headersSent) return;

  const requestError = error as { type?: string; message?: string };

  if (requestError.type === 'entity.too.large') {
    res.status(413).json({ error: 'REQUEST_BODY_TOO_LARGE' });
    return;
  }

  if (requestError.type === 'entity.parse.failed') {
    res.status(400).json({ error: 'INVALID_JSON_BODY' });
    return;
  }

  if (requestError.message === 'CORS_ORIGIN_NOT_ALLOWED') {
    res.status(403).json({ error: 'CORS_ORIGIN_NOT_ALLOWED' });
    return;
  }

  res.status(500).json({ error: 'INTERNAL_SERVER_ERROR' });
};

app.use(apiErrorHandler);
