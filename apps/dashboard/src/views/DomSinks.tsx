import { Bug, CheckCircle } from 'lucide-react';
import type { Assessment, SinkFinding } from '@sitelens/shared-types';

export const DomSinksView = ({ assessment }: { assessment: Assessment }) => {
  const sinkEv = assessment.evidence.find((e) => e.label === 'DOM XSS Sinks');
  const sinks = (sinkEv?.data as SinkFinding[]) || [];

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="px-6 py-5 border-b border-slate-100 bg-slate-50/50 flex items-center gap-3">
          <Bug className="text-rose-600 h-5 w-5" />
          <h3 className="font-semibold text-slate-800">DOM XSS Sink Tracker</h3>
        </div>

        {sinks.length === 0 ? (
          <div className="p-12 text-center text-slate-500 flex flex-col items-center">
            <CheckCircle className="h-12 w-12 text-emerald-400 mb-3" />
            <p className="font-medium text-slate-700">No Inline DOM Sinks Detected</p>
            <p className="text-sm mt-1">
              This site does not use inline event handlers or javascript: URIs.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100 text-xs uppercase tracking-wider text-slate-500">
                  <th className="px-6 py-3 font-semibold">Type</th>
                  <th className="px-6 py-3 font-semibold">Node</th>
                  <th className="px-6 py-3 font-semibold">Attribute</th>
                  <th className="px-6 py-3 font-semibold">Snippet</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {sinks.map((s, i) => (
                  <tr key={i} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-6 py-4">
                      <span className="text-[11px] font-bold uppercase px-2 py-0.5 rounded-full bg-rose-100 text-rose-700">
                        {s.type}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <code className="text-xs bg-slate-100 px-1 py-0.5 rounded text-slate-700">
                        {s.node}
                      </code>
                    </td>
                    <td className="px-6 py-4">
                      <code className="text-xs bg-slate-100 px-1 py-0.5 rounded text-slate-700">
                        {s.attribute}
                      </code>
                    </td>
                    <td className="px-6 py-4 text-xs font-mono text-slate-600 break-all">
                      {s.snippet}
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
