
import assert from 'node:assert/strict';
import {
  ChatServiceError,
  sendChatMessage,
} from '../server/services/chatService.js';
import { getProviderById } from '../server/db/repositories/providerRepository.js';

let passed = 0;
let failed = 0;

function test(name: string, callback: () => void): void {
  try {
    callback();
    passed++;
    console.log(`PASS: ${name}`);
  } catch (error) {
    failed++;
    console.error(`FAIL: ${name}`, error);
  }
}

function expectError(
  callback: () => unknown,
  expectedCode: string
): void {
  assert.throws(callback, (error: unknown) => {
    return (
      error instanceof ChatServiceError &&
      error.code === expectedCode
    );
  });
}

test('Rejects empty thread ID', () => {
  expectError(
    () => sendChatMessage({
      threadId: ' ',
      content: 'Hello',
      providerId: 'gemini',
    }),
    'THREAD_ID_REQUIRED'
  );
});

test('Rejects empty message content', () => {
  expectError(
    () => sendChatMessage({
      threadId: 'test-thread',
      content: ' ',
      providerId: 'gemini',
    }),
    'MESSAGE_CONTENT_REQUIRED'
  );
});

test('Rejects empty provider ID', () => {
  expectError(
    () => sendChatMessage({
      threadId: 'test-thread',
      content: 'Hello',
      providerId: ' ',
    }),
    'PROVIDER_ID_REQUIRED'
  );
});

test('Rejects unknown provider', () => {
  expectError(
    () => sendChatMessage({
      threadId: 'test-thread',
      content: 'Hello',
      providerId: 'unknown-provider',
    }),
    'PROVIDER_NOT_FOUND'
  );
});

test('Rejects unconfigured provider', () => {
  const provider = getProviderById('gemini');

  assert.ok(provider);

  if (provider.status !== 'ready' || provider.enabled !== 1) {
    expectError(
      () => sendChatMessage({
        threadId: 'test-thread',
        content: 'Hello',
        providerId: 'gemini',
      }),
      'PROVIDER_NOT_CONFIGURED'
    );
  } else {
    console.log('SKIP: Gemini is already configured and enabled');
  }
});

console.log('\nChat Service Test Results');
console.log(`Passed: ${passed}`);
console.log(`Failed: ${failed}`);

if (failed > 0) {
  process.exitCode = 1;
}
