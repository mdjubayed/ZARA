
import assert from 'node:assert/strict';
import {
  registerProviderAdapter,
  getProviderAdapter,
  hasProviderAdapter,
  unregisterProviderAdapter,
  getRegisteredProviderIds,
} from '../server/services/providerRegistry.js';
import type { ProviderAdapter } from '../server/services/providerAdapter.js';

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

function createAdapter(providerId: string): ProviderAdapter {
  return {
    providerId,
    async generate() {
      return { content: 'Test response' };
    },
  };
}

test('Registers a provider adapter', () => {
  registerProviderAdapter(createAdapter('test-provider'));
  assert.ok(hasProviderAdapter('test-provider'));
});

test('Retrieves a registered adapter', () => {
  const adapter = getProviderAdapter('test-provider');
  assert.ok(adapter);
  assert.equal(adapter.providerId, 'test-provider');
});

test('Rejects duplicate registration', () => {
  assert.throws(
    () => registerProviderAdapter(createAdapter('test-provider')),
    /PROVIDER_ADAPTER_ALREADY_REGISTERED/
  );
});

test('Rejects empty provider ID', () => {
  assert.throws(
    () => registerProviderAdapter(createAdapter('  ')),
    /PROVIDER_ID_REQUIRED/
  );
});

test('Lists registered provider IDs', () => {
  assert.ok(getRegisteredProviderIds().includes('test-provider'));
});

test('Unregisters a provider adapter', () => {
  assert.equal(unregisterProviderAdapter('test-provider'), true);
  assert.equal(hasProviderAdapter('test-provider'), false);
});

test('Returns false when unregistering a missing adapter', () => {
  assert.equal(unregisterProviderAdapter('missing-provider'), false);
});

console.log('\nProvider Registry Test Results');
console.log(`Passed: ${passed}`);
console.log(`Failed: ${failed}`);

if (failed > 0) {
  process.exitCode = 1;
}
