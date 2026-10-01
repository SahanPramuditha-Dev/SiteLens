import test from 'node:test';
import { detectTechnologies, TECHNOLOGIES } from '@sitelens/technology-detector';
import assert from 'node:assert/strict';
import { assess, normalizePage } from '@sitelens/assessment-engine';
import { CHECKS } from '@sitelens/rule-definitions';
import {
  cookieMetadata,
  hashUrl,
  redactHeader,
  redactUrl,
} from '@sitelens/rule-definitions/src/privacy.js';
import {
  compareAssessments,
  inheritHistory,
  verificationResult,
} from '../apps/extension/src/core/history';
import { parseCsp, positiveHsts, sriValid } from '@sitelens/rule-definitions/src/policies.js';
import { reportHtml } from '../apps/extension/src/report';
import type { AssessmentInput, PageSnapshot } from '@sitelens/shared-types';
const time = '2026-10-01T09:00:00.000Z';
const techResource = (url: string) => ({ url, type: 'script', integrity: null, crossorigin: null });
test('technology catalog has broad categories and strict vendor hostname boundaries', () => {
  assert.ok(new Set(TECHNOLOGIES.map((t) => t.name)).size >= 60);
  const detected = detectTechnologies(
    '',
    [
      techResource('https://js.stripe.com/v3/?token=SECRET'),
      techResource('https://www.googletagmanager.com/gtm.js?id=SECRET'),
    ],
    {},
    []
  );
  assert.ok(detected.some((t) => t.name === 'Stripe'));
  assert.ok(detected.some((t) => t.name === 'Google Tag Manager'));
  assert.ok(!detected.some((t) => t.name === 'Google Analytics'));
  assert.ok(!JSON.stringify(detected).includes('token=SECRET'));
  assert.equal(
    detectTechnologies('', [techResource('https://js.stripe.com.attacker.test/v3/')], {}, [])
      .length,
    0
  );
});
test('technology signals merge sources and distinguish exact declarations from asset version guesses', () => {
  const technologies = detectTechnologies(
    '',
    [techResource('https://cdn.test/jquery-3.7.1.min.js')],
    { server: ['nginx/1.26.3'] },
    [],
    [],
    [{ name: 'generator', content: 'WordPress 6.8.1' }]
  );
  assert.equal(technologies.find((t) => t.name === 'jQuery')?.version, '3.7.1');
  assert.equal(technologies.find((t) => t.name === 'jQuery')?.versionConfidence, 'medium');
  assert.equal(technologies.find((t) => t.name === 'Nginx')?.version, '1.26.3');
  assert.equal(technologies.find((t) => t.name === 'Nginx')?.confidence, 'medium');
  assert.equal(technologies.find((t) => t.name === 'WordPress')?.signals?.[0].type, 'meta');
});
test('technology profile preserves all independent signals and labels indirect framework inference', () => {
  const t = detectTechnologies('', [techResource('https://example.com/_next/static/a.js')], {}, []);
  assert.equal(t.find((t) => t.name === 'React')?.detection, 'inferred');
  assert.equal(t.find((t) => t.name === 'React')?.confidence, 'low');
  const a = assess(
    input(
      { server: ['cloudflare'], 'cf-ray': ['abcdef-TEST'] },
      {
        technologyMeta: [{ name: 'generator', content: 'WordPress 6.8.1 private-extra' }],
        resources: [techResource('https://example.com/wp-content/a.js')],
      }
    )
  );
  assert.equal(a.technologies.filter((t) => t.name === 'Cloudflare').length, 1);
  assert.equal(a.technologies.find((t) => t.name === 'Cloudflare')?.signals?.length, 2);
  assert.equal(a.technologies.find((t) => t.name === 'WordPress')?.signals?.length, 2);
  assert.ok(!JSON.stringify(a).includes('private-extra'));
});
test('conflicting technology versions remain ambiguous and cookie clues do not prove backend use', () => {
  const t = detectTechnologies(
    '',
    [
      techResource('https://example.com/jquery-3.7.1.min.js'),
      techResource('https://example.com/jquery-3.6.0.min.js'),
    ],
    {},
    [cookieMetadata({ name: 'csrftoken', domain: 'example.com', path: '/' })]
  );
  assert.equal(t.find((t) => t.name === 'jQuery')?.version, 'Conflicting indicators');
  assert.equal(t.find((t) => t.name === 'Django')?.confidence, 'low');
  assert.ok(!t.some((t) => t.layer === 'Database'));
});
const page: PageSnapshot = {
  url: 'https://example.com/?token=secret#secret',
  timeOrigin: 1000,
  resources: [],
  forms: [],
  frames: [],
  indicators: [],
  metaCsp: [],
  metaReferrer: null,
  blankLinks: 0,
  storage: { local: 0, session: 0 },
  limits: [],
  collectedAt: time,
};
function input(
  headers: Record<string, string[]> | null = {},
  patch: Partial<PageSnapshot> = {}
): AssessmentInput {
  return {
    page: { ...page, ...patch },
    response:
      headers === null
        ? null
        : {
            url: page.url,
            headers,
            statusCode: 200,
            collectedAt: time,
            requestId: 'r1',
            startedAt: 1000,
            urlHash: 'target',
            redirects: [],
          },
    cookies: { available: false, cookies: [], limitation: 'Permission not granted.' },
    browser: 'Test browser',
    targetKey: 'target',
  };
}
const result = (i: AssessmentInput, id: string) =>
  assess(i).findings.find((f) => f.checkId === id)!;
