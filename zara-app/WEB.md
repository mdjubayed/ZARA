# ZARA Web Search & Reader

## What it does

- Opens a public web search in DuckDuckGo with Safe Search enabled.
- Lets the user enter an HTTPS page address and open it in the system browser after a confirmation prompt.
- Supports Bengali and English search terms.
- Uses the existing Electron external-browser confirmation flow on Windows desktop.

## Security boundary

- Search terms are sent to DuckDuckGo only after the user confirms.
- Page navigation is opened by the user's browser; the ZARA backend does not fetch arbitrary URLs. This avoids turning the backend into an open proxy and avoids server-side request forgery (SSRF) exposure.
- Only HTTPS addresses with ordinary public hostnames are accepted. IP literals, local hostnames, credentials in URLs, and non-HTTPS schemes are rejected.
- ZARA does not sign into websites, download files, execute remote scripts, or read browser cookies.
- This first version does not extract page text into ZARA. To ask ZARA to explain or summarize a page, the user can copy the relevant text and paste it into Chat.
- External websites remain subject to their own privacy, content, and safety policies. Search Safe Search is enabled, but no search filter is perfect.

## Not implemented

- In-app page extraction or summarization
- Browser automation, website form submission, or account login
- Background browsing or unattended web actions
