import type { Assessment } from '@sitelens/shared-types';
export function CrossOriginView({ assessment }: { assessment: Assessment }) {
  return (
    <div className="space-y-5">
      <section className="bg-white border rounded-xl p-6">
        <h3 className="font-bold">Cross-origin & isolation</h3>
        <p className="text-sm text-slate-500 mt-3">
          CORS determines readable cross-origin responses. COOP, COEP and CORP affect isolation and
          resource sharing. Missing policies and wildcard CORS are not automatically
          vulnerabilities.
        </p>
      </section>
      {assessment.findings
        .filter(
          (f) =>
            f.category === 'Cross-Origin & Isolation' ||
            ['SL-TT-001', 'SL-ISOLATION-001', 'SL-HEADER-004', 'SL-RESOURCE-005'].includes(
              f.checkId
            )
        )
        .map((f) => (
          <section key={f.id} className="bg-white border rounded-xl p-6">
            <p className="text-xs text-slate-400">
              {f.checkId} · version {f.ruleVersion || 'legacy'} · {f.status}
            </p>
            <h3 className="font-bold mt-2">{f.title}</h3>
            <p className="text-sm mt-3">{f.observation}</p>
            <p className="text-sm text-slate-500 mt-3">{f.limitation}</p>
            <p className="text-xs text-slate-400 mt-3">Evidence: {f.evidenceIds.join(', ')}</p>
          </section>
        ))}
    </div>
  );
}
