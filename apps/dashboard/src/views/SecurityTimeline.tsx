import { GitCommit, CheckCircle2, AlertCircle, Info, Clock } from 'lucide-react';
import type { Assessment } from '@sitelens/shared-types';
import { compareAssessments } from '@sitelens/extension/src/core/history';

function formatDate(iso: string): string {
  return new Date(iso)
    .toLocaleString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
    .replace(',', ' ·');
}

function getWeaknessCount(a: Assessment): number {
  return a.findings.filter((f) => f.status === 'potential_weakness').length;
}
function getProtectionCount(a: Assessment): number {
  return a.findings.filter((f) => f.status === 'protection_observed').length;
}

export const SecurityTimelineView = ({
  assessment,
  allAssessments,
}: {
  assessment: Assessment;
  allAssessments: Assessment[];
}) => {
  const history = allAssessments
    .filter((a) => a.targetKey === assessment.targetKey)
    .sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt));

  if (history.length <= 1) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm px-6 py-16 text-center">
        <Clock className="h-12 w-12 text-slate-200 mx-auto mb-4" />
        <p className="text-slate-600 font-semibold">No historical data yet.</p>
        <p className="text-sm text-slate-400 mt-2">
          Run another inspection of this target to start building a security timeline.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-6 py-5 border-b border-slate-100 bg-slate-50/50 flex items-center gap-3">
          <GitCommit className="h-5 w-5 text-slate-500" />
          <div>
            <h3 className="font-semibold text-slate-800">Security Change Timeline</h3>
            <p className="text-xs text-slate-400 mt-0.5">
              {history.length} assessments · Showing all changes since first assessment
            </p>
          </div>
        </div>

        <div className="px-6 py-6">
          <div className="relative">
            {/* Vertical timeline line */}
            <div className="absolute left-3.5 top-0 bottom-0 w-px bg-slate-200" />

            <div className="space-y-6">
              {history.map((a, idx) => {
                const isCurrent = a.id === assessment.id;
                const prev = history[idx - 1];
                let diffs: ReturnType<typeof compareAssessments> = [];
                try {
                  if (prev) diffs = compareAssessments(prev, a);
                } catch {}

                const improvements = diffs.filter(
                  (d) =>
                    d.type === 'status' &&
                    d.after === 'protection_observed' &&
                    d.before !== 'protection_observed'
                );
                const regressions = diffs.filter(
                  (d) => d.after === 'potential_weakness' && d.before !== 'potential_weakness'
                );
                const newFindings = diffs.filter((d) => d.type === 'added');
                const changes = diffs.filter(
                  (d) => d.type === 'status' || d.type === 'evidence' || d.type === 'rule'
                );

                return (
                  <div key={a.id} className="relative pl-10">
                    {/* Timeline dot */}
                    <div
                      className={`absolute left-0 top-1 h-7 w-7 rounded-full flex items-center justify-center border-2 shadow-sm ${
                        isCurrent
                          ? 'bg-emerald-500 border-emerald-600 text-white'
                          : 'bg-white border-slate-300 text-slate-400'
                      }`}
                    >
                      <GitCommit className="h-3.5 w-3.5" />
                    </div>

                    {/* Entry card */}
                    <div
                      className={`rounded-xl border p-4 ${isCurrent ? 'border-emerald-200 bg-emerald-50/30' : 'border-slate-200 bg-white'}`}
                    >
                      <div className="flex flex-wrap items-start justify-between gap-2 mb-3">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-semibold text-slate-800">
                              {formatDate(a.createdAt)}
                            </span>
                            {isCurrent && (
                              <span className="text-[10px] font-bold uppercase px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-700">
                                Current
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-slate-400 mt-0.5">
                            {a.kind === 'full' ? 'Full Assessment' : 'Verification'} ·{' '}
                            {a.checksCompleted}/{a.checksTotal} checks
                          </p>
                        </div>
                        <div className="flex gap-3 text-xs">
                          <span className="text-emerald-700 font-semibold">
                            {getProtectionCount(a)} protections
                          </span>
                          <span className="text-amber-600 font-semibold">
                            {getWeaknessCount(a)} weaknesses
                          </span>
                        </div>
                      </div>

                      {/* Diffs */}
                      {diffs.length === 0 && idx > 0 && (
                        <p className="text-xs text-slate-400 italic">
                          No changes detected vs. previous assessment.
                        </p>
                      )}
                      {idx === 0 && (
                        <p className="text-xs text-slate-400 italic">
                          First assessment — baseline established.
                        </p>
                      )}

                      <div className="space-y-1 mt-2">
                        {improvements.slice(0, 5).map((d, i) => (
                          <div key={i} className="flex items-center gap-2 text-xs">
                            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 flex-shrink-0" />
                            <span className="text-emerald-700 font-medium">{d.title}</span>
                            <span className="text-slate-400">
                              fixed ({d.before} → {d.after})
                            </span>
                          </div>
                        ))}
                        {regressions.slice(0, 5).map((d, i) => (
                          <div key={i} className="flex items-center gap-2 text-xs">
                            <AlertCircle className="h-3.5 w-3.5 text-amber-500 flex-shrink-0" />
                            <span className="text-amber-700 font-medium">{d.title}</span>
                            <span className="text-slate-400">
                              regression ({d.before} → {d.after})
                            </span>
                          </div>
                        ))}
                        {newFindings.slice(0, 3).map((d, i) => (
                          <div key={i} className="flex items-center gap-2 text-xs">
                            <Info className="h-3.5 w-3.5 text-blue-400 flex-shrink-0" />
                            <span className="text-blue-700 font-medium">{d.title}</span>
                            <span className="text-slate-400">newly assessed</span>
                          </div>
                        ))}
                        {changes
                          .filter((d) => d.type === 'evidence')
                          .slice(0, 3)
                          .map((d, i) => (
                            <div key={i} className="flex items-center gap-2 text-xs">
                              <span className="text-slate-400 font-bold pl-0.5">~</span>
                              <span className="text-slate-600">{d.title}</span>
                              <span className="text-slate-400">evidence changed</span>
                            </div>
                          ))}
                        {diffs.length > 8 && (
                          <p className="text-xs text-slate-400 pl-5">
                            ...and {diffs.length - 8} more changes.
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
