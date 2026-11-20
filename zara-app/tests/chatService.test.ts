import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import {
  ChatServiceError,
  sendChatMessage,
} from '../server/services/chatService.js';

const temporaryDirectory = mkdtempSync(
  path.join(tmpdir(), 'zara-chat-service-test-'),
);
process.env.ZARA_DATA_DIR = temporaryDirectory;

const [
  database,
  threadRepository,
  providerRepository,
  registry,
  messageRepository,
] = await Promise.all([
  import('../server/db/database.js'),
  import('../server/db/repositories/threadRepository.js'),
  import('../server/db/repositories/providerRepository.js'),
  import('../server/services/providerRegistry.js'),
  import('../server/db/repositories/messageRepository.js'),
]);

const thread = threadRepository.createThread('Chat service test');
providerRepository.initializeProviders();

for (const id of ['omniroute', 'freellmapi'] as const) {
  providerRepository.markProviderReadyAfterVerification(id);
  providerRepository.setProviderEnabled(id, true);
}

registry.registerProviderAdapter({
  providerId: 'omniroute',
  async generate() {
    return { content: 'Test response' };
  },
  async stream(_request, onToken) {
    onToken('Test ');
    onToken('response');
    return { content: 'Test response', model: 'test-model' };
  },
  async verify() {
    return ['test-model'];
  },
});

after(() => {
  registry.unregisterProviderAdapter('omniroute');
  database.closeDatabase();
  rmSync(temporaryDirectory, { recursive: true, force: true });
  delete process.env.ZARA_DATA_DIR;
});

async function expectCode(
  callback: () => Promise<unknown>,
  code: string,
): Promise<void> {
  await assert.rejects(
    callback,
    (error: unknown) =>
      error instanceof ChatServiceError && error.code === code,
  );
}

test('rejects invalid chat input', async () => {
  await expectCode(
    () => sendChatMessage({
      threadId: ' ',
      content: 'Hello',
      clientMessageId: 'invalid-1',
      onToken: () => undefined,
    }),
    'THREAD_ID_REQUIRED',
  );

  await expectCode(
    () => sendChatMessage({
      threadId: thread.id,
      content: ' ',
      clientMessageId: 'invalid-2',
      onToken: () => undefined,
    }),
    'MESSAGE_CONTENT_REQUIRED',
  );

  await expectCode(
    () => sendChatMessage({
      threadId: thread.id,
      content: 'Hello',
      clientMessageId: ' ',
      onToken: () => undefined,
    }),
    'CLIENT_MESSAGE_ID_REQUIRED',
  );
});

test('creates a chat request with a valid message foreign key', async () => {
  const result = await sendChatMessage({
    threadId: thread.id,
    content: 'Hello Zara',
    clientMessageId: 'chat-request-1',
    onToken: () => undefined,
  });

  assert.equal(result.userMessage.id, 'chat-request-1');
  assert.equal(result.assistantMessage.content, 'Test response');
  assert.equal(result.providerId, 'omniroute');
});

test('replaying the same client message ID does not create duplicate messages', async () => {
  const first = await sendChatMessage({
    threadId: thread.id,
    content: 'Replay safely',
    clientMessageId: 'chat-request-replay',
    onToken: () => undefined,
  });

  const second = await sendChatMessage({
    threadId: thread.id,
    content: 'Replay safely',
    clientMessageId: 'chat-request-replay',
    onToken: () => undefined,
  });

  assert.equal(second.replayed, true);
  assert.equal(second.userMessage.id, first.userMessage.id);
  assert.equal(second.assistantMessage.id, first.assistantMessage.id);
  assert.equal(messageRepository.getMessagesByThread(thread.id).length, 4);
});
