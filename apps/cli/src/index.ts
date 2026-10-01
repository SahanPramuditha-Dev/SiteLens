import { chromium } from 'playwright';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { parse as yaml } from 'yaml';
import { assess } from '@sitelens/assessment-engine';
import { validateBackup } from '@sitelens/assessment-engine/src/backup.js';
import { CHECKS } from '@sitelens/rule-definitions';
import { validatePolicy, evaluatePolicy } from '@sitelens/rule-definitions/src/governance.js';
import { defaultScope, inScope, validateScope } from '@sitelens/rule-definitions/src/scope.js';
import {
  cookieMetadata,
  hashUrl,
  redactHeader,
  redactUrl,
} from '@sitelens/rule-definitions/src/privacy.js';
import { validateAdvisories, matchAdvisories } from '@sitelens/rule-definitions/src/advisories.js';
import { analyzeScripts, scanScriptSecrets } from '@sitelens/evidence-engine';
import { sarif, junit } from '@sitelens/reporting/src/exports.js';
import { collectPage } from '../../extension/src/collector';
import { collectRuntimeTechnologies } from '../../extension/src/technology-runtime';
import { reportHtml } from '../../extension/src/report';
import type { Assessment, RequestObservation, ResponseSnapshot } from '@sitelens/shared-types';
const args = process.argv.slice(2),
  command = args.shift();
