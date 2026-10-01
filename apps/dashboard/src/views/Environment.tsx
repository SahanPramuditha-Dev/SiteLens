import { FileKey2, ShieldAlert, CheckCircle, Database } from 'lucide-react';
import type { Assessment, SecretFinding } from '@sitelens/shared-types';
import { useEffect, useState } from 'react';

export const EnvironmentView = ({ assessment }: { assessment: Assessment }) => {
  const envFinding = assessment.findings.find((f) => f.checkId === 'SL-SECRET-001');
  const evidenceId = envFinding?.evidenceIds[0];
  const envEvidence = assessment.evidence.find(
    (e) => e.id === evidenceId && Array.isArray(e.data) && e.data.some((d) => 'isSecret' in d)
  );
  const secrets = (envEvidence?.data as SecretFinding[]) || [];
  const [liveValues, setLiveValues] = useState<Record<string, string>>({});
  const [valueStatus, setValueStatus] = useState('');
  useEffect(() => {
    let active = true;
    setLiveValues({});
    if (!secrets.length) return;
    setValueStatus('Reading full values from the original website…');
    chrome.runtime
      .sendMessage({ type: 'secret-values', assessmentId: assessment.id })
      .then((result) => {
        if (!active) return;
        if (result?.error) throw new Error(result.error);
        setLiveValues(
          Object.fromEntries(
            (result.values || []).map(
              (v: { key: string; valueFingerprint: string; value: string }) => [
                `${v.key.slice(0, 100)}:${v.valueFingerprint}`,
                v.value,
              ]
            )
          )
        );
        setValueStatus(
          'Full values are displayed from the live page. Saved assessments and exports remain redacted.'
        );
      })
      .catch((error) => {
        if (active)
          setValueStatus(
            error.message || 'Live values are unavailable. Inspect the original website again.'
          );
      });
    return () => {
      active = false;
    };
  }, [assessment.id]);

  const trueSecrets = secrets.filter((s) => s.isSecret);
  const publicConfigs = secrets.filter((s) => s.isLikelyPublic);

  return (
    <div className="space-y-6">
      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex items-center gap-5">
          <div className="bg-amber-50 p-4 rounded-xl border border-amber-100 text-amber-600">
            <ShieldAlert className="h-8 w-8" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-1">
              Potential Secrets
            </h3>
            <div className="text-3xl font-bold text-slate-800">{trueSecrets.length}</div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex items-center gap-5">
          <div className="bg-emerald-50 p-4 rounded-xl border border-emerald-100 text-emerald-600">
            <Database className="h-8 w-8" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-1">
              Public Configurations
            </h3>
            <div className="text-3xl font-bold text-slate-800">{publicConfigs.length}</div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        {valueStatus && (
          <p role="status" className="p-4 text-sm bg-slate-50 text-slate-600">
            {valueStatus}
          </p>
        )}
        <div className="px-6 py-5 border-b border-slate-100 bg-slate-50/50 flex items-center gap-3">
          <FileKey2 className="text-emerald-600 h-5 w-5" />
          <h3 className="font-semibold text-slate-800">Detected Environment Values</h3>
        </div>

        {secrets.length === 0 ? (
          <div className="p-12 text-center text-slate-500 flex flex-col items-center">
            <CheckCircle className="h-12 w-12 text-emerald-400 mb-3" />
            <p className="font-medium text-slate-700">
              No configuration patterns in collected inline scripts
            </p>
            <p className="text-sm mt-1">
              This limited pattern scan does not establish the absence of exposed secrets. External
              bundles were not fetched.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100 text-xs uppercase tracking-wider text-slate-500">
                  <th className="px-6 py-3 font-semibold">Key</th>
                  <th className="px-6 py-3 font-semibold">Location</th>
                  <th className="px-6 py-3 font-semibold">Full live value</th>
                  <th className="px-6 py-3 font-semibold">Category</th>
                  <th className="px-6 py-3 font-semibold">Confidence</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {secrets
                  .sort((a, b) => (a.isSecret === b.isSecret ? 0 : a.isSecret ? -1 : 1))
                  .map((secret, i) => (
                    <tr key={i} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          {secret.isSecret ? (
                            <div className="w-2 h-2 rounded-full bg-amber-500 flex-shrink-0"></div>
                          ) : (
                            <div className="w-2 h-2 rounded-full bg-slate-300 flex-shrink-0"></div>
                          )}
                          <code
                            className={`text-sm font-mono font-semibold ${secret.isSecret ? 'text-amber-700' : 'text-slate-700'}`}
                          >
                            {secret.key}
                          </code>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-xs break-all">
                        {secret.location ? (
                          <>
                            <b>{secret.location.propertyPath}</b>
                            <p>
                              {secret.location.scriptId} · line {secret.location.line}, column{' '}
                              {secret.location.column}
                            </p>
                            <p>{secret.location.url}</p>
                            <p>{secret.location.method}</p>
                          </>
                        ) : (
                          'Location not retained in this older assessment'
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <code className="text-xs bg-slate-100 text-slate-600 px-2 py-1 rounded font-mono whitespace-pre-wrap break-all select-all">
                          {liveValues[`${secret.key}:${secret.valueFingerprint}`] ??
                            secret.valueRedacted}
                        </code>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-xs font-medium text-slate-600 bg-slate-100 px-2 py-1 rounded-full">
                          {secret.category}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={`text-[11px] font-bold uppercase px-2 py-0.5 rounded-full ${
                            secret.confidence === 'High'
                              ? 'bg-amber-100 text-amber-700'
                              : secret.confidence === 'Medium'
                                ? 'bg-blue-100 text-blue-700'
                                : 'bg-slate-100 text-slate-600'
                          }`}
                        >
                          {secret.confidence}
                        </span>
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
