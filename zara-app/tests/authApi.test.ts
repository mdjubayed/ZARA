import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

const temporaryDirectory = mkdtempSync(path.join(tmpdir(), 'zara-auth-api-test-'));
process.env.ZARA_DATA_DIR = temporaryDirectory;
process.env.NODE_ENV = 'test';

const [{ app }, database] = await Promise.all([
  import('../server/app.js'),
  import('../server/db/database.js'),
]);

const server = createServer(app);
await new Promise<void>((resolve, reject) => {
  server.once('error', reject);
  server.listen(0, '127.0.0.1', resolve);
});
const address = server.address() as AddressInfo;
const baseUrl = `http://127.0.0.1:${address.port}/api/v1`;

after(async () => {
  await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  database.closeDatabase();
  rmSync(temporaryDirectory, { recursive: true, force: true });
  delete process.env.ZARA_DATA_DIR;
  delete process.env.NODE_ENV;
});

test('authentication API protects private application routes', async () => {
  const privateBeforeLogin = await fetch(`${baseUrl}/threads`);
  assert.equal(privateBeforeLogin.status, 401);

  const status = await fetch(`${baseUrl}/auth/status`);
  assert.equal(status.status, 200);
  assert.deepEqual(await status.json(), { setupRequired: true });

  const password = 'ZARA-api-owner-password-2026';
  const setup = await fetch(`${baseUrl}/auth/setup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password }),
  });
  assert.equal(setup.status, 201);
  const setCookie = setup.headers.get('set-cookie');
  assert.ok(setCookie);
  const cookie = setCookie.split(';', 1)[0];
  assert.match(cookie, /^zara_session=/);

  const privateAfterLogin = await fetch(`${baseUrl}/threads`, {
    headers: { Cookie: cookie },
  });
  assert.equal(privateAfterLogin.status, 200);

  const me = await fetch(`${baseUrl}/auth/me`, {
    headers: { Cookie: cookie },
  });
  assert.equal(me.status, 200);
  assert.equal((await me.json() as { authenticated: boolean }).authenticated, true);

  const logout = await fetch(`${baseUrl}/auth/logout`, {
    method: 'POST',
    headers: { Cookie: cookie },
  });
  assert.equal(logout.status, 200);

  const privateAfterLogout = await fetch(`${baseUrl}/threads`, {
    headers: { Cookie: cookie },
  });
  assert.equal(privateAfterLogout.status, 401);
});