const flag = (name: string) => {
  const n = args.indexOf('--' + name);
  return n < 0 ? undefined : args[n + 1];
};
async function json(file: string) {
  const value = await readFile(file, 'utf8');
  if (value.length > 10000000) throw new Error('Input file exceeds 10 MB.');
  return JSON.parse(value);
}
function record(value: unknown): Assessment {
  const a = validateBackup(value).assessments[0];
  a.importedAt = (value as Assessment).importedAt;
  a.originalId = (value as Assessment).originalId;
  return a;
}
async function main() {
  if (!command || command === '--help') {
    console.log(
      'SiteLens\n  scan <url> [--scope file.json] [--policy file.yml] [--baseline report.json] [--advisories file.json] [--out directory]\n  policy <report.json> --policy file.yml [--baseline report.json]\n  validate <report.json>\n  export <report.json> --format sarif|junit|html --out file'
    );
    return;
  }
  if (command === 'validate') {
    record(await json(args[0]));
    console.log('Assessment schema and evidence references validated.');
    return;
  }
  if (command === 'export') {
    const a = record(await json(args[0])),
      format = flag('format');
    const output =
      format === 'sarif'
        ? JSON.stringify(sarif(a), null, 2)
        : format === 'junit'
          ? junit(a)
          : format === 'html'
            ? reportHtml(a)
            : null;
    if (!output || !flag('out'))
      throw new Error('Specify --format sarif|junit|html and --out file.');
    await writeFile(flag('out')!, output);
    return;
  }
  const policy = flag('policy')
    ? validatePolicy(yaml(await readFile(flag('policy')!, 'utf8')), CHECKS)
    : undefined;
  const baseline = flag('baseline') ? record(await json(flag('baseline')!)) : undefined;
  if (command === 'policy') {
    if (!policy) throw new Error('Provide --policy.');
    const result = evaluatePolicy(record(await json(args[0])), policy, baseline);
    console.log(JSON.stringify(result, null, 2));
    if (!result.passed) process.exitCode = 2;
    return;
  }
  if (command !== 'scan') throw new Error('Unknown command. Use --help.');
  const target = args[0];
  if (!/^https?:\/\//.test(target)) throw new Error('An HTTP or HTTPS target is required.');
  const scope = validateScope(
    flag('scope') ? await json(flag('scope')!) : policy?.scope || defaultScope(target)
  );
  if (!inScope(target, scope)) throw new Error('Target outside scope.');
  const browser = await chromium.launch({
    headless: true,
    ...(flag('browser') ? { executablePath: flag('browser') } : {}),
  });
  const started = performance.now();
  try {
    const context = await browser.newContext();
    let navRequests = 0;
    const page = await context.newPage();
    const requests: RequestObservation[] = [];
    const pending: Promise<void>[] = [];
    await context.route('**/*', async (route) => {
      const req = route.request();
      if (!inScope(req.url(), scope, new URL(req.url()).origin !== new URL(target).origin)) {
        await route.abort();
        return;
      }
      if (++navRequests > 100) {
        await route.abort();
        return;
      }
      await route.continue();
    });
    page.on('response', (r) => {
      const task = (async () => {
        const req = r.request();
        const headers: Record<string, string[]> = {};
        for (const [k, v] of Object.entries(await r.allHeaders()))
          if (
            /^(content-security-policy(?:-report-only)?|strict-transport-security|x-content-type-options|referrer-policy|x-frame-options|permissions-policy|cross-origin-.*|access-control-.*|content-type|cache-control|pragma|vary|server|x-powered-by|cf-ray|via|x-amz-cf-id|x-served-by|x-fastly-request-id|x-vercel-id|x-nf-request-id|x-aspnet-version)$/.test(
              k
            )
          )
            headers[k] = [redactHeader(v)];
        requests.push({
          url: redactUrl(r.url()),
          method: req.method(),
          type: req.resourceType(),
          statusCode: r.status(),
          contentType: headers['content-type']?.[0],
          headers,
          initiator: redactUrl(target),
          authentication: 'unknown',
          firstObserved: new Date().toISOString(),
          provenance: {
            source: 'cli-request',
            collector: 'Playwright page response',
            statusCode: r.status(),
          },
        });
      })();
      pending.push(task);
    });
    const original = await page.goto(target, { waitUntil: 'load', timeout: scope.timeoutMs });
    if (!original) throw new Error('Document response unavailable.');
    await page.waitForTimeout(100);
    const snapshot = await page.evaluate(collectPage);
    const runtime = await page.evaluate(collectRuntimeTechnologies);
    if (runtime.timeOrigin === snapshot.timeOrigin && runtime.url === snapshot.url)
      snapshot.indicators.push(...runtime.technologies);
    else snapshot.limits.push('Runtime technology metadata document changed during collection.');
    snapshot.analysis = analyzeScripts(snapshot.inlineScripts || []);
    snapshot.secrets = await scanScriptSecrets(snapshot.inlineScripts || [], snapshot.url);
    await Promise.all(pending);
    const matched = requests.find(
      (r) => r.url === redactUrl(original.url()) && r.type === 'document'
    );
    const response: ResponseSnapshot = {
      url: original.url(),
      headers: matched?.headers || {},
      statusCode: original.status(),
      collectedAt: matched?.firstObserved || new Date().toISOString(),
      requestId: 'cli-document',
      startedAt: Date.now(),
      urlHash: await hashUrl(snapshot.url),
      redirects: [],
      provenance: {
        source: 'cli-request',
        collector: 'Headless browser document response',
        statusCode: original.status(),
      },
    };
    const metadata = (await context.cookies(snapshot.url)).map((c) =>
      cookieMetadata({
        ...c,
        sameSite: c.sameSite === 'None' ? 'no_restriction' : c.sameSite.toLowerCase(),
        session: c.expires === -1,
        expirationDate: c.expires === -1 ? undefined : c.expires,
        hostOnly: !c.domain.startsWith('.'),
      })
    );
    const a = assess({
      page: snapshot,
      response,
      cookies: {
        available: true,
        cookies: metadata,
        limitation:
          'New unauthenticated CLI browser session; only cookies matching the effective URL.',
      },
      browser: browser.version(),
      targetKey: await hashUrl(snapshot.url),
      profile: 'cli-browser',
      scope,
      permissions: ['Explicit CLI target navigation'],
      requestedUrl: target,
      requests,
      suppressions: policy?.exceptions || [],
    });
    a.durationMs = Math.round(performance.now() - started);
    if (navRequests > 100) a.limits.push('CLI document/resource request cap reached (100).');
    if (flag('advisories'))
      a.advisoryMatches = matchAdvisories(
        a.technologies,
        validateAdvisories(await json(flag('advisories')!))
      );
    const out = flag('out') || 'sitelens-output';
    await mkdir(out, { recursive: true });
    await Promise.all([
      writeFile(`${out}/assessment.json`, JSON.stringify(a, null, 2)),
      writeFile(`${out}/assessment.sarif`, JSON.stringify(sarif(a), null, 2)),
      writeFile(`${out}/assessment.xml`, junit(a)),
      writeFile(`${out}/assessment.html`, reportHtml(a)),
    ]);
    const result = policy ? evaluatePolicy(a, policy, baseline) : undefined;
    if (result) {
      await writeFile(`${out}/policy.json`, JSON.stringify(result, null, 2));
      if (!result.passed) process.exitCode = 2;
    }
    console.log(
      JSON.stringify(
        {
          assessmentId: a.id,
          checksCompleted: a.checksCompleted,
          checksTotal: a.checksTotal,
          output: out,
          policy: result || 'not configured',
        },
        null,
        2
      )
    );
  } finally {
    await browser.close();
  }
}
main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