test('registry has 36 unique stable checks and full methodology', () => {
  assert.ok(CHECKS.length >= 36);
  assert.equal(new Set(CHECKS.map((c) => c.id)).size, CHECKS.length);
  for (const c of CHECKS)
    for (const key of [
      'method',
      'impact',
      'limitation',
      'recommendation',
      'learning',
      'references',
    ])
      assert.ok(c[key as keyof typeof c], `${c.id}: ${key}`);
});
test('missing response evidence does not become absent-header warnings', () => {
  const a = assess(input(null));
  assert.equal(a.findings.find((f) => f.checkId === 'SL-HEADER-002')?.status, 'unable_to_assess');
  assert.equal(a.checksTotal, CHECKS.length);
  assert.ok(a.checksCompleted < a.checksTotal);
});
test('captured absent CSP is a contextual weakness', () => {
  assert.equal(result(input({}), 'SL-CSP-001').status, 'potential_weakness');
});
test('report-only policy is not enforcing protection', () => {
  const i = input({ 'content-security-policy-report-only': ["default-src 'self'"] });
  assert.equal(result(i, 'SL-CSP-001').status, 'potential_weakness');
  assert.equal(result(i, 'SL-CSP-007').status, 'informational');
});
test('meta CSP counts as presence but cannot provide frame-ancestors', () => {
  const i = input({}, { metaCsp: ["default-src 'self'; frame-ancestors 'none'"] });
  assert.equal(result(i, 'SL-CSP-001').status, 'protection_observed');
  assert.equal(result(i, 'SL-HEADER-004').status, 'potential_weakness');
});
test('restrictive header ancestors is recognized', () => {
  assert.equal(
    result(input({ 'content-security-policy': ["frame-ancestors 'none'"] }), 'SL-HEADER-004')
      .status,
    'protection_observed'
  );
});
test('broad ancestors overrides XFO rather than claiming a protection', () => {
  assert.equal(
    result(
      input({ 'content-security-policy': ['frame-ancestors *'], 'x-frame-options': ['DENY'] }),
      'SL-HEADER-004'
    ).status,
    'potential_weakness'
  );
});
test('script-src overrides default-src correctly', () => {
  const i = input({
    'content-security-policy': ["default-src 'none'; script-src https: 'unsafe-inline'"],
  });
  assert.equal(result(i, 'SL-CSP-002').status, 'potential_weakness');
  assert.equal(result(i, 'SL-CSP-004').status, 'potential_weakness');
});
test('nonce suppresses unsafe-inline pattern in modern CSP semantics', () => {
  const i = input({
    'content-security-policy': ["script-src 'nonce-super-secret' 'unsafe-inline'"],
  });
  assert.equal(result(i, 'SL-CSP-002').status, 'protection_observed');
  assert.ok(!JSON.stringify(assess(i)).includes('super-secret'));
});
test('first duplicate directive wins', () => {
  assert.deepEqual(parseCsp("script-src 'self'; script-src *").get('script-src'), ["'self'"]);
});
test('multiple CSP policies stay separate with intersection limitation', () => {
  const i = input({ 'content-security-policy': ['script-src *', "script-src 'self'"] });
  const f = result(i, 'SL-CSP-004');
  assert.equal(f.status, 'potential_weakness');
  assert.match(f.limitation, /intersect/);
});
test('HSTS syntax accepts positive ages only', () => {
  for (const bad of ['max-age=0', 'max-age=10garbage', 'max-age=-10', 'max-age=abc'])
    assert.equal(positiveHsts(bad), false);
  assert.equal(positiveHsts('max-age=31536000; includeSubDomains'), true);
  assert.equal(
    result(
      input({ 'strict-transport-security': ['max-age=100'] }, { url: 'http://example.com/' }),
      'SL-HEADER-001'
    ).status,
    'potential_weakness'
  );
});
test('nosniff is exact, case insensitive', () => {
  assert.equal(
    result(input({ 'x-content-type-options': ['nosniff garbage'] }), 'SL-HEADER-002').status,
    'potential_weakness'
  );
  assert.equal(
    result(input({ 'x-content-type-options': ['NOSNIFF'] }), 'SL-HEADER-002').status,
    'protection_observed'
  );
});
test('Referrer-Policy selects last recognized token and supports meta', () => {
  assert.equal(
    result(input({ 'referrer-policy': ['no-referrer, unsafe-url'] }), 'SL-HEADER-003').status,
    'potential_weakness'
  );
  assert.equal(
    result(input(null, { metaReferrer: 'same-origin' }), 'SL-HEADER-003').status,
    'protection_observed'
  );
});
test('optional cross-origin policies are informational when absent', () => {
  assert.equal(result(input({}), 'SL-HEADER-008').status, 'informational');
});
test('cookie metadata whitelists fields and never retains value', () => {
  const c = cookieMetadata({
    name: 'sessionid',
    value: 'PASSWORD_SECRET',
    secure: false,
    httpOnly: false,
    domain: 'example.com',
    path: '/',
    sameSite: 'lax',
    session: true,
  });
  assert.equal(c.value, '[REDACTED]');
  assert.ok(!JSON.stringify(c).includes('PASSWORD_SECRET'));
});
test('cookie attributes require permission and use inferred-purpose confidence', () => {
  const i = input();
  assert.equal(result(i, 'SL-COOKIE-001').status, 'unable_to_assess');
  i.cookies = {
    available: true,
    cookies: [
      cookieMetadata({
        name: 'sessionid',
        value: 'secret',
        secure: false,
        httpOnly: false,
        domain: 'example.com',
        path: '/',
        sameSite: 'lax',
        session: true,
      }),
    ],
    limitation: 'Matching URL only.',
  };
  assert.equal(result(i, 'SL-COOKIE-001').status, 'potential_weakness');
  const f = result(i, 'SL-COOKIE-002');
  assert.equal(f.status, 'potential_weakness');
  assert.equal(f.confidence, 'medium');
});
test('empty applicable cookie set is not a protection claim', () => {
  const i = input();
  i.cookies = { available: true, cookies: [], limitation: 'Matching URL only.' };
  assert.equal(result(i, 'SL-COOKIE-001').status, 'not_applicable');
});
test('no password forms is not applicable', () => {
  assert.equal(result(input(), 'SL-FORM-001').status, 'not_applicable');
});
test('insecure document makes password form transport a weakness', () => {
  const i = input(
    {},
    {
      url: 'http://example.com',
      forms: [{ action: 'https://example.com/login', password: true, method: 'post' }],
    }
  );
  assert.equal(result(i, 'SL-FORM-001').status, 'potential_weakness');
});
test('GET password form is a high severity contextual observation', () => {
  const i = input(
    {},
    { forms: [{ action: 'https://example.com/login', password: true, method: 'get' }] }
  );
  const f = result(i, 'SL-FORM-002');
  assert.equal(f.status, 'potential_weakness');
  assert.equal(f.severity, 'high');
});
test('mixed references are redacted without leaking query tokens', () => {
  const i = input(
    {},
    {
      resources: [
        {
          url: 'http://cdn.example.com/a.js?secret=abc',
          type: 'script',
          integrity: null,
          crossorigin: null,
        },
      ],
    }
  );
  const a = assess(i);
  assert.equal(
    a.findings.find((f) => f.checkId === 'SL-RESOURCE-001')?.status,
    'potential_weakness'
  );
  assert.ok(!JSON.stringify(a).includes('secret=abc'));
});
test('SRI syntax check does not claim to validate content', () => {
  assert.equal(sriValid('sha256-YWJjZGVm='), true);
  assert.equal(sriValid('md5-deadbeef'), false);
  assert.match(
    CHECKS.find((c) => c.id === 'SL-RESOURCE-003')!.limitation,
    /does not compute hashes/
  );
});
test('special resource schemes are omitted safely', () => {
  const p = normalizePage({
    ...page,
    resources: [
      { url: 'data:text/plain,SECRET', type: 'img', integrity: null, crossorigin: null },
      { url: 'javascript:alert(1)', type: 'resource', integrity: null, crossorigin: null },
    ],
  });
  assert.equal(p.resources[0].url, 'data:[OMITTED]');
  assert.ok(!JSON.stringify(p).includes('SECRET'));
});
test('URL privacy removes credentials fragments queries and JWT-like path tokens', () => {
  assert.equal(
    redactUrl('https://user:password@example.com/a?password=secret#secret'),
    'https://example.com/a?REDACTED'
  );
  assert.ok(!redactUrl('https://example.com/eyJabc.abc.def').includes('eyJabc'));
});
test('header privacy removes CSP nonces and reporting URL secrets', () => {
  const value = redactHeader(
    "script-src 'nonce-secret'; report-uri https://example.com/report?key=secret"
  );
  assert.ok(!value.includes('nonce-secret'));
  assert.ok(!value.includes('key=secret'));
});
test('target hashes distinguish query parameters while ignoring fragments', async () => {
  assert.notEqual(
    await hashUrl('https://example.com/?a=1'),
    await hashUrl('https://example.com/?a=2')
  );
  assert.equal(await hashUrl('https://example.com/#a'), await hashUrl('https://example.com/#b'));
});
test('evidence references resolve and findings never declare confirmed vulnerabilities', () => {
  const a = assess(input());
  for (const f of a.findings) {
    assert.ok(f.evidenceIds.length);
    for (const id of f.evidenceIds) assert.ok(a.evidence.find((e) => e.id === id));
    assert.notEqual(f.status, 'confirmed_vulnerability');
  }
});
test('selective verification evaluates one check and stores relevant evidence only', () => {
  const a = assess(input({ 'x-content-type-options': ['nosniff'] }), 'SL-HEADER-002');
  assert.equal(a.checksTotal, 1);
  assert.equal(a.findings.length, 1);
  assert.equal(a.evidence.length, 1);
  assert.equal(a.resources.length, 0);
  assert.throws(() => assess(input(), 'invalid'));
});
test('verification refuses stale headers and accepts newer evidence', () => {
  const before = assess(input({}));
  const fresh = assess(input({ 'x-content-type-options': ['nosniff'] }), 'SL-HEADER-002');
  assert.equal(verificationResult(before, fresh).verified, false);
  fresh.evidence[0].collectedAt = '2026-10-01T09:01:00.000Z';
  assert.equal(verificationResult(before, fresh).verified, true);
  fresh.targetKey = 'other';
  assert.equal(verificationResult(before, fresh).verified, false);
});
test('comparison ignores collection timestamps but detects policy changes', () => {
  const before = assess(input({ 'content-security-policy': ["default-src 'self'"] }));
  const after = assess(
    input({ 'content-security-policy': ["default-src 'self'"] }),
    undefined,
    '2026-10-01T09:01:00.000Z'
  );
  assert.equal(compareAssessments(before, after).length, 0);
  const changed = assess(input({ 'content-security-policy': ["default-src 'none'"] }));
  assert.ok(compareAssessments(before, changed).some((c) => c.type === 'evidence'));
  changed.targetKey = 'other';
  assert.throws(() => compareAssessments(before, changed));
});
test('lifecycle and first observed date survive reinspection', () => {
  const before = assess(input());
  before.findings[0].lifecycle = 'investigating';
  const after = inheritHistory(
    assess(input(), undefined, '2026-10-02T09:00:00.000Z'),
    [before],
    []
  );
  assert.equal(after.findings[0].lifecycle, 'investigating');
  assert.equal(after.findings[0].firstObserved, before.findings[0].firstObserved);
});
test('report has 13 sections and escapes hostile website evidence', () => {
  const a = assess(input({ server: ['<img src=x onerror=alert(1)>'] }));
  const html = reportHtml(a);
  assert.equal((html.match(/<h2>\d+\./g) || []).length, 13);
  assert.ok(!html.includes('<img src=x'));
  assert.ok(html.includes('&lt;img'));
  assert.ok(html.includes('default-src &#39;none&#39;') || html.includes("default-src 'none'"));
  assert.ok(!html.includes('token=secret'));
});

