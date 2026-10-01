import type { Assessment, LifecycleEvent, Settings, ReportOptions } from '@sitelens/shared-types';
import { redactHeader, redactUrl } from '@sitelens/rule-definitions/src/privacy.js';
import { validateScope } from '@sitelens/rule-definitions/src/scope.js';
const statuses = new Set([
  'protection_observed',
  'potential_weakness',
  'informational',
  'not_applicable',
  'unable_to_assess',
]);
export function validateBackup(input: unknown) {
  if (!input || typeof input !== 'object')
    throw new Error('Choose an assessment or backup object.');
  const box = input as {
    backupVersion?: number;
    assessments?: unknown[];
    events?: LifecycleEvent[];
    settings?: Settings;
  };
  if (box.backupVersion !== undefined && box.backupVersion !== 1)
    throw new Error('Unsupported backup version.');
  const source = Array.isArray(box.assessments) ? box.assessments : [input];
  if (!source.length || source.length > 200) throw new Error('Import 1–200 assessments.');
  const scrub = (value: unknown, depth = 0, key = ''): any => {
    if (depth > 20) throw new Error('Evidence nesting exceeds limit.');
    if (['code', 'inlineScripts', 'sourcesContent', 'rawValue', 'windowKeys'].includes(key))
      throw new Error('Raw source/credential fields are not accepted in backups.');
    if (key === 'value') {
      if (value !== '[REDACTED]') throw new Error('Raw values are not accepted in backups.');
      return value;
    }
    if (key === 'valueRedacted') return '[REDACTED]';
    if (typeof value === 'string') {
      if (value.length > 32000) throw new Error('Evidence text exceeds limit.');
      return /^https?:\/\//.test(value) ? redactUrl(value) : redactHeader(value);
    }
    if (Array.isArray(value)) {
      if (value.length > 5000) throw new Error('Evidence array exceeds limit.');
      return value.map((v) => scrub(v, depth + 1));
    }
    if (value && typeof value === 'object') {
      const out: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(value)) {
        if (['__proto__', 'constructor', 'prototype'].includes(k))
          throw new Error('Unsafe field name.');
        out[k] = scrub(v, depth + 1, k);
      }
      return out;
    }
    return value;
  };
  const assessments = source.map((value) => {
    const a = value as Assessment;
    if (
      !a ||
      ![1, 2].includes(a.schemaVersion) ||
      typeof a.id !== 'string' ||
      !a.id ||
      !/^https?:\/\//.test(a.url) ||
      !a.targetKey ||
      !Number.isFinite(Date.parse(a.createdAt))
    )
      throw new Error('Unsupported assessment metadata.');
    for (const k of [
      'findings',
      'evidence',
      'resources',
      'forms',
      'frames',
      'cookies',
      'technologies',
      'coverage',
      'limits',
    ] as const)
      if (!Array.isArray(a[k]) || a[k].length > 5000)
        throw new Error('Missing or oversized assessment array: ' + k);
    const strings = (value: unknown, keys: string[]) =>
      !!value &&
      typeof value === 'object' &&
      keys.every((k) => typeof (value as Record<string, unknown>)[k] === 'string');
    if (
      a.technologies.some(
        (t) =>
          t.signals !== undefined &&
          (!Array.isArray(t.signals) ||
            t.signals.some(
              (s) =>
                !strings(s, ['type', 'source', 'observation', 'confidence']) ||
                ![
                  'dom',
                  'meta',
                  'resource',
                  'header',
                  'cookie',
                  'inference',
                  'runtime',
                  'stylesheet',
                  'bundle',
                ].includes(s.type) ||
                !['low', 'medium', 'high'].includes(s.confidence)
            ))
      )
    )
      throw new Error('Invalid technology signals.');
    try {
      if (
        new URL(a.url).origin !== a.origin ||
        !['http:', 'https:'].includes(new URL(a.url).protocol)
      )
        throw new Error();
    } catch {
      throw new Error('Invalid assessment URL/origin.');
    }
    if (a.scope) validateScope(a.scope);
    for (const k of [
      'requests',
      'apiEndpoints',
      'advisoryMatches',
      'enabledChecks',
      'disabledChecks',
      'permissionsGranted',
      'timeouts',
    ] as const)
      if (a[k] !== undefined && !Array.isArray(a[k]))
        throw new Error('Invalid optional array: ' + k);
    if (
      (a.apiEndpoints || []).some(
        (r) => !strings(r, ['url', 'category', 'initiator', 'relationship', 'authentication'])
      ) ||
      (a.requests || []).some(
        (r) => !strings(r, ['url', 'method', 'type', 'initiator', 'authentication'])
      )
    )
      throw new Error('Invalid request metadata.');
    if (
      (a.advisoryMatches || []).some(
        (r) =>
          !strings(r, [
            'id',
            'component',
            'affectedRange',
            'fixedVersion',
            'source',
            'detectedVersion',
          ])
      )
    )
      throw new Error('Invalid advisory details.');
    for (const e of a.evidence) {
      const d = e?.data as any;
      if (
        e?.type === 'header' &&
        e.label !== 'CORS relationships' &&
        (!strings(d, ['name', 'availability']) ||
          !(
            d.values === null ||
            (Array.isArray(d.values) && d.values.every((v: unknown) => typeof v === 'string'))
          ))
      )
        throw new Error('Invalid header evidence.');
      if (
        e?.label === 'Redacted configuration patterns' &&
        (!Array.isArray(d) ||
          d.some(
            (s) =>
              !strings(s, ['key', 'source', 'category', 'confidence', 'valueRedacted']) ||
              typeof s.isSecret !== 'boolean'
          ))
      )
        throw new Error('Invalid configuration evidence.');
      if (
        e?.label === 'Client-side AST observations' &&
        d !== null &&
        d !== undefined &&
        (!strings(d, ['limitation']) ||
          !['apis', 'sources', 'flows', 'handlers'].every((k) => Array.isArray(d[k])) ||
          !Number.isFinite(d.parsed) ||
          !Number.isFinite(d.failed))
      )
        throw new Error('Invalid script analysis evidence.');
    }
    if (
      !strings(a, ['version', 'origin', 'browser']) ||
      !['full', 'verification'].includes(a.kind) ||
      !Number.isFinite(a.durationMs) ||
      !Number.isFinite(a.checksCompleted) ||
      !Number.isFinite(a.checksTotal) ||
      !a.limits.every((s) => typeof s === 'string')
    )
      throw new Error('Invalid assessment details.');
    if (
      a.resources.some(
        (r) =>
          !strings(r, ['url', 'type']) ||
          !(r.integrity === null || typeof r.integrity === 'string') ||
          !(r.crossorigin === null || typeof r.crossorigin === 'string')
      ) ||
      a.forms.some((f) => !strings(f, ['action', 'method']) || typeof f.password !== 'boolean') ||
      a.frames.some(
        (f) => !strings(f, ['url']) || !(f.sandbox === null || typeof f.sandbox === 'string')
      ) ||
      a.technologies.some(
        (t) =>
          !strings(t, ['name', 'layer', 'observation', 'version']) ||
          !['low', 'medium', 'high'].includes(t.confidence)
      ) ||
      a.coverage.some((c) => !strings(c, ['area', 'status', 'detail']))
    )
      throw new Error('Invalid resource, technology or coverage details.');
    if (
      a.cookies.some(
        (c) =>
          !strings(c, ['name', 'domain', 'path', 'sameSite']) ||
          c.value !== '[REDACTED]' ||
          ['secure', 'httpOnly', 'hostOnly', 'session', 'partitioned'].some(
            (k) => typeof (c as unknown as Record<string, unknown>)[k] !== 'boolean'
          )
      )
    )
      throw new Error('Invalid or unredacted cookie metadata.');
    if (
      a.evidence.some(
        (e) =>
          !strings(e, ['id', 'type', 'label', 'source', 'collectedAt']) ||
          typeof e.redacted !== 'boolean'
      )
    )
      throw new Error('Invalid evidence details.');
    if (
      a.findings.some(
        (f) =>
          !strings(f, [
            'id',
            'checkId',
            'title',
            'category',
            'affectedUrl',
            'observation',
            'impact',
            'limitation',
            'recommendation',
            'validation',
            'createdAt',
            'firstObserved',
          ]) ||
          !['low', 'medium', 'high'].includes(f.confidence) ||
          !['informational', 'low', 'medium', 'high', 'critical'].includes(f.severity) ||
          ![
            'new',
            'acknowledged',
            'investigating',
            'accepted risk',
            'fixed',
            'needs verification',
            'verified',
            'false positive',
          ].includes(f.lifecycle) ||
          !Array.isArray(f.references) ||
          !f.references.every((r) => typeof r === 'string')
      )
    )
      throw new Error('Invalid finding details.');
    const ids = new Set(a.evidence.map((e) => e.id));
    if (
      ids.size !== a.evidence.length ||
      a.evidence.some((e) => !e.id || !Number.isFinite(Date.parse(e.collectedAt)))
    )
      throw new Error('Invalid evidence identities/timestamps.');
    if (
      a.findings.some(
        (f) =>
          !/^SL-[A-Z]+-\d+$/.test(f.checkId) ||
          !statuses.has(f.status) ||
          !Array.isArray(f.evidenceIds) ||
          f.evidenceIds.some((id) => !ids.has(id))
      )
    )
      throw new Error('Invalid finding or evidence references.');
    const clean = scrub(a) as Assessment;
    clean.schemaVersion = 2;
    clean.importedAt = new Date().toISOString();
    clean.originalId = a.originalId || a.id;
    clean.limits = [
      ...clean.limits,
      ...((a.schemaVersion as number) === 1
        ? [
            'Compatible schema 1 record migrated; absent provenance/version metadata remains unknown.',
          ]
        : []),
    ];
    return clean;
  });
  if (box.events !== undefined && !Array.isArray(box.events))
    throw new Error('Invalid lifecycle events.');
  const events = (box.events || []).filter(
    (e) =>
      e &&
      typeof e.note === 'string' &&
      Number.isFinite(Date.parse(e.at)) &&
      assessments.some(
        (a) =>
          a.id === e.assessmentId &&
          a.targetKey === e.targetKey &&
          a.findings.some((f) => f.checkId === e.checkId)
      )
  );
  if (events.length > 2000) throw new Error('Too many lifecycle events.');
  return { assessments, events: scrub(events) as LifecycleEvent[] };
}

