import type { Assessment, PerformanceMetrics } from '@sitelens/shared-types';

export const PerformanceView = ({ assessment }: { assessment: Assessment }) => {
  const perfEv = assessment.evidence.find((e) => e.label === 'Performance Metrics');
  const metrics = (perfEv?.data as PerformanceMetrics) || {
    fcp: 0,
    domInteractive: 0,
    domComplete: 0,
    loadEvent: 0,
  };

  const formatMs = (ms: number) => (ms ? `${Math.round(ms)} ms` : 'N/A');

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
          <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
            First Contentful Paint
          </h3>
          <div className="text-2xl font-bold text-slate-800">{formatMs(metrics.fcp)}</div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
          <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
            DOM Interactive
          </h3>
          <div className="text-2xl font-bold text-slate-800">
            {formatMs(metrics.domInteractive)}
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
          <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
            DOM Complete
          </h3>
          <div className="text-2xl font-bold text-slate-800">{formatMs(metrics.domComplete)}</div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
          <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
            Load Event
          </h3>
          <div className="text-2xl font-bold text-slate-800">{formatMs(metrics.loadEvent)}</div>
        </div>
      </div>
    </div>
  );
};
