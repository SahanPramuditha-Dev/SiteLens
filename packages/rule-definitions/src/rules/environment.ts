import type { Check } from '@sitelens/shared-types';
export const secretExposureCheck: Check = {
  id: 'SL-SECRET-001',
  version: '2.0.0',
  name: 'Potential client-visible credentials',
  category: 'Information exposure',
  severity: 'high',
  method:
    'Combine assignment key, value format, entropy, provider and public context; retain SHA-256 and short previews only.',
  impact: 'An exposed usable credential may grant unintended access.',
  limitation:
    'Validity, permissions and runtime usability are unknown. Public browser keys are distinguished from secret formats. External bundles are not fetched.',
  recommendation:
    'Investigate high-confidence credential patterns. Rotate confirmed exposed credentials and remove private configuration from client builds.',
  learning:
    'A public prefix is a clue, not permission to expose a private credential. Provider secret formats take precedence over public naming.',
  references: [
    'https://cheatsheetseries.owasp.org/cheatsheets/Secrets_Management_Cheat_Sheet.html',
  ],
  run: (i) => {
    const matches = i.page.secrets || [];
    const risky = matches.filter((s) => s.isSecret && s.confidence !== 'Low');
    return {
      status: risky.length ? 'potential_weakness' : 'informational',
      confidence: risky.some((s) => s.confidence === 'High')
        ? 'high'
        : risky.length
          ? 'medium'
          : 'low',
      observation: `${risky.length} potential credentials and ${matches.filter((s) => s.isLikelyPublic).length} public-context configurations observed. Credentials were not validated; complete values are not retained.`,
      evidenceKeys: ['environment-secrets'],
    };
  },
};
