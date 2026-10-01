import type { Assessment, ScriptAnalysis } from '@sitelens/shared-types';
export function ClientSideSecurityView({ assessment }: { assessment: Assessment }) {
  const analysis = assessment.evidence.find((e) => e.label === 'Client-side AST observations')
    ?.data as ScriptAnalysis | null;
  return (
    <div className="space-y-5">
      <section className="bg-white rounded-xl border p-6">
        <h3 className="font-bold">Client-side security evidence</h3>
        <p className="text-sm text-slate-500 mt-3">
          {analysis?.limitation || 'No inline-script analysis collected.'}
        </p>
        <p className="text-sm mt-3">
          Parsed {analysis?.parsed || 0} scripts; {analysis?.failed || 0} unsupported or failed
          parses. Exploitability is not confirmed.
        </p>
      </section>
      {analysis && (
        <>
          <section className="bg-white rounded-xl border p-6">
            <h3 className="font-bold">Potential source → sink expressions</h3>
            {analysis.flows.length ? (
              analysis.flows.map((f, i) => (
                <div key={i} className="border-b py-4 text-sm">
                  <b>
                    {f.source} → {f.sink}
                  </b>
                  <p className="text-slate-500">
                    {f.scriptId}, line {f.line} · {f.confidence} confidence · {f.method}
                  </p>
                </div>
              ))
            ) : (
              <p className="text-sm text-slate-500 mt-3">
                No direct relationship observed. This is not a protection claim.
              </p>
            )}
          </section>
          <section className="bg-white rounded-xl border p-6">
            <h3 className="font-bold">API observations</h3>
            {analysis.apis.map((a, i) => (
              <p key={i} className="text-sm mt-2">
                {a.name} · {a.scriptId}:{a.line}
              </p>
            ))}
          </section>
          <section className="bg-white rounded-xl border p-6">
            <h3 className="font-bold">Message handlers</h3>
            {analysis.handlers.map((h, i) => (
              <p key={i} className="text-sm mt-3">
                {h.scriptId}:{h.line} · Origin comparison:{' '}
                {h.originCheck ? 'pattern observed' : 'not resolved'} · Source comparison:{' '}
                {h.sourceCheck ? 'pattern observed' : 'not resolved'}. Validation correctness
                remains unknown.
              </p>
            ))}
          </section>
        </>
      )}
    </div>
  );
}
