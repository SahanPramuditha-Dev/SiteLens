import { readFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
const root = 'apps/extension/dist/';
const manifest = JSON.parse(await readFile(root + 'manifest.json', 'utf8'));
assert.equal(manifest.manifest_version, 3);
assert.equal(manifest.incognito, 'not_allowed');
assert.ok(!manifest.host_permissions);
assert.ok(manifest.optional_permissions.includes('cookies'));
for (const file of [
  manifest.background.service_worker,
  manifest.action.default_popup,
  'dashboard/index.html',
  'dashboard.html',
  'app.js',
  'popup.js',
  'report.html',
  'report.js',
  'style.css',
])
  assert.ok((await readFile(root + file)).length);
for (const page of ['dashboard/index.html', 'popup.html', 'report.html']) {
  const html = await readFile(root + page, 'utf8');
  assert.ok(!/on(?:click|load|change)=/i.test(html));
  assert.ok(!/<script[^>]*src="https?:/i.test(html));
}
console.log('Manifest, dashboard and extension assets verified.');
