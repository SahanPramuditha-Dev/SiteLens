import type { CookieMetadata } from '@sitelens/shared-types';
export function text(value: unknown, limit = 4096): string {
  return String(value ?? '')
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '')
    .slice(0, limit);
}
export function redactUrl(value: string): string {
  try {
    if (!value) return '[unavailable URL]';
    const u = new URL(value);
    if (!['http:', 'https:'].includes(u.protocol)) return `${u.protocol}[OMITTED]`;
    u.username = '';
    u.password = '';
    u.hash = '';
    if (u.search) u.search = '?REDACTED';
    u.pathname = u.pathname
      .split('/')
      .map((p) => (p.length > 80 || /^eyJ[\w-]+\.[\w-]+\.[\w-]+$/.test(p) ? '[REDACTED]' : p))
      .join('/');
    return text(u.href, 2048);
  } catch {
    return '[unavailable URL]';
  }
}
export function redactHeader(value: string): string {
  return text(value, 16000)
    .replace(/'nonce-[^']*'/gi, "'nonce-[REDACTED]'")
    .replace(/https?:\/\/[^\s;,]+/gi, redactUrl)
    .replace(/\beyJ[\w-]+\.[\w-]+\.[\w-]+\b/g, '[REDACTED]');
}
export function cookieMetadata(cookie: any): CookieMetadata {
  return {
    name: text(cookie.name, 128),
    domain: text(cookie.domain, 256),
    path: redactUrl(`https://metadata.invalid${cookie.path || '/'}`).replace(
      'https://metadata.invalid',
      ''
    ),
    secure: cookie.secure === true,
    httpOnly: cookie.httpOnly === true,
    sameSite: text(cookie.sameSite || 'unspecified', 32),
    hostOnly: cookie.hostOnly === true,
    session: cookie.session === true,
    ...(Number.isFinite(cookie.expirationDate) ? { expirationDate: cookie.expirationDate } : {}),
    partitioned: !!cookie.partitionKey,
    value: '[REDACTED]',
  };
}
export async function hashUrl(url: string): Promise<string> {
  const u = new URL(url);
  u.hash = '';
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(u.href));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}
export function originOf(url: string): string {
  try {
    if (!url) return '';
    return new URL(url).origin;
  } catch {
    return '';
  }
}
export function httpUrl(url: string): boolean {
  try {
    return ['http:', 'https:'].includes(new URL(url).protocol);
  } catch {
    return false;
  }
}
