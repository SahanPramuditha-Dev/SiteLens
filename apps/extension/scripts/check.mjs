import {readFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const manifest=JSON.parse(await readFile('dist/manifest.json','utf8'));
assert.equal(manifest.manifest_version,3);assert.equal(manifest.incognito,'not_allowed');assert.ok(!manifest.host_permissions);assert.ok(manifest.optional_permissions.includes('cookies'));
for(const file of [manifest.background.service_worker,manifest.action.default_popup,'dashboard.html','app.js','popup.js','report.html','report.js','style.css'])assert.ok((await readFile(`dist/${file}`)).length);
for(const page of ['dashboard.html','popup.html','report.html']){const html=await readFile(`dist/${page}`,'utf8');assert.ok(!/on(?:click|load|change)=/i.test(html));assert.ok(!/<script[^>]*src="https?:/i.test(html));}
console.log('Manifest and extension assets verified.');
