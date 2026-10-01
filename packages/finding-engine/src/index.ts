import type { AssessmentInput, Finding, Check } from '@sitelens/shared-types';
import { ruleVersion, suppressionFor } from '@sitelens/rule-definitions/src/governance.js';

export class FindingEngine {
  public static generateFindings(
    checks: Check[],
    input: AssessmentInput,
    evidenceKeys: Map<string, string>,
    now: string
  ): Finding[] {
    return checks.map((check) => {
      const result =
        input.enabledChecks && !input.enabledChecks.includes(check.id)
          ? {
              status: 'unable_to_assess' as const,
              observation: 'Check skipped by the assessment profile.',
              evidenceKeys: ['document'],
            }
          : check.run(input);
      const finding: Finding = {
        id: crypto.randomUUID(),
        checkId: check.id,
        ruleVersion: ruleVersion(check),
        title: check.name,
        category: check.category,
        status: result.status,
        severity:
          result.status === 'potential_weakness'
            ? result.severity || check.severity
            : 'informational',
        confidence: check.id === 'SL-COOKIE-002' ? 'medium' : result.confidence || 'high',
        affectedUrl: input.page.url,
        observation: result.observation,
        impact: check.impact,
        limitation: check.limitation,
        recommendation: check.recommendation,
        validation:
          'Reload the target after configuration changes. Re-run this check against newly collected evidence.',
        evidenceIds: (result.evidenceKeys.length ? result.evidenceKeys : ['document'])
          .map((k) => evidenceKeys.get(k)!)
          .filter(Boolean),
        references: check.references,
        lifecycle: 'new',
        firstObserved: now,
        createdAt: now,
      };
      finding.suppression = suppressionFor(
        finding,
        new URL(input.page.url).origin,
        input.suppressions || [],
        Date.parse(now)
      );
      return finding;
    });
  }
}
