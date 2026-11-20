import { useEffect, useState } from 'react';
import type { FormEvent, ReactNode } from 'react';

type AuthStatus = { setupRequired: boolean };
type AuthResponse = { authenticated: boolean; error?: string };

async function requestAuth(path: string, password?: string): Promise<AuthResponse> {
  const response = await fetch(`/api/v1/auth/${path}`, {
    method: path === 'status' || path === 'me' ? 'GET' : 'POST',
    headers: password === undefined ? undefined : { 'Content-Type': 'application/json' },
    body: password === undefined ? undefined : JSON.stringify({ password }),
    credentials: 'same-origin',
  });
  const body = await response.json().catch(() => ({})) as AuthResponse & AuthStatus;
  if (!response.ok) throw new Error(body.error || 'AUTHENTICATION_FAILED');
  return body;
}

export default function AuthGate({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [setupRequired, setSetupRequired] = useState(false);
  const [authenticated, setAuthenticated] = useState(false);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    void requestAuth('status').then(async (status) => {
      if (!active) return;
      setSetupRequired(Boolean((status as AuthResponse & AuthStatus).setupRequired));
      try {
        await requestAuth('me');
        if (active) setAuthenticated(true);
      } catch {
        if (active) setAuthenticated(false);
      }
    }).catch(() => {
      if (active) setError('ZARA server is unavailable. Please refresh after the server starts.');
    }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    if (password.length < 12 || password.length > 128) {
      setError('Password must contain 12–128 characters.');
      return;
    }
    if (setupRequired && password !== confirmPassword) {
      setError('The passwords do not match.');
      return;
    }
    setBusy(true);
    try {
      await requestAuth(setupRequired ? 'setup' : 'login', password);
      setAuthenticated(true);
      setPassword('');
      setConfirmPassword('');
    } catch (cause) {
      const code = cause instanceof Error ? cause.message : 'AUTHENTICATION_FAILED';
      setError(code === 'AUTH_RATE_LIMITED' ? 'Too many attempts. Wait 15 minutes and try again.' :
        code === 'OWNER_ALREADY_CONFIGURED' ? 'The first account is already set up. Refresh and sign in.' :
        code === 'INVALID_CREDENTIALS' ? 'Incorrect password.' : 'Could not complete authentication. Please try again.');
      if (code === 'OWNER_ALREADY_CONFIGURED') setSetupRequired(false);
    } finally {
      setBusy(false);
    }
  }

  async function logout() {
    try { await requestAuth('logout'); } finally { setAuthenticated(false); }
  }

  if (loading) return <main className="auth-screen"><section className="auth-card"><h1>ZARA AI</h1><p>Checking secure sign-in…</p></section></main>;
  if (authenticated) return <>{children}<button className="auth-logout" onClick={() => void logout()}>Sign out</button></>;
  return (
    <main className="auth-screen">
      <form className="auth-card" onSubmit={submit}>
        <div className="auth-mark">Z</div>
        <h1>{setupRequired ? 'Secure your ZARA' : 'Welcome back'}</h1>
        <p>{setupRequired ? 'Create the owner password for this private ZARA installation. It cannot be recovered by ZARA.' : 'Sign in to continue to your private ZARA assistant.'}</p>
        <label htmlFor="zara-password">{setupRequired ? 'Create password' : 'Owner password'}</label>
        <input id="zara-password" type="password" autoComplete={setupRequired ? 'new-password' : 'current-password'} minLength={12} maxLength={128} value={password} onChange={(event) => setPassword(event.target.value)} required />
        {setupRequired && <><label htmlFor="zara-confirm-password">Confirm password</label><input id="zara-confirm-password" type="password" autoComplete="new-password" minLength={12} maxLength={128} value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} required /></>}
        <small>Use at least 12 characters. Your password is stored only as a salted scrypt hash.</small>
        {error && <p className="auth-error" role="alert">{error}</p>}
        <button type="submit" disabled={busy || !password || (setupRequired && !confirmPassword)}>{busy ? 'Please wait…' : setupRequired ? 'Create Secure Account' : 'Sign In'}</button>
      </form>
    </main>
  );
}
