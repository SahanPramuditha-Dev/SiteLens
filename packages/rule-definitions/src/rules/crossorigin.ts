import type { Check } from '@sitelens/shared-types';
import { policies } from '../policies';
const base = {
  category: 'Cross-Origin & Isolation',
  severity: 'informational' as const,
  version: '2.0.0',
  method: 'Inspect actual response header values, without issuing cross-origin tests.',
  impact: 'Browser policies can control cross-origin sharing and browsing context isolation.',
  limitation:
    'Header observations do not establish access to sensitive data or exploitable behavior. Absence may be appropriate.',
  recommendation: 'Review policy applicability and integration compatibility.',
  learning: 'Cross-origin sharing and cross-origin isolation have different purposes.',
  references: ['https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/CORS'],
};
const isolation = (id: string, name: string, key: string, accepted: string[]): Check => ({
  ...base,
  id,
  name,
  run: (i) => {
    const values = i.response?.headers[key] || [];
    return {
      status: !i.response
        ? 'unable_to_assess'
        : values.some((v) => accepted.includes(v.split(';')[0].trim()))
          ? 'protection_observed'
          : 'informational',
      observation: values.length
        ? `${name}: ${values.join(', ')}. Applicability remains contextual.`
        : `${name} not observed; absence is not a general vulnerability.`,
      evidenceKeys: [key],
    };
  },
});
export const coopCheck = isolation(
  'SL-COOP-001',
  'Cross-origin opener policy',
  'cross-origin-opener-policy',
  ['same-origin', 'same-origin-allow-popups', 'noopener-allow-popups']
);
export const coepCheck = isolation(
  'SL-COEP-001',
  'Cross-origin embedder policy',
  'cross-origin-embedder-policy',
  ['require-corp', 'credentialless']
);
export const corpCheck = isolation(
  'SL-CORP-001',
  'Cross-origin resource policy',
  'cross-origin-resource-policy',
  ['same-origin', 'same-site']
);
export const corsCheck: Check = {
  ...base,
  id: 'SL-CORS-001',
  name: 'CORS response and credential relationships',
  run: (i) => {
    if (!i.response)
      return {
        status: 'unable_to_assess',
        observation: 'Response headers unavailable.',
        evidenceKeys: ['cors'],
      };
    const observed = [
      i.response,
      ...(i.requests || []).filter((r) => r.headers['access-control-allow-origin']),
    ];
    const conflicts = observed.filter(
      (r) =>
        r.headers['access-control-allow-origin']?.includes('*') &&
        r.headers['access-control-allow-credentials']?.includes('true')
    );
    return {
      status: 'informational',
      observation: `${observed.length} observed responses reviewed; ${conflicts.length} wildcard/credentials combinations are incompatible with credentialed CORS reads. Origin reflection and sensitive response access were not tested.`,
      evidenceKeys: ['cors'],
    };
  },
};
export const trustedTypesCheck: Check = {
  ...base,
  id: 'SL-TT-001',
  name: 'Trusted Types enforcement',
  category: 'Client-Side Security',
  method: 'Parse enforced CSP require-trusted-types-for tokens separately from Report-Only.',
  run: (i) => {
    const enforced = policies([
      ...(i.response?.headers['content-security-policy'] || []),
      ...i.page.metaCsp,
    ]);
    const required = enforced.some((p) => p.get('require-trusted-types-for')?.includes("'script'"));
    const reportOnly = policies(
      i.response?.headers['content-security-policy-report-only'] || []
    ).some((p) => p.get('require-trusted-types-for')?.includes("'script'"));
    return {
      status: required
        ? 'protection_observed'
        : !i.response && !i.page.metaCsp.length
          ? 'unable_to_assess'
          : 'informational',
      observation: required
        ? "Trusted Types 'script' requirement observed in an enforced policy. Policy quality and runtime behavior are not assessed."
        : reportOnly
          ? 'Trusted Types is report-only; enforcement not established.'
          : 'No enforced Trusted Types requirement observed; applicability is contextual.',
      evidenceKeys: ['content-security-policy', 'content-security-policy-report-only', 'meta-csp'],
    };
  },
};
export const redirectCheck: Check = {
  ...base,
  id: 'SL-REDIRECT-001',
  name: 'Redirect transport and origin changes',
  severity: 'medium',
  run: (i) => {
    const hops = i.response?.redirects || [];
    const downgraded = hops.filter(
      (h) => h.url.startsWith('https:') && h.destination.startsWith('http:')
    );
    return {
      status: !i.response
        ? 'unable_to_assess'
        : downgraded.length
          ? 'potential_weakness'
          : 'informational',
      observation: `${hops.length} permitted redirect hops observed; ${downgraded.length} HTTPS-to-HTTP downgrades. Chain completeness is not guaranteed.`,
      evidenceKeys: ['redirects'],
    };
  },
};
