import { createServer } from 'node:http';
import { app } from './app';
import { config } from './config';
import { closeDatabase } from './db/database';

const server = createServer(app);

server.listen(config.port, config.host, () => {
  console.log(`ZARA API listening on ${config.host}:${config.port}`);
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
