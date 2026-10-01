import {
  ShieldCheck,
  ShieldAlert,
  Activity,
  HelpCircle,
  CheckSquare,
  AlertCircle,
  ArrowRight,
  Globe,
  CheckCircle2,
  MinusCircle,
  Plus,
  GitCompare,
  Info,
  X,
} from 'lucide-react';
import type { Assessment, Coverage, Finding } from '@sitelens/shared-types';
import { compareAssessments } from '@sitelens/extension/src/core/history';

const severityColors: Record<string, string> = {
  critical: 'bg-red-100 text-red-700 border border-red-200',
  high: 'bg-orange-100 text-orange-700 border border-orange-200',
  medium: 'bg-amber-100 text-amber-700 border border-amber-200',
  low: 'bg-sky-100 text-sky-700 border border-sky-200',
  informational: 'bg-slate-100 text-slate-600 border border-slate-200',
};

const confidenceColors: Record<string, string> = {
  high: 'text-emerald-600 font-semibold',
  medium: 'text-amber-600 font-semibold',
  low: 'text-slate-400 font-semibold',
};

const coverageStatusIcon = (s: Coverage['status']) =>
  s === 'assessed' ? (
    <CheckCircle2 className="h-4 w-4 text-emerald-500 flex-shrink-0" />
  ) : s === 'partial' ? (
    <MinusCircle className="h-4 w-4 text-amber-500 flex-shrink-0" />
  ) : s === 'not assessed' ? (
    <HelpCircle className="h-4 w-4 text-slate-400 flex-shrink-0" />
  ) : (
    <X className="h-4 w-4 text-slate-300 flex-shrink-0" />
  );

const coverageStatusBadge = (s: Coverage['status']) => {
  const base = 'text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded';
  return s === 'assessed'
    ? `${base} bg-emerald-100 text-emerald-700`
    : s === 'partial'
      ? `${base} bg-amber-100 text-amber-700`
      : s === 'not assessed'
        ? `${base} bg-slate-100 text-slate-500`
        : `${base} bg-slate-100 text-slate-400`;
};

function formatDuration(ms: number): string {
  if (!ms) return '–';
  return ms < 1000 ? `${ms}ms` : `${(ms / 1000).toFixed(1)}s`;
}

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

// ─── sub-components ─────────────────────────────────────────────────────────

interface KpiCardProps {
  label: string;
  value: number | string;
  sub?: string;
  accent?: 'emerald' | 'amber' | 'blue' | 'slate' | 'rose';
  icon: React.ReactNode;
}

function KpiCard({ label, value, sub, accent = 'slate', icon }: KpiCardProps) {
  const colors: Record<string, string> = {
    emerald: 'border-emerald-200 bg-emerald-50/40 text-emerald-700',
    amber: 'border-amber-200 bg-amber-50/40 text-amber-700',
    blue: 'border-blue-200 bg-blue-50/40 text-blue-700',
    slate: 'border-slate-200 bg-slate-50/40 text-slate-700',
    rose: 'border-rose-200 bg-rose-50/40 text-rose-700',
  };
  const iconColors: Record<string, string> = {
    emerald: 'text-emerald-500',
    amber: 'text-amber-500',
    blue: 'text-blue-500',
    slate: 'text-slate-400',
    rose: 'text-rose-500',
  };
  return (
    <div
      className={`bg-white rounded-xl border shadow-sm p-5 flex flex-col gap-2 ${colors[accent]}`}
    >
      <div className="flex items-center justify-between">
        <span className="text-[10px] uppercase font-bold tracking-widest text-current opacity-70">
          {label}
        </span>
        <span className={iconColors[accent]}>{icon}</span>
      </div>
      <div className="flex items-end gap-2">
        <span className="text-3xl font-bold leading-none">{value}</span>
        {sub && <span className="text-sm text-slate-400 font-normal mb-0.5">{sub}</span>}
      </div>
    </div>
  );
}

// ─── main ───────────────────────────────────────────────────────────────────

interface Props {
  assessment: Assessment;
  allAssessments: Assessment[];
  setView: (v: string) => void;
}

