import type { Check } from '@sitelens/shared-types';
import { policies } from '../policies';
const base = {
  version: '1.0.0',
  category: 'Modern browser security',
  severity: 'low' as const,
  impact: 'Explicit browser policy can reduce accidental exposure in applicable contexts.',
  limitation:
    'Configuration patterns are contextual; browser support, policy intersections and runtime applicability require review.',
  recommendation: 'Review this policy with the application owner and test compatibility.',
  learning:
    'Presence and syntax are observations; enforcement and exploitability are separate questions.',
  references: [
    'https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Content-Security-Policy',
  ],
};
export const modernChecks: Check[] = [
  {
    ...base,
    id: 'SL-CSP-008',
    name: 'Script attribute restrictions',
    method: 'Inspect script-src-attr or its script/default fallback.',
    run: (i) => {
      const p = policies([
        ...(i.response?.headers['content-security-policy'] || []),
        ...i.page.metaCsp,
      ]);
      return {
        status: !p.length
          ? 'unable_to_assess'
          : p.some((p) =>
                (
                  p.get('script-src-attr') ??
                  p.get('script-src') ??
                  p.get('default-src') ??
                  []
                ).includes("'unsafe-inline'")
              )
            ? 'potential_weakness'
            : 'informational',
        observation:
          'Script attribute directive and fallback reviewed. Nonce/hash and unsafe-hashes interactions require contextual review.',
        evidenceKeys: ['content-security-policy', 'meta-csp'],
      };
    },
  },
  {
    ...base,
    id: 'SL-CSP-009',
    name: 'Extended CSP directive inventory',
    method: 'Inventory modern fetch, navigation, reporting and Trusted Types directives.',
    run: (i) => ({
      status: 'informational',
      observation:
        policies([...(i.response?.headers['content-security-policy'] || []), ...i.page.metaCsp])
          .map((p) => [...p.keys()].join(', '))
          .join(' | ') ||
        'No enforced policy available. Unsupported directives such as navigate-to are not assumed effective.',
      evidenceKeys: ['content-security-policy', 'meta-csp'],
    }),
  },
  {
    ...base,
    id: 'SL-CSP-010',
    name: 'Nonce, hash and strict-dynamic patterns',
    method: 'Inspect redacted source tokens; no nonce values are retained.',
    run: (i) => {
      const p = policies([
        ...(i.response?.headers['content-security-policy'] || []),
        ...i.page.metaCsp,
      ]);
      const scripts = p.flatMap((p) => p.get('script-src') || []);
      return {
        status: 'informational',
        observation: `Nonce tokens: ${scripts.filter((t) => t.startsWith("'nonce-")).length}; hash tokens: ${scripts.filter((t) => /^'sha(256|384|512)-/.test(t)).length}; strict-dynamic: ${scripts.includes("'strict-dynamic'") ? 'observed' : 'not observed'}.`,
        evidenceKeys: ['content-security-policy', 'meta-csp'],
      };
    },
  },
  {
    ...base,
    id: 'SL-PWA-001',
    name: 'Service worker and PWA scope',
    method:
      'Read same-origin registered service worker metadata without enumerating cache contents.',
    run: (i) => ({
      status: i.page.serviceWorkers ? 'informational' : 'unable_to_assess',
      observation: `${i.page.serviceWorkers?.length || 0} service worker registrations observed. Cached body sensitivity and session invalidation are not assessed.`,
      evidenceKeys: ['service-workers'],
    }),
  },
  {
    ...base,
    id: 'SL-CACHE-001',
    name: 'Document cache policy',
    category: 'Session observations',
    method: 'Inspect captured Cache-Control and Pragma in authentication-like document context.',
    run: (i) => {
      const cache = i.response?.headers['cache-control'] || [];
      const sensitive =
        i.page.forms.some((f) => f.password) ||
        i.cookies.cookies.some((c) => /(session|auth|token)/i.test(c.name));
      return {
        status: !i.response
          ? 'unable_to_assess'
          : sensitive && cache.some((c) => /(?:^|,)\s*public(?:,|$)/i.test(c))
            ? 'potential_weakness'
            : 'informational',
        observation: `Cache policy: ${cache.join(', ') || 'not observed'}. Sensitivity is ${sensitive ? 'heuristically suggested' : 'unknown'}; cache contents and user-specific response variation were not inspected.`,
        evidenceKeys: ['cache-control', 'forms', 'cookies'],
      };
    },
  },
  {
    ...base,
    id: 'SL-ISOLATION-001',
    name: 'Runtime cross-origin isolation',
    method: 'Read crossOriginIsolated from the selected document.',
    run: (i) => ({
      status:
        i.page.crossOriginIsolated === true
          ? 'protection_observed'
          : typeof i.page.crossOriginIsolated === 'boolean'
            ? 'informational'
            : 'unable_to_assess',
      observation: `crossOriginIsolated: ${i.page.crossOriginIsolated ?? 'unknown'}. Lack of isolation is not a general vulnerability.`,
      evidenceKeys: ['isolation'],
    }),
  },
];
