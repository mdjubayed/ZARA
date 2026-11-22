# ZARA Account Authentication

ZARA uses a single-owner account for a private installation.

## First launch
1. Open ZARA.
2. Create an owner password containing 12–128 characters.
3. Confirm the password.
4. Sign in with that password on later visits.

The first successful setup creates the only owner account. The setup endpoint refuses subsequent account creation.

## Security model
- Passwords are stored as salted scrypt hashes; plaintext passwords are never written to SQLite.
- Session tokens are random, HttpOnly cookies. Only SHA-256 token hashes are stored in SQLite.
- Cookies use SameSite=Strict and Secure when ZARA is served over HTTPS.
- Sessions expire after seven days.
- Login and setup attempts are rate-limited per client IP.
- Health and authentication status endpoints are public; application data, chat, search, settings, and provider routes require a valid owner session.
- API keys remain separate from account authentication and must never be stored in account settings.

## Important deployment requirements
- Use HTTPS for any network-accessible deployment.
- Keep the ZARA API behind the same trusted origin as the frontend where possible.
- Do not expose an unauthenticated backend port directly to the public internet.
- Back up the SQLite database securely. Losing the owner password currently requires a separately planned local recovery procedure; there is no password-reset endpoint.
- Rate limiting is currently process-local. A multi-instance deployment needs a shared rate-limit store and session revocation strategy before production use.
