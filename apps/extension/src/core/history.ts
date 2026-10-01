import type { Assessment, Finding, LifecycleEvent } from '@sitelens/shared-types';
import { sameRule } from '@sitelens/rule-definitions/src/governance.js';
export function fingerprint(f: Finding, a: Assessment): string {
  return JSON.stringify(
    a.evidence
      .filter((e) => f.evidenceIds.includes(e.id))
      .map((e) => ({ type: e.type, label: e.label, data: e.data }))
  );
}
export function compareAssessments(before: Assessment, after: Assessment) {
  if (before.targetKey !== after.targetKey)
    throw new Error('Choose assessments of the same exact target.');
  const previous = new Map(before.findings.map((f) => [f.checkId, f]));
  return after.findings.flatMap((f) => {
    const old = previous.get(f.checkId);
    if (!old)
      return [
        {
          checkId: f.checkId,
          title: f.title,
          type: 'added',
          before: 'not assessed',
          after: f.status,
        },
      ];
    if (!sameRule(old, f))
      return [
        { checkId: f.checkId, title: f.title, type: 'rule', before: old.status, after: f.status },
      ];
    if (old.status !== f.status)
      return [
        { checkId: f.checkId, title: f.title, type: 'status', before: old.status, after: f.status },
      ];
    if (fingerprint(old, before) !== fingerprint(f, after))
      return [
        {
          checkId: f.checkId,
          title: f.title,
          type: 'evidence',
          before: old.status,
          after: f.status,
        },
      ];
    return [];
  });
}
export function inheritHistory(
  assessment: Assessment,
  history: Assessment[],
  events: LifecycleEvent[]
): Assessment {
  return {
    ...assessment,
    findings: assessment.findings.map((f) => {
      const older = history
        .filter((a) => a.targetKey === assessment.targetKey)
        .flatMap((a) => a.findings.filter((p) => p.checkId === f.checkId));
      const event = events
        .filter((e) => e.targetKey === assessment.targetKey && e.checkId === f.checkId)
        .at(-1);
      return {
        ...f,
        firstObserved: older.map((p) => p.firstObserved || p.createdAt).sort()[0] || f.createdAt,
        lifecycle:
          (event?.expiresAt && Date.parse(event.expiresAt) <= Date.now()) ||
          (older[0] && !sameRule(older[0], f))
            ? 'needs verification'
            : event?.state || older[0]?.lifecycle || 'new',
        owner: event?.owner,
        reviewState:
          event?.expiresAt && Date.parse(event.expiresAt) <= Date.now()
            ? 'Expired decision; review required'
            : undefined,
      };
    }),
  };
}
export function verificationResult(
  before: Assessment,
  after: Assessment
): { verified: boolean; reason: string } {
  if (after.kind !== 'verification' || !after.selectedCheckId)
    return { verified: false, reason: 'This is not a selective verification.' };
  if (before.targetKey !== after.targetKey)
    return { verified: false, reason: 'The target changed; verification was refused.' };
  const old = before.findings.find((f) => f.checkId === after.selectedCheckId),
    fresh = after.findings[0];
  if (!old || !fresh)
    return { verified: false, reason: 'The baseline does not contain this check.' };
  if (!sameRule(old, fresh) || after.reproducibility?.reevaluatedFrom)
    return {
      verified: false,
      reason:
        'Rule changes or stored-evidence re-evaluation cannot verify a website fix. Collect a new baseline.',
    };
  if (old.status !== 'potential_weakness' || fresh.status !== 'protection_observed')
    return {
      verified: false,
      reason:
        'The selected observation has not changed from a potential weakness to an observed protection.',
    };
  const newEvidence = after.evidence.filter((e) => fresh.evidenceIds.includes(e.id));
  const oldHeaders = before.evidence.filter(
    (e) => old.evidenceIds.includes(e.id) && e.type === 'header'
  );
  if (
    oldHeaders.length &&
    newEvidence
      .filter((e) => e.type === 'header')
      .some(
        (e) =>
          Date.parse(e.collectedAt) <= Math.max(...oldHeaders.map((p) => Date.parse(p.collectedAt)))
      )
  )
    return { verified: false, reason: 'Reload the target to obtain newer response evidence.' };
  return {
    verified: true,
    reason:
      'Improvement verified for the selected passive check. This does not establish that the entire application is secure.',
  };
}
