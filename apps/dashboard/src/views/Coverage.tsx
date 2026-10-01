import type { Assessment } from '@sitelens/shared-types';
export function CoverageView({ assessment }: { assessment: Assessment }) {
  return (
    <div className="space-y-5">
      <section className="bg-white border border-slate-200 rounded-xl p-6">
        <h3 className="font-bold text-lg">What this assessment covers</h3>
        <p className="text-slate-600 mt-2">
          Completed inspection does not mean the whole application was tested. Each area records its
          collection limits separately.
        </p>
        <p className="text-sm text-slate-500 mt-3">
          {assessment.checksCompleted} / {assessment.checksTotal} checks produced an assessable
          result · Profile: {assessment.profile || 'Legacy'} · Engine:{' '}
          {assessment.engineVersion || assessment.version} · Rules:{' '}
          {assessment.ruleSetVersion || 'Legacy'}
        </p>
      </section>
      {assessment.coverage.map((c) => (
        <section className="bg-white border border-slate-200 rounded-xl p-5" key={c.area}>
          <div className="flex flex-wrap justify-between gap-3">
            <h4 className="font-semibold">{c.area}</h4>
            <span className="text-xs uppercase bg-slate-100 rounded px-2 py-1">{c.status}</span>
          </div>
          <p className="text-sm text-slate-600 mt-2">{c.detail}</p>
        </section>
      ))}
      <details className="bg-white border rounded-xl p-5">
        <summary className="font-semibold cursor-pointer">Scope and reproducibility</summary>
        <pre className="text-xs whitespace-pre-wrap break-all mt-4">
          {JSON.stringify(
            {
              requestedUrl: assessment.requestedUrl,
              effectiveUrl: assessment.effectiveUrl,
              scope: assessment.scope,
              permissions: assessment.permissionsGranted,
              enabledChecks: assessment.enabledChecks,
              disabledChecks: assessment.disabledChecks,
              ruleVersions: assessment.ruleVersions,
              reproducibility: assessment.reproducibility,
            },
            null,
            2
          )}
        </pre>
      </details>
    </div>
  );
}
