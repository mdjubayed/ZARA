import assert from 'node:assert/strict';
import {
  getProviderApiKey,
  hasProviderApiKey,
} from '../server/services/secretStore.js';

const originalOmniRoute = process.env.OMNIROUTE_API_KEY;
const originalFreeLLMAPI = process.env.FREELLMAPI_API_KEY;

try {
  delete process.env.OMNIROUTE_API_KEY;
  delete process.env.FREELLMAPI_API_KEY;

  assert.equal(getProviderApiKey('omniroute'), undefined);
  assert.equal(getProviderApiKey('freellmapi'), undefined);
  assert.equal(hasProviderApiKey('omniroute'), false);
  assert.equal(hasProviderApiKey('freellmapi'), false);

  process.env.OMNIROUTE_API_KEY = 'test-omniroute-secret';

  assert.equal(
    getProviderApiKey('omniroute'),
    'test-omniroute-secret'
  );
  assert.equal(hasProviderApiKey('omniroute'), true);
  assert.equal(hasProviderApiKey('freellmapi'), false);

  process.env.FREELLMAPI_API_KEY = 'test-freellmapi-secret';

  assert.equal(
    getProviderApiKey('freellmapi'),
    'test-freellmapi-secret'
  );
  assert.equal(hasProviderApiKey('freellmapi'), true);

  console.log('Secret Store Tests: PASS');
  console.log('All 8 assertions passed.');
} finally {
  if (originalOmniRoute === undefined) {
    delete process.env.OMNIROUTE_API_KEY;
  } else {
    process.env.OMNIROUTE_API_KEY = originalOmniRoute;
  }

  if (originalFreeLLMAPI === undefined) {
    delete process.env.FREELLMAPI_API_KEY;
  } else {
    process.env.FREELLMAPI_API_KEY = originalFreeLLMAPI;
  }
}
