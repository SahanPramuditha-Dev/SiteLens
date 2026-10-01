import { test, expect, chromium, type BrowserContext, type Page } from '@playwright/test';
import { createServer, type Server } from 'node:http';
import { cp, mkdtemp, readFile, writeFile, rm, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
test.describe.configure({ mode: 'serial' });
let server: Server,
  origin: string,
  extensionId: string,
  context: BrowserContext,
  workspace: Page,
  target: Page,
  fixtureDir: string;
let nosniff = false,
  csp =
    "default-src 'self'; script-src 'self' 'unsafe-inline'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'",
  requests = 0;
test.beforeAll(async () => {
  server = createServer((req, res) => {
    requests++;
    if (req.url?.startsWith('/api/profile')) {
      res.writeHead(200, {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': origin,
        'Cache-Control': 'no-store',
      });
      res.end(JSON.stringify({ value: 'API_BODY_SECRET' }));
      return;
    }
    if (req.url?.startsWith('/script.js')) {
      res.writeHead(200, { 'Content-Type': 'application/javascript' });
      res.end('window.fixtureLoaded=true');
      return;
    }
    if (req.url === '/bundle.js') {
      res.writeHead(200, { 'Content-Type': 'application/javascript' });
      res.end(
        'const fixtureConfig={API_TOKEN:"sk_dummy_ZyXw9876VuTs5432RqPo1098"};function unusedFixture(){document.body.innerHTML=location.hash;}'
      );
      return;
    }
    res.writeHead(200, {
      'Content-Type': 'text/html',
      Server: 'nginx/1.26.3',
      'Content-Security-Policy': csp,
      ...(nosniff ? { 'X-Content-Type-Options': 'nosniff' } : {}),
      'Set-Cookie': [
        'sessionid=COOKIE_VALUE_SECRET; HttpOnly; SameSite=Lax; Path=/',
        'theme=COOKIE_VALUE_SECRET; SameSite=Lax; Path=/',
      ],
    });
    res.end(
      '<!doctype html><html lang="en"><head><meta name="generator" content="WordPress 6.8.1"><title>Fixture</title><script src="/script.js?token=RESOURCE_SECRET"></script><script src="/bundle.js"></script></head><body><main><h1>Local test target</h1><form action="/login?token=FORM_SECRET" method="post"><input type="password"></form><script>const API_TOKEN="sk_dummy_AbCd1234EfGh5678IjKl9012";localStorage.setItem("SECRET_KEY","STORAGE_VALUE_SECRET");fetch("/api/profile?token=API_QUERY_SECRET");</script></main></body></html>'
    );
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  origin = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
  fixtureDir = await mkdtemp(path.join(tmpdir(), 'sitelens-test-'));
  const extensionPath = path.join(fixtureDir, 'extension');
  await cp(path.resolve('apps/extension/dist'), extensionPath, { recursive: true });
  // Only the integration fixture pre-grants local host/cookie access. The shipped manifest uses optional access.
  const manifest = JSON.parse(await readFile(path.join(extensionPath, 'manifest.json'), 'utf8'));
  manifest.host_permissions = ['http://127.0.0.1/*'];
  manifest.permissions.push('cookies');
  manifest.optional_permissions = [];
  await writeFile(path.join(extensionPath, 'manifest.json'), JSON.stringify(manifest));
  context = await chromium.launchPersistentContext(path.join(fixtureDir, 'profile'), {
    ...(process.env.SITELENS_TEST_BROWSER
      ? { executablePath: process.env.SITELENS_TEST_BROWSER }
      : process.platform === 'win32'
        ? { executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe' }
        : { channel: 'chromium' }),
    headless: true,
    args: [`--disable-extensions-except=${extensionPath}`, `--load-extension=${extensionPath}`],
  });
  const worker = context.serviceWorkers()[0] || (await context.waitForEvent('serviceworker'));
  extensionId = worker.url().split('/')[2];
  target = await context.newPage();
  await target.goto(origin + '/page?token=TARGET_SECRET');
  workspace = await context.newPage();
  await workspace.goto(`chrome-extension://${extensionId}/dashboard.html`);
});
test.afterAll(async () => {
  await context?.close();
  await new Promise<void>((resolve) => server?.close(() => resolve()));
  if (fixtureDir) await rm(fixtureDir, { recursive: true, force: true });
});
async function message(data: Record<string, unknown>) {
  return workspace.evaluate(async (data) => {
    const result = await chrome.runtime.sendMessage(data);
    if (result?.error) throw new Error(result.error);
    return result;
  }, data);
}
async function targetId() {
  return workspace.evaluate(
    async (origin) => (await chrome.tabs.query({})).find((t) => t.url?.startsWith(origin))!.id!,
    origin
  );
}
test('empty workspace and documented methodology render', async () => {
  await expect(workspace.getByText('Start with the website in front of you')).toBeVisible();
  await workspace.locator('nav [data-view="methodology"]').click();
  expect(await workspace.locator('.methodology-card').count()).toBeGreaterThanOrEqual(36);
});
test('inspects without captured headers and never stores sensitive values', async () => {
  const startRequests = requests;
  const result = await message({ type: 'inspect', tabId: await targetId() });
  expect(requests).toBe(startRequests);
  await workspace.goto(`chrome-extension://${extensionId}/dashboard.html?id=${result.id}`);
  await expect(workspace.locator('.stat')).toHaveCount(4);
  const state = await message({ type: 'state' });
  const a = state.assessments[0];
  expect(a.findings.find((f: any) => f.checkId === 'SL-HEADER-002').status).toBe(
    'unable_to_assess'
  );
  const serialized = JSON.stringify(state);
  for (const secret of [
    'TARGET_SECRET',
    'RESOURCE_SECRET',
    'FORM_SECRET',
    'COOKIE_VALUE_SECRET',
    'STORAGE_VALUE_SECRET',
    'SECRET_KEY',
  ])
    expect(serialized).not.toContain(secret);
  expect(a.cookies.every((c: any) => c.value === '[REDACTED]')).toBe(true);
});
test('capture document headers, inspect views, persist lifecycle, and learning mode', async () => {
  await message({ type: 'observe', origin });
  await target.reload();
  await target.waitForTimeout(150);
  const result = await message({ type: 'inspect', tabId: await targetId() });
  const captured = (await message({ type: 'state' })).assessments.find(
    (a: any) => a.id === result.id
  );
  const live = await message({ type: 'secret-values', assessmentId: result.id });
  expect(live.values.find((v: any) => v.key === 'API_TOKEN').value).toBe(
    'sk_dummy_AbCd1234EfGh5678IjKl9012'
  );
  expect(JSON.stringify(await message({ type: 'state' }))).not.toContain(
    'sk_dummy_AbCd1234EfGh5678IjKl9012'
  );
  const configuration = await context.newPage();
  await configuration.goto(
    `chrome-extension://${extensionId}/dashboard/index.html?id=${result.id}`
  );
  await configuration.getByRole('button', { name: 'Secrets & Configuration', exact: true }).click();
  await expect(
    configuration.getByText('sk_dummy_AbCd1234EfGh5678IjKl9012', { exact: true })
  ).toBeVisible();
  await configuration.close();
  expect(
    captured.apiEndpoints.some(
      (r: any) =>
        r.url.includes('/api/profile') &&
        r.method === 'GET' &&
        r.statusCode === 200 &&
        r.authentication === 'unknown'
    )
  ).toBe(true);
  expect(JSON.stringify(captured)).not.toContain('API_BODY_SECRET');
  expect(JSON.stringify(captured)).not.toContain('API_QUERY_SECRET');
  await workspace.goto(`chrome-extension://${extensionId}/dashboard.html?id=${result.id}`);
  const errors: string[] = [];
  workspace.on('pageerror', (e) => errors.push(e.message));
  for (const view of [
    'findings',
    'evidence',
    'coverage',
    'headers',
    'cookies',
    'resources',
    'technology',
    'relationships',
    'history',
    'methodology',
    'settings',
  ]) {
    await workspace.locator(`nav [data-view="${view}"]`).click();
    await expect(workspace.locator('#content')).not.toBeEmpty();
  }
  expect(errors).toEqual([]);
  await workspace.locator('nav [data-view="findings"]').click();
  const f = workspace.locator('#finding-SL-HEADER-002');
  await f.locator('summary').click();
  await f.locator('select[name="state"]').selectOption('investigating');
  await f.locator('input[name="note"]').fill('Review fixture configuration');
  await f.getByRole('button', { name: 'Save state' }).click();
  await expect(workspace.locator('#notice')).toContainText('Lifecycle state saved');
  await workspace.locator('#learning').check();
  await workspace.locator('#finding-SL-HEADER-002 summary').click();
  await expect(workspace.locator('#finding-SL-HEADER-002 .learning-box')).toBeVisible();
});
test('selective fix verification and policy evidence comparison', async () => {
  nosniff = true;
  const state = await message({ type: 'state' });
  const baseline = state.assessments.find((a: any) => a.kind === 'full');
  await target.reload();
  const verification = await message({
    type: 'verify',
    assessmentId: baseline.id,
    checkId: 'SL-HEADER-002',
  });
  expect(verification.verification.verified).toBe(true);
  const fresh = (await message({ type: 'state' })).assessments[0];
  expect(fresh.checksTotal).toBe(1);
  expect(fresh.findings[0].lifecycle).toBe('verified');
  expect(fresh.evidence).toHaveLength(1);
  csp =
    "default-src 'self'; script-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'";
  await target.reload();
  const full = await message({ type: 'inspect', tabId: await targetId() });
  await workspace.goto(`chrome-extension://${extensionId}/dashboard.html?id=${full.id}`);
  await expect(
    workspace.getByText('Evidence changed; observation status unchanged.').first()
  ).toBeVisible();
});
test('reports, downloads, navigation identity and responsive layout', async () => {
  const state = await message({ type: 'state' });
  const current = state.assessments.find((a: any) => a.kind === 'full');
  await workspace.goto(`chrome-extension://${extensionId}/dashboard.html?id=${current.id}`);
  await mkdir('test-results/screenshots', { recursive: true });
  await workspace.setViewportSize({ width: 1440, height: 1100 });
  await workspace.screenshot({ path: 'test-results/screenshots/overview.png', fullPage: true });
  await workspace.locator('nav [data-view="cookies"]').click();
  await workspace.screenshot({ path: 'test-results/screenshots/cookies.png', fullPage: true });
  await workspace.locator('nav [data-view="findings"]').click();
  await workspace.locator('#finding-SL-CSP-001 summary').click();
  await workspace.screenshot({ path: 'test-results/screenshots/finding.png', fullPage: true });
  await workspace.setViewportSize({ width: 540, height: 900 });
  await workspace.screenshot({ path: 'test-results/screenshots/mobile.png', fullPage: true });
  expect(
    await workspace.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)
  ).toBe(true);
  await workspace.locator('#exports').click();
  const downloadPromise = workspace.waitForEvent('download');
  await workspace.locator('#json').click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/\.json$/);
  await workspace.setViewportSize({ width: 1440, height: 1100 });
  const report = await context.newPage();
  await report.goto(`chrome-extension://${extensionId}/report.html?id=${current.id}`);
  await expect(report.locator('h2')).toHaveCount(13);
  await report.pdf({
    path: 'test-results/sitelens-fixture-report.pdf',
    format: 'A4',
    printBackground: true,
  });
  await report.close();
  await target.goto(origin + '/other?token=DIFFERENT');
  const refused = await workspace.evaluate(
    async (id) =>
      chrome.runtime.sendMessage({ type: 'verify', assessmentId: id, checkId: 'SL-HEADER-002' }),
    current.id
  );
  expect(refused.error).toContain('URL changed');
  await target.close();
  const closed = await workspace.evaluate(
    async (id) => chrome.runtime.sendMessage({ type: 'reinspect', assessmentId: id }),
    current.id
  );
  expect(closed.error).toBeTruthy();
});

test('React workspace renders live extension records and all inspection views', async () => {
  const state = await message({ type: 'state' });
  const a = state.assessments.find((a: any) => a.kind === 'full');
  const page = await context.newPage();
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(`chrome-extension://${extensionId}/dashboard/index.html?id=${a.id}`);
  await expect(page.getByRole('img', { name: 'SiteLens' })).toBeVisible();
  expect(
    await page
      .getByRole('img', { name: 'SiteLens' })
      .evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0)
  ).toBe(true);
  expect(await page.locator('link[rel="icon"]').getAttribute('href')).toContain(
    'brand/favicon.svg'
  );
  for (const label of [
    'Findings',
    'Assessment Coverage',
    'CSP & Headers',
    'Cross-Origin & Isolation',
    'Secrets & Configuration',
    'Cookies',
    'Client-Side Security',
    'Dependencies & Supply Chain',
    'API Surface',
    'Runtime & Resources',
    'Evidence Explorer',
    'History',
    'Security Timeline',
    'Comparison',
    'Methodology',
    'Scope, projects & exceptions',
    'Developer Tools',
    'Technology Profile',
  ]) {
    await page
      .getByRole('button', { name: label, exact: label !== 'Findings' })
      .first()
      .click();
    await expect(page.locator('main')).not.toBeEmpty();
  }
  await page.setViewportSize({ width: 540, height: 900 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true
  );
  expect(errors).toEqual([]);
  await page.close();
});

test('configured path exclusions block inspection before collection', async () => {
  const state = await message({ type: 'state' }),
    a = state.assessments.find((a: any) => a.kind === 'full');
  await message({ type: 'scope', origin, scope: { ...a.scope, excludedPaths: ['/blocked'] } });
  const page = await context.newPage();
  await page.goto(origin + '/blocked');
  const id = await page
    .evaluate(() => 0)
    .then(() =>
      workspace.evaluate(
        async (origin) =>
          (await chrome.tabs.query({})).find((t) => t.url?.startsWith(origin + '/blocked'))!.id!,
        origin
      )
    );
  const start = requests;
  const result = await workspace.evaluate(
    async (id) => chrome.runtime.sendMessage({ type: 'inspect', tabId: id }),
    id
  );
  expect(result.error).toContain('outside the configured scope');
  expect(requests).toBe(start);
  await page.close();
});

test('scoped bundle inspection adds redacted immutable evidence and freshness notices', async () => {
  target = await context.newPage();
  await target.goto(origin + '/new-assessment');
  const prior = await message({ type: 'state' });
  const previous = prior.assessments.find((a: any) => a.kind === 'full');
  const scope = {
    ...previous.scope,
    excludedPaths: [],
    mode: 'passive',
    authorized: false,
    requestBudget: 0,
  };
  await message({ type: 'scope', origin, scope });
  const initial = await message({ type: 'inspect', tabId: await targetId() });
  expect((await message({ type: 'freshness', assessmentId: initial.id })).status).toBe('current');
  const before = requests;
  const denied = await workspace.evaluate(
    async ({ id, url }) =>
      chrome.runtime.sendMessage({ type: 'bundles', assessmentId: id, urls: [url] }),
    { id: initial.id, url: origin + '/bundle.js' }
  );
  expect(denied.error).toContain('authorized supplemental scope');
  expect(requests).toBe(before);
  await message({
    type: 'scope',
    origin,
    scope: {
      ...scope,
      mode: 'supplemental',
      authorized: true,
      requestBudget: 3,
      requestsPerSecond: 5,
    },
  });
  const bundle = await message({
    type: 'bundles',
    assessmentId: initial.id,
    urls: [origin + '/bundle.js'],
  });
  expect(bundle.id).not.toBe(initial.id);
  expect(bundle.records[0].status).toBe('inspected');
  const state = await message({ type: 'state' });
  const a = state.assessments.find((a: any) => a.id === bundle.id);
  expect(a.profile).toBe('extension-supplemental');
  expect(
    a.evidence.some((e: any) => e.id === 'EV-BUNDLE' && e.provenance.source === 'extension-request')
  ).toBe(true);
  expect(
    a.evidence
      .find((e: any) => e.label === 'Redacted configuration patterns')
      .data.some((s: any) => s.location?.propertyPath === 'fixtureConfig.API_TOKEN')
  ).toBe(true);
  expect(JSON.stringify(state)).not.toContain('sk_dummy_ZyXw9876VuTs5432RqPo1098');
  expect(state.assessments.find((a: any) => a.id === initial.id).supplemental).toBeUndefined();
  expect((await message({ type: 'freshness', assessmentId: bundle.id })).status).toBe(
    'older assessment'
  );
  const repeated = await workspace.evaluate(
    async (id) =>
      chrome.runtime.sendMessage({ type: 'bundles', assessmentId: id, urls: [location.origin] }),
    initial.id
  );
  expect(repeated.error).toBeTruthy();
  await target.reload();
  expect((await message({ type: 'freshness', assessmentId: initial.id })).status).toBe(
    'page changed'
  );
});

test('backup restore, custom reports and all developer panels work with live extension storage', async () => {
  const state = await message({ type: 'state' });
  const a = state.assessments.find((a: any) => a.profile === 'extension-supplemental');
  const duplicate = await message({
    type: 'import',
    data: { backupVersion: 1, assessments: [a, a], events: [] },
  });
  expect(duplicate).toEqual({ added: 0, skipped: 2 });
  const imported = { ...a, id: 'imported-fixture', originalId: 'imported-fixture' };
  expect((await message({ type: 'import', data: imported })).added).toBe(1);
  expect((await message({ type: 'freshness', assessmentId: imported.id })).status).toBe(
    'older assessment'
  );
  const invalid = await workspace.evaluate(
    async (a) =>
      chrome.runtime.sendMessage({
        type: 'import',
        data: { ...a, findings: [{ ...a.findings[0], evidenceIds: ['missing'] }] },
      }),
    a
  );
  expect(invalid.error).toContain('references');
  const usage = await message({ type: 'storage-usage' });
  expect(usage.bytes).toBeGreaterThan(0);
  await message({
    type: 'report-options',
    options: {
      audience: 'executive',
      assessor: 'Fixture Assessor',
      organization: 'Example Organization',
      project: 'Fixture Project',
      selectedCheckIds: ['SL-CSP-001'],
    },
  });
  const report = await context.newPage();
  await report.goto(`chrome-extension://${extensionId}/report.html?id=${a.id}`);
  await expect(report.locator('h2')).toHaveCount(4);
  await expect(report.getByText('Fixture Assessor / Example Organization')).toBeVisible();
  await report.close();
  const page = await context.newPage();
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(`chrome-extension://${extensionId}/dashboard/index.html?id=${a.id}`);
  await page.getByRole('button', { name: 'Developer Tools', exact: true }).click();
  for (const panel of [
    'Third-party map',
    'Bundle inspection',
    'Backup & restore',
    'Report customization',
    'CSP rollout assistant',
    'Fix recipes',
  ]) {
    await page.getByRole('button', { name: panel, exact: true }).click();
    await expect(page.locator('main')).not.toBeEmpty();
  }
  await page.getByRole('button', { name: 'CSP rollout assistant', exact: true }).click();
  await expect(page.locator('textarea')).toHaveValue(/default-src 'self'/);
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.screenshot({ path: 'test-results/screenshots/developer-csp.png', fullPage: true });
  await page.getByRole('button', { name: 'Report customization', exact: true }).click();
  await expect(page.getByLabel('assessor', { exact: true })).toHaveValue('Fixture Assessor');
  await page.setViewportSize({ width: 540, height: 900 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expect(errors).toEqual([]);
  await page.close();
  await message({ type: 'report-options', options: { audience: 'complete' } });
});
test('technology profile collects DOM metadata and headers, filters results and explains evidence', async () => {
  const scanned = await message({ type: 'inspect', tabId: await targetId() });
  const a = (await message({ type: 'state' })).assessments.find((a: any) => a.id === scanned.id);
  expect(a.technologies.find((t: any) => t.name === 'WordPress').version).toBe('6.8.1');
  expect(a.technologies.find((t: any) => t.name === 'Nginx').signals[0].type).toBe('header');
  expect(a.technologies.find((t: any) => t.name === 'WordPress').signals[0].type).toBe('meta');
  const page = await context.newPage();
  await page.goto(`chrome-extension://${extensionId}/dashboard/index.html?id=${a.id}`);
  await page.getByRole('button', { name: 'Technology Profile', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Observed technology map' })).toBeVisible();
  await page.getByLabel('Search technologies').fill('WordPress');
  await expect(page.locator('article')).toHaveCount(1);
  const technologyLogo = page.locator('article img[title="WordPress technology logo"]');
  await expect(technologyLogo).toBeVisible();
  expect(
    await technologyLogo.evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0)
  ).toBe(true);
  await page.locator('article summary').click();
  await expect(
    page.getByText('Generator declares WordPress 6.8.1; this is self-reported.')
  ).toBeVisible();
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.screenshot({
    path: 'test-results/screenshots/technology-profile.png',
    fullPage: true,
  });
  await page.getByLabel('Technology category').selectOption('Server');
  await expect(page.getByText('No technologies match these filters.')).toBeVisible();
  await page.setViewportSize({ width: 540, height: 900 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.close();
});
