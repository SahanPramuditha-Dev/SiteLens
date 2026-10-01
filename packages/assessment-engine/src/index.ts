import type {
  Assessment,
  AssessmentInput,
  Evidence,
  Finding,
  PageSnapshot,
} from '@sitelens/shared-types';
import { CHECKS, CHECK_BY_ID } from '@sitelens/rule-definitions';
import { detectTechnologies } from '@sitelens/technology-detector';
import {
  httpUrl,
  originOf,
  redactHeader,
  redactUrl,
  text,
} from '@sitelens/rule-definitions/src/privacy.js';
import { EvidenceEngine } from '@sitelens/evidence-engine';
import { FindingEngine } from '@sitelens/finding-engine';
import { defaultScope } from '@sitelens/rule-definitions/src/scope.js';
import { RULESET_VERSION, ruleVersion } from '@sitelens/rule-definitions/src/governance.js';
import type { ApiEndpoint, RequestObservation } from '@sitelens/shared-types';
export const VERSION = '1.0.0';
export function normalizePage(page: PageSnapshot): PageSnapshot {
  const origin = originOf(page.url);
  const { inlineScripts, windowKeys, activeProbes, ...safe } = page;
  const secretMetadata = (values: PageSnapshot['secrets']) =>
    values?.map((v) => ({
      key: text(v.key, 100),
      location: v.location
        ? {
            scriptId: text(v.location.scriptId, 128),
            url: redactUrl(v.location.url),
            line: v.location.line,
            column: v.location.column,
            propertyPath: text(v.location.propertyPath, 512),
            method: text(v.location.method, 128),
          }
        : undefined,
      source: text(v.source, 256),
      category: text(v.category, 80),
      confidence: v.confidence,
      isSecret: !!v.isSecret,
      isLikelyPublic: !!v.isLikelyPublic,
      provider: text(v.provider, 64),
      valueRedacted: '[REDACTED]',
      valueFingerprint: /^[a-f0-9]{64}$/.test(v.valueFingerprint || '')
        ? v.valueFingerprint
        : undefined,
      length: v.length,
      entropyScore: v.entropyScore,
      signals: v.signals?.map((t) => text(t, 100)),
    }));
  return {
    ...safe,
    secrets: secretMetadata(page.secrets),
    sourceMaps: page.sourceMaps?.map((m) => ({
      ...m,
      url: redactUrl(m.url),
      secrets: secretMetadata(m.secrets) || [],
    })),
    storage: {
      local: page.storage.local,
      session: page.storage.session,
      keys: page.storage.keys?.length
        ? Array(Math.min(page.storage.keys.length, 200)).fill('sensitive-name pattern')
        : undefined,
    },
    manifestUrl: page.manifestUrl ? redactUrl(page.manifestUrl) : null,
    sinks: page.sinks?.map((s) => ({
      type: text(s.type, 64),
      node: text(s.node, 64),
      attribute: text(s.attribute, 64),
      snippet: '[CODE OMITTED]',
    })),
    sourceMapUrls: page.sourceMapUrls?.map(redactUrl),
    serviceWorkers: page.serviceWorkers?.map((s) => ({
      scope: redactUrl(s.scope),
      scriptUrl: redactUrl(s.scriptUrl),
      state: text(s.state, 32),
    })),
    url: redactUrl(page.url),
    resources: page.resources.map((r) => ({
      url: redactUrl(r.url),
      type: text(r.type, 32),
      integrity: r.integrity ? text(r.integrity, 2048) : null,
      crossorigin: r.crossorigin ? text(r.crossorigin, 32) : null,
      loadedBy: text(r.loadedBy, 128),
      observedBy: text(r.observedBy, 32),
      thirdParty: httpUrl(r.url) && originOf(r.url) !== origin,
    })),
    forms: page.forms.map((f) => ({
      action: redactUrl(f.action),
      method: text(f.method, 16),
      password: !!f.password,
    })),
    frames: page.frames.map((f) => ({
      url: redactUrl(f.url),
      sandbox: f.sandbox === null ? null : text(f.sandbox, 1024),
    })),
    metaCsp: page.metaCsp.map(redactHeader),
    metaReferrer: page.metaReferrer ? text(page.metaReferrer, 128) : null,
    indicators: page.indicators.map((t) => ({
      name: text(t.name, 64),
      layer: text(t.layer, 64),
      confidence: t.confidence,
      observation: text(t.observation, 512),
      versionConfidence: t.versionConfidence || 'low',
      versionSource: t.versionSource,
      detection: t.detection,
      fingerprintVersion: t.fingerprintVersion,
      variant: t.variant ? text(t.variant, 32) : undefined,
      signals: t.signals?.slice(0, 30).map((s) => ({
        ...s,
        source: httpUrl(s.source) ? redactUrl(s.source) : text(s.source, 256),
        observation: text(s.observation, 512),
      })),
      version:
        t.version === 'Conflicting indicators'
          ? t.version
          : /^\d+(\.\d+){0,3}(?:[-\w.]*)?$/.test(t.version)
            ? text(t.version, 32)
            : 'Unknown',
    })),
  };
}
export function assess(
  raw: AssessmentInput,
  selectedCheckId?: string,
  now = new Date().toISOString()
): Assessment {
  if (selectedCheckId && !CHECK_BY_ID.has(selectedCheckId)) throw new Error('Unknown check ID.');
  const page = normalizePage({
    ...raw.page,
    indicators: detectTechnologies(
      '',
      raw.page.resources,
      raw.response?.headers || {},
      raw.cookies.cookies,
      [],
      raw.page.technologyMeta,
      raw.page.indicators
    ),
  });
  const response = raw.response
    ? {
        ...raw.response,
        url: redactUrl(raw.response.url),
        headers: Object.fromEntries(
          Object.entries(raw.response.headers).map(([k, v]) => [k, v.map(redactHeader)])
        ),
        redirects: raw.response.redirects.map((r) => ({
          ...r,
          url: redactUrl(r.url),
          destination: redactUrl(r.destination),
        })),
      }
    : null;
  const technologies = [...page.indicators];
  const requests = (raw.requests || []).map((r) => ({
    ...r,
    url: redactUrl(r.url),
    initiator: redactUrl(r.initiator),
    headers: Object.fromEntries(
      Object.entries(r.headers).map(([k, v]) => [k, v.map(redactHeader)])
    ),
  }));
  const input = {
    ...raw,
    cookies: {
      ...raw.cookies,
      cookies: raw.cookies.cookies.map((c) => ({ ...c, value: '[REDACTED]' as const })),
    },
    page: { ...page, indicators: technologies },
    response,
    requests,
  };

  const evidenceEngine = new EvidenceEngine(input, page, response, technologies);
  evidenceEngine.generateCoreEvidence();
  const evidence = evidenceEngine.getEvidence();
  const keys = evidenceEngine.getKeys();

  const selected = selectedCheckId ? [CHECK_BY_ID.get(selectedCheckId)!] : CHECKS;
  const findings = FindingEngine.generateFindings(selected, input, keys, now);
  const apiEndpoints: ApiEndpoint[] = requests
    .filter(
      (r) =>
        ['xmlhttprequest', 'fetch', 'websocket'].includes(r.type) ||
        /\/(api|graphql|gql|auth|socket)(?:\/|[?]|$)/i.test(r.url)
    )
    .map((r) => ({
      ...r,
      category:
        r.type === 'websocket'
          ? 'WebSocket'
          : /\/graphql(?:\/|[?]|$)/i.test(r.url)
            ? 'GraphQL'
            : /\/(auth|login|token|refresh)(?:\/|[?]|$)/i.test(r.url)
              ? 'Authentication'
              : /\/api(?:\/|[?]|$)/i.test(r.url)
                ? 'REST'
                : 'Fetch / XHR',
      relationship: originOf(r.url) === originOf(page.url) ? 'same-origin' : 'third-party',
    }));
  const needed = new Set(findings.flatMap((f) => f.evidenceIds));
  return {
    id: crypto.randomUUID(),
    schemaVersion: 2,
    version: VERSION,
    ruleSetVersion: RULESET_VERSION,
    engineVersion: '1.1.0',
    requestedUrl: redactUrl(raw.requestedUrl || raw.page.url),
    effectiveUrl: page.url,
    permissionsGranted: raw.permissions || [],
    profile: raw.profile || 'extension-passive',
    enabledChecks: selected
      .filter((c) => !raw.enabledChecks || raw.enabledChecks.includes(c.id))
      .map((c) => c.id),
    disabledChecks: selected
      .filter((c) => raw.enabledChecks && !raw.enabledChecks.includes(c.id))
      .map((c) => c.id),
    scope: raw.scope || defaultScope(raw.page.url),
    timeouts: [],
    projectId: raw.projectId,
    environment: raw.environment,
    ruleVersions: Object.fromEntries(selected.map((c) => [c.id, ruleVersion(c)])),
    apiEndpoints: selectedCheckId ? [] : apiEndpoints,
    requests: selectedCheckId ? [] : requests,
    url: page.url,
    origin: originOf(page.url),
    targetKey: raw.targetKey,
    createdAt: now,
    durationMs: 0,
    browser: raw.browser,
    kind: selectedCheckId ? 'verification' : 'full',
    ...(selectedCheckId ? { selectedCheckId } : {}),
    findings,
    evidence: selectedCheckId ? evidence.filter((e) => needed.has(e.id)) : evidence,
    resources: selectedCheckId ? [] : page.resources,
    forms: selectedCheckId ? [] : page.forms,
    frames: selectedCheckId ? [] : page.frames,
    cookies: selectedCheckId
      ? []
      : raw.cookies.cookies.map((c) => ({ ...c, value: '[REDACTED]' as const })),
    technologies: selectedCheckId ? [] : technologies,
    checksCompleted: findings.filter((f) => f.status !== 'unable_to_assess').length,
    checksTotal: selected.length,
    limits: page.limits,
    coverage: [
      {
        area: 'Document transport',
        status: 'assessed',
        detail: 'URL scheme only; no TLS protocol or certificate audit.',
      },
      {
        area: 'Security headers',
        status: response ? 'assessed' : 'blocked by permissions',
        detail: response
          ? 'Matching document response captured. Policy effectiveness remains contextual.'
          : 'Response unavailable: permission, prior navigation or collection timing may be responsible; DOM meta evidence remains available.',
      },
      {
        area: 'Cookie attributes',
        status: raw.cookies.available ? 'partial' : 'blocked by permissions',
        detail: raw.cookies.limitation,
      },
      {
        area: 'Page resources',
        status: 'partial',
        detail: 'DOM references and available resource timing entries; not a complete network log.',
      },
      {
        area: 'HTML forms / frames',
        status: page.limits.length ? 'partial' : 'assessed',
        detail: 'Declared top-level DOM attributes only; no submissions.',
      },
      {
        area: 'Client technologies',
        status: 'partial',
        detail:
          'Local fingerprints from DOM markers, generator metadata, resource URLs, permitted response headers and cookie names. Inferences and version confidence are separate; runtime globals, hidden backends and a complete dependency inventory are not assessed.',
      },
      {
        area: 'Client-side JavaScript',
        status: page.analysis ? 'partial' : 'skipped',
        detail: page.analysis?.limitation || 'No AST analysis collected.',
      },
      {
        area: 'API surface / CORS',
        status: requests.length ? 'partial' : 'not assessed',
        detail: 'Only permitted intercepted requests; bodies and credential values are not read.',
      },
      {
        area: 'Active vulnerability testing',
        status: 'unsupported',
        detail: 'No attack payloads, probing or exploit confirmation.',
      },
      { area: 'Browser storage', status: 'partial', detail: 'Metadata only; values omitted.' },
      {
        area: 'Redirect chain',
        status: response?.redirects.length ? 'partial' : 'not assessed',
        detail: 'Only selected permitted hops captured while observation is enabled.',
      },
      {
        area: 'Authentication / authorization',
        status: 'not assessed',
        detail: 'No login, session validation or access-control tests.',
      },
      {
        area: 'Backend / database security',
        status: 'impossible from browser',
        detail: 'Not established by browser-visible evidence.',
      },
      {
        area: 'Business logic',
        status: 'not assessed',
        detail: 'No workflow or transaction testing.',
      },
      {
        area: 'TLS certificate / protocol',
        status: 'impossible from browser',
        detail: 'HTTPS URL observation is not a TLS audit; use a dedicated external TLS tool.',
      },
    ].map((c) =>
      selectedCheckId
        ? {
            ...c,
            status: 'skipped' as const,
            detail: 'Selective verification; see the selected check and its evidence for scope.',
          }
        : c
    ) as Assessment['coverage'],
  };
}
