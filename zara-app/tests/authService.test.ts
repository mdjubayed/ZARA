import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

const temporaryDirectory = mkdtempSync(path.join(tmpdir(), 'zara-auth-test-'));
process.env.ZARA_DATA_DIR = temporaryDirectory;

const [database, auth] = await Promise.all([
  import('../server/db/database.js'),
  import('../server/services/authService.js'),
]);

after(() => {
  database.closeDatabase();
  rmSync(temporaryDirectory, { recursive: true, force: true });
  delete process.env.ZARA_DATA_DIR;
});

test('single-owner authentication lifecycle', async (t) => {
  const password = 'ZARA-test-owner-password-2026';
  assert.equal(auth.getOwnerCount(), 0);

  await t.test('creates the first owner and a session', async () => {
    const result = await auth.createOwnerAndSession(password);
    assert.ok(result);
    assert.equal(typeof result.token, 'string');
    assert.equal(auth.getOwnerCount(), 1);
    assert.equal(auth.getUserForSession(result.token)?.id, result.user.id);

    const db = database.getDatabase();
    const storedUser = db.prepare('SELECT password_hash FROM auth_users WHERE id = ?')
      .get(result.user.id) as { password_hash: string };
    assert.match(storedUser.password_hash, /^scrypt:/);
    assert.equal(storedUser.password_hash.includes(password), false);

    const storedSession = db.prepare('SELECT token_hash FROM auth_sessions WHERE user_id = ?')
      .get(result.user.id) as { token_hash: string };
    assert.notEqual(storedSession.token_hash, result.token);
  });

  await t.test('refuses a second owner account', async () => {
    assert.equal(await auth.createOwnerAndSession(password), null);
    assert.equal(auth.getOwnerCount(), 1);
  });

  await t.test('accepts the correct password and rejects an incorrect password', async () => {
    const valid = await auth.loginOwner(password);
    assert.ok(valid);
    assert.equal(auth.getUserForSession(valid.token)?.id, valid.user.id);
    assert.equal(await auth.loginOwner('incorrect-password-value'), null);
  });

  await t.test('revokes sessions and rejects their tokens', async () => {
    const session = await auth.loginOwner(password);
    assert.ok(session);
    auth.revokeSession(session.token);
    assert.equal(auth.getUserForSession(session.token), null);
  });
});