import { analyzeScripts, scanForSecrets } from '@sitelens/evidence-engine';
import {
  defaultScope,
  inScope,
  validateScope,
  RequestBudget,
} from '@sitelens/rule-definitions/src/scope.js';
import {
  validateSuppression,
  suppressionFor,
  validatePolicy,
  evaluatePolicy,
} from '@sitelens/rule-definitions/src/governance.js';
import { validateAdvisories, matchAdvisories } from '@sitelens/rule-definitions/src/advisories.js';
import { sarif, junit } from '@sitelens/reporting/src/exports.js';
import { replayAssessment } from '@sitelens/assessment-engine/src/replay.js';

test('scope rejects suffix lookalikes, credentials and excluded paths', () => {
  const s = {
    ...defaultScope('https://example.com'),
    origins: [],
    domains: ['example.com'],
    includeSubdomains: true,
    excludedPaths: ['/private'],
  };
  assert.ok(inScope('https://app.example.com/open', s));
  for (const url of [
    'https://badexample.com',
    'https://example.com.attacker.net',
    'https://user:pass@example.com',
    'https://example.com/private/child',
    'https://example.com/%70rivate/child',
  ])
    assert.equal(inScope(url, s), false, url);
  assert.ok(inScope('https://example.com/private-ish', s));
});
test('scope prefix uses directory boundaries', () => {
  const s = { ...defaultScope('https://example.com'), pathPrefixes: ['/app'] };
  assert.ok(inScope('https://example.com/app/home', s));
  assert.equal(inScope('https://example.com/application', s), false);
});
test('third party observation requires both opt-in and allowed host', () => {
  const s = defaultScope('https://example.com');
  assert.equal(inScope('https://cdn.test', s, true), false);
  assert.equal(inScope('https://cdn.test', { ...s, includeThirdParty: true }, true), false);
  assert.ok(
    inScope('https://cdn.test', { ...s, includeThirdParty: true, domains: ['cdn.test'] }, true)
  );
});
test('supplemental request mode requires authorization', () => {
  assert.throws(() =>
    validateScope({ ...defaultScope('https://example.com'), mode: 'supplemental' })
  );
});
test('passive budget and exhausted supplemental budget block requests', async () => {
  await assert.rejects(
    new RequestBudget(defaultScope('https://example.com')).reserve('https://example.com/a')
  );
  const b = new RequestBudget({
    ...defaultScope('https://example.com'),
    mode: 'supplemental',
    authorized: true,
    requestBudget: 1,
  });
  await b.reserve('https://example.com/a');
  await assert.rejects(b.reserve('https://example.com/b'));
  assert.equal(b.count, 1);
});
test('AST traces direct and local alias relationships', () => {
  const a = analyzeScripts([
    { id: 'one', code: 'const value=location.hash; document.body.innerHTML=value;' },
  ]);
  assert.equal(a.flows.length, 1);
  assert.equal(a.flows[0].source, 'location.hash');
  assert.ok(!JSON.stringify(a).includes('const value'));
});
test('source and unrelated sink co-occurrence is not a flow', () => {
  const a = analyzeScripts([
    { id: 'one', code: 'console.log(location.hash); document.body.innerHTML="constant";' },
  ]);
  assert.equal(a.flows.length, 0);
  assert.equal(a.apis.length, 1);
});
test('AST ignores comments and strings containing API names', () => {
  assert.equal(
    analyzeScripts([
      { id: 'one', code: '// eval(location.hash)\nconst text="document.write(location.hash)";' },
    ]).apis.length,
    0
  );
});
test('AST alias reset removes a prior source relationship', () => {
  assert.equal(
    analyzeScripts([
      { id: 'one', code: 'let x=location.hash;x="constant";document.body.innerHTML=x;' },
    ]).flows.length,
    0
  );
});
test('AST isolates aliases between scripts', () => {
  assert.equal(
    analyzeScripts([
      { id: 'one', code: 'const x=location.hash;' },
      { id: 'two', code: 'document.body.innerHTML=x;' },
    ]).flows.length,
    0
  );
});
test('unparseable scripts retain an explicit limitation', () => {
  const a = analyzeScripts([{ id: 'one', code: 'const = ;' }]);
  assert.equal(a.failed, 1);
  assert.equal(a.flows.length, 0);
  assert.ok(a.limitation);
});
test('postMessage validation patterns are observations only', () => {
  const a = analyzeScripts([
    {
      id: 'one',
      code: 'window.addEventListener("message",event=>{if(event.origin!=="https://example.com")return; console.log(event.data);});',
    },
  ]);
  assert.equal(a.handlers[0].originCheck, true);
  assert.equal(a.handlers[0].sourceCheck, false);
});
test('secret scanner stores fingerprints and removes complete values', async () => {
  const value = 'sk_dummy_AbCd1234EfGh5678IjKl9012';
  const a = await scanForSecrets(`const STRIPE_SECRET_KEY="${value}";`, 'inline');
  assert.equal(a.length, 1);
  assert.equal(a[0].isSecret, true);
  assert.match(a[0].valueFingerprint!, /^[a-f0-9]{64}$/);
  assert.ok(!JSON.stringify(a).includes(value));
});
test('publishable configuration is not a secret claim', async () => {
  const a = await scanForSecrets('const NEXT_PUBLIC_KEY="pk_test_AbCd1234EfGh5678";', 'inline');
  assert.equal(a[0].isLikelyPublic, true);
  assert.equal(a[0].isSecret, false);
});
test('secret provider format takes precedence over public variable prefix', async () => {
  const a = await scanForSecrets('const NEXT_PUBLIC_KEY="sk_dummy_AbCd1234EfGh5678";', 'inline');
  assert.equal(a[0].isSecret, true);
});
test('legacy page values and storage keys are removed by normalization', () => {
  const p = normalizePage({
    ...page,
    secrets: [
      {
        key: 'TOKEN',
        valueRedacted: 'SENSITIVE_FULL_VALUE',
        source: 'old',
        category: 'pattern',
        confidence: 'Low',
        isSecret: true,
      },
    ],
    storage: { local: 1, session: 0, keys: ['SENSITIVE_STORAGE_KEY'] },
  });
  assert.ok(!JSON.stringify(p).includes('SENSITIVE'));
});
test('all evidence includes collection provenance', () => {
  assert.ok(assess(input()).evidence.every((e) => e.provenance?.source && e.provenance.collector));
});
test('exception preserves evidence and expires or changes with rule version', () => {
  const f = result(input(), 'SL-CSP-001'),
    exception = validateSuppression({
      origin: 'https://example.com',
      checkId: f.checkId,
      ruleVersion: f.ruleVersion,
      rationale: 'Temporary migration',
      actor: 'Analyst',
      expiresAt: '2099-01-01T00:00:00Z',
    });
  assert.equal(suppressionFor(f, 'https://example.com', [exception])?.active, true);
  assert.equal(
    suppressionFor({ ...f, ruleVersion: 'future' }, 'https://example.com', [exception])?.active,
    false
  );
  assert.equal(
    suppressionFor(f, 'https://example.com', [exception], Date.parse('2100-01-01'))?.active,
    false
  );
});
test('rule changes cannot masquerade as verified improvements', () => {
  const before = assess(input()),
    after = assess(
      input({ 'x-content-type-options': ['nosniff'] }),
      'SL-HEADER-002',
      '2026-10-02T09:00:00Z'
    );
  after.findings[0].ruleVersion = 'future';
  assert.equal(verificationResult(before, after).verified, false);
  assert.equal(compareAssessments(before, after)[0].type, 'rule');
});
test('stored-evidence evaluation records reproducibility without new collection timestamps', () => {
  const before = assess(input());
  const after = replayAssessment(before, {
    learningMode: false,
    retention: 50,
    observedOrigins: [],
  });
  assert.equal(after.reproducibility?.reevaluatedFrom, before.id);
  assert.ok(after.evidence.every((e) => e.collectedAt === time));
});
test('advisory range matching requires an exact high confidence version', () => {
  const data = validateAdvisories([
    {
      id: 'TEST-1',
      component: 'Library',
      affectedRange: '<3.5.0',
      fixedVersion: '3.5.0',
      publishedAt: time,
      updatedAt: time,
      source: 'https://example.com/advisory',
    },
  ]);
  const t = {
    name: 'Library',
    layer: 'Frontend',
    confidence: 'high' as const,
    version: '3.4.9',
    versionConfidence: 'high' as const,
    observation: 'Runtime',
  };
  assert.equal(matchAdvisories([t], data).length, 1);
  assert.equal(matchAdvisories([{ ...t, versionConfidence: 'low' }], data).length, 0);
  assert.equal(matchAdvisories([{ ...t, version: '3.10.0' }], data).length, 0);
  assert.equal(matchAdvisories([t], data)[0].runtimeApplicability, 'unknown');
});
test('policy rejects unknown checks and cannot pass unavailable required protection', () => {
  assert.throws(() =>
    validatePolicy({ version: 1, rules: { UNKNOWN: { required: true } } }, CHECKS)
  );
  const p = validatePolicy({ version: 1, rules: { 'SL-CSP-001': { required: true } } }, CHECKS);
  assert.equal(evaluatePolicy(assess(input(null)), p).passed, false);
});
test('policy regression requires matching baseline', () => {
  const p = validatePolicy({ version: 1, rules: {}, regression: { failOnNew: ['high'] } }, CHECKS);
  assert.equal(evaluatePolicy(assess(input()), p).passed, false);
  assert.throws(() =>
    evaluatePolicy(assess(input()), p, { ...assess(input()), targetKey: 'other' })
  );
});
test('SARIF emits contextual weaknesses and JUnit escapes text', () => {
  const a = assess(input());
  assert.equal(
    sarif(a).runs[0].results.length,
    a.findings.filter((f) => f.status === 'potential_weakness').length
  );
  a.findings[0].title = '<unsafe>';
  assert.ok(junit(a).includes('&lt;unsafe&gt;'));
  assert.ok(!junit(a).includes('<unsafe>'));
});

