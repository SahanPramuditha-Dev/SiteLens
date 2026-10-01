import type { Assessment } from '@sitelens/shared-types';
export function ApiSurfaceView({ assessment }: { assessment: Assessment }) {
  const endpoints = assessment.apiEndpoints || [];
  return (
    <section className="bg-white rounded-xl border p-6">
      <h3 className="font-bold">API surface — actual observed requests</h3>
      <p className="text-sm text-slate-500 my-4">
        Only permitted intercepted requests are listed. URL patterns alone do not establish an API.
        Bodies and credential values are not inspected.
      </p>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead>
            <tr>
              {[
                'Endpoint',
                'Category',
                'Method',
                'Status',
                'Content type',
                'Origin',
                'Authentication',
                'CORS',
                'Provenance',
                'First observed',
              ].map((h) => (
                <th className="p-3 border-b" key={h}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {endpoints.map((r, i) => (
              <tr key={i}>
                {[
                  r.url,
                  r.category,
                  r.method,
                  String(r.statusCode ?? 'Unknown'),
                  r.contentType || 'Unknown',
                  r.relationship,
                  r.authentication,
                  JSON.stringify({
                    origin: r.headers['access-control-allow-origin'],
                    credentials: r.headers['access-control-allow-credentials'],
                  }),
                  r.provenance.source,
                  r.firstObserved,
                ].map((value, n) => (
                  <td key={n} className="p-3 border-b break-all">
                    {value}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!endpoints.length && (
        <p className="text-sm text-slate-500">
          No API requests captured. Enable observation and reload the target; unobserved endpoints
          may exist.
        </p>
      )}
    </section>
  );
}
