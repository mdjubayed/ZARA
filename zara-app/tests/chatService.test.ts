import assert from 'node:assert/strict';
import { ChatServiceError, sendChatMessage } from '../server/services/chatService.js';

async function expectCode(callback: () => Promise<unknown>, code: string): Promise<void> {
  await assert.rejects(callback, (error: unknown) => error instanceof ChatServiceError && error.code === code);
}

await expectCode(() => sendChatMessage({
  threadId: ' ', content: 'Hello', clientMessageId: 'test-1', onToken: () => undefined,
}), 'THREAD_ID_REQUIRED');

await expectCode(() => sendChatMessage({
  threadId: 'thread-1', content: ' ', clientMessageId: 'test-2', onToken: () => undefined,
}), 'MESSAGE_CONTENT_REQUIRED');

await expectCode(() => sendChatMessage({
  threadId: 'thread-1', content: 'Hello', clientMessageId: ' ', onToken: () => undefined,
}), 'CLIENT_MESSAGE_ID_REQUIRED');

console.log('Chat Service validation tests: PASS (3 assertions)');
