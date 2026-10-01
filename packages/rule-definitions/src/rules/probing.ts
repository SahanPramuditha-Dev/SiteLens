import type { Check } from '@sitelens/shared-types';
export const activeProbingCheck: Check = {
  id: 'SL-PROBE-001',
  name: 'Active testing coverage',
  category: 'Configuration',
  severity: 'informational',
  method: 'Record that active testing is outside this release.',
  impact:
    'Passive browser observations cannot establish whether sensitive files or exploitable vulnerabilities exist.',
  limitation:
    'No probes, attack payloads, authentication attacks or exploit confirmation are performed.',
  recommendation:
    'Use a separately scoped authorized security assessment when active testing is required.',
  learning:
    'Passive inspection and active testing have different collection methods and authorization requirements.',
  references: ['https://owasp.org/www-project-web-security-testing-guide/'],
  run: () => ({
    status: 'unable_to_assess',
    observation: 'Active testing is unsupported. No paths were probed.',
    evidenceKeys: ['active-probes'],
  }),
};
