import type { Assessment } from '@sitelens/shared-types';
import { parseCsp } from '@sitelens/rule-definitions/src/policies.js';
export function HeadersView({ assessment }: { assessment: Assessment }) {
  const headers = assessment.evidence.filter(
    (e) => e.type === 'header' && e.data && typeof e.data === 'object' && 'values' in e.data
  );
  const findings = assessment.findings.filter(
    (f) => f.checkId.startsWith('SL-CSP-') || f.checkId.startsWith('SL-HEADER-')
  );
  const policies = assessment.evidence
    .filter(
      (e) =>
        e.label === 'CSP meta policies' ||
        (e.data as { name?: string })?.name === 'content-security-policy'
    )
    .flatMap((e) =>
      Array.isArray(e.data) ? e.data : (e.data as { values?: string[] }).values || []
    );
  return (
    <div className="space-y-5">
      <section className="bg-white border border-slate-200 rounded-xl p-6">
        <h3 className="font-bold text-lg">Document headers and policies</h3>
        <p className="text-slate-600 mt-2">
          Unavailable response evidence is distinct from an absent header. Presence and policy
          syntax do not establish effective protection against every attack.
        </p>
      </section>
      <section className="bg-white border rounded-xl overflow-x-auto">
        <table className="w-full text-sm text-left">
          <thead>
            <tr className="bg-slate-50">
              <th className="p-4">Header</th>
              <th className="p-4">Observation</th>
              <th className="p-4">Source / time</th>
            </tr>
          </thead>
          <tbody>
            {headers.map((e) => {
              const data = e.data as { name: string; values: string[] | null };
              return (
                <tr className="border-t" key={e.id}>
                  <td className="p-4">{data.name}</td>
                  <td className="p-4 whitespace-pre-wrap break-all font-mono">
                    {data.values === null
                      ? 'Unable to assess — response not captured'
                      : data.values.length
                        ? data.values.join('\n')
                        : 'Not present in captured document response'}
                  </td>
                  <td className="p-4 text-xs">
                    {e.provenance?.source}
                    <br />
                    {e.collectedAt}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>
      <section className="bg-white border rounded-xl p-6 space-y-4">
        <h3 className="font-bold">CSP directive inventory</h3>
        <p className="text-sm text-slate-500">
          Policies remain separate. Each policy uses its first occurrence of a directive; combined
          enforcement and browser behavior need contextual review.
        </p>
        {!policies.length && (
          <p>
            No CSP policy was available in collected evidence. See the CSP presence finding for
            assessment status.
          </p>
        )}
        {policies.map((p: string, i: number) => (
          <details key={i}>
            <summary className="cursor-pointer">Policy {i + 1}</summary>
            <pre className="text-xs whitespace-pre-wrap break-all bg-slate-50 p-3">
              {JSON.stringify(Object.fromEntries(parseCsp(p)), null, 2)}
            </pre>
          </details>
        ))}
      </section>
      {findings.map((f) => (
        <section className="bg-white border rounded-xl p-5" key={f.id}>
          <h4 className="font-semibold">{f.title}</h4>
          <p className="text-xs text-slate-500 mt-1">
            {f.checkId} · {f.status.replaceAll('_', ' ')} · {f.confidence} confidence
          </p>
          <p className="text-sm mt-3">{f.observation}</p>
          <p className="text-sm text-slate-500 mt-2">{f.limitation}</p>
        </section>
      ))}
    </div>
  );
}
