const MOBILE_BUILD = import.meta.env.VITE_MOBILE_APP === 'true';
const ENVIRONMENT_API_BASE = import.meta.env.VITE_API_BASE_URL?.trim() ?? '';

function normalizeApiBase(value: string): string {
  const url = new URL(value.trim());
  const isLoopback = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
  if (url.protocol !== 'https:' && !(url.protocol === 'http:' && isLoopback)) {
    throw new Error('ZARA_SERVER_MUST_USE_HTTPS');
  }
  if (url.username || url.password || url.search || url.hash) {
    throw new Error('INVALID_ZARA_SERVER_URL');
  }
  const path = url.pathname.replace(/\/+$/, '');
  if (path && path !== '/api/v1') throw new Error('INVALID_ZARA_SERVER_PATH');
  return `${url.origin}/api/v1`;
}

export function isMobileBuild(): boolean {
  return MOBILE_BUILD;
}

export function getApiBase(): string {
  if (!MOBILE_BUILD && !ENVIRONMENT_API_BASE) return '/api/v1';
  const configured = ENVIRONMENT_API_BASE || localStorage.getItem('zara.apiBaseUrl') || '';
  if (!configured) return '';
  try {
    return normalizeApiBase(configured);
  } catch {
    return '';
  }
}

export function saveApiBase(value: string): string {
  if (!MOBILE_BUILD) throw new Error('MOBILE_CONFIGURATION_ONLY');
  const normalized = normalizeApiBase(value);
  localStorage.setItem('zara.apiBaseUrl', normalized);
  return normalized;
}
