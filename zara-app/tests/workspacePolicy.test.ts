import assert from 'node:assert/strict';
import { test } from 'node:test';
import { isSafeWorkspaceDirectory, isSafeWorkspacePath, WORKSPACE_FILE_SIZE_LIMIT } from '../src/lib/workspacePolicy.js';

test('allows supported text and source files', () => {
  assert.equal(isSafeWorkspacePath('src/App.tsx'), true);
  assert.equal(isSafeWorkspacePath('notes/idea.md'), true);
  assert.equal(isSafeWorkspacePath('data/export.csv'), true);
});

test('rejects unsupported and binary file types', () => {
  assert.equal(isSafeWorkspacePath('image.png'), false);
  assert.equal(isSafeWorkspacePath('archive.zip'), false);
  assert.equal(isSafeWorkspacePath('program.exe'), false);
});

test('rejects hidden files and environment files', () => {
  assert.equal(isSafeWorkspacePath('.env'), false);
  assert.equal(isSafeWorkspacePath('.env.local'), false);
  assert.equal(isSafeWorkspacePath('.git/config'), false);
  assert.equal(isSafeWorkspacePath('folder/.hidden.ts'), false);
});

test('rejects likely credential and secret files', () => {
  assert.equal(isSafeWorkspacePath('secrets.json'), false);
  assert.equal(isSafeWorkspacePath('api-token.txt'), false);
  assert.equal(isSafeWorkspacePath('private-key.pem'), false);
  assert.equal(isSafeWorkspacePath('credentials/config.json'), false);
});

test('rejects traversal and absolute paths', () => {
  assert.equal(isSafeWorkspacePath('../outside.txt'), false);
  assert.equal(isSafeWorkspacePath('/outside.txt'), false);
  assert.equal(isSafeWorkspacePath('src/../../outside.txt'), false);
  assert.equal(isSafeWorkspacePath('src\\\\outside.txt'), false);
});

test('does not descend into dependency, build, or hidden directories', () => {
  assert.equal(isSafeWorkspaceDirectory('node_modules'), false);
  assert.equal(isSafeWorkspaceDirectory('src/.git'), false);
  assert.equal(isSafeWorkspaceDirectory('dist'), false);
  assert.equal(isSafeWorkspaceDirectory('src/components'), true);
});

test('exposes a bounded 500 KB editor limit', () => {
  assert.equal(WORKSPACE_FILE_SIZE_LIMIT, 500_000);
});