export const Overview = ({ assessment, allAssessments, setView }: Props) => {
  const protections = assessment.findings.filter((f) => f.status === 'protection_observed');
  const weaknesses = assessment.findings.filter((f) => f.status === 'potential_weakness');
  const observations = assessment.findings.filter((f) => f.status === 'informational');
  const unable = assessment.findings.filter((f) => f.status === 'unable_to_assess');

  // Priority findings – sorted by severity then confidence
  const severityRank: Record<string, number> = {
    critical: 5,
    high: 4,
    medium: 3,
    low: 2,
    informational: 1,
  };
  const priorityFindings: Finding[] = [...weaknesses]
    .sort(
      (a, b) =>
        severityRank[b.severity] - severityRank[a.severity] || (b.confidence === 'high' ? 1 : -1)
    )
    .slice(0, 5);

  // Previous assessment for same target
  const prevAssessments = allAssessments
    .filter((a) => a.targetKey === assessment.targetKey && a.id !== assessment.id)
    .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
  const prev = prevAssessments[0];

  let diffs: ReturnType<typeof compareAssessments> = [];
  try {
    if (prev) diffs = compareAssessments(prev, assessment);
  } catch {}

  const improvements = diffs.filter(
    (d) =>
      d.type === 'status' && d.after === 'protection_observed' && d.before === 'potential_weakness'
  );
  const regressions = diffs.filter(
    (d) =>
      d.type === 'status' && d.after === 'potential_weakness' && d.before !== 'potential_weakness'
  );
  const newFindings = diffs.filter((d) => d.type === 'added');

  // Security configuration snapshot
  const headerEvidence = (checkId: string) =>
    assessment.findings.find((f) => f.checkId === checkId);

  const secConfig: { label: string; checkId: string }[] = [
    { label: 'HTTPS', checkId: 'SL-TLS-001' },
    { label: 'HSTS', checkId: 'SL-HEADER-001' },
    { label: 'Content-Security-Policy', checkId: 'SL-CSP-001' },
    { label: 'X-Content-Type-Options', checkId: 'SL-HEADER-002' },
    { label: 'X-Frame-Options / Frame Ancestors', checkId: 'SL-HEADER-004' },
    { label: 'Referrer-Policy', checkId: 'SL-HEADER-003' },
    { label: 'Permissions-Policy', checkId: 'SL-HEADER-005' },
    { label: 'Secure session cookies', checkId: 'SL-COOKIE-001' },
  ];

  // Severity distribution
  const sevDist: Record<string, number> = {
    critical: 0,
    high: 0,
    medium: 0,
    low: 0,
    informational: 0,
  };
  for (const f of weaknesses) sevDist[f.severity] = (sevDist[f.severity] || 0) + 1;
  const maxSev = Math.max(...Object.values(sevDist), 1);

  // Unique assessment ID short display
  const shortId = assessment.id?.slice(0, 13).toUpperCase() ?? '–';

  // Hostname for header
  let hostname = '–';
  try {
    hostname = new URL(assessment.url).hostname;
  } catch {}

  // Coverage areas – use stored coverage + synthesise if empty
  const coverageAreas: Coverage[] = assessment.coverage?.length
    ? assessment.coverage
    : [
        { area: 'HTTPS & Transport', status: 'assessed', detail: '' },
        { area: 'Security Headers', status: 'assessed', detail: '' },
        { area: 'CSP', status: 'assessed', detail: '' },
        { area: 'Cookies', status: 'partial', detail: '' },
        { area: 'Forms', status: 'assessed', detail: '' },
        { area: 'Resources', status: 'assessed', detail: '' },
        { area: 'Technologies', status: 'partial', detail: '' },
        { area: 'Authentication', status: 'not assessed', detail: 'Not browser-visible.' },
        {
          area: 'Backend / Server',
          status: 'not assessable',
          detail: 'Requires server-side access.',
        },
      ];

  return (
    <div className="space-y-5">
      {/* ── 1. Assessment Identity Bar ──────────────────────────────── */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm px-6 py-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-3">
            <Globe className="h-8 w-8 text-slate-300 flex-shrink-0" />
            <div>
              <p className="text-xl font-bold text-slate-800 leading-tight">{hostname}</p>
              <p className="text-xs text-slate-400 mt-0.5 font-mono break-all">{assessment.url}</p>
            </div>
          </div>
          <div className="flex flex-col sm:items-end gap-1 text-xs text-slate-500">
            <div className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-emerald-500 inline-block animate-pulse" />
              <span className="font-semibold text-emerald-700">Assessment complete</span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-1 gap-x-6 gap-y-0.5 text-slate-400 text-[11px]">
              <span>
                <span className="text-slate-500 font-medium">Last assessed:</span>{' '}
                {formatDate(assessment.createdAt)}
              </span>
              <span>
                <span className="text-slate-500 font-medium">Assessment ID:</span> {shortId}
              </span>
              <span>
                <span className="text-slate-500 font-medium">Mode:</span> Passive Assessment
              </span>
              <span>
                <span className="text-slate-500 font-medium">Duration:</span>{' '}
                {formatDuration(assessment.durationMs)}
              </span>
              <span className="col-span-2 sm:col-span-1">
                <span className="text-slate-500 font-medium">Browser:</span>{' '}
                {assessment.browser?.slice(0, 60) || '–'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* ── 2. KPI Cards ────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <KpiCard
          label="Protections Observed"
          value={protections.length}
          accent="emerald"
          icon={<ShieldCheck className="h-5 w-5" />}
        />
        <KpiCard
          label="Potential Weaknesses"
          value={weaknesses.length}
          accent={weaknesses.length > 0 ? 'amber' : 'slate'}
          icon={<ShieldAlert className="h-5 w-5" />}
        />
        <KpiCard
          label="Informational"
          value={observations.length}
          accent="blue"
          icon={<Activity className="h-5 w-5" />}
        />
        <KpiCard
          label="Unable to Assess"
          value={unable.length}
          accent="slate"
          icon={<HelpCircle className="h-5 w-5" />}
        />
        <KpiCard
          label="Assessment Coverage"
          value={assessment.checksCompleted}
          sub={`/ ${assessment.checksTotal}`}
          accent="slate"
          icon={<CheckSquare className="h-5 w-5" />}
        />
      </div>

      {/* ── 3+4. Priority Findings & Security Config ─────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* Priority Findings */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wider">
              Priority Findings
            </h3>
            <button
              onClick={() => setView('findings')}
              className="text-xs text-emerald-600 hover:underline flex items-center gap-1"
            >
              View all <ArrowRight className="h-3 w-3" />
            </button>
          </div>
          {priorityFindings.length === 0 ? (
            <div className="px-5 py-8 text-center text-sm text-slate-500 flex flex-col items-center gap-2">
              <CheckCircle2 className="h-8 w-8 text-emerald-400" />
              No potential weaknesses in the checks that could be assessed.
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {priorityFindings.map((f, i) => (
                <div
                  key={i}
                  className="px-5 py-3.5 flex items-start justify-between gap-3 hover:bg-slate-50/50"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-slate-800 truncate">{f.title}</p>
                    <p className="text-[11px] text-slate-500 font-mono mt-0.5">{f.checkId}</p>
                  </div>
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    <span
                      className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded-full ${severityColors[f.severity]}`}
                    >
                      {f.severity}
                    </span>
                    <span className={`text-[10px] ${confidenceColors[f.confidence]}`}>
                      {f.confidence} conf.
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Security Configuration Snapshot */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 bg-slate-50/50">
            <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wider">
              Security Configuration
            </h3>
          </div>
          <div className="divide-y divide-slate-100">
            {secConfig.map(({ label, checkId }) => {
              const f = headerEvidence(checkId);
              const ok = f?.status === 'protection_observed';
              const warn = f?.status === 'potential_weakness';
              const unknown = !ok && !warn;
              return (
                <div key={checkId} className="px-5 py-2.5 flex items-center justify-between gap-2">
                  <span className="text-sm text-slate-700">{label}</span>
                  {ok && (
                    <span className="flex items-center gap-1 text-emerald-600 text-xs font-semibold">
                      <CheckCircle2 className="h-3.5 w-3.5" /> Present
                    </span>
                  )}
                  {warn && (
                    <span className="flex items-center gap-1 text-amber-600 text-xs font-semibold">
                      <AlertCircle className="h-3.5 w-3.5" /> Weakness
                    </span>
                  )}
                  {unknown && (
                    <span className="flex items-center gap-1 text-slate-400 text-xs">
                      ○ {f ? f.status.replaceAll('_', ' ') : 'Not checked'}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── 5+18. Changes Since Last Assessment / Baseline ──────────── */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
          <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wider flex items-center gap-2">
            <GitCompare className="h-4 w-4 text-slate-500" /> Changes Since Previous Assessment
          </h3>
          {prev && (
            <span className="text-[11px] text-slate-400">vs. {formatDate(prev.createdAt)}</span>
          )}
        </div>

        {!prev ? (
          <div className="px-5 py-5 text-sm text-slate-500">
            No previous assessment found.{' '}
            <button onClick={() => setView('history')} className="text-emerald-600 hover:underline">
              View history →
            </button>
          </div>
        ) : diffs.length === 0 ? (
          <div className="px-5 py-5 text-sm text-slate-500 flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
            No changes detected since the previous assessment.
          </div>
        ) : (
          <div className="px-5 py-4 grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-emerald-600 mb-2 flex items-center gap-1">
                <Plus className="h-3 w-3" /> Improvements ({improvements.length})
              </p>
              {improvements.length === 0 ? (
                <p className="text-xs text-slate-400">None</p>
              ) : (
                improvements.slice(0, 3).map((d, i) => (
                  <p key={i} className="text-xs text-slate-700 py-0.5 truncate">
                    + {d.title}
                  </p>
                ))
              )}
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-amber-600 mb-2 flex items-center gap-1">
                <AlertCircle className="h-3 w-3" /> Regressions ({regressions.length})
              </p>
              {regressions.length === 0 ? (
                <p className="text-xs text-slate-400">None</p>
              ) : (
                regressions.slice(0, 3).map((d, i) => (
                  <p key={i} className="text-xs text-slate-700 py-0.5 truncate">
                    ! {d.title}
                  </p>
                ))
              )}
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-sky-600 mb-2 flex items-center gap-1">
                <Info className="h-3 w-3" /> New ({newFindings.length})
              </p>
              {newFindings.length === 0 ? (
                <p className="text-xs text-slate-400">None</p>
              ) : (
                newFindings.slice(0, 3).map((d, i) => (
                  <p key={i} className="text-xs text-slate-700 py-0.5 truncate">
                    ~ {d.title}
                  </p>
                ))
              )}
            </div>
          </div>
        )}
      </div>

      {/* ── 6. Coverage by Area + 19. Severity Distribution ─────────── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* Coverage by Area */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 bg-slate-50/50">
            <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wider">
              Coverage by Area
            </h3>
          </div>
          <div className="divide-y divide-slate-100">
            {coverageAreas.map((c, i) => (
              <div key={i} className="px-5 py-2.5 flex items-center gap-3">
                {coverageStatusIcon(c.status)}
                <span className="flex-1 text-sm text-slate-700">{c.area}</span>
                <span className={coverageStatusBadge(c.status)}>{c.status}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Severity Distribution + Technologies */}
        <div className="flex flex-col gap-5">
          {/* Severity Distribution */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100 bg-slate-50/50">
              <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wider">
                Weakness Severity Distribution
              </h3>
            </div>
            <div className="px-5 py-4 space-y-2.5">
              {(['critical', 'high', 'medium', 'low', 'informational'] as const).map((sev) => {
                const count = sevDist[sev] || 0;
                const barW = Math.round((count / maxSev) * 100);
                return (
                  <div key={sev} className="flex items-center gap-3">
                    <span className="w-20 text-[11px] uppercase font-semibold text-slate-500 flex-shrink-0 capitalize">
                      {sev}
                    </span>
                    <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className={`h-2 rounded-full ${
                          sev === 'critical'
                            ? 'bg-red-500'
                            : sev === 'high'
                              ? 'bg-orange-500'
                              : sev === 'medium'
                                ? 'bg-amber-400'
                                : sev === 'low'
                                  ? 'bg-sky-400'
                                  : 'bg-slate-300'
                        }`}
                        style={{ width: `${barW}%` }}
                      />
                    </div>
                    <span className="w-4 text-xs text-slate-500 text-right">{count}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Assessment Distribution (replaces donut) */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100 bg-slate-50/50">
              <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wider">
                Assessment Distribution
              </h3>
            </div>
            <div className="px-5 py-4 space-y-2">
              {[
                {
                  label: 'Protection Observed',
                  count: protections.length,
                  color: 'bg-emerald-500',
                },
                { label: 'Potential Weakness', count: weaknesses.length, color: 'bg-amber-400' },
                { label: 'Informational', count: observations.length, color: 'bg-blue-400' },
                {
                  label: 'Not applicable',
                  count: assessment.findings.filter((f) => f.status === 'not_applicable').length,
                  color: 'bg-slate-200',
                },
                { label: 'Unable to Assess', count: unable.length, color: 'bg-slate-300' },
              ].map(({ label, count, color }) => (
                <div key={label} className="flex items-center gap-3">
                  <span className={`h-2.5 w-2.5 rounded-full flex-shrink-0 ${color}`} />
                  <span className="flex-1 text-sm text-slate-700">{label}</span>
                  <span className="text-sm font-bold text-slate-700">{count}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── 7. Detected Technologies ────────────────────────────────── */}
      {assessment.technologies.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wider">
              Detected Technologies
            </h3>
            <span className="text-xs text-slate-400">{assessment.technologies.length} detected</span>
          </div>
          <div className="p-5 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
            {assessment.technologies.map((t, i) => (
              <div
                key={i}
                className="flex items-center gap-2.5 px-3 py-2.5 bg-slate-50 rounded-lg border border-slate-100 hover:border-slate-200 transition-colors"
              >
                <span className="shrink-0">
                  <TechnologyLogo name={t.name} size={20} />
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-slate-800 truncate">{t.name}</p>
                  <p className="text-[10px] text-slate-400 uppercase tracking-wider truncate">{t.layer}</p>
                </div>
                <span
                  className={`ml-auto shrink-0 text-[9px] px-1 py-0.5 rounded font-bold uppercase ${
                    t.confidence === 'high'
                      ? 'bg-emerald-100 text-emerald-700'
                      : t.confidence === 'medium'
                        ? 'bg-amber-100 text-amber-700'
                        : 'bg-slate-100 text-slate-500'
                  }`}
                >
                  {t.confidence[0]}
                </span>
              </div>
            ))}
          </div>
          <div className="px-5 pb-4">
            <button
              onClick={() => setView('technologies')}
              className="text-xs text-emerald-600 hover:underline flex items-center gap-1"
            >
              View full technology profile <ArrowRight className="h-3 w-3" />
            </button>
          </div>
        </div>
      )}


      {/* ── 9. Assessment Limitations ───────────────────────────────── */}
      <div className="bg-slate-50 rounded-xl border border-slate-200 px-5 py-4 flex items-start gap-3">
        <Info className="h-4 w-4 text-slate-400 flex-shrink-0 mt-0.5" />
        <div>
          <p className="text-xs font-bold text-slate-600 uppercase tracking-wider mb-1">
            Assessment Limitations
          </p>
          <p className="text-sm text-slate-500">
            SiteLens performs browser-visible passive assessment only. Authentication logic, backend
            authorisation, database access, internal services, and server-side vulnerabilities are
            not directly assessed. Confidence levels reflect evidence quality, not exploitability.
          </p>
          <button
            onClick={() => setView('coverage')}
            className="text-xs text-emerald-600 hover:underline mt-1.5 flex items-center gap-1"
          >
            View methodology & full coverage <ArrowRight className="h-3 w-3" />
          </button>
        </div>
      </div>
    </div>
  );
};
import { TechnologyLogo } from '../components/TechnologyLogo';
