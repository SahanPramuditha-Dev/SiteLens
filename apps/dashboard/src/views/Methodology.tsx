import { BookOpen, AlertCircle } from 'lucide-react';
import { CHECKS } from '@sitelens/rule-definitions';

export const MethodologyView = () => {
  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="px-6 py-5 border-b border-slate-100 bg-slate-50/50 flex items-center gap-3">
          <BookOpen className="text-slate-600 h-5 w-5" />
          <h3 className="font-semibold text-slate-800">Methodology Library</h3>
        </div>
        <div className="p-6">
          <p className="text-sm text-slate-500 mb-8">
            SiteLens is entirely transparent about its assessment rules. Below are the definitions,
            limitations, and evaluation methods for all supported security checks.
          </p>

          <div className="space-y-12">
            {CHECKS.map((c) => (
              <div key={c.id} className="border border-slate-200 rounded-lg overflow-hidden">
                <div className="px-5 py-4 bg-slate-50/80 border-b border-slate-200 flex justify-between items-start">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-[10px] uppercase font-bold tracking-wider text-slate-500">
                        {c.category}
                      </span>
                      <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-slate-200 text-slate-600">
                        {c.severity} Severity
                      </span>
                    </div>
                    <h4 className="font-bold text-slate-800 text-lg">{c.name}</h4>
                    <p className="text-xs font-mono text-slate-500 mt-1">{c.id}</p>
                  </div>
                </div>

                <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-6 text-sm text-slate-700">
                  <div className="space-y-4">
                    <div>
                      <strong className="block text-xs uppercase tracking-wide text-slate-500 mb-1">
                        Evaluation Method
                      </strong>
                      <p>{c.method}</p>
                    </div>
                    <div>
                      <strong className="block text-xs uppercase tracking-wide text-slate-500 mb-1">
                        Impact
                      </strong>
                      <p>{c.impact}</p>
                    </div>
                    <div className="bg-amber-50/50 border border-amber-100 rounded-md p-3">
                      <strong className="flex items-center gap-1.5 text-xs uppercase tracking-wide text-amber-700 mb-1">
                        <AlertCircle className="h-3.5 w-3.5" /> Limitations
                      </strong>
                      <p className="text-amber-900/80">{c.limitation}</p>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div>
                      <strong className="block text-xs uppercase tracking-wide text-slate-500 mb-1">
                        Recommendation
                      </strong>
                      <p>{c.recommendation}</p>
                    </div>
                    <div>
                      <strong className="block text-xs uppercase tracking-wide text-slate-500 mb-1">
                        Educational Context
                      </strong>
                      <p>{c.learning}</p>
                    </div>
                    {c.references.length > 0 && (
                      <div>
                        <strong className="block text-xs uppercase tracking-wide text-slate-500 mb-1">
                          References
                        </strong>
                        <ul className="list-disc pl-4 space-y-1">
                          {c.references.map((ref, i) => (
                            <li key={i}>
                              <a
                                href={ref}
                                target="_blank"
                                rel="noreferrer"
                                className="text-emerald-600 hover:underline break-all"
                              >
                                {ref}
                              </a>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
