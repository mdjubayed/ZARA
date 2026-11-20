import test from 'node:test';
import assert from 'node:assert/strict';
import { buildWebSearchUrl, isAllowedWebSearchQuery, validateWebPageUrl } from '../src/lib/webNavigation.js';

test('builds a DuckDuckGo search URL with Safe Search enabled', () => {
  const result = new URL(buildWebSearchUrl('বাংলা গল্প'));
  assert.equal(result.origin, 'https://duckduckgo.com');
  assert.equal(result.searchParams.get('q'), 'বাংলা গল্প');
  assert.equal(result.searchParams.get('kp'), '1');
});

test('rejects blank and overlong search queries', () => {
  assert.throws(() => buildWebSearchUrl('   '), /INVALID_WEB_SEARCH_QUERY/);
  assert.throws(() => buildWebSearchUrl('x'.repeat(301)), /INVALID_WEB_SEARCH_QUERY/);
});

test('blocks unsafe or age-restricted search topics', () => {
  assert.equal(isAllowedWebSearchQuery('ordinary science homework'), true);
  assert.equal(isAllowedWebSearchQuery('how to gamble online'), false);
  assert.equal(isAllowedWebSearchQuery('অস্ত্র সম্পর্কে তথ্য'), false);
  assert.throws(() => buildWebSearchUrl('how to gamble online'), /INVALID_WEB_SEARCH_QUERY/);
});

test('accepts public HTTPS URLs and strips fragments', () => {
  assert.deepEqual(validateWebPageUrl('https://example.com/article#section'), {
    ok: true,
    url: 'https://example.com/article',
  });
});

test('rejects non-HTTPS schemes and malformed URLs', () => {
  assert.equal(validateWebPageUrl('http://example.com').ok, false);
  assert.equal(validateWebPageUrl('javascript:alert(1)').ok, false);
  assert.equal(validateWebPageUrl('not a url').ok, false);
});

test('rejects credentials, IP literals, and local hostnames', () => {
  assert.equal(validateWebPageUrl('https://user:pass@example.com').ok, false);
  assert.equal(validateWebPageUrl('https://127.0.0.1').ok, false);
  assert.equal(validateWebPageUrl('https://[::1]').ok, false);
  assert.equal(validateWebPageUrl('https://printer.local').ok, false);
  assert.equal(validateWebPageUrl('https://service.internal').ok, false);
  assert.equal(validateWebPageUrl('https://example.com:8443').ok, false);
  assert.equal(validateWebPageUrl('https://printer.localdomain.').ok, false);
});

test('rejects excessively long page URLs', () => {
  assert.equal(validateWebPageUrl('https://example.com/' + 'a'.repeat(2050)).ok, false);
});
