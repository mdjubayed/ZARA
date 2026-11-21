const SEARCH_BASE = 'https://duckduckgo.com/';

const DISALLOWED_SEARCH_PATTERNS = [
  /\b(guns?|firearms?|ammunition|weapons?|knives|switchblades|tasers?|pepper spray)\b/i,
  /\b(drugs?|narcotics?|marijuana|cannabis|weed|vapes?|nicotine|cigarettes?|alcohol)\b/i,
  /\b(gamble|gambles|gambled|gambling|bet|bets|betting|casino|sports betting|prediction markets?)\b/i,
  /\b(explosives?|bomb making|dangerous challenges?|harmful stunts?)\b/i,
  /(অস্ত্র|বন্দুক|গুলি|ছুরি|মাদক|গাঁজা|নেশা|ভেপ|জুয়া|জুয়া|বাজি|বিস্ফোরক|বিপজ্জনক চ্যালেঞ্জ)/i,
];

export function isAllowedWebSearchQuery(query: string): boolean {
  const normalized = query.trim();
  return Boolean(normalized)
    && normalized.length <= 300
    && !DISALLOWED_SEARCH_PATTERNS.some((pattern) => pattern.test(normalized));
}

export function buildWebSearchUrl(query: string): string {
  const normalized = query.trim();
  if (!isAllowedWebSearchQuery(normalized)) {
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
  if (parsed.username || parsed.password || (parsed.port && parsed.port !== '443')) {
    return { ok: false, error: 'Credentials and nonstandard ports are not allowed in website addresses.' };
  }

  const hostname = parsed.hostname.toLowerCase().replace(/^\[|\]$/g, '').replace(/\.$/, '');
  const isIpAddress = /^\d{1,3}(?:\.\d{1,3}){3}$/.test(hostname) || hostname.includes(':');
  const isLocalName = hostname === 'localhost'
    || hostname.endsWith('.localhost')
    || hostname.endsWith('.local')
    || hostname.endsWith('.internal')
    || hostname.endsWith('.test')
    || hostname.endsWith('.invalid')
    || hostname.endsWith('.lan')
    || hostname.endsWith('.corp')
    || hostname.endsWith('.intranet')
    || hostname.endsWith('.localdomain')
    || hostname.endsWith('.home.arpa')
    || !hostname.includes('.');

  if (isIpAddress || isLocalName) {
    return { ok: false, error: 'Local network addresses and IP addresses cannot be opened from this tool.' };
  }

  parsed.hash = '';
  return { ok: true, url: parsed.toString() };
}
