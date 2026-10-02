import { useEffect, useState } from 'react';
import type { Assessment, Settings, Scope } from '@sitelens/shared-types';
import { defaultScope } from '@sitelens/rule-definitions/src/scope.js';
import { CHECKS } from '@sitelens/rule-definitions';
const call = async (message: Record<string, unknown>) => {
  const result = await chrome.runtime.sendMessage(message);
  if (result?.error) throw new Error(result.error);
  return result;
};
export function ControlsView({ assessment }: { assessment: Assessment }) {
  const [settings, setSettings] = useState<Settings>({
      learningMode: false,
      retention: 50,
      observedOrigins: [],
    }),
    [scope, setScope] = useState<Scope>(assessment.scope || defaultScope(assessment.url)),
    [notice, setNotice] = useState(''),
    [headers, setHeaders] = useState<{name: string; value: string; domain: string}[]>([]);
  useEffect(() => {
    call({ type: 'state' })
      .then((s) => {
        setSettings(s.settings);
        setScope(
          s.settings.scopes?.[assessment.origin] || assessment.scope || defaultScope(assessment.url)
        );

        setHeaders(s.settings.customHeaders || []);

      })
      .catch((e) => setNotice(e.message));
  }, [assessment.id]);
  
    const saveHeaders = async (newHeaders: {name: string; value: string; domain: string}[]) => {
      setHeaders(newHeaders);
      try {
        await call({ type: 'settings', customHeaders: newHeaders });
        setNotice('Custom headers saved.');
      } catch (e: any) {
        setNotice(e.message);
      }
    };

  const run = async (message: Record<string, unknown>) => {
    try {
      const result = await call(message);
      setNotice('Saved. New assessments use these controls. Existing evidence remains unchanged.');
      if (result.id) location.href = `index.html?id=${result.id}`;
      const s = await call({ type: 'state' });
      setSettings(s.settings);
    } catch (e) {
      setNotice((e as Error).message);
    }
  };
  const inputClass = 'border rounded px-3 py-2 text-sm w-full';
  const field = (label: string, node: React.ReactNode) => (
    <label className="text-xs text-slate-500 grid gap-2">
      {label}
      {node}
    </label>
  );
  return (
    <div className="space-y-5">
      {notice && (
        <p role="status" className="bg-emerald-50 border rounded p-4 text-sm">
          {notice}
        </p>
      )}
      <form
        className="bg-white border rounded-xl p-6 space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          run({ type: 'scope', origin: assessment.origin, scope });
        }}
      >
        <h3 className="font-bold">Assessment scope</h3>
        <p className="text-sm text-slate-500">
          Passive inspection sends no extra requests. Supplemental source-map inspection requires
          recorded authorization, an explicit button click, a budget and bounded responses.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {field(
            'Allowed origins (comma separated)',
            <input
              className={inputClass}
              value={scope.origins.join(',')}
              onChange={(e) =>
                setScope({ ...scope, origins: e.target.value.split(',').map((v) => v.trim()) })
              }
            />
          )}
          {field(
            'Allowed domains (optional)',
            <input
              className={inputClass}
              value={scope.domains.join(',')}
              onChange={(e) =>
                setScope({
                  ...scope,
                  domains: e.target.value
                    .split(',')
                    .map((v) => v.trim())
                    .filter(Boolean),
                })
              }
            />
          )}
          {field(
            'Included path prefixes',
            <input
              className={inputClass}
              value={scope.pathPrefixes.join(',')}
              onChange={(e) =>
                setScope({ ...scope, pathPrefixes: e.target.value.split(',').map((v) => v.trim()) })
              }
            />
          )}
          {field(
            'Excluded paths',
            <input
              className={inputClass}
              value={scope.excludedPaths.join(',')}
              onChange={(e) =>
                setScope({
                  ...scope,
                  excludedPaths: e.target.value
                    .split(',')
                    .map((v) => v.trim())
                    .filter(Boolean),
                })
              }
            />
          )}
          {field(
            'Inspection mode',
            <select
              className={inputClass}
              value={scope.mode}
              onChange={(e) =>
                setScope({
                  ...scope,
                  mode: e.target.value as Scope['mode'],
                  requestBudget: e.target.value === 'passive' ? 0 : scope.requestBudget || 5,
                })
              }
            >
              <option value="passive">Passive — no supplemental requests</option>
              <option value="supplemental">Authorized source-map requests</option>
            </select>
          )}
          {field(
            'Supplemental request budget (0–100)',
            <input
              className={inputClass}
              type="number"
              min="0"
              max="100"
              value={scope.requestBudget}
              onChange={(e) => setScope({ ...scope, requestBudget: Number(e.target.value) })}
            />
          )}
          {field(
            'Maximum requests per second',
            <input
              className={inputClass}
              type="number"
              min="0.1"
              max="5"
              step="0.1"
              value={scope.requestsPerSecond}
              onChange={(e) => setScope({ ...scope, requestsPerSecond: Number(e.target.value) })}
            />
          )}
          {field(
            'Maximum response bytes',
            <input
              className={inputClass}
              type="number"
              min="1000"
              max="2000000"
              value={scope.maxBytes}
              onChange={(e) => setScope({ ...scope, maxBytes: Number(e.target.value) })}
            />
          )}
          {field(
            'Timeout in milliseconds',
            <input
              className={inputClass}
              type="number"
              min="1000"
              max="30000"
              value={scope.timeoutMs}
              onChange={(e) => setScope({ ...scope, timeoutMs: Number(e.target.value) })}
            />
          )}
        </div>
        <div className="grid gap-3 text-sm">
          <label>
            <input
              type="checkbox"
              checked={scope.includeSubdomains}
              onChange={(e) => setScope({ ...scope, includeSubdomains: e.target.checked })}
            />{' '}
            Include subdomains of listed domains
          </label>
          <label>
            <input
              type="checkbox"
              checked={scope.includeThirdParty}
              onChange={(e) => setScope({ ...scope, includeThirdParty: e.target.checked })}
            />{' '}
            Include third-party requests within the explicit allowed scope
          </label>
          <label>
            <input
              type="checkbox"
              checked={scope.authorized}
              onChange={(e) => setScope({ ...scope, authorized: e.target.checked })}
            />{' '}
            I am authorized to request the listed source maps within this scope
          </label>
        </div>
        <button className="bg-emerald-700 text-white rounded px-4 py-2">Save scope</button>
      </form>
      <section className="bg-white border rounded-xl p-6 space-y-4">
        <h3 className="font-bold">Evidence and rule updates</h3>
        <p className="text-sm text-slate-500">
          Re-evaluation runs current rules on stored evidence without contacting the site. It cannot
          verify a website fix.
        </p>
        <div className="flex flex-wrap gap-3">
          <button
            className="border rounded px-4 py-2 text-sm"
            onClick={() => run({ type: 'reevaluate', assessmentId: assessment.id })}
          >
            Re-evaluate stored evidence
          </button>
          <button
            className="border rounded px-4 py-2 text-sm"
            onClick={() => run({ type: 'source-maps', assessmentId: assessment.id })}
          >
            Inspect referenced source maps
          </button>
        </div>
      </section>
      <form
        className="bg-white border rounded-xl p-6 space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          const f = new FormData(e.currentTarget);
          const checkId = String(f.get('check')),
            version =
              assessment.findings.find((v) => v.checkId === checkId)?.ruleVersion || '1.1.0';
          run({
            type: 'suppression',
            suppression: {
              id: crypto.randomUUID(),
              origin: assessment.origin,
              checkId,
              ruleVersion: version,
              rationale: f.get('reason'),
              actor: f.get('actor'),
              expiresAt: new Date(String(f.get('expiry'))).toISOString(),
              createdAt: new Date().toISOString(),
            },
          });
        }}
      >
        <h3 className="font-bold">Expiring finding exception</h3>
        <p className="text-sm text-slate-500">
          Exceptions annotate potential weaknesses; the original result and evidence remain visible.
          Expiry or rule-version changes require review.
        </p>
        <div className="grid md:grid-cols-2 gap-4">
          {field(
            'Check',
            <select name="check" className={inputClass}>
              {CHECKS.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.id} · {c.name}
                </option>
              ))}
            </select>
          )}
          {field(
            'Accepted by',
            <input name="actor" className={inputClass} required defaultValue="Local analyst" />
          )}
          {field(
            'Reason',
            <input name="reason" className={inputClass} required maxLength={2000} />
          )}
          {field(
            'Expires',
            <input
              name="expiry"
              className={inputClass}
              required
              type="date"
              min={new Date(Date.now() + 86400000).toISOString().slice(0, 10)}
            />
          )}
        </div>
        <button className="bg-emerald-700 text-white rounded px-4 py-2">Save exception</button>
        {(settings.suppressions || []).map((s) => (
          <div key={s.id} className="border-t pt-3 text-sm">
            <b>{s.checkId}</b> · {s.origin} · expires {s.expiresAt}
            <p>{s.rationale}</p>
            <button
              type="button"
              className="text-emerald-700"
              onClick={() => run({ type: 'remove-suppression', id: s.id })}
            >
              Remove exception
            </button>
          </div>
        ))}
      </form>
      <form
        className="bg-white border rounded-xl p-6 space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          const f = new FormData(e.currentTarget);
          const existing = settings.projects?.find((p) => p.id === f.get('existingProject'));
          const name = String(f.get('environment'));
          const origins = String(f.get('origins') || assessment.origin)
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean);
          run({
            type: 'project',
            project: {
              id: existing?.id || crypto.randomUUID(),
              name: existing?.name || f.get('name'),
              environments: [
                ...(existing?.environments || []).filter((e) => e.name !== name),
                { name, origins },
              ],
            },
            environment: f.get('environment'),
          });
        }}
      >
        <h3 className="font-bold">Project & environment</h3>
        <p className="text-sm text-slate-500">
          Group subsequent assessments locally. Team synchronization and external issue publishing
          are not performed.
        </p>
        <div className="grid md:grid-cols-2 gap-4">
          {field(
            'Existing project (optional)',
            <select name="existingProject" className={inputClass}>
              <option value="">Create a new project</option>
              {settings.projects?.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          )}
          {field('New project name', <input name="name" className={inputClass} />)}
          {field(
            'Environment origins (comma separated)',
            <input name="origins" defaultValue={assessment.origin} className={inputClass} />
          )}
          {field(
            'Environment',
            <input
              name="environment"
              required
              className={inputClass}
              placeholder="Production, Staging, Development"
            />
          )}
        </div>
        <button className="bg-emerald-700 text-white rounded px-4 py-2">
          Save project and select environment
        </button>
        {(settings.projects || []).map((p) => (
          <div className="text-sm" key={p.id}>
            {p.name}
            {p.environments.map((e) => (
              <button
                type="button"
                className="border rounded ml-2 px-2 py-1"
                key={e.name}
                onClick={() => run({ type: 'project', project: p, environment: e.name })}
              >
                Select {e.name}
              </button>
            ))}
          </div>
        ))}
      </form>
      <section className="bg-white border rounded-xl p-6 space-y-4">
        <h3 className="font-bold">Local storage and permissions</h3>
        <label>
          History retention{' '}
          <input
            className={inputClass}
            type="number"
            min="5"
            max="200"
            value={settings.retention}
            onChange={(e) => setSettings({ ...settings, retention: Number(e.target.value) })}
          />
        </label>
        <button
          className="border rounded p-2"
          onClick={() =>
            run({
              type: 'settings',
              retention: settings.retention,
              learningMode: settings.learningMode,
            })
          }
        >
          Save retention
        </button>
        <button
          className="border rounded p-2 ml-2"
          onClick={() => run({ type: 'revoke', origin: assessment.origin })}
        >
          Revoke site access
        </button>
        <button
          className="border rounded p-2 ml-2"
          onClick={async () => {
            if (window.confirm('Delete this local assessment?')) {
              await call({ type: 'delete', id: assessment.id });
              location.href = 'index.html';
            }
          }}
        >
          Delete this assessment
        </button>
      </section>
    
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 mt-6">
        <h3 className="font-semibold text-slate-800 flex items-center gap-2 mb-2">
          Custom HTTP Headers & Auth
        </h3>
        <p className="text-sm text-slate-500 mb-4">
          Inject custom headers (like <code>Authorization: Bearer ...</code>) to scan staging environments or protected APIs.
        </p>
        
        <div className="space-y-3">
          {headers.map((h, i) => (
            <div key={i} className="flex gap-2">
              <input type="text" placeholder="Header Name" value={h.name} onChange={e => { const n = [...headers]; n[i].name = e.target.value; saveHeaders(n); }} className="border rounded px-3 py-1.5 text-sm flex-1" />
              <input type="text" placeholder="Value" value={h.value} onChange={e => { const n = [...headers]; n[i].value = e.target.value; saveHeaders(n); }} className="border rounded px-3 py-1.5 text-sm flex-1" />
              <button onClick={() => saveHeaders(headers.filter((_, idx) => idx !== i))} className="px-3 py-1.5 text-red-600 hover:bg-red-50 rounded">Remove</button>
            </div>
          ))}
          <button onClick={() => saveHeaders([...headers, {name: '', value: '', domain: ''}])} className="px-4 py-2 bg-slate-100 text-slate-700 hover:bg-slate-200 rounded text-sm font-medium">
            + Add Header
          </button>
        </div>
      </div>
</div>
  );
}
