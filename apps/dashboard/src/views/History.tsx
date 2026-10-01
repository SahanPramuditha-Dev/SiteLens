import { History as HistoryIcon, Calendar } from 'lucide-react';
import type { Assessment } from '@sitelens/shared-types';

export const HistoryView = ({
  assessments,
  current,
}: {
  assessments: Assessment[];
  current: Assessment;
}) => {
  const pastForTarget = assessments;

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="px-6 py-5 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <HistoryIcon className="text-emerald-600 h-5 w-5" />
            <h3 className="font-semibold text-slate-800">Assessment History</h3>
          </div>
          <div className="text-sm text-slate-500 flex items-center gap-2">
            <span className="font-medium">{pastForTarget.length}</span> Total Records
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100 text-xs uppercase tracking-wider text-slate-500">
                <th className="px-6 py-3 font-semibold">Date</th>
                <th className="px-6 py-3 font-semibold">Target URL</th>
                <th className="px-6 py-3 font-semibold">Checks Completed</th>
                <th className="px-6 py-3 font-semibold">Status / actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {pastForTarget.map((a, i) => (
                <tr
                  key={i}
                  className={`hover:bg-slate-50/50 transition-colors ${a.id === current.id ? 'bg-emerald-50/30' : ''}`}
                >
                  <td className="px-6 py-4 text-sm text-slate-600 flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-slate-400" />
                    {new Date(a.createdAt).toLocaleString()}
                    {a.id === current.id && (
                      <span className="ml-2 text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700">
                        Current
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-sm font-semibold text-slate-700 break-all">
                    {a.url}
                  </td>
                  <td className="px-6 py-4 text-sm font-mono text-slate-600">
                    {a.checksCompleted} / {a.checksTotal}
                  </td>
                  <td className="px-6 py-4">
                    <span
                      className={`text-[11px] font-bold uppercase px-2 py-0.5 rounded-full ${a.kind === 'verification' ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-600'}`}
                    >
                      {a.kind || 'Full Assessment'} · {a.projectId || 'Unassigned'} /{' '}
                      {a.environment || 'Default'}
                    </span>
                    <a
                      className="block text-emerald-700 text-sm mt-2"
                      href={`index.html?id=${a.id}`}
                    >
                      Open assessment
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
