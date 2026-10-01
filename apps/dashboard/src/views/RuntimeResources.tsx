import { AlertCircle, CheckCircle2, Info } from 'lucide-react';
import type { Assessment } from '@sitelens/shared-types';

export const RuntimeResourcesView = ({ assessment }: { assessment: Assessment }) => {
  const scripts = assessment.resources.filter((r) => r.type === 'script');
  const styles = assessment.resources.filter((r) => r.type === 'link');
  const images = assessment.resources.filter((r) => r.type === 'img');
  const xhrFetch = assessment.resources.filter((r) => ['xmlhttprequest', 'fetch'].includes(r.type));
  const tpScripts = scripts.filter((r) => r.thirdParty);
  const tpNoSri = tpScripts.filter((r) => !r.integrity);

  // Performance from evidence
  const perfEvidence = assessment.evidence.find((e) => e.performance);
  const perf = perfEvidence?.performance;

  return (
    <div className="space-y-5">
      {/* ── Resource Overview ─────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Total Resources', value: assessment.resources.length },
          { label: 'Scripts', value: scripts.length },
          { label: 'Third-Party Scripts', value: tpScripts.length, warn: tpScripts.length > 10 },
          { label: 'No SRI (3rd-party)', value: tpNoSri.length, warn: tpNoSri.length > 0 },
        ].map(({ label, value, warn }) => (
          <div
            key={label}
            className={`bg-white rounded-xl border shadow-sm p-5 ${warn ? 'border-amber-200 bg-amber-50/30' : 'border-slate-200'}`}
          >
            <p className="text-[10px] uppercase font-bold tracking-widest text-slate-400 mb-1">
              {label}
            </p>
            <p className={`text-3xl font-bold ${warn ? 'text-amber-700' : 'text-slate-700'}`}>
              {value}
            </p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Stylesheets', value: styles.length },
          { label: 'Images', value: images.length },
          { label: 'XHR / Fetch', value: xhrFetch.length },
          { label: 'Frames', value: assessment.frames.length },
        ].map(({ label, value }) => (
          <div key={label} className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
            <p className="text-[10px] uppercase font-bold tracking-widest text-slate-400 mb-1">
              {label}
            </p>
            <p className="text-3xl font-bold text-slate-700">{value}</p>
          </div>
        ))}
      </div>

      {/* ── Script Inventory ─────────────────────────────────────── */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-6 py-5 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
          <h3 className="font-semibold text-slate-800">Script Inventory</h3>
          <span className="text-xs text-slate-500">
            {scripts.length} scripts · {tpNoSri.length} third-party without SRI
          </span>
        </div>
        {scripts.length === 0 ? (
          <div className="px-6 py-8 text-center text-sm text-slate-400">No scripts detected.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100 text-xs uppercase tracking-wider text-slate-500">
                  <th className="px-6 py-3 font-semibold">URL</th>
                  <th className="px-6 py-3 font-semibold">Origin</th>
                  <th className="px-6 py-3 font-semibold">SRI</th>
                  <th className="px-6 py-3 font-semibold">crossorigin</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {scripts.map((r, i) => {
                  const isRisky = r.thirdParty && !r.integrity;
                  return (
                    <tr
                      key={i}
                      className={`hover:bg-slate-50/50 ${isRisky ? 'bg-amber-50/30' : ''}`}
                    >
                      <td className="px-6 py-3 font-mono text-xs text-slate-700 max-w-xs">
                        <span className="truncate block" title={r.url}>
                          {r.url.replace(/^https?:\/\/[^/]+/, '') || r.url.slice(0, 60)}
                        </span>
                        <span className="text-[10px] text-slate-400">{r.url.split('/')[2]}</span>
                      </td>
                      <td className="px-6 py-3">
                        <span
                          className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded ${r.thirdParty ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'}`}
                        >
                          {r.thirdParty ? 'Third-party' : 'Same-origin'}
                        </span>
                      </td>
                      <td className="px-6 py-3 text-xs">
                        {r.integrity ? (
                          <span className="text-emerald-600 font-semibold flex items-center gap-1">
                            <CheckCircle2 className="h-3 w-3" /> Present
                          </span>
                        ) : (
                          <span
                            className={`flex items-center gap-1 ${r.thirdParty ? 'text-amber-600 font-semibold' : 'text-slate-400'}`}
                          >
                            {r.thirdParty ? <AlertCircle className="h-3 w-3" /> : null} Missing
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-3 text-xs font-mono text-slate-500">
                        {r.crossorigin ?? '–'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Load Timing (secondary) ───────────────────────────────── */}
      {perf && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-6 py-5 border-b border-slate-100 bg-slate-50/50">
            <h3 className="font-semibold text-slate-800">Load Timing</h3>
          </div>
          <div className="px-6 py-4 flex items-start gap-3">
            <Info className="h-4 w-4 text-slate-400 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-slate-500">
              Load timing is provided for context. SiteLens does not score or grade performance.
            </p>
          </div>
          <div className="px-6 pb-5 grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: 'First Contentful Paint', value: `${perf.fcp.toFixed(0)}ms` },
              { label: 'DOM Interactive', value: `${perf.domInteractive.toFixed(0)}ms` },
              { label: 'DOM Complete', value: `${perf.domComplete.toFixed(0)}ms` },
              { label: 'Load Event', value: `${perf.loadEvent.toFixed(0)}ms` },
            ].map(({ label, value }) => (
              <div key={label} className="bg-slate-50 rounded-lg border border-slate-100 p-4">
                <p className="text-[10px] uppercase tracking-wider text-slate-400 font-bold mb-1">
                  {label}
                </p>
                <p className="text-lg font-bold text-slate-700 font-mono">{value}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
