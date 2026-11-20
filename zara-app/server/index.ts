import { createServer } from 'node:http';
import { app } from './app';
import { config } from './config';
import { closeDatabase } from './db/database';

const server = createServer(app);

server.listen(config.port, '127.0.0.1', () => {
  console.log(`ZARA API running on port ${config.port}`);
  console.log(`Environment: ${config.nodeEnv}`);
});

function shutdown(signal: string) {
  console.log(`${signal} received. Shutting down ZARA API...`);

  server.close(() => {
    try {
      closeDatabase();
      console.log('ZARA API stopped.');
      process.exit(0);
    } catch (error) {
      console.error('Database shutdown failed:', error);
      process.exit(1);
    }
  });
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
