
import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import {
  ProviderRequestError,
  type ProviderAdapter,
  type ProviderGenerationRequest,
  type ProviderGenerationResponse,
} from '../server/services/providerAdapter.js';

const temporaryDirectory = mkdtempSync(
  path.join(tmpdir(), 'zara-brain-test-'),
);

process.env.ZARA_DATA_DIR = temporaryDirectory;

const [
  providerRepository,
  database,
  registry,
  brainManager,
] = await Promise.all([
  import('../server/db/repositories/providerRepository.js'),
  import('../server/db/database.js'),
  import('../server/services/providerRegistry.js'),
  import('../server/services/brainManager.js'),
]);

providerRepository.initializeProviders();

for (const id of ['omniroute', 'freellmapi'] as const) {
  providerRepository.markProviderReadyAfterVerification(id);
  providerRepository.setProviderEnabled(id, true);
}

const request: ProviderGenerationRequest = {
  messages: [
    { role: 'user', content: 'Hello Zara' },
  ],
};

function clearAdapters(): void {
  registry.unregisterProviderAdapter('omniroute');
  registry.unregisterProviderAdapter('freellmapi');
}

function createAdapter(
  providerId: 'omniroute' | 'freellmapi',
  generate: (
    request: ProviderGenerationRequest,
  ) => Promise<ProviderGenerationResponse> = async () => ({
    content: `${providerId} response`,
  }),
  stream: (
    request: ProviderGenerationRequest,
    onToken: (token: string) => void,
  ) => Promise<ProviderGenerationResponse> = async (_request, onToken) => {
    onToken(`${providerId} token`);
    return { content: `${providerId} response` };
  },
): ProviderAdapter {
  return {
    providerId,
    generate,
    stream,
    async verify() {
      return ['test-model'];
    },
  };
}

after(() => {
  clearAdapters();
  database.closeDatabase();
  rmSync(temporaryDirectory, { recursive: true, force: true });
  delete process.env.ZARA_DATA_DIR;
});

test('OmniRoute failure automatically falls back to FreeLLMAPI', async () => {
  clearAdapters();

  let backupCalls = 0;

  registry.registerProviderAdapter(
    createAdapter('omniroute', async () => {
      throw new ProviderRequestError(
        'omniroute',
        'PROVIDER_TIMEOUT',
        undefined,
        true,
      );
    }),
  );

  registry.registerProviderAdapter(
    createAdapter('freellmapi', async () => {
      backupCalls += 1;
      return { content: 'Backup response' };
    }),
  );

  const result = await brainManager.generateWithFailover(request);

  assert.equal(result.providerId, 'freellmapi');
  assert.equal(result.content, 'Backup response');
  assert.equal(backupCalls, 1);

  console.log('PASS: Automatic failover to FreeLLMAPI');
});

test('Authentication error does not trigger automatic failover', async () => {
  clearAdapters();

  let backupCalls = 0;

  registry.registerProviderAdapter(
    createAdapter('omniroute', async () => {
      throw new ProviderRequestError(
        'omniroute',
        'PROVIDER_AUTHENTICATION_FAILED',
        401,
        false,
      );
    }),
  );

  registry.registerProviderAdapter(
    createAdapter('freellmapi', async () => {
      backupCalls += 1;
      return { content: 'Backup response' };
    }),
  );

  await assert.rejects(
    () => brainManager.generateWithFailover(request),
    (error: unknown) =>
      error instanceof ProviderRequestError &&
      error.code === 'PROVIDER_AUTHENTICATION_FAILED',
  );

  assert.equal(backupCalls, 0);

  console.log('PASS: Authentication error does not trigger failover');
});

test('User cancellation does not trigger automatic failover', async () => {
  clearAdapters();

  let backupCalls = 0;

  registry.registerProviderAdapter(
    createAdapter('omniroute', async () => {
      throw new ProviderRequestError(
        'omniroute',
        'REQUEST_ABORTED',
        undefined,
        false,
      );
    }),
  );

  registry.registerProviderAdapter(
    createAdapter('freellmapi', async () => {
      backupCalls += 1;
      return { content: 'Backup response' };
    }),
  );

  await assert.rejects(
    () => brainManager.generateWithFailover(request),
    (error: unknown) =>
      error instanceof ProviderRequestError &&
      error.code === 'REQUEST_ABORTED',
  );

  assert.equal(backupCalls, 0);

  console.log('PASS: User cancellation does not trigger failover');
});

test('Streaming failure after sending a token does not switch providers', async () => {
  clearAdapters();

  let backupCalls = 0;
  const receivedTokens: string[] = [];

  registry.registerProviderAdapter(
    createAdapter(
      'omniroute',
      undefined,
      async (_request, onToken) => {
        onToken('Partial response');

        throw new ProviderRequestError(
          'omniroute',
          'PROVIDER_STREAM_INTERRUPTED',
          undefined,
          true,
        );
      },
    ),
  );

  registry.registerProviderAdapter(
    createAdapter(
      'freellmapi',
      undefined,
      async (_request, onToken) => {
        backupCalls += 1;
        onToken('Backup token');
        return { content: 'Backup response' };
      },
    ),
  );

  await assert.rejects(
    () =>
      brainManager.streamWithFailover(
        request,
        undefined,
        (token) => receivedTokens.push(token),
      ),
    (error: unknown) =>
      error instanceof ProviderRequestError &&
      error.code === 'PROVIDER_STREAM_INTERRUPTED',
  );

  assert.deepEqual(receivedTokens, ['Partial response']);
  assert.equal(backupCalls, 0);

  console.log('PASS: Streaming does not switch after partial output');
});
