import { build } from 'esbuild';
import { pathToFileURL } from 'node:url';
import { chromium } from 'playwright';
import { readFile, mkdir } from 'node:fs/promises';
import { createServer } from 'node:http';
import path from 'node:path';
await build({
  entryPoints: ['tests/fixtures/dashboard.ts'],
  outfile: '.test-build/dashboard-fixture.mjs',
  bundle: true,
  platform: 'node',
  format: 'esm',
});
const { default: state } = await import(
  pathToFileURL(path.resolve('.test-build/dashboard-fixture.mjs')).href
);
const server = createServer(async (req, res) => {
  try {
    const file = path.join(
      process.cwd(),
      'apps/extension/dist/dashboard',
      req.url.split('?')[0] === '/' ? 'index.html' : req.url.split('?')[0]
    );
    res.setHeader(
      'Content-Type',
      file.endsWith('.js')
        ? 'text/javascript'
        : file.endsWith('.css')
          ? 'text/css'
          : file.endsWith('.svg')
            ? 'image/svg+xml'
            : file.endsWith('.png')
              ? 'image/png'
              : file.endsWith('.ico')
                ? 'image/x-icon'
                : 'text/html'
    );
    res.end(await readFile(file));
  } catch {
    res.writeHead(404).end();
  }
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const browser = await chromium.launch({
  ...(process.env.SITELENS_TEST_BROWSER
    ? { executablePath: process.env.SITELENS_TEST_BROWSER }
    : process.platform === 'win32'
      ? { executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' }
      : {}),
  headless: true,
});
try {
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.addInitScript((state) => {
    window.chrome = {
      runtime: {
        sendMessage: (message, callback) => {
          const result =
            message.type === 'freshness'
              ? { status: 'older assessment', collectedAt: state.assessments[0].createdAt }
              : message.type === 'storage-usage'
                ? { bytes: 42000, quota: 10485760 }
                : state;
          if (callback) callback(result);
          return Promise.resolve(result);
        },
        getURL: (x) => x,
      },
      tabs: { create: () => Promise.resolve() },
    };
  }, state);
  await page.goto('http://127.0.0.1:' + server.address().port);
  await page.getByRole('button', { name: 'Findings', exact: false }).click();
  await page.getByText('Why am I seeing this?').first().click();
  await page.getByRole('button', { name: 'Evidence Explorer', exact: true }).click();
  await page.getByRole('button', { name: 'Overview', exact: true }).click();
  await mkdir('test-results/screenshots', { recursive: true });
  await page.screenshot({
    path: 'test-results/screenshots/dashboard-overview.png',
    fullPage: true,
  });
  await page.getByRole('button', { name: 'Scope, projects & exceptions', exact: true }).click();
  await page.getByRole('heading', { name: 'Assessment scope', exact: true }).waitFor();
  await mkdir('test-results/screenshots', { recursive: true });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.screenshot({
    path: 'test-results/screenshots/dashboard-controls.png',
    fullPage: true,
  });
  await page.getByRole('button', { name: 'Developer Tools', exact: true }).click();
  await page.getByRole('button', { name: 'CSP rollout assistant', exact: true }).click();
  await page.locator('textarea').waitFor();
  await page.screenshot({
    path: 'test-results/screenshots/dashboard-developer-csp.png',
    fullPage: true,
  });
  await page.getByRole('button', { name: 'Third-party map', exact: true }).click();
  await page.getByRole('heading', { name: 'Observed relationship map', exact: true }).waitFor();
  await page.screenshot({
    path: 'test-results/screenshots/dashboard-relationships.png',
    fullPage: true,
  });
  await page.getByRole('button', { name: 'Report customization', exact: true }).click();
  await page.getByLabel('assessor', { exact: true }).fill('Fixture reviewer');
  await page.getByRole('button', { name: 'Save report preferences', exact: true }).click();
  await page.getByText('Report preferences saved.').waitFor();
  await page.getByRole('button', { name: 'Technology Profile', exact: true }).click();
  await page.getByRole('heading', { name: 'Observed technology map' }).waitFor();
  await page.getByLabel('Search technologies').fill('WordPress');
  await page.locator('article summary').click();
  const technologyAssets = JSON.parse(
    await readFile('assets/technologies/SOURCES.json', 'utf8')
  ).logos;
  const broken = await page.evaluate(async (logos) => {
    return (
      await Promise.all(
        logos.map(
          (logo) =>
            new Promise((resolve) => {
              const img = new Image();
              img.onload = () => resolve(img.naturalWidth > 0 ? null : logo.technology);
              img.onerror = () => resolve(logo.technology);
              img.src = './technologies/' + logo.file;
            })
        )
      )
    ).filter(Boolean);
  }, technologyAssets);
  if (broken.length) throw new Error('Technology logos failed to render: ' + broken.join(', '));
  await page.screenshot({
    path: 'test-results/screenshots/dashboard-technology-profile.png',
    fullPage: true,
  });
  if (errors.length) throw new Error(errors.join('\n'));
  console.log('React dashboard fixture interaction passed.');
} finally {
  await browser.close();
  server.close();
}
