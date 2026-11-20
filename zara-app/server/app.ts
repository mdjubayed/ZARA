import express from 'express';
import cors from 'cors';
import { config } from './config';
import { threadRouter } from './routes/threads';
import { messageRouter } from './routes/messages';
import { settingsRouter } from './routes/settings';
import { providerRouter } from './routes/providers';
import searchRouter from './routes/search';

export const app = express();

app.disable('x-powered-by');

app.use(cors({
  origin(origin, callback) {
    if (!origin) {
      return callback(null, true);
    }

    const isLocalOrigin =
      /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin);

    const isCodespacesOrigin =
      /^https:\/\/[a-zA-Z0-9-]+\.app\.github\.dev$/.test(origin);

    const isAllowed =
      config.corsOrigins.includes(origin) ||
      (!config.isProduction && (isLocalOrigin || isCodespacesOrigin));

    if (isAllowed) {
      return callback(null, true);
    }

    return callback(new Error('CORS_ORIGIN_NOT_ALLOWED'));
  },
}));

app.use(express.json({ limit: '1mb' }));
app.use('/api/v1/threads', threadRouter);
app.use('/api/v1/threads/:threadId/messages', messageRouter);
app.use('/api/v1/settings', settingsRouter);
app.use('/api/v1/providers', providerRouter);
app.use('/api/v1/search', searchRouter);
app.get('/api/v1/health', (_req, res) => {
  res.status(200).json({
    status: 'ok',
    service: 'zara-api',
    timestamp: new Date().toISOString(),
  });
});
