import { freshness, scopedText } from '@sitelens/assessment-engine/src/workspace.js';
import { validateBackup, validateReportOptions } from '@sitelens/assessment-engine/src/backup.js';
import { RequestBudget } from '@sitelens/rule-definitions/src/scope.js';
import {
  scanForSecrets,
  scanScriptSecrets,
  readSecretValues,
  analyzeScripts,
  inspectSourceMaps,
} from '@sitelens/evidence-engine';
import { defaultScope, inScope, validateScope } from '@sitelens/rule-definitions/src/scope.js';
import { validateSuppression } from '@sitelens/rule-definitions/src/governance.js';
import { collectPage } from './collector';
import { collectRuntimeTechnologies } from './technology-runtime';
import { detectBundleTechnologies } from '@sitelens/technology-detector/src/bundles.js';
import { assess } from '@sitelens/assessment-engine';
import { replayAssessment } from '@sitelens/assessment-engine/src/replay.js';
import { RULESET_VERSION } from '@sitelens/rule-definitions/src/governance.js';
import { CHECKS } from '@sitelens/rule-definitions';
import { ruleVersion } from '@sitelens/rule-definitions/src/governance.js';
import {
  cookieMetadata,
  hashUrl,
  httpUrl,
  originOf,
  redactHeader,
  redactUrl,
} from '@sitelens/rule-definitions/src/privacy.js';
import { inheritHistory, verificationResult } from './core/history';
import {
  deleteAssessment,
  getState,
  saveAssessment,
  setLifecycle,
  setSettings,
  transaction,
} from './repository';
import type { CookieCollection, ResponseSnapshot } from '@sitelens/shared-types';
const ALLOWED_HEADERS = new Set([
  'content-security-policy',
  'content-security-policy-report-only',
  'strict-transport-security',
  'x-content-type-options',
  'referrer-policy',
  'x-frame-options',
  'permissions-policy',
  'server',
  'x-powered-by',
  'cross-origin-opener-policy',
  'cross-origin-resource-policy',
  'cross-origin-embedder-policy',
  'access-control-allow-origin',
  'access-control-allow-credentials',
  'access-control-allow-methods',
  'access-control-allow-headers',
  'cache-control',
  'pragma',
  'vary',
  'content-type',
  'cf-ray',
  'via',
  'x-amz-cf-id',
  'x-served-by',
  'x-fastly-request-id',
  'x-vercel-id',
  'x-nf-request-id',
  'x-aspnet-version',
]);
interface Navigation {
  requestId: string;
  startedAt: number;
  response?: ResponseSnapshot;
  redirects: ResponseSnapshot['redirects'];
  documentId?: string;
}
const tabQueues = new Map<number, Promise<unknown>>();
function tabTask(id: number, fn: () => Promise<void>) {
  const task = (tabQueues.get(id) || Promise.resolve()).then(fn).catch(() => {});
  tabQueues.set(id, task);
  task.finally(() => {
    if (tabQueues.get(id) === task) tabQueues.delete(id);
  });
}
async function selected(url: string) {
  const { settings } = await getState();
  return (
    settings.observedOrigins.includes(originOf(url)) &&
    (!settings.scopes?.[originOf(url)] || inScope(url, settings.scopes[originOf(url)]))
  );
}
const key = (id: number) => `navigation_${id}`;
async function readNav(id: number): Promise<Navigation | undefined> {
  return (await chrome.storage.session.get(key(id)))[key(id)] as Navigation | undefined;
}
async function writeNav(id: number, nav: Navigation) {
  await chrome.storage.session.set({ [key(id)]: nav });
}
chrome.webRequest.onBeforeRequest.addListener(
  (d): chrome.webRequest.BlockingResponse | undefined => {
    if (d.tabId < 0 || d.type !== 'main_frame') return;
    tabTask(d.tabId, async () => {
      if (!(await selected(d.url))) {
        await chrome.storage.session.remove(key(d.tabId));
        return;
      }
      const old = await readNav(d.tabId);
      if (old?.requestId === d.requestId) return;
      await writeNav(d.tabId, { requestId: d.requestId, startedAt: d.timeStamp, redirects: [] });
    });
    return undefined;
  },
  { urls: ['http://*/*', 'https://*/*'], types: ['main_frame'] }
);
chrome.webRequest.onHeadersReceived.addListener(
  (d): chrome.webRequest.BlockingResponse | undefined => {
    if (d.tabId < 0) return;
    tabTask(d.tabId, async () => {
      if (!(await selected(d.url))) return;
      let nav = await readNav(d.tabId);
      if (!nav || nav.requestId !== d.requestId)
        nav = { requestId: d.requestId, startedAt: d.timeStamp, redirects: [] };
      const headers: Record<string, string[]> = {};
      for (const h of d.responseHeaders || [])
        if (ALLOWED_HEADERS.has(h.name.toLowerCase()))
          (headers[h.name.toLowerCase()] ??= []).push(redactHeader(h.value || ''));
      nav.response = {
        url: redactUrl(d.url),
        urlHash: await hashUrl(d.url),
        headers,
        statusCode: d.statusCode,
        collectedAt: new Date(d.timeStamp).toISOString(),
        requestId: d.requestId,
        startedAt: nav.startedAt,
        redirects: nav.redirects,
      };
      await writeNav(d.tabId, nav);
    });
    return undefined;
  },
  { urls: ['http://*/*', 'https://*/*'], types: ['main_frame'] },
  ['responseHeaders']
);
chrome.webRequest.onBeforeRedirect.addListener(
  (d): chrome.webRequest.BlockingResponse | undefined => {
    if (d.tabId < 0) return;
    tabTask(d.tabId, async () => {
      const nav = await readNav(d.tabId);
      if (!nav || nav.requestId !== d.requestId || !(await selected(d.url))) return;
      nav.redirects.push({
        url: redactUrl(d.url),
        destination: redactUrl(d.redirectUrl),
        statusCode: d.statusCode,
        collectedAt: new Date(d.timeStamp).toISOString(),
      });
      nav.redirects = nav.redirects.slice(-20);
      delete nav.response;
      await writeNav(d.tabId, nav);
    });
    return undefined;
  },
  { urls: ['http://*/*', 'https://*/*'], types: ['main_frame'] }
);
chrome.webNavigation.onCommitted.addListener(
  (d) => {
    if (d.frameId !== 0) return;
    tabTask(d.tabId, async () => {
      const nav = await readNav(d.tabId);
      if (
        !nav?.response ||
        nav.response.urlHash !== (await hashUrl(d.url)) ||
        d.timeStamp < nav.startedAt ||
        d.timeStamp - nav.startedAt > 120000
      ) {
        await chrome.storage.session.remove(key(d.tabId));
        return;
      }
      nav.documentId = d.documentId;
      nav.response.documentId = d.documentId;
      await writeNav(d.tabId, nav);
    });
  },
  { url: [{ schemes: ['http', 'https'] }] }
);
chrome.tabs.onRemoved.addListener((id) => {
  tabTask(id, async () => {
    await chrome.storage.session.remove(key(id));
  });
});
chrome.webRequest.onBeforeRequest.addListener(
  (d): chrome.webRequest.BlockingResponse | undefined => {
    if (d.tabId < 0 || d.type !== 'main_frame') return;
    tabTask(d.tabId, async () => {
      const nav = await readNav(d.tabId);
      if (!nav?.redirects.length) await chrome.storage.session.remove(`requests_${d.tabId}`);
    });
    return undefined;
  },
  { urls: ['http://*/*', 'https://*/*'], types: ['main_frame'] }
);
chrome.webRequest.onHeadersReceived.addListener(
  (d): chrome.webRequest.BlockingResponse | undefined => {
    if (d.tabId < 0 || d.type === 'main_frame') return;
    tabTask(d.tabId, async () => {
      const nav = await readNav(d.tabId);
      if (
        !nav?.documentId ||
        d.documentId !== nav.documentId ||
        !d.initiator ||
        !(await selected(d.initiator))
      )
        return;
      const state = await getState();
      const scope = state.settings.scopes?.[originOf(d.initiator)] || defaultScope(d.initiator);
      if (!inScope(d.url, scope, originOf(d.url) !== originOf(d.initiator))) return;
      const headers: Record<string, string[]> = {};
      for (const h of d.responseHeaders || [])
        if (ALLOWED_HEADERS.has(h.name.toLowerCase()))
          (headers[h.name.toLowerCase()] ??= []).push(redactHeader(h.value || ''));
      const storageKey = `requests_${d.tabId}`;
      const requests =
        ((await chrome.storage.session.get(storageKey))[
          storageKey
        ] as import('@sitelens/shared-types').RequestObservation[]) || [];
      requests.push({
        url: redactUrl(d.url),
        method: d.method,
        type: d.type,
        statusCode: d.statusCode,
        contentType: headers['content-type']?.[0],
        headers,
        initiator: redactUrl(d.initiator),
        authentication: 'unknown',
        firstObserved: new Date(d.timeStamp).toISOString(),
        provenance: {
          source: 'intercepted-request',
          collector: 'chrome.webRequest',
          requestId: d.requestId,
          documentId: d.documentId,
          statusCode: d.statusCode,
          limitation: 'Credential presence and values were not inspected.',
        },
      });
      await chrome.storage.session.set({ [storageKey]: requests.slice(-200) });
    });
    return undefined;
  },
  { urls: ['http://*/*', 'https://*/*', 'ws://*/*', 'wss://*/*'] },
  ['responseHeaders']
);
async function collectCookies(
  tabId: number,
  url: string,
  documentId: string
): Promise<CookieCollection> {
  if (
    !(await chrome.permissions.contains({
      permissions: ['cookies'],
      origins: [`${originOf(url)}/*`],
    }))
  )
    return {
      available: false,
      cookies: [],
      limitation:
        'Cookie permission or site access unavailable. Enable cookie inspection in the extension popup.',
    };
  try {
    const stores = await chrome.cookies.getAllCookieStores();
    const storeId = stores.find((s) => s.tabIds.includes(tabId))?.id;
    if (!storeId) throw new Error('Cookie store not available.');
    const unpartitioned = await chrome.cookies.getAll({ url, storeId });
    const partition = await chrome.cookies.getPartitionKey({ tabId, frameId: 0, documentId });
    const partitioned = await chrome.cookies.getAll({
      url,
      storeId,
      partitionKey: partition.partitionKey,
    });
    const unique = new Map(
      [...unpartitioned, ...partitioned].map((c) => [
        JSON.stringify([c.name, c.domain, c.path, c.partitionKey]),
        cookieMetadata(c),
      ])
    );
    return {
      available: true,
      cookies: [...unique.values()].slice(0, 200),
      limitation: `Only cookies matching the inspected document URL in its cookie store were queried, including the current partition. Other paths and third-party iframe cookies are not assessed.${unique.size > 200 ? ' Collection capped at 200 cookies.' : ''}`,
    };
  } catch {
    return {
      available: false,
      cookies: [],
      limitation:
        'Cookie collection could not be completed. The page may have navigated or cookie access may be restricted.',
    };
  }
}
const inspectionLocks = new Set<number>();
async function inspect(
  tabId: number,
  baselineId?: string,
  checkId?: string,
  includeCookies?: boolean
) {
  if (!Number.isInteger(tabId) || tabId < 0)
    throw new Error(
      'No original website tab is available. Open the website and inspect it from the popup.'
    );
  if (inspectionLocks.has(tabId)) throw new Error('This tab is already being inspected.');
  inspectionLocks.add(tabId);
  try {
    const started = performance.now();
    const tab = await chrome.tabs.get(tabId);
    if (!httpUrl(tab.url || '')) throw new Error('Open an HTTP or HTTPS page first.');
    if (tab.incognito) throw new Error('Private browsing inspection is disabled.');
    if (typeof includeCookies === 'boolean')
      await setSettings({ cookieInspection: includeCookies });
    const configured = await getState();
    const allowedScope = configured.settings.scopes?.[originOf(tab.url!)] || defaultScope(tab.url!);
    if (!inScope(tab.url!, allowedScope))
      throw new Error('This document is outside the configured scope or in an excluded path.');
    const initial = await chrome.webNavigation.getFrame({ tabId, frameId: 0 });
    if (!initial?.documentId) throw new Error('Wait for the page to finish loading.');
    const results = await chrome.scripting.executeScript({
      target: { tabId, documentIds: [initial.documentId] },
      func: collectPage,
    });
    const page = results[0]?.result;
    if (!page) throw new Error('Page collection failed.');
    try {
      const result = await chrome.scripting.executeScript({
        target: { tabId, documentIds: [initial.documentId] },
        world: 'MAIN',
        func: collectRuntimeTechnologies,
      });
      const runtime = result[0]?.result;
      if (
        runtime &&
        Math.abs(runtime.timeOrigin - page.timeOrigin) < 1000 &&
        (await hashUrl(runtime.url)) === (await hashUrl(page.url))
      )
        page.indicators.push(...runtime.technologies);
      else
        page.limits.push(
          'Runtime technology metadata could not be matched to the collected document.'
        );
    } catch {
      page.limits.push('Runtime technology data properties could not be assessed.');
    }
    page.analysis = analyzeScripts(page.inlineScripts || []);
    page.secrets = await scanScriptSecrets(page.inlineScripts || [], page.url);
    const targetKey = await hashUrl(page.url);
    const state = await getState();
    const baseline = baselineId ? state.assessments.find((a) => a.id === baselineId) : undefined;
    const scope = state.settings.scopes?.[originOf(page.url)] || defaultScope(page.url);
    if (!inScope(page.url, scope))
      throw new Error('This document is outside the configured scope or in an excluded path.');
    if (checkId && (!baseline || baseline.targetKey !== targetKey))
      throw new Error(
        'The website URL changed or its baseline was deleted. Inspect the current target again.'
      );
    await tabQueues.get(tabId);
    const nav = await readNav(tabId);
    const response =
      nav?.documentId === initial.documentId && nav.response?.urlHash === targetKey
        ? nav.response
        : null;
    const cookies =
      configured.settings.cookieInspection !== false &&
      (!checkId || checkId.startsWith('SL-COOKIE'))
        ? await collectCookies(tabId, page.url, initial.documentId)
        : {
            available: false,
            cookies: [],
            limitation: 'Cookie collection not required for this selected check.',
          };
    const finalFrame = await chrome.webNavigation.getFrame({ tabId, frameId: 0 });
    if (finalFrame?.documentId !== initial.documentId)
      throw new Error('The website navigated during inspection. Try again.');
    const permission = await chrome.permissions.getAll();
    const requests = (await chrome.storage.session.get(`requests_${tabId}`))[
      `requests_${tabId}`
    ] as import('@sitelens/shared-types').RequestObservation[] | undefined;
    let assessment = inheritHistory(
      assess(
        {
          page,
          response,
          cookies,
          browser: navigator.userAgent
            .replace(/\([^)]*\)/g, '')
            .trim()
            .slice(0, 128),
          targetKey,
          scope,
          permissions: [...(permission.permissions || []), ...(permission.origins || [])],
          profile: 'extension-passive',
          suppressions: state.settings.suppressions || [],
          requests: requests || [],
          projectId: state.settings.projectId,
          environment: state.settings.environment,
        },
        checkId
      ),
      state.assessments,
      state.events
    );
    assessment.durationMs = Math.round(performance.now() - started);
    if (baseline) assessment.baselineId = baseline.id;
    const verification = baseline ? verificationResult(baseline, assessment) : undefined;
    if (verification?.verified) assessment.findings[0].lifecycle = 'verified';
    else if (checkId && assessment.findings[0].lifecycle === 'verified')
      assessment.findings[0].lifecycle = 'needs verification';
    await saveAssessment(assessment);
    const bindingKey = 'binding_' + assessment.id;
    const bindingValue = { tabId, documentId: initial.documentId };
    await chrome.storage.session.set({ [bindingKey]: bindingValue });
    // Also persist to local so it survives extension reloads (session storage is wiped on reload)
    await chrome.storage.local.set({ [bindingKey]: bindingValue });
    if (verification && checkId)
      await setLifecycle(
        assessment.id,
        checkId,
        verification.verified ? 'verified' : 'needs verification',
        verification.reason
      );
    return { id: assessment.id, verification };
  } finally {
    inspectionLocks.delete(tabId);
  }
}
chrome.runtime.onMessage.addListener((message, sender, reply) => {
  if (sender.id !== chrome.runtime.id || !sender.url?.startsWith(chrome.runtime.getURL(''))) return;
  (async () => {
    switch (message.type) {
      case 'inspect':
        return inspect(
          message.tabId,
          undefined,
          undefined,
          typeof message.includeCookies === 'boolean' ? message.includeCookies : undefined
        );
      case 'verify': {
        const binding = (await chrome.storage.session.get('binding_' + message.assessmentId))[
          'binding_' + message.assessmentId
        ] as { tabId: number } | undefined;
        return inspect(binding?.tabId ?? -1, message.assessmentId, message.checkId);
      }
      case 'reinspect': {
        const bKey = 'binding_' + message.assessmentId;
        let bnd = (await chrome.storage.session.get(bKey))[bKey] as { tabId: number } | undefined;
        if (!bnd) bnd = (await chrome.storage.local.get(bKey))[bKey] as { tabId: number } | undefined;
        return inspect(bnd?.tabId ?? -1);
      }
      case 'freshness': {
        const state = await getState();
        const a = state.assessments.find((a) => a.id === message.assessmentId);
        if (!a) throw new Error('Assessment unavailable.');
        // Try session binding first, then local storage fallback
        const bindingKey = 'binding_' + a.id;
        let binding = (await chrome.storage.session.get(bindingKey))[bindingKey] as
          { tabId: number; documentId: string } | undefined;
        if (!binding) {
          binding = (await chrome.storage.local.get(bindingKey))[bindingKey] as
            { tabId: number; documentId: string } | undefined;
          if (binding) await chrome.storage.session.set({ [bindingKey]: binding });
        }
        let documentId: string | undefined, target: string | undefined;
        // If no stored binding, try to find a matching open tab by URL
        if (!binding) {
          try {
            const tabs = await chrome.tabs.query({});
            for (const tab of tabs) {
              if (!tab.url || !tab.id) continue;
              try {
                const tabHash = await hashUrl(tab.url);
                if (tabHash === a.targetKey) {
                  target = tabHash;
                  try {
                    const frame = await chrome.webNavigation.getFrame({ tabId: tab.id, frameId: 0 });
                    documentId = frame?.documentId;
                    // Restore binding for future calls
                    if (documentId) {
                      const restored = { tabId: tab.id, documentId };
                      await chrome.storage.session.set({ [bindingKey]: restored });
                      await chrome.storage.local.set({ [bindingKey]: restored });
                    }
                  } catch {}
                  break;
                }
              } catch {}
            }
          } catch {}
        } else {
          try {
            const tab = await chrome.tabs.get(binding.tabId);
            try { target = await hashUrl(tab.url || ''); } catch {}
            try {
              documentId = (await chrome.webNavigation.getFrame({ tabId: binding.tabId, frameId: 0 }))?.documentId;
            } catch {}
          } catch {}
        }
        return {
          status: a.importedAt ? 'older assessment' : freshness(a, binding || (target ? { tabId: -1, documentId: documentId || '' } : undefined), documentId, target),
          collectedAt: a.evidence.find((e) => e.type === 'document')?.collectedAt || a.createdAt,
        };
      }
      case 'storage-usage': {
        return {
          bytes: await chrome.storage.local.getBytesInUse(),
          quota: chrome.storage.local.QUOTA_BYTES,
        };
      }
      case 'bundles': {
        const state = await getState(),
          a = state.assessments.find((a) => a.id === message.assessmentId);
        if (!a || a.kind !== 'full') throw new Error('Choose a full assessment.');
        const scope = state.settings.scopes?.[a.origin];
        if (!scope || scope.mode !== 'supplemental' || !scope.authorized)
          throw new Error('Save an authorized supplemental scope first.');
        const urls = message.urls as string[];
        if (
          !Array.isArray(urls) ||
          !urls.length ||
          urls.length > 10 ||
          urls.some(
            (u) =>
              typeof u !== 'string' ||
              !a.resources.some((r) => r.url === u && r.type === 'script') ||
              u.includes('?REDACTED') ||
              !inScope(u, scope, originOf(u) !== a.origin)
          )
        )
          throw new Error(
            'Select 1–10 recorded script URLs within scope. Redacted query URLs need a new inspectable reference.'
          );
        for (const u of urls)
          if (!(await chrome.permissions.contains({ origins: [originOf(u) + '/*'] })))
            throw new Error('Grant access to the selected script origin first.');
        const budgetKey = 'bundle-budget_' + a.id;
        await transaction(async () => {
          if ((await chrome.storage.session.get(budgetKey))[budgetKey])
            throw new Error(
              'Bundle budget already used for this assessment. Start a new assessment before another batch.'
            );
          await chrome.storage.session.set({ [budgetKey]: true });
        });
        const budget = new RequestBudget(scope),
          copy = structuredClone(a),
          records: { url: string; status: string; bytes?: number; error?: string }[] = [];
        for (const url of [...new Set(urls)]) {
          try {
            const body = await scopedText(
              url,
              scope,
              budget,
              async (target, init) => {
                if (
                  !(await chrome.permissions.contains({
                    origins: [originOf(String(target)) + '/*'],
                  }))
                )
                  throw new Error('Bundle destination permission is not granted.');
                return fetch(target, init);
              },
              a.origin
            );
            const secrets = await scanScriptSecrets([{ id: body.url, code: body.text }], body.url),
              analysis = analyzeScripts([{ id: body.url, code: body.text }]);
            copy.technologies.push(...detectBundleTechnologies(body.text, body.url));
            const ev = copy.evidence.find((e) => e.label === 'Redacted configuration patterns');
            if (ev && Array.isArray(ev.data)) ev.data.push(...secrets);
            const ast = copy.evidence.find((e) => e.label === 'Client-side AST observations');
            if (ast) {
              if (!ast.data) ast.data = analyzeScripts([]);
              const current = ast.data as import('@sitelens/shared-types').ScriptAnalysis;
              for (const k of ['apis', 'sources', 'flows', 'handlers'] as const)
                (current[k] as unknown[]).push(...analysis[k]);
              current.parsed += analysis.parsed;
              current.failed += analysis.failed;
              current.limitation =
                'Static analysis of captured inline scripts and explicitly selected bundles. Unvisited code, dynamic behavior and runtime exploitability are not established.';
            }
            records.push({ url: body.url, status: 'inspected', bytes: body.bytes });
          } catch (error) {
            records.push({
              url: redactUrl(url),
              status: 'failed',
              error: (error as Error).message,
            });
          }
        }
        const result = replayAssessment(copy, state.settings);
        result.reproducibility = undefined;
        result.supplemental = {
          sourceAssessmentId: a.id,
          collectedAt: new Date().toISOString(),
          urls: records.filter((r) => r.status === 'inspected').map((r) => r.url),
        };
        result.baselineId = a.id;
        result.profile = 'extension-supplemental';
        result.coverage.push({
          area: 'Selected external bundles',
          status: 'partial',
          detail: `${records.filter((r) => r.status === 'inspected').length} of ${records.length} selected bundles read. Unselected scripts and runtime behavior remain unassessed.`,
        });
        result.limits = result.limits.filter((s) => !s.startsWith('Re-evaluation'));
        result.limits.push(
          'Selected external bundles requested explicitly; raw source and full credential values omitted.'
        );
        result.evidence.push({
          id: 'EV-BUNDLE',
          type: 'resource',
          label: 'Selected bundle inspection',
          source: a.url,
          data: records,
          collectedAt: result.supplemental.collectedAt,
          redacted: true,
          provenance: { source: 'extension-request', collector: 'Scoped bundle reader' },
        });
        for (const e of result.evidence.filter((e) =>
          [
            'Redacted configuration patterns',
            'Client-side AST observations',
            'Technology indicators',
          ].includes(e.label)
        )) {
          e.collectedAt = result.supplemental.collectedAt;
          e.provenance = {
            source: 'inference',
            collector: 'DOM and scoped bundle static analysis',
            limitation:
              'Combined observations; script locations identify the source. External source was read by extension requests.',
          };
        }
        await saveAssessment(result);
        return { id: result.id, records };
      }
      case 'state':
        return getState();
      case 'secret-values': {
        const state = await getState();
        const assessment = state.assessments.find((a) => a.id === message.assessmentId);
        const binding = (await chrome.storage.session.get('binding_' + message.assessmentId))[
          'binding_' + message.assessmentId
        ] as { tabId: number; documentId: string } | undefined;
        if (!assessment || !binding)
          throw new Error(
            'Full values were not saved. Inspect the original website again to display live values.'
          );
        const tab = await chrome.tabs.get(binding.tabId);
        if (tab.incognito || !httpUrl(tab.url || ''))
          throw new Error('The original website is unavailable.');
        const scope = state.settings.scopes?.[assessment.origin] || defaultScope(assessment.url);
        if (!inScope(tab.url!, scope))
          throw new Error('The original website is outside the configured scope.');
        if ((await hashUrl(tab.url!)) !== assessment.targetKey)
          throw new Error('The website URL changed. Inspect it again to display current values.');
        const frame = await chrome.webNavigation.getFrame({ tabId: binding.tabId, frameId: 0 });
        if (frame?.documentId !== binding.documentId)
          throw new Error(
            'The original document was reloaded. Inspect it again to display current values.'
          );
        const result = await chrome.scripting.executeScript({
          target: { tabId: binding.tabId, documentIds: [binding.documentId] },
          func: collectPage,
        });
        const snapshot = result[0]?.result;
        if (
          !snapshot ||
          (await hashUrl(snapshot.url)) !== assessment.targetKey ||
          (await chrome.webNavigation.getFrame({ tabId: binding.tabId, frameId: 0 }))
            ?.documentId !== binding.documentId
        )
          throw new Error('The website navigated during collection. Inspect it again.');
        const saved = assessment.evidence.find((e) => e.label === 'Redacted configuration patterns')
          ?.data as import('@sitelens/shared-types').SecretFinding[] | undefined;
        const values = await readSecretValues(
          (snapshot.inlineScripts || []).map((s) => s.code).join('\n')
        );
        return {
          values: values.filter((v) =>
            saved?.some(
              (s) => s.key === v.key.slice(0, 100) && s.valueFingerprint === v.valueFingerprint
            )
          ),
        };
      }
      case 'reevaluate': {
        const state = await getState();
        const a = state.assessments.find((a) => a.id === message.assessmentId);
        if (!a || a.kind !== 'full')
          throw new Error('Choose a full assessment with retained evidence.');
        const result = replayAssessment(a, state.settings);
        await saveAssessment(result);
        return { id: result.id };
      }
      case 'source-maps': {
        const data = await getState();
        const a = data.assessments.find((a) => a.id === message.assessmentId);
        if (!a) throw new Error('Assessment not available.');
        const scope = data.settings.scopes?.[a.origin];
        if (!scope || scope.mode !== 'supplemental' || !scope.authorized)
          throw new Error(
            'Configure and authorize supplemental scope before inspecting source maps.'
          );
        const budgetKey = 'supplement_' + a.id;
        return transaction(async () => {
          if ((await chrome.storage.session.get(budgetKey))[budgetKey])
            throw new Error(
              'Supplemental map inspection already attempted for this assessment. Create a new assessment to establish a new request budget.'
            );
          await chrome.storage.session.set({ [budgetKey]: true });
          const supplemental = structuredClone(a);
          supplemental.id = crypto.randomUUID();
          supplemental.createdAt = new Date().toISOString();
          supplemental.baselineId = a.id;
          supplemental.profile = 'extension-supplemental';
          const evidence = supplemental.evidence.find((e) => e.label === 'Source map observations');
          const urls = Array.isArray(evidence?.data)
            ? (evidence.data as unknown[]).filter((v): v is string => typeof v === 'string')
            : [];
          const maps = await inspectSourceMaps(urls, scope);
          if (evidence) {
            evidence.data = maps;
            evidence.provenance = {
              source: 'extension-request',
              collector: 'Authorized bounded source-map inspection',
            };
          }
          if (evidence) evidence.collectedAt = supplemental.createdAt;
          supplemental.coverage.push({
            area: 'Source map contents',
            status: 'partial',
            detail:
              'Explicitly authorized bounded requests; source paths and redacted credential patterns only.',
          });
          await chrome.storage.local.set({
            records: [supplemental, ...data.assessments].slice(0, data.settings.retention),
          });
          return { maps, id: supplemental.id };
        });
      }
      case 'observe': {
        if (!httpUrl(message.origin)) throw new Error('Invalid origin.');
        const origin = originOf(message.origin);
        if (!(await chrome.permissions.contains({ origins: [`${origin}/*`] })))
          throw new Error('Site access was not granted.');
        const state = await getState();
        return setSettings({
          observedOrigins: [...new Set([...state.settings.observedOrigins, origin])],
        });
      }
      case 'settings':
        return setSettings({
          learningMode: !!message.learningMode,
          retention: Number.isFinite(Number(message.retention)) ? Number(message.retention) : 50,
        });
      case 'lifecycle':
        return setLifecycle(
          message.assessmentId,
          message.checkId,
          message.state,
          String(message.note || ''),
          {
            actor: message.actor,
            owner: message.owner,
            expiresAt: message.expiresAt,
            reviewRequired: message.reviewRequired,
          }
        );
      case 'delete':
        await deleteAssessment(message.id);
        return { ok: true };
      case 'import': {
        if (JSON.stringify(message.data || message.assessment).length > 10000000)
          throw new Error('Backup exceeds 10 MB.');
        const imported = validateBackup(message.data || message.assessment);
        return transaction(async () => {
          const state = await getState();
          const seen = [...state.assessments];
          const added = imported.assessments.filter((a) => {
            if (
              seen.some(
                (old) =>
                  old.id === a.id ||
                  (old.originalId === a.originalId &&
                    old.targetKey === a.targetKey &&
                    old.createdAt === a.createdAt)
              )
            )
              return false;
            seen.push(a);
            return true;
          });
          if (state.assessments.length + added.length > 200)
            throw new Error('Restore would exceed 200 records. Delete unneeded records first.');
          const ids = new Set(added.map((a) => a.id));
          await chrome.storage.local.set({
            records: [...added, ...state.assessments].sort(
              (a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt)
            ),
            events: [
              ...state.events,
              ...imported.events.filter((e) => ids.has(e.assessmentId)),
            ].slice(-2000),
            settings: {
              ...state.settings,
              retention: Math.max(
                state.settings.retention,
                state.assessments.length + added.length
              ),
            },
          });
          return { added: added.length, skipped: imported.assessments.length - added.length };
        });
      }
      case 'report-options':
        return setSettings({ reportOptions: validateReportOptions(message.options) });
      case 'scope': {
        const scope = validateScope(message.scope);
        return setSettings({
          scopes: { ...(await getState()).settings.scopes, [message.origin]: scope },
        });
      }
      case 'suppression': {
        const suppression = validateSuppression(message.suppression);
        return setSettings({
          suppressions: [
            ...((await getState()).settings.suppressions || []).filter(
              (s) => s.id !== suppression.id
            ),
            suppression,
          ],
        });
      }
      case 'remove-suppression':
        return setSettings({
          suppressions: ((await getState()).settings.suppressions || []).filter(
            (s) => s.id !== message.id
          ),
        });
      case 'project': {
        const project = message.project;
        if (
          !project?.name ||
          !Array.isArray(project.environments) ||
          project.environments.length > 20 ||
          project.environments.some(
            (e: { name: string; origins: string[] }) =>
              !e.name ||
              !Array.isArray(e.origins) ||
              e.origins.length > 50 ||
              e.origins.some((o) => !httpUrl(o) || originOf(o) !== o)
          )
        )
          throw new Error('Project name and environments required.');
        return setSettings({
          projects: [
            ...((await getState()).settings.projects || []).filter((p) => p.id !== project.id),
            {
              id: project.id || crypto.randomUUID(),
              name: String(project.name).slice(0, 128),
              environments: project.environments,
            },
          ],
          projectId: project.id,
          environment: String(message.environment || ''),
        });
      }
      case 'clear':
        await transaction(async () => {
          await chrome.storage.local.remove(['records', 'events', 'assessments']);
          await chrome.storage.session.clear();
        });
        return { ok: true };
      case 'revoke': {
        const origin = originOf(message.origin);
        await chrome.permissions.remove({ origins: [`${origin}/*`] });
        const state = await getState();
        return setSettings({
          observedOrigins: state.settings.observedOrigins.filter((o) => o !== origin),
        });
      }
      default:
        throw new Error('Unknown operation.');
    }
  })()
    .then(reply)
    .catch((error) =>
      reply({ error: error instanceof Error ? error.message : 'Operation failed.' })
    );
  return true;
});
chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason !== 'update') return;
  void (async () => {
    const state = await getState();
    const targets = new Set<string>();
    for (const a of state.assessments) {
      if (a.kind !== 'full' || targets.has(a.targetKey)) continue;
      targets.add(a.targetKey);
      if (
        a.ruleSetVersion !== RULESET_VERSION ||
        CHECKS.some((c) => a.ruleVersions?.[c.id] !== ruleVersion(c))
      ) {
        try {
          await saveAssessment(replayAssessment(a, state.settings));
        } catch {
          /* Unsupported legacy records remain available for review. */
        }
      }
    }
  })().catch(() => {});
});

