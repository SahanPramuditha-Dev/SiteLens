import { useEffect, useState } from 'react';
import type { Assessment, ReportOptions } from '@sitelens/shared-types';
import {
  cspDraft,
  domainMap,
  FIX_RECIPES,
  recipeReference,
} from '@sitelens/assessment-engine/src/workspace.js';
const call = async (data: Record<string, unknown>) => {
  const result = await chrome.runtime.sendMessage(data);
  if (result?.error) throw new Error(result.error);
  return result;
};
const download = (name: string, value: unknown) => {
  const url = URL.createObjectURL(
    new Blob([JSON.stringify(value, null, 2)], { type: 'application/json' })
  );
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};
export function DeveloperTools({ assessment }: { assessment: Assessment }) {
  const [tab, setTab] = useState('recipes'),
    [notice, setNotice] = useState(''),
    [urls, setUrls] = useState<string[]>([]),
    [usage, setUsage] = useState({ bytes: 0, quota: 0 }),
    [options, setOptions] = useState<ReportOptions>({}),
    [policy, setPolicy] = useState(cspDraft(assessment).policy),
    [recipe, setRecipe] = useState('SL-HEADER-002');
  const draft = cspDraft(assessment),
    domains = domainMap(assessment),
    scripts = [
      ...new Set(assessment.resources.filter((r) => r.type === 'script').map((r) => r.url)),
    ];
  useEffect(() => {
    call({ type: 'state' })
      .then((s) => setOptions(s.settings.reportOptions || {}))
      .catch((e) => setNotice(e.message));
    call({ type: 'storage-usage' })
      .then(setUsage)
      .catch((e) => setNotice(e.message));
  }, [assessment.id]);
  const run = async (action: () => Promise<void>) => {
    setNotice('Working…');
    try {
      await action();
    } catch (e) {
      setNotice((e as Error).message);
    }
  };
  const input = 'border border-slate-200 rounded p-2 w-full';
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap gap-2">
        {[
          ['recipes', 'Fix recipes'],
          ['domains', 'Third-party map'],
          ['bundles', 'Bundle inspection'],
          ['backup', 'Backup & restore'],
          ['report', 'Report customization'],
          ['csp', 'CSP rollout assistant'],
        ].map(([id, label]) => (
          <button
            className={
              'border border-slate-200 rounded-lg px-4 py-2 text-sm ' +
              (tab === id
                ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                : 'bg-white text-slate-600')
            }
            key={id}
            onClick={() => setTab(id)}
          >
            {label}
          </button>
        ))}
      </div>
      {notice && (
        <p role="status" className="p-4 bg-slate-100 rounded">
          {notice}
        </p>
      )}
      {tab === 'recipes' && (
        <section className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
          <h3 className="font-bold">Developer fix recipes</h3>
          <select className={input} value={recipe} onChange={(e) => setRecipe(e.target.value)}>
            {Object.entries(FIX_RECIPES).map(([id, r]) => (
              <option key={id} value={id}>
                {id} · {r.title}
              </option>
            ))}
          </select>
          <p>{FIX_RECIPES[recipe].context}</p>
          {FIX_RECIPES[recipe].examples.map((e) => (
            <details key={e.platform}>
              <summary className="cursor-pointer font-semibold">{e.platform}</summary>
              <pre className="whitespace-pre-wrap break-all bg-slate-50 p-4 text-xs">{e.code}</pre>
              <a
                className="text-sm text-emerald-700 underline"
                href={recipeReference(e.platform)}
                target="_blank"
                rel="noreferrer"
              >
                Official configuration documentation
              </a>
            </details>
          ))}
          <p className="text-sm text-slate-500">
            Review examples for your deployment, apply the change, reload the original site, then
            verify the check. Report-only CSP does not establish an enforcing CSP. Nginx header
            inheritance depends on configuration context. Netlify static headers do not apply to
            function or proxied responses; set those headers in the responding service.
          </p>
          <button
            className="border rounded p-2"
            onClick={() =>
              run(async () => {
                const r = await call({
                  type: 'verify',
                  assessmentId: assessment.id,
                  checkId: recipe,
                });
                location.href = 'index.html?id=' + r.id;
              })
            }
          >
            Verify selected fix
          </button>
        </section>
      )}
      {tab === 'domains' && (
        <section className="space-y-4">
          <div className="bg-white border border-slate-200 rounded-xl p-6">
            <h3 className="font-bold">Observed relationship map</h3>
            <p className="text-sm text-slate-500">
              {assessment.origin} → resources, frames and observed API endpoints. Collection
              coverage is incomplete; presence does not imply trust.
            </p>
          </div>
          {domains.map((d) => (
            <details
              className="bg-white border border-slate-200 rounded-xl p-5"
              key={d.domain}
              open
            >
              <summary className="font-semibold cursor-pointer">
                {d.domain} · {d.thirdParty ? 'Third party' : 'Same host'} · {d.items.length}{' '}
                relationships
              </summary>
              {d.items.map((r, i) => (
                <div className="text-sm border-t py-2 mt-2 break-all" key={i}>
                  ↳ {r.type} · {r.url}
                  <p className="text-xs text-slate-500">Loaded / observed from: {r.source}</p>
                </div>
              ))}
            </details>
          ))}
        </section>
      )}
      {tab === 'bundles' && (
        <section className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
          <h3 className="font-bold">Selective external JavaScript inspection</h3>
          <p className="text-sm text-slate-500">
            Select up to ten recorded script URLs. Save an authorized supplemental scope under
            Scope, projects & exceptions first. Each response and redirect consumes the shared batch
            budget. No credentials, raw source or full values are stored. One batch per assessment.
          </p>
          {scripts.map((url) => (
            <label className="flex gap-2 break-all text-sm" key={url}>
              <input
                type="checkbox"
                disabled={url.includes('?REDACTED')}
                checked={urls.includes(url)}
                onChange={(e) =>
                  setUrls(e.target.checked ? [...urls, url] : urls.filter((u) => u !== url))
                }
              />
              {url}
              {url.includes('?REDACTED') ? ' (query redacted; not fetchable)' : ''}
            </label>
          ))}
          {!scripts.length && <p>No script URLs were retained.</p>}
          <button
            className="bg-emerald-700 text-white rounded p-2"
            disabled={!urls.length}
            onClick={() =>
              run(async () => {
                const origins = [...new Set(urls.map((u) => new URL(u).origin + '/*'))];
                if (!(await chrome.permissions.request({ origins })))
                  throw new Error('Selected site access was declined.');
                const r = await call({ type: 'bundles', assessmentId: assessment.id, urls });
                location.href = 'index.html?id=' + r.id;
              })
            }
          >
            Inspect selected bundles
          </button>
        </section>
      )}
      {tab === 'backup' && (
        <section className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
          <h3 className="font-bold">Local backup and validated restore</h3>
          <p>
            {Math.round(usage.bytes / 1024)} KiB used of {Math.round(usage.quota / 1024)} KiB quota.
          </p>
          <p className="text-sm text-slate-500">
            Backups contain redacted assessments and lifecycle events. Import validates structure
            and references, migrates compatible schema 1 records, and skips duplicates. Permissions
            and live values are not restored.
          </p>
          <button
            className="border rounded p-2"
            onClick={() =>
              run(async () => {
                const s = await call({ type: 'state' });
                download('sitelens-backup.json', {
                  backupVersion: 1,
                  createdAt: new Date().toISOString(),
                  assessments: s.assessments,
                  events: s.events,
                });
                setNotice('Backup downloaded.');
              })
            }
          >
            Download backup
          </button>
          <label className="block">
            Restore backup or assessment JSON
            <input
              className={input}
              type="file"
              accept="application/json,.json"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                run(async () => {
                  if (file.size > 10000000) throw new Error('Backup exceeds 10 MB.');
                  const r = await call({ type: 'import', data: JSON.parse(await file.text()) });
                  setNotice(
                    `Restored ${r.added} records; skipped ${r.skipped} duplicates. Open History to choose a restored assessment.`
                  );
                });
              }}
            />
          </label>
        </section>
      )}
      {tab === 'report' && (
        <form
          className="bg-white border border-slate-200 rounded-xl p-6 space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            run(async () => {
              await call({ type: 'report-options', options });
              setNotice('Report preferences saved.');
            });
          }}
        >
          <h3 className="font-bold">Report customization</h3>
          {(['assessor', 'organization', 'project'] as const).map((k) => (
            <label key={k} className="block capitalize">
              {k}
              <input
                className={input}
                maxLength={128}
                value={options[k] || ''}
                onChange={(e) => setOptions({ ...options, [k]: e.target.value })}
              />
            </label>
          ))}
          <label className="block">
            Audience
            <select
              className={input}
              value={options.audience || 'complete'}
              onChange={(e) =>
                setOptions({ ...options, audience: e.target.value as ReportOptions['audience'] })
              }
            >
              <option value="complete">Complete assessment</option>
              <option value="executive">
                Executive: summary, scope, coverage, recommendations
              </option>
              <option value="developer">Developer: technical findings and evidence</option>
            </select>
          </label>
          <label className="block">
            Project logo (PNG/JPEG, max 200 KB)
            <input
              className={input}
              type="file"
              accept="image/png,image/jpeg"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                run(async () => {
                  if (file.size > 200000 || !['image/png', 'image/jpeg'].includes(file.type))
                    throw new Error('Choose a PNG/JPEG under 200 KB.');
                  const value = await new Promise<string>((resolve, reject) => {
                    const reader = new FileReader();
                    reader.onload = () => resolve(String(reader.result));
                    reader.onerror = reject;
                    reader.readAsDataURL(file);
                  });
                  setOptions({ ...options, customLogo: value });
                  setNotice('Logo ready; save report preferences.');
                });
              }}
            />
          </label>
          <button
            type="button"
            className="border rounded p-2"
            onClick={() => setOptions({ ...options, customLogo: undefined })}
          >
            Use SiteLens logo
          </button>
          <details>
            <summary className="cursor-pointer">
              Select included findings (
              {options.selectedCheckIds?.length ?? assessment.findings.length})
            </summary>
            <label className="block">
              <input
                type="checkbox"
                checked={!options.selectedCheckIds}
                onChange={(e) =>
                  setOptions({ ...options, selectedCheckIds: e.target.checked ? undefined : [] })
                }
              />{' '}
              All findings
            </label>
            {assessment.findings.map((f) => (
              <label className="block text-sm" key={f.id}>
                <input
                  type="checkbox"
                  checked={
                    !options.selectedCheckIds || options.selectedCheckIds.includes(f.checkId)
                  }
                  onChange={(e) => {
                    const ids =
                      options.selectedCheckIds || assessment.findings.map((f) => f.checkId);
                    setOptions({
                      ...options,
                      selectedCheckIds: e.target.checked
                        ? [...new Set([...ids, f.checkId])]
                        : ids.filter((id) => id !== f.checkId),
                    });
                  }}
                />{' '}
                {f.checkId} · {f.title}
              </label>
            ))}
          </details>
          <button className="bg-emerald-700 text-white rounded p-2">Save report preferences</button>
          <button
            type="button"
            className="border rounded p-2 ml-2"
            onClick={() =>
              chrome.tabs.create({ url: chrome.runtime.getURL('report.html?id=' + assessment.id) })
            }
          >
            Open report
          </button>
        </form>
      )}
      {tab === 'csp' && (
        <section className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
          <h3 className="font-bold">CSP rollout assistant</h3>
          <p>
            Draft header: <code>{draft.header}</code>
          </p>
          <textarea
            className={input + ' font-mono text-xs h-40'}
            value={policy}
            onChange={(e) => setPolicy(e.target.value)}
          />
          <button
            className="border rounded p-2"
            onClick={() => {
              navigator.clipboard
                .writeText(draft.header + ': ' + policy)
                .then(() => setNotice('Draft header copied.'))
                .catch((e) => setNotice(e.message));
            }}
          >
            Copy report-only header
          </button>
          <ol className="list-decimal pl-5 space-y-2">
            {draft.directives.map((d) => (
              <li key={d.text}>
                <code className="text-sm break-all">{d.text}</code>
                <p className="text-xs text-slate-500">{d.reason}</p>
              </li>
            ))}
          </ol>
          {draft.limitations.map((s) => (
            <p className="text-sm text-slate-600" key={s}>
              {s}
            </p>
          ))}
          <p>
            Deploy in report-only mode → exercise workflows and collect violation reports → refine
            the draft → test enforcing CSP → re-inspect. SiteLens does not deploy policies or host a
            violation endpoint.
          </p>
        </section>
      )}
    </div>
  );
}
