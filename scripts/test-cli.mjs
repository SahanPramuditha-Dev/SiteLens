import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import { readFile } from 'node:fs/promises';
const server = createServer((req, res) => {
  res.writeHead(200, {
    'Content-Type': 'text/html',
    'X-Content-Type-Options': 'nosniff',
    Server: 'nginx/1.26.3',
    'Content-Security-Policy': "default-src 'self'",
  });
  res.end(
    '<!doctype html><html><head><meta name="generator" content="WordPress 6.8.1"><title>Local SiteLens fixture</title></head><body><h1>Fixture</h1></body></html>'
  );
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
try {
  const target = 'http://127.0.0.1:' + server.address().port;
  const child = spawn(process.execPath, [
    'apps/cli/dist/index.js',
    'scan',
    target,
    ...(process.env.SITELENS_TEST_BROWSER || process.platform === 'win32'
      ? [
          '--browser',
          process.env.SITELENS_TEST_BROWSER ||
            'C:/Program Files/Google/Chrome/Application/chrome.exe',
        ]
      : []),
    '--out',
    'test-results/cli',
  ]);
  child.stdout.pipe(process.stdout);
  child.stderr.pipe(process.stderr);
  const code = await new Promise((r) => child.on('exit', r));
  if (code !== 0) throw new Error('CLI failed: ' + code);
  const a = JSON.parse(await readFile('test-results/cli/assessment.json', 'utf8'));
  if (a.profile !== 'cli-browser' || a.checksTotal < 36 || !a.evidence.every((e) => e.provenance))
    throw new Error('CLI assessment metadata invalid');
  if (
    a.technologies.find((t) => t.name === 'WordPress')?.version !== '6.8.1' ||
    !a.technologies.find((t) => t.name === 'Nginx')?.signals?.length
  )
    throw new Error('CLI technology detection invalid');
  console.log('CLI local fixture assessment and all four exports passed.');
} finally {
  server.close();
}
