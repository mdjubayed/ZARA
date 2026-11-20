# ZARA Web Search & Reader

## What it does

- Opens a public web search in DuckDuckGo with Safe Search enabled and blocks search requests matching unsafe or age-restricted topics.
- Lets the user enter an HTTPS page address and open it in the system browser after a confirmation prompt.
- Supports Bengali and English search terms.
- Uses the existing Electron external-browser confirmation flow on Windows desktop.

## Security boundary

- Search terms are sent to DuckDuckGo only after the user confirms.
- Page navigation is opened by the user's browser; the ZARA backend does not fetch arbitrary URLs. This avoids turning the backend into an open proxy and avoids server-side request forgery (SSRF) exposure.
- Only HTTPS addresses with ordinary public hostnames are accepted. IP literals, local hostnames, credentials in URLs, and non-HTTPS schemes are rejected.
- ZARA does not sign into websites, download files, execute remote scripts, or read browser cookies.
- This first version does not fetch or extract page text automatically. Users can paste up to 15,000 characters of selected page text into the panel; ZARA treats it as untrusted reference material and is instructed not to follow embedded commands or provide dangerous, illegal, or age-restricted instructions.
- External websites remain subject to their own privacy, content, and safety policies. Search Safe Search is enabled, but no search filter is perfect.

## Not implemented

- Automatic in-app page extraction or browser-based summarization
- Browser automation, website form submission, or account login
- Background browsing or unattended web actions
