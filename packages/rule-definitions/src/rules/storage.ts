import type { Check } from '@sitelens/shared-types';
export const storageSecurityCheck: Check = {
  id: 'SL-STORAGE-002',
  version: '2.0.0',
  name: 'Browser storage sensitivity patterns',
  category: 'Storage',
  severity: 'informational',
  method: 'Count local-storage entries and redacted sensitive-name patterns; omit keys and values.',
  impact:
    'Script-readable storage may hold sensitive data. A name pattern does not establish that credentials are present or exposed.',
  limitation:
    'Values and actual keys are not retained. Application purpose, token validity and XSS exploitability remain unknown.',
  recommendation:
    'Review sensitive storage with the application owner. Consider HttpOnly cookies for suitable server-managed sessions and the associated CSRF controls.',
  learning:
    'Local storage is script-readable and has no HttpOnly attribute. Storage security depends on the data, application design and script execution context.',
  references: [
    'https://cheatsheetseries.owasp.org/cheatsheets/HTML5_Security_Cheat_Sheet.html#local-storage',
  ],
  run: (i) => ({
    status:
      i.page.storage.local === null
        ? 'unable_to_assess'
        : i.page.storage.local === 0
          ? 'not_applicable'
          : 'informational',
    confidence: 'low',
    observation:
      i.page.storage.local === null
        ? 'Local-storage metadata could not be read.'
        : `${i.page.storage.local} local-storage entries; ${i.page.storage.keys?.length || 0} redacted sensitive-name patterns. Values and actual names omitted.`,
    evidenceKeys: ['storage'],
  }),
};
