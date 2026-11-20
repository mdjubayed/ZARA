const SEARCH_BASE = 'https://duckduckgo.com/';

export function buildWebSearchUrl(query: string): string {
  const normalized = query.trim();
  if (!normalized || normalized.length > 300) {
    throw new Error('INVALID_WEB_SEARCH_QUERY');
  }
  const url = new URL(SEARCH_BASE);
  url.searchParams.set('q', normalized);
  url.searchParams.set('kp', '1');
  return url.toString();
}

export type WebPageUrlValidation =
  | { ok: true; url: string }
  | { ok: false; error: string };

/**
 * Only allow ordinary public HTTPS hostnames. Opening remains a user-confirmed
 * external-browser action; the ZARA backend never fetches arbitrary URLs.
 */
export function validateWebPageUrl(rawUrl: string): WebPageUrlValidation {
  const value = rawUrl.trim();
  if (!value || value.length > 2048) {
    return { ok: false, error: 'Enter a valid HTTPS website address (maximum 2,048 characters).' };
  }

  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    return { ok: false, error: 'That website address is not valid.' };
  }

  if (parsed.protocol !== 'https:') {
    return { ok: false, error: 'For safety, ZARA only opens HTTPS websites.' };
  }
  if (parsed.username || parsed.password) {
    return { ok: false, error: 'Website addresses containing usernames or passwords are not allowed.' };
  }

  const hostname = parsed.hostname.toLowerCase().replace(/^\[|\]$/g, '');
  const isIpAddress = /^\d{1,3}(?:\.\d{1,3}){3}$/.test(hostname) || hostname.includes(':');
  const isLocalName = hostname === 'localhost'
    || hostname.endsWith('.localhost')
    || hostname.endsWith('.local')
    || hostname.endsWith('.internal')
    || hostname.endsWith('.test')
    || hostname.endsWith('.invalid')
    || !hostname.includes('.');

  if (isIpAddress || isLocalName) {
    return { ok: false, error: 'Local network addresses and IP addresses cannot be opened from this tool.' };
  }

  parsed.hash = '';
  return { ok: true, url: parsed.toString() };
}
