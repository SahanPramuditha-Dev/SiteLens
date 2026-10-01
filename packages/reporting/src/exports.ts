import type { Assessment } from '@sitelens/shared-types';
const xml = (s: unknown) =>
  String(s ?? '').replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' })[c]!
  );
export function sarif(a: Assessment) {
  const findings = a.findings.filter((f) => f.status === 'potential_weakness');
  return {
    $schema: 'https://json.schemastore.org/sarif-2.1.0.json',
    version: '2.1.0',
    runs: [
      {
        tool: {
          driver: {
            name: 'SiteLens',
            version: a.version,
            informationUri: 'https://owasp.org/www-project-secure-headers/',
            rules: a.findings.map((f) => ({
              id: f.checkId,
              name: f.title,
              shortDescription: { text: f.title },
              fullDescription: { text: f.limitation },
              help: { text: f.recommendation },
              properties: { ruleVersion: f.ruleVersion },
            })),
          },
        },
        results: findings.map((f) => ({
          ruleId: f.checkId,
          level: ['high', 'critical'].includes(f.severity)
            ? 'error'
            : f.severity === 'medium'
              ? 'warning'
              : 'note',
          message: { text: `${f.observation} Limitation: ${f.limitation}` },
          locations: [{ physicalLocation: { artifactLocation: { uri: f.affectedUrl } } }],
          ...(f.suppression?.active
            ? {
                suppressions: [
                  {
                    kind: 'external',
                    status: 'accepted',
                    justification: f.suppression.exception?.rationale,
                  },
                ],
              }
            : {}),
          properties: {
            status: f.status,
            confidence: f.confidence,
            ruleVersion: f.ruleVersion,
            evidenceIds: f.evidenceIds,
            runtimeApplicability: 'unknown',
          },
        })),
        properties: {
          assessmentId: a.id,
          ruleSetVersion: a.ruleSetVersion,
          scope: a.scope,
          coverage: a.coverage,
        },
      },
    ],
  };
}
export function junit(a: Assessment) {
  const failed = a.findings.filter(
      (f) => f.status === 'potential_weakness' && !f.suppression?.active
    ).length,
    skipped = a.findings.filter(
      (f) => f.status === 'unable_to_assess' || f.status === 'not_applicable'
    ).length;
  return `<?xml version="1.0" encoding="UTF-8"?><testsuite name="SiteLens passive observations" tests="${a.findings.length}" failures="${failed}" skipped="${skipped}" time="${a.durationMs / 1000}">${a.findings.map((f) => `<testcase classname="${xml(f.category)}" name="${xml(f.checkId + ' ' + f.title)}">${f.status === 'potential_weakness' && !f.suppression?.active ? `<failure message="${xml(f.observation)}">${xml(f.limitation)}</failure>` : ['unable_to_assess', 'not_applicable'].includes(f.status) ? `<skipped message="${xml(f.observation)}"/>` : ''}<system-out>${xml(JSON.stringify({ status: f.status, confidence: f.confidence, evidence: f.evidenceIds, ruleVersion: f.ruleVersion }))}</system-out></testcase>`).join('')}</testsuite>`;
}