export function validateReportOptions(input: unknown): ReportOptions {
  if (!input || typeof input !== 'object' || Array.isArray(input))
    throw new Error('Invalid report options.');
  const a = input as ReportOptions,
    out: ReportOptions = {};
  for (const key of ['assessor', 'organization', 'project'] as const) {
    if (a[key] !== undefined) {
      if (typeof a[key] !== 'string' || a[key]!.length > 128)
        throw new Error('Report labels must be 128 characters or fewer.');
      out[key] = a[key];
    }
  }
  if (a.audience !== undefined) {
    if (!['complete', 'executive', 'developer'].includes(a.audience))
      throw new Error('Invalid report audience.');
    out.audience = a.audience;
  }
  if (a.logo !== undefined) {
    if (!['sitelens', 'none'].includes(a.logo)) throw new Error('Invalid report logo.');
    out.logo = a.logo;
  }
  if (a.selectedCheckIds !== undefined) {
    if (
      !Array.isArray(a.selectedCheckIds) ||
      a.selectedCheckIds.length > 200 ||
      a.selectedCheckIds.some((id) => typeof id !== 'string' || !/^SL-[A-Z]+-\d+$/.test(id))
    )
      throw new Error('Invalid selected checks.');
    out.selectedCheckIds = [...new Set(a.selectedCheckIds)];
  }
  if (a.customLogo) {
    if (
      typeof a.customLogo !== 'string' ||
      a.customLogo.length > 280000 ||
      !/^data:image\/(?:png|jpeg);base64,[A-Za-z0-9+/]+=*$/.test(a.customLogo) ||
      !(
        a.customLogo.startsWith('data:image/png;base64,iVBORw0KGgo') ||
        a.customLogo.startsWith('data:image/jpeg;base64,/9j/')
      )
    )
      throw new Error('Use a PNG or JPEG logo up to 200 KB.');
    out.customLogo = a.customLogo;
  }
  return out;
}
