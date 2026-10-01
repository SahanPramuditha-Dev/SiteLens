import { useState } from 'react';
import type { Assessment } from '@sitelens/shared-types';
import { detailedChanges } from '@sitelens/assessment-engine/src/workspace.js';
import { compareAssessments } from '@sitelens/extension/src/core/history';
import { Dropdown } from '../components/Dropdown';

export function ComparisonView({
  assessments,
  current,
}: {
  assessments: Assessment[];
  current: Assessment;
}) {
  const candidates = assessments
    .filter((a) => a.targetKey === current.targetKey && a.id !== current.id && a.kind === 'full')
    .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
  const [id, setId] = useState('');
  const before =
    candidates.find((a) => a.id === id) ||
    candidates.find((a) => Date.parse(a.createdAt) < Date.parse(current.createdAt)) ||
    candidates[0];
  if (!before)
    return (
      <div className="bg-white border border-slate-200 rounded-xl p-6">
        Inspect this target again to compare evidence.
      </div>
    );
  const changes = detailedChanges(before, current),
    rules = compareAssessments(before, current);
  return (
    <div className="space-y-5">
      <section className="bg-white border border-slate-200 rounded-xl p-6 space-y-3">
        <h3 className="font-bold">Detailed assessment comparison</h3>
        <div className="flex items-center gap-3 flex-wrap">
          <span className="text-sm font-medium text-slate-600">Compare against:</span>
          <Dropdown
            value={before.id}
            onChange={setId}
            options={candidates.map((a) => ({
              value: a.id,
              label: `${new Date(a.createdAt).toLocaleString()} · ${a.profile}`,
            }))}
          />
        </div>
        <p className="text-sm text-slate-500">
          Changes in captured evidence do not establish causality or exploitability. Rule-version
          changes are distinguished from website improvements. A missing item means it was not
          observed in that snapshot.
        </p>
      </section>
      <section className="bg-white border border-slate-200 rounded-xl p-6">
        <h3 className="font-bold">Observation / rule transitions</h3>
        {rules.map((r) => (
          <p className="py-2 text-sm" key={r.checkId}>
            {r.checkId} · {r.type === 'rule' ? 'Rule changed — review required' : r.type} ·{' '}
            {r.before} → {r.after}
          </p>
        ))}
        {!rules.length && <p>No changes in these evaluated observations.</p>}
      </section>
      {changes.map((c, i) => (
        <section className="bg-white border border-slate-200 rounded-xl p-5" key={i}>
          <h4 className="font-semibold break-all">
            {c.area} · {c.item}
          </h4>
          <div className="grid md:grid-cols-2 gap-4 mt-3">
            <div>
              <b className="text-xs">Before</b>
              <pre className="text-xs whitespace-pre-wrap break-all bg-slate-50 p-3">
                {JSON.stringify(c.before, null, 2)}
              </pre>
            </div>
            <div>
              <b className="text-xs">After</b>
              <pre className="text-xs whitespace-pre-wrap break-all bg-slate-50 p-3">
                {JSON.stringify(c.after, null, 2)}
              </pre>
            </div>
          </div>
        </section>
      ))}
      {!changes.length && (
        <p className="bg-white border border-slate-200 rounded-xl p-6">
          No changes in the compared captured headers, cookies, dependencies, resources or domains.
        </p>
      )}
    </div>
  );
}