import { inspectSourceMaps } from '@sitelens/evidence-engine';
test('source maps are never requested by a passive scope', async () => {
  let called = 0;
  const result = await inspectSourceMaps(
    ['https://example.com/app.js.map'],
    defaultScope('https://example.com'),
    async () => {
      called++;
      return new Response('{}');
    }
  );
  assert.equal(called, 0);
  assert.notEqual(result[0].status, 'inspected');
});
test('source map redirects cannot escape explicit scope', async () => {
  let called = 0;
  const s = {
    ...defaultScope('https://example.com'),
    mode: 'supplemental' as const,
    authorized: true,
    requestBudget: 5,
  };
  const result = await inspectSourceMaps(['https://example.com/app.js.map'], s, async () => {
    called++;
    return new Response(null, {
      status: 302,
      headers: { location: 'https://outside.test/secret' },
    });
  });
  assert.equal(called, 1);
  assert.notEqual(result[0].status, 'inspected');
});
test('source map reader caps response bytes', async () => {
  const s = {
    ...defaultScope('https://example.com'),
    mode: 'supplemental' as const,
    authorized: true,
    requestBudget: 1,
    maxBytes: 10,
  };
  const result = await inspectSourceMaps(
    ['https://example.com/app.js.map'],
    s,
    async () => new Response('x'.repeat(100))
  );
  assert.equal(result[0].status, 'failed');
  assert.match(result[0].limitation, /byte limit/);
});
test('source maps retain source names and redacted secret metadata only', async () => {
  const secret = 'sk_dummy_AbCd1234EfGh5678';
  const s = {
    ...defaultScope('https://example.com'),
    mode: 'supplemental' as const,
    authorized: true,
    requestBudget: 1,
  };
  const result = await inspectSourceMaps(
    ['https://example.com/app.js.map'],
    s,
    async () =>
      new Response(
        JSON.stringify({
          version: 3,
          sources: ['src/app.ts'],
          sourcesContent: [`const SECRET_KEY="${secret}";`],
        })
      )
  );
  assert.equal(result[0].status, 'inspected');
  assert.equal(result[0].secrets.length, 1);
  assert.ok(!JSON.stringify(result).includes(secret));
  assert.ok(!JSON.stringify(result).includes('const SECRET'));
});

