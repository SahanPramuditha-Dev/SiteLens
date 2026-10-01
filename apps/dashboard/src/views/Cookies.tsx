import { Cookie, ShieldCheck } from 'lucide-react';
import type { Assessment, CookieMetadata } from '@sitelens/shared-types';

export const CookiesView = ({ assessment }: { assessment: Assessment }) => {
  const cookieEv = assessment.evidence.find((e) => e.label === 'Cookie attributes');
  const cookies = ((cookieEv?.data as any)?.cookies as CookieMetadata[]) || [];

  const insecure = cookies.filter((c) => !c.secure);
  const noHttpOnly = cookies.filter((c) => !c.httpOnly);
  const badSameSite = cookies.filter(
    (c) => c.sameSite === 'unspecified' || c.sameSite === 'no_restriction'
  );

  return (
    <div className="space-y-6">
      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
          <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
            Total Cookies
          </h3>
          <div className="text-2xl font-bold text-slate-800">{cookies.length}</div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
          <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
            Missing Secure
          </h3>
          <div className="text-2xl font-bold text-amber-600">{insecure.length}</div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
          <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
            Missing HttpOnly
          </h3>
          <div className="text-2xl font-bold text-amber-600">{noHttpOnly.length}</div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
          <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
            Weak SameSite
          </h3>
          <div className="text-2xl font-bold text-amber-600">{badSameSite.length}</div>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="px-6 py-5 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Cookie className="text-emerald-600 h-5 w-5" />
            <h3 className="font-semibold text-slate-800">Cookie Security Analyzer</h3>
          </div>
        </div>

        {cookies.length === 0 ? (
          <div className="p-12 text-center text-slate-500 flex flex-col items-center">
            <ShieldCheck className="h-12 w-12 text-emerald-400 mb-3" />
            <p className="font-medium text-slate-700">No Cookies Detected</p>
            <p className="text-sm mt-1">This site does not set any cookies.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100 text-xs uppercase tracking-wider text-slate-500">
                  <th className="px-6 py-3 font-semibold">Name</th>
                  <th className="px-6 py-3 font-semibold">Domain</th>
                  <th className="px-6 py-3 font-semibold">Secure</th>
                  <th className="px-6 py-3 font-semibold">HttpOnly</th>
                  <th className="px-6 py-3 font-semibold">SameSite</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {cookies.map((c, i) => (
                  <tr key={i} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="text-sm font-semibold text-slate-700 break-all">{c.name}</div>
                      <div className="text-[10px] text-slate-400 mt-0.5 uppercase tracking-wide">
                        {c.session ? 'Session' : 'Persistent'}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-600">{c.domain}</td>

                    <td className="px-6 py-4">
                      <span
                        className={`text-[11px] font-bold uppercase px-2 py-0.5 rounded-full ${
                          c.secure
                            ? 'bg-emerald-100 text-emerald-700'
                            : 'bg-amber-100 text-amber-700'
                        }`}
                      >
                        {c.secure ? 'Yes' : 'No'}
                      </span>
                    </td>

                    <td className="px-6 py-4">
                      <span
                        className={`text-[11px] font-bold uppercase px-2 py-0.5 rounded-full ${
                          c.httpOnly
                            ? 'bg-emerald-100 text-emerald-700'
                            : 'bg-amber-100 text-amber-700'
                        }`}
                      >
                        {c.httpOnly ? 'Yes' : 'No'}
                      </span>
                    </td>

                    <td className="px-6 py-4">
                      <span
                        className={`text-[11px] font-bold uppercase px-2 py-0.5 rounded-full ${
                          c.sameSite === 'strict' || c.sameSite === 'lax'
                            ? 'bg-emerald-100 text-emerald-700'
                            : 'bg-amber-100 text-amber-700'
                        }`}
                      >
                        {c.sameSite || 'Unspecified'}
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
