import type { Check } from '@sitelens/shared-types';
export const techVulnerabilityCheck: Check = {
  id: 'SL-TECH-002',
  version: '2.0.0',
  name: 'Dependency advisory applicability',
  category: 'Dependencies',
  severity: 'medium',
  method: 'Match exact package versions to supplied dated advisory affected ranges.',
  impact: 'A component version in an advisory range may require dependency review.',
  limitation:
    'Runtime reachability and exploitability remain unknown. Without an exact version and authoritative advisory data, no vulnerable-version assertion is made.',
  recommendation:
    'Use a current advisory dataset and confirm exact component versions and runtime applicability.',
  learning:
    'A version-range match is not a confirmed exploit. Unknown or inferred major versions must not be treated as exact versions.',
  references: ['https://osv.dev/docs/'],
  run: (i) => ({
    status: 'informational',
    observation: `${i.page.indicators.filter((t) => /^\d+\.\d+\.\d+$/.test(t.version)).length} exact-looking version indicators; advisories require independent version confidence and authoritative range data.`,
    evidenceKeys: ['technology'],
  }),
};