test('session-purpose and prefix checks are not applicable to ordinary cookies', () => {
  const i = input();
  i.cookies = {
    available: true,
    limitation: 'Matching metadata',
    cookies: [
      cookieMetadata({
        name: 'theme',
        domain: 'example.com',
        path: '/',
        secure: true,
        httpOnly: false,
        sameSite: 'lax',
        hostOnly: true,
        session: true,
      }),
    ],
  };
  assert.equal(result(i, 'SL-COOKIE-002').status, 'not_applicable');
  assert.equal(result(i, 'SL-COOKIE-004').status, 'not_applicable');
});
test('resource timing cannot establish a DOM integrity attribute', () => {
  const i = input(
    {},
    {
      resources: [
        {
          url: 'https://cdn.example.net/test.js',
          type: 'script',
          integrity: null,
          crossorigin: null,
          thirdParty: true,
          observedBy: 'Resource timing',
        },
      ],
    }
  );
  assert.equal(result(i, 'SL-RESOURCE-002').status, 'not_applicable');
});

test('postMessage data is traced only inside a recognized handler', () => {
  const a = analyzeScripts([
    { id: 'one', code: 'window.addEventListener("message",e=>{document.body.innerHTML=e.data;});' },
  ]);
  assert.equal(a.flows[0].source, 'postMessage event.data');
  const b = analyzeScripts([
    { id: 'one', code: 'const e={data:"constant"};document.body.innerHTML=e.data;' },
  ]);
  assert.equal(b.flows.length, 0);
});
test('normalization retains redacted storage pattern counts', () => {
  const p = normalizePage({
    ...page,
    storage: { local: 1, session: 0, keys: ['AUTH_TOKEN_NAME'] },
  });
  assert.deepEqual(p.storage.keys, ['sensitive-name pattern']);
  assert.ok(!JSON.stringify(p).includes('AUTH_TOKEN_NAME'));
});

