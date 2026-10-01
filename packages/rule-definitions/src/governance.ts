import type { Assessment, Check, Finding, Suppression } from '@sitelens/shared-types';
export const RULESET_VERSION = '2026.10.1';
export function ruleVersion(check: Check): string {
  return check.version || '1.1.0';
}
export function validateSuppression(value: unknown): Suppression {
  const s = value as Suppression;
  if (
    !s ||
    typeof s.checkId !== 'string' ||
    !/^SL-[A-Z]+-\d+$/.test(s.checkId) ||
    typeof s.ruleVersion !== 'string' ||
    !s.rationale?.trim() ||
    s.rationale.length > 2000 ||
    typeof s.actor !== 'string' ||
    !s.actor.trim() ||
    !Number.isFinite(Date.parse(s.expiresAt)) ||
    Date.parse(s.expiresAt) <= Date.now() ||
    new URL(s.origin).origin !== s.origin
  )
    throw new Error(
      'An exception needs a rule, version, origin, rationale, analyst and future expiry.'
    );
  return {
    ...s,
    id: s.id || crypto.randomUUID(),
    createdAt: s.createdAt || new Date().toISOString(),
  };
}
export function suppressionFor(
  finding: Finding,
  origin: string,
  exceptions: Suppression[],
  now = Date.now()
) {
  const exception = exceptions.find((e) => e.origin === origin && e.checkId === finding.checkId);
  if (!exception) return undefined;
  const expired = Date.parse(exception.expiresAt) <= now;
  const changed = exception.ruleVersion !== finding.ruleVersion;
  return {
    active: !expired && !changed && finding.status === 'potential_weakness',
    reason: expired
      ? 'Exception expired; review required.'
      : changed
        ? 'Rule version changed; exception needs re-evaluation.'
        : 'Approved exception; original observation and evidence retained.',
    exception,
  };
}
export function sameRule(before: Finding, after: Finding) {
  return (before.ruleVersion || 'legacy') === (after.ruleVersion || 'legacy');
}
export interface Policy {
  version: 1;
  rules: Record<string, { required?: boolean; maxSeverity?: string }>;
  regression?: { failOnNew?: string[] };
  thirdPartyDomains?: { allow?: string[] };
  exceptions?: Suppression[];
  scope?: unknown;
}
const rank: Record<string, number> = { informational: 0, low: 1, medium: 2, high: 3, critical: 4 };
export function validatePolicy(p: unknown, checks: Check[]): Policy {
  const policy = p as Policy;
  if (
    !policy ||
    policy.version !== 1 ||
    !policy.rules ||
    typeof policy.rules !== 'object' ||
    Array.isArray(policy.rules)
  )
    throw new Error('Policy version 1 and a rules object are required.');
  for (const [id, r] of Object.entries(policy.rules)) {
    if (
      !checks.some((c) => c.id === id) ||
      !r ||
      typeof r !== 'object' ||
      (r.maxSeverity && !Object.hasOwn(rank, r.maxSeverity))
    )
      throw new Error(`Invalid policy rule ${id}.`);
  }
  if (policy.regression?.failOnNew?.some((s) => !Object.hasOwn(rank, s)))
    throw new Error('Invalid regression severities.');
  if (policy.thirdPartyDomains?.allow?.some((v) => typeof v !== 'string' || v.includes('/')))
    throw new Error('Allowed third parties must be hostnames.');
  policy.exceptions = policy.exceptions?.map(validateSuppression);
  return policy;
}
export function evaluatePolicy(a: Assessment, p: Policy, baseline?: Assessment) {
  const violations: { checkId: string; reason: string }[] = [];
  for (const [id, rule] of Object.entries(p.rules)) {
    const f = a.findings.find((f) => f.checkId === id);
    if (f?.suppression?.active) continue;
    if (rule.required && f?.status !== 'protection_observed')
      violations.push({ checkId: id, reason: 'Required protection was not established.' });
    if (
      f?.status === 'potential_weakness' &&
      rule.maxSeverity &&
      rank[f.severity] > rank[rule.maxSeverity]
    )
      violations.push({ checkId: id, reason: `Observed severity exceeds ${rule.maxSeverity}.` });
  }
  if (baseline && baseline.targetKey !== a.targetKey)
    throw new Error('Baseline target does not match the assessment.');
  if (p.regression?.failOnNew?.length) {
    if (!baseline)
      violations.push({ checkId: 'BASELINE', reason: 'Regression policy requires a baseline.' });
    else
      for (const f of a.findings) {
        const previous = baseline.findings.find((b) => b.checkId === f.checkId);
        if (
          f.status === 'potential_weakness' &&
          !f.suppression?.active &&
          p.regression.failOnNew.includes(f.severity) &&
          (!previous ||
            previous.status !== 'potential_weakness' ||
            rank[previous.severity] < rank[f.severity])
        )
          violations.push({
            checkId: f.checkId,
            reason: sameRule(previous || f, f)
              ? 'New or escalated weakness violates regression policy.'
              : 'Rule version changed; baseline review required.',
          });
      }
  }
  if (p.thirdPartyDomains?.allow) {
    for (const r of a.resources.filter((r) => r.thirdParty)) {
      let host = '';
      try {
        host = new URL(r.url).hostname;
      } catch {}
      if (
        host &&
        !p.thirdPartyDomains.allow.includes(host) &&
        !violations.some((v) => v.reason === `Unapproved third party: ${host}`)
      )
        violations.push({ checkId: 'THIRD-PARTY', reason: `Unapproved third party: ${host}` });
    }
  }
  return { passed: violations.length === 0, violations };
}
