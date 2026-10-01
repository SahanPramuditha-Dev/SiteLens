import { Link2, AlertTriangle, CheckCircle2 } from 'lucide-react';
import type { Assessment, Resource } from '@sitelens/shared-types';

export const SupplyChainView = ({ assessment }: { assessment: Assessment }) => {
  const resourceEv = assessment.evidence.find(
    (e) => e.id === 'resources' || e.label === 'Resource references'
  );
  const resources = (resourceEv?.data as Resource[]) || [];

  const thirdParty = resources.filter((r) => r.thirdParty);
  const scriptsAndLinks = thirdParty.filter(
    (r) => (r.type === 'script' || r.type === 'link') && r.observedBy !== 'Resource timing'
  );
  const missingSri = scriptsAndLinks.filter((r) => !r.integrity);
  const hasSri = scriptsAndLinks.filter((r) => !!r.integrity);

  return (
    <div className="space-y-6">
      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
          <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-1">
            Third-Party Assets
          </h3>
          <div className="text-3xl font-bold text-slate-800">{thirdParty.length}</div>
          <p className="text-xs text-slate-400 mt-2">External domains loaded by this site.</p>
        </div>

        <div className="bg-white p-6 rounded-xl border border-amber-200 shadow-sm bg-amber-50/30">
          <div className="flex justify-between items-start">
            <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-1">
              Missing SRI
            </h3>
            <AlertTriangle className="h-5 w-5 text-amber-500" />
          </div>
          <div className="text-3xl font-bold text-amber-700">{missingSri.length}</div>
          <p className="text-xs text-amber-600/80 mt-2">
            Review SRI applicability for these external resources.
          </p>
        </div>

        <div className="bg-white p-6 rounded-xl border border-emerald-200 shadow-sm bg-emerald-50/30">
          <div className="flex justify-between items-start">
            <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-1">
              Protected by SRI
            </h3>
            <CheckCircle2 className="h-5 w-5 text-emerald-500" />
          </div>
          <div className="text-3xl font-bold text-emerald-700">{hasSri.length}</div>
          <p className="text-xs text-emerald-600/80 mt-2">
            External scripts/CSS pinned by a cryptographic hash.
          </p>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="px-6 py-5 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link2 className="text-emerald-600 h-5 w-5" />
            <h3 className="font-semibold text-slate-800">Software Supply Chain</h3>
          </div>
        </div>

        {scriptsAndLinks.length === 0 ? (
          <div className="p-12 text-center text-slate-500 flex flex-col items-center">
            <CheckCircle2 className="h-12 w-12 text-emerald-400 mb-3" />
            <p className="font-medium text-slate-700">No Third-Party Executables</p>
            <p className="text-sm mt-1">
              This site does not load any external scripts or stylesheets.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100 text-xs uppercase tracking-wider text-slate-500">
                  <th className="px-6 py-3 font-semibold">Type</th>
                  <th className="px-6 py-3 font-semibold">External Resource URL</th>
                  <th className="px-6 py-3 font-semibold">Subresource Integrity (SRI)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {scriptsAndLinks.map((r, i) => (
                  <tr key={i} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-6 py-4">
                      <span className="text-[11px] font-bold uppercase px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                        {r.type}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-slate-700 break-all max-w-xl">{r.url}</div>
                    </td>
                    <td className="px-6 py-4">
                      {r.integrity ? (
                        <div className="flex items-center gap-1.5 text-xs text-emerald-600 font-medium">
                          <CheckCircle2 className="h-3.5 w-3.5" /> Present
                        </div>
                      ) : (
                        <div className="flex items-center gap-1.5 text-xs text-amber-600 font-medium">
                          <AlertTriangle className="h-3.5 w-3.5" /> Missing
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
