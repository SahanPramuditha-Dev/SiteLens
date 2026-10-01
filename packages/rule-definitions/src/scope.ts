import type { Scope } from '@sitelens/shared-types';
export function defaultScope(url: string): Scope {
  return {
    origins: [new URL(url).origin],
    domains: [],
    includeSubdomains: false,
    pathPrefixes: ['/'],
    excludedPaths: [],
    includeThirdParty: false,
    authorized: false,
    mode: 'passive',
    requestBudget: 0,
    requestsPerSecond: 1,
    maxBytes: 1000000,
    timeoutMs: 10000,
  };
}
function pathMatch(path: string, prefix: string) {
  return (
    prefix === '/' ||
    path === prefix ||
    path.startsWith(prefix.endsWith('/') ? prefix : prefix + '/')
  );
}
export function inScope(url: string, scope: Scope, thirdParty = false): boolean {
  try {
    const u = new URL(url);
    if (!['http:', 'https:', 'ws:', 'wss:'].includes(u.protocol) || u.username || u.password)
      return false;
    if (thirdParty && !scope.includeThirdParty) return false;
    const allowed =
      scope.origins.includes(u.origin) ||
      scope.domains.some(
        (d) => u.hostname === d || (scope.includeSubdomains && u.hostname.endsWith('.' + d))
      );
    let path = u.pathname;
    for (let n = 0; n < 3; n++) {
      const decoded = decodeURIComponent(path);
      if (decoded === path) break;
      path = decoded;
    }
    if (/%(?:2e|2f|5c|25)/i.test(path)) return false;
    const segments: string[] = [];
    for (const segment of path.replaceAll('\\', '/').split('/')) {
      if (!segment || segment === '.') continue;
      if (segment === '..') segments.pop();
      else segments.push(segment);
    }
    path = '/' + segments.join('/');
    return (
      allowed &&
      scope.pathPrefixes.some((p) => pathMatch(path, p)) &&
      !scope.excludedPaths.some((p) => pathMatch(path, p))
    );
  } catch {
    return false;
  }
}
export function validateScope(value: unknown): Scope {
  if (!value || typeof value !== 'object') throw new Error('Scope must be an object.');
  const s = value as Scope;
  for (const key of ['origins', 'domains', 'pathPrefixes', 'excludedPaths'] as const)
    if (
      !Array.isArray(s[key]) ||
      s[key].some((v) => typeof v !== 'string' || v.length > 2048) ||
      s[key].length > 100
    )
      throw new Error(`Invalid scope ${key}.`);
  if (!s.origins.length && !s.domains.length)
    throw new Error('Scope requires an origin or domain.');
  if (
    s.origins.some((o) => {
      try {
        return new URL(o).origin !== o || !/^https?:/.test(o);
      } catch {
        return true;
      }
    }) ||
    s.domains.some((d) => !/^([a-z0-9-]+\.)*[a-z0-9-]+$/i.test(d))
  )
    throw new Error('Scope origins or domains are invalid.');
  if (
    [...s.pathPrefixes, ...s.excludedPaths].some(
      (p) => !p.startsWith('/') || p.includes('..') || p.includes('?') || p.includes('#')
    )
  )
    throw new Error('Use absolute scope paths without queries or parent traversal.');
  for (const [k, min, max] of [
    ['requestBudget', 0, 100],
    ['requestsPerSecond', 0.1, 5],
    ['maxBytes', 1000, 2000000],
    ['timeoutMs', 1000, 30000],
  ] as const)
    if (!Number.isFinite(s[k]) || s[k] < min || s[k] > max) throw new Error(`Invalid scope ${k}.`);
  if (!['passive', 'supplemental'].includes(s.mode)) throw new Error('Unsupported scope mode.');
  if (s.mode === 'supplemental' && !s.authorized)
    throw new Error('Supplemental requests require recorded authorization.');
  return {
    ...s,
    includeSubdomains: s.includeSubdomains === true,
    includeThirdParty: s.includeThirdParty === true,
    authorized: s.authorized === true,
    requestBudget: s.mode === 'passive' ? 0 : Math.trunc(s.requestBudget),
  };
}
export class RequestBudget {
  private used = 0;
  private previous = 0;
  public scope: Scope;
  constructor(scope: Scope) {
    this.scope = scope;
  }
  async reserve(url: string) {
    if (
      this.scope.mode !== 'supplemental' ||
      !this.scope.authorized ||
      !inScope(url, this.scope) ||
      this.used >= this.scope.requestBudget
    )
      throw new Error('Request blocked by scope, authorization or budget.');
    this.used++;
    const wait = Math.max(0, this.previous + 1000 / this.scope.requestsPerSecond - Date.now());
    if (wait) await new Promise((r) => setTimeout(r, wait));
    this.previous = Date.now();
  }
  get count() {
    return this.used;
  }
}