test('scope normalizes encoded separators and traversal before boundaries', () => {
  const s = {
    ...defaultScope('https://example.com'),
    pathPrefixes: ['/app'],
    excludedPaths: ['/private'],
  };
  for (const url of [
    'https://example.com/app/%2e%2e%2fprivate',
    'https://example.com/app/%252e%252e%252fprivate',
    'https://example.com/app/%2e%2e%5cprivate',
  ])
    assert.equal(inScope(url, s), false);
});

test('malformed public URL configuration does not abort secret analysis', async () => {
  const a = await scanForSecrets('const API_URL="https://invalid[";', 'inline');
  assert.equal(a.length, 1);
  assert.ok(!JSON.stringify(a).includes('https://invalid['));
});

test('storage sensitivity remains contextual and unavailable storage is explicit', () => {
  const i = input({}, { storage: { local: 2, session: 0, keys: ['AUTH_TOKEN'] } }),
    f = result(i, 'SL-STORAGE-002');
  assert.equal(f.status, 'informational');
  assert.equal(f.severity, 'informational');
  assert.match(f.observation, /1 redacted/);
  assert.equal(
    result(input({}, { storage: { local: null, session: null } }), 'SL-STORAGE-002').status,
    'unable_to_assess'
  );
});

import { readSecretValues } from '@sitelens/evidence-engine';
import { scanScriptSecrets } from '@sitelens/evidence-engine/src/scanners/environment.js';
import {
  detailedChanges,
  domainMap,
  cspDraft,
  freshness,
  scopedText,
} from '@sitelens/assessment-engine/src/workspace.js';
import { validateBackup, validateReportOptions } from '@sitelens/assessment-engine/src/backup.js';
test('script locations preserve nested property paths and redact source values', async () => {
  const token = 'sk_dummy_AbCd1234EfGh5678IjKl9012';
  const rows = await scanScriptSecrets(
    [{ id: 'inline-7', code: `const config = {\n  services: { token: "${token}" }\n};` }],
    'https://example.com/'
  );
  assert.equal(rows[0].location?.propertyPath, 'config.services.token');
  assert.equal(rows[0].location?.line, 2);
  assert.equal(rows[0].location?.scriptId, 'inline-7');
  assert.match(rows[0].location!.method, /AST/);
  assert.ok(!JSON.stringify(rows).includes(token));
  const fallback = await scanScriptSecrets(
    [{ id: 'broken', code: `bad syntax\n   token="${token}"` }],
    page.url
  );
  assert.equal(fallback[0].location?.line, 2);
  assert.equal(fallback[0].location?.column, 4);
  assert.equal(fallback[0].location?.method, 'Text pattern location');
});
test('freshness distinguishes unchanged, changed, unavailable and historical evidence', () => {
  const a = assess(input());
  assert.equal(freshness(a, { documentId: 'd' }, 'd', a.targetKey), 'current');
  assert.equal(freshness(a, { documentId: 'd' }, 'new', a.targetKey), 'page changed');
  assert.equal(freshness(a, undefined, undefined, undefined), 'unavailable');
  a.supplemental = { sourceAssessmentId: 'previous', collectedAt: time, urls: [] };
  assert.equal(freshness(a, undefined, undefined, undefined), 'older assessment');
});
test('detailed comparison includes removed domains, integrity and header values', () => {
  const before = assess(
    input(
      { 'x-content-type-options': ['nosniff'] },
      {
        resources: [
          {
            url: 'https://cdn.example.net/bundle.js',
            type: 'script',
            integrity: null,
            crossorigin: null,
          },
        ],
      }
    )
  );
  const after = assess(input({}));
  const changes = detailedChanges(before, after);
  assert.ok(changes.some((c) => c.area === 'Headers' && c.item === 'x-content-type-options'));
  assert.ok(changes.some((c) => c.area === 'Resources' && c.after === null));
  assert.ok(changes.some((c) => c.area === 'External domains' && c.item === 'cdn.example.net'));
  assert.equal(domainMap(before)[0].items[0].type, 'script');
  after.targetKey = 'other';
  assert.throws(() => detailedChanges(before, after));
});
test('CSP draft uses observed origins and remains a report-only starting policy', () => {
  const a = assess(
    input(
      {},
      {
        resources: [
          {
            url: 'https://cdn.example.net/a.js',
            type: 'script',
            integrity: null,
            crossorigin: null,
          },
        ],
      }
    )
  );
  const draft = cspDraft(a);
  assert.equal(draft.header, 'Content-Security-Policy-Report-Only');
  assert.match(draft.policy, /script-src 'self' https:\/\/cdn.example.net/);
  assert.ok(!draft.policy.includes('unsafe-inline') && !draft.policy.includes('*'));
  assert.ok(draft.limitations.some((l) => l.includes('Draft only')));
});
test('backup restores compatible assessments and rejects invalid shape, raw values and dangling references', () => {
  const a = assess(input());
  const restored = validateBackup({ backupVersion: 1, assessments: [a], events: [] });
  assert.equal(restored.assessments[0].originalId, a.id);
  assert.ok(restored.assessments[0].importedAt);
  assert.throws(() => validateBackup({ ...a, findings: [{ ...a.findings[0], title: undefined }] }));
  assert.throws(() =>
    validateBackup({ ...a, findings: [{ ...a.findings[0], evidenceIds: ['missing'] }] })
  );
  assert.throws(() =>
    validateBackup({ ...a, evidence: [{ ...a.evidence[0], data: { code: 'raw source' } }] })
  );
  assert.throws(() => validateBackup({ backupVersion: 8, assessments: [a] }));
  assert.throws(() => validateBackup({ ...a, cookies: [{ name: 'session', value: 'raw' }] }));
  const legacy = validateBackup({ ...a, schemaVersion: 1 }).assessments[0];
  assert.equal(legacy.schemaVersion, 2);
  assert.ok(legacy.limits.some((l) => l.includes('migrated')));
});
test('report preferences are bounded and audience selection escapes supplied labels', () => {
  const a = assess(input());
  const options = validateReportOptions({
    audience: 'executive',
    organization: '<img src=x>',
    selectedCheckIds: [a.findings[0].checkId],
    logo: 'none',
  });
  const html = reportHtml(a, [], options);
  assert.equal((html.match(/<h2>\d+\./g) || []).length, 4);
  assert.ok(html.includes('&lt;img src=x&gt;'));
  assert.ok(!html.includes('<img src=x>'));
  assert.throws(() => validateReportOptions({ customLogo: 'data:image/svg+xml;base64,abcd' }));
  assert.throws(() => validateReportOptions({ assessor: 'a'.repeat(129) }));
  assert.throws(() => validateReportOptions({ audience: 'invalid' }));
});
test('scoped bundle reader blocks third-party redirect before sending a request', async () => {
  const scope = {
    ...defaultScope('https://example.com'),
    origins: ['https://example.com', 'https://cdn.example.net'],
  };
  let calls = 0;
  await assert.rejects(
    scopedText('https://example.com/bundle.js', scope, { reserve: async () => {} }, async () => {
      calls++;
      return new Response(null, {
        status: 302,
        headers: { location: 'https://cdn.example.net/bundle.js' },
      });
    }),
    /outside/
  );
  assert.equal(calls, 1);
});
test('scoped bundle reader limits bytes and rejects HTML responses', async () => {
  const scope = { ...defaultScope('https://example.com'), maxBytes: 4 };
  await assert.rejects(
    scopedText(
      'https://example.com/a.js',
      scope,
      { reserve: async () => {} },
      async () => new Response('12345', { headers: { 'content-type': 'text/javascript' } })
    ),
    /byte limit/
  );
  await assert.rejects(
    scopedText(
      'https://example.com/a.js',
      scope,
      { reserve: async () => {} },
      async () => new Response('<html>', { headers: { 'content-type': 'text/html' } })
    ),
    /not a JavaScript/
  );
  const body = await scopedText(
    'https://example.com/a.js',
    scope,
    { reserve: async () => {} },
    async () => new Response('true', { headers: { 'content-type': 'text/javascript' } })
  );
  assert.equal(body.bytes, 4);
  assert.equal(body.text, 'true');
});
test('full live values are separate from persisted secret metadata', async () => {
  const value = 'sk_dummy_AbCd1234EfGh5678IjKl9012',
    content = `const API_TOKEN="${value}";`;
  const values = await readSecretValues(content);
  assert.equal(values[0].value, value);
  const findings = await scanForSecrets(content, 'inline');
  assert.ok(!JSON.stringify(findings).includes(value));
  assert.equal(values[0].valueFingerprint, findings[0].valueFingerprint);
});
