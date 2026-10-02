import { GlossaryText } from '../components/GlossaryText';
import { REMEDIATIONS } from '../lib/remediations';
import { FIX_RECIPES } from '@sitelens/assessment-engine/src/workspace.js';
declare var chrome: any;
import { Dropdown } from '../components/Dropdown';
import { useState } from 'react';
import { Search, AlertCircle, RefreshCw } from 'lucide-react';
import type { Assessment, LifecycleEvent } from '@sitelens/shared-types';

const STATES = [
  'new',
  'acknowledged',
  'investigating',
  'accepted risk',
  'fixed',
  'needs verification',
  'verified',
  'false positive',
];

export const Findings = ({
  assessment,
  isProfessionalMode = false,
  events = [],
}: {
  assessment: Assessment;
  isProfessionalMode?: boolean;
  events?: LifecycleEvent[];
}) => {
  const [notice, setNotice] = useState('');
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');

  const filtered = assessment.findings.filter((f) => {
    if (filter !== 'all' && f.status !== filter) return false;
    if (
      search &&
      !f.title.toLowerCase().includes(search.toLowerCase()) &&
      !f.checkId.toLowerCase().includes(search.toLowerCase())
    )
      return false;
    return true;
  });

  const handleVerify = async (checkId: string) => {
    try {
      const result = await chrome.runtime.sendMessage({
        type: 'verify',
        assessmentId: assessment.id,
        checkId,
      });
      if (result?.error) throw new Error(result.error);
      window.location.href = 'index.html?id=' + result.id;
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Verification failed.');
    }
  };
  const handleLifecycleChange = async (checkId: string, state: string) => {
    const exceptional = state === 'accepted risk' || state === 'false positive';
    const note = exceptional ? window.prompt('Record the rationale for this decision:') : '';
    if (exceptional && !note) return;
    const actor = exceptional ? window.prompt('Analyst name:') : undefined;
    if (exceptional && !actor) return;
    const expiresAt = exceptional ? window.prompt('Review expiry (YYYY-MM-DD):') : undefined;
    if (exceptional && !expiresAt) return;
    try {
      const result = await chrome.runtime.sendMessage({
        type: 'lifecycle',
        assessmentId: assessment.id,
        checkId,
        state,
        note,
        actor,
        expiresAt,
      });
      if (result?.error) throw new Error(result.error);
      window.location.reload();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Unable to save decision.');
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex flex-col h-[calc(100vh-140px)]">
      <div className="p-4 border-b border-slate-200 flex justify-between items-center bg-slate-50">
        <div className="flex gap-2">
          <Dropdown
            value={filter}
            onChange={setFilter}
            options={[
              { value: 'all', label: 'All Findings' },
              { value: 'potential_weakness', label: 'Potential Weaknesses' },
              { value: 'protection_observed', label: 'Protections Observed' },
              { value: 'informational', label: 'Informational' },
            ]}
          />
        </div>
        <div className="relative w-64">
          <Search className="h-4 w-4 absolute left-3 top-2.5 text-slate-400" />
          <input
            type="text"
            placeholder="Search findings..."
            className="w-full pl-9 pr-3 py-2 bg-white border border-slate-200 rounded-lg text-sm outline-none focus:border-emerald-500"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6 bg-slate-50/50">
        {notice && (
          <p role="status" className="p-3 bg-amber-50 mb-4">
            {notice}
          </p>
        )}
        <div className="space-y-6">
          {filtered.length === 0 ? (
            <div className="text-center py-12 text-slate-500">
              <AlertCircle className="h-12 w-12 text-slate-300 mx-auto mb-3" />
              <p>No findings match your criteria.</p>
            </div>
          ) : (
            filtered.map((f, i) => (
              <div
                key={i}
                className="bg-white border border-slate-200 rounded-xl shadow-sm flex flex-col"
              >
                <div
                  className={`px-5 py-4 border-b border-slate-100 flex justify-between items-start rounded-t-xl ${
                    f.status === 'potential_weakness'
                      ? 'bg-amber-50/30'
                      : f.status === 'protection_observed'
                        ? 'bg-emerald-50/30'
                        : 'bg-slate-50/30'
                  }`}
                >
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-[10px] uppercase font-bold tracking-wider text-slate-500">
                        {f.checkId}
                      </span>
                      <span
                        className={`text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full ${
                          f.severity === 'critical' || f.severity === 'high'
                            ? 'bg-rose-100 text-rose-700'
                            : f.severity === 'medium'
                              ? 'bg-amber-100 text-amber-700'
                              : 'bg-slate-100 text-slate-600'
                        }`}
                      >
                        {f.severity} Severity · {f.confidence} confidence ·{' '}
                        {f.status.replaceAll('_', ' ')}
                      </span>
                      <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 border border-blue-200">
                        {f.lifecycle || 'new'}
                      </span>
                    </div>
                    <h3 className="font-bold text-slate-800 text-lg">{f.title}</h3>
                  </div>
                  <div className="flex items-center gap-2">
                    <Dropdown
                      value={f.lifecycle || 'new'}
                      onChange={(v) => handleLifecycleChange(f.checkId, v)}
                      options={STATES.map((s) => ({ value: s, label: s.toUpperCase() }))}
                    />
                    <button
                      onClick={() => handleVerify(f.checkId)}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded shadow-sm transition-colors"
                    >
                      <RefreshCw className="h-3.5 w-3.5" />
                      Verify Fix
                    </button>
                  </div>
                </div>

                <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-6 text-sm">
                  <div className="space-y-4">
                    <div>
                      <strong className="block text-xs uppercase tracking-wide text-slate-500 mb-1">
                        Observation
                      </strong>
                      <p className="text-slate-700"><GlossaryText text={f.observation} /></p>

                    {REMEDIATIONS[f.checkId] && (
                      <div className="mt-4 pt-4 border-t border-slate-100">
                        <h4 className="text-sm font-semibold text-slate-700 mb-2">How to Fix (Remediation)</h4>
                        <div className="space-y-3">
                          {REMEDIATIONS[f.checkId].map((rem, i) => (
                            <div key={i} className="bg-slate-50 rounded-lg border border-slate-200 overflow-hidden">
                              <div className="px-3 py-1.5 bg-slate-100 border-b border-slate-200 text-xs font-semibold text-slate-600">
                                {rem.framework}
                              </div>
                              <pre className="p-3 text-xs text-slate-800 overflow-x-auto whitespace-pre-wrap">
                                <code>{rem.code}</code>
                              </pre>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    </div>
                    {!isProfessionalMode && f.impact && (
                      <div>
                        <strong className="block text-xs uppercase tracking-wide text-slate-500 mb-1">
                          Impact
                        </strong>
                        <p className="text-slate-600">{f.impact}</p>
                      </div>
                    )}
                  </div>
                  <div className="space-y-4">
                    {!isProfessionalMode && f.recommendation && (
                      <div className="bg-slate-50 border border-slate-100 rounded p-3">
                        <strong className="block text-xs uppercase tracking-wide text-slate-500 mb-1">
                          Recommendation
                        </strong>
                        <p className="text-slate-700">{f.recommendation}</p>
                      </div>
                    )}
                    <div>
                      <strong>Important limitation</strong>
                      <p>{f.limitation}</p>
                    </div>
                    <div>
                      <strong>Validate the improvement</strong>
                      <p>{f.validation}</p>
                    </div>
                    {FIX_RECIPES[f.checkId] && (
                      <details>
                        <summary className="cursor-pointer font-semibold">
                          Developer fix recipes
                        </summary>
                        <p>{FIX_RECIPES[f.checkId].context}</p>
                        {FIX_RECIPES[f.checkId].examples.map((e) => (
                          <div key={e.platform}>
                            <strong>{e.platform}</strong>
                            <pre className="text-xs whitespace-pre-wrap break-all bg-slate-50 p-3">
                              {e.code}
                            </pre>
                          </div>
                        ))}
                      </details>
                    )}
                    <details>
                      <summary className="cursor-pointer font-semibold">
                        Why am I seeing this?
                      </summary>
                      {assessment.evidence
                        .filter((e) => f.evidenceIds.includes(e.id))
                        .map((e) => (
                          <div key={e.id} className="py-3">
                            <strong>{e.label}</strong>
                            <p>
                              {e.source} · {e.collectedAt}
                            </p>
                            <pre className="whitespace-pre-wrap break-all text-xs bg-slate-50 p-3">
                              {JSON.stringify({ provenance: e.provenance, data: e.data }, null, 2)}
                            </pre>
                          </div>
                        ))}
                    </details>
                    <details>
                      <summary className="cursor-pointer font-semibold">
                        Decision and verification history
                      </summary>
                      {events
                        .filter(
                          (e) => e.targetKey === assessment.targetKey && e.checkId === f.checkId
                        )
                        .map((e) => (
                          <p className="text-xs py-2" key={e.id}>
                            {e.at} · {e.state} · {e.actor || 'Local analyst'} · {e.note}
                            {e.expiresAt ? ` · Review by ${e.expiresAt}` : ''}
                            {e.owner ? ` · Owner: ${e.owner}` : ''}
                          </p>
                        ))}
                    </details>
                    {f.suppression && (
                      <p>
                        Exception: {f.suppression.active ? 'active' : 'requires review'} ·{' '}
                        {f.suppression.reason}
                      </p>
                    )}
                    <div className="text-xs text-slate-400 font-mono">
                      First Observed: {new Date(f.firstObserved || f.createdAt).toLocaleString()}
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
