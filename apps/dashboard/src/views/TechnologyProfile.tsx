import { useState } from 'react';
import { TechnologyLogo } from '../components/TechnologyLogo';
import { Dropdown } from '../components/Dropdown';
import type { Assessment } from '@sitelens/shared-types';
import { TECHNOLOGIES, FINGERPRINT_VERSION } from '@sitelens/technology-detector';
import { Search, ChevronDown, ChevronUp, AlertTriangle, Info } from 'lucide-react';

const CONFIDENCE_COLOR: Record<string, string> = {
  high:   'bg-emerald-50 text-emerald-700 border border-emerald-200',
  medium: 'bg-amber-50 text-amber-700 border border-amber-200',
  low:    'bg-slate-100 text-slate-600 border border-slate-200',
};

const VERSION_CONF_COLOR: Record<string, string> = {
  high:    'text-emerald-600',
  medium:  'text-amber-600',
  low:     'text-slate-400',
  unknown: 'text-slate-400',
};

function TechCard({ t }: { t: Assessment['technologies'][number] }) {
  const [open, setOpen] = useState(false);
  const signals = t.signals || [{ type: 'inference', source: 'Retained observation', confidence: t.confidence, observation: t.observation }];
  return (
    <article className="bg-white border border-slate-200 rounded-xl overflow-hidden hover:shadow-sm transition-shadow">
      {/* Header */}
      <div className="px-5 py-4 flex items-center gap-4">
        <span className="shrink-0 rounded-lg bg-slate-50 border border-slate-100 p-2.5 flex items-center justify-center">
          <TechnologyLogo name={t.name} size={28} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-semibold text-slate-900 text-sm truncate">
              {t.name}{t.variant ? ` · ${t.variant}` : ''}{t.detection === 'inferred' ? ' ?' : ''}
            </h3>
            <span className={`text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded ${CONFIDENCE_COLOR[t.confidence] || CONFIDENCE_COLOR.low}`}>
              {t.confidence}
            </span>
          </div>
          <p className="text-[11px] text-slate-400 uppercase tracking-wider mt-0.5">{t.layer}</p>
        </div>
      </div>

      {/* Version row */}
      <div className="px-5 pb-4 grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
        <div>
          <span className="text-slate-400 uppercase tracking-wider text-[10px]">Version</span>
          <p className="text-slate-700 font-medium mt-0.5 truncate">{t.version || 'Not detected'}</p>
        </div>
        <div>
          <span className="text-slate-400 uppercase tracking-wider text-[10px]">Version confidence</span>
          <p className={`font-medium mt-0.5 capitalize ${VERSION_CONF_COLOR[t.versionConfidence || 'low']}`}>
            {t.versionConfidence || 'Low'}
          </p>
        </div>
      </div>

      {/* Signals toggle */}
      <div className="border-t border-slate-100">
        <button
          onClick={() => setOpen(!open)}
          className="w-full flex items-center justify-between px-5 py-3 text-xs font-medium text-slate-500 hover:bg-slate-50 transition-colors"
        >
          <span>{signals.length} detection signal{signals.length !== 1 ? 's' : ''}</span>
          {open ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
        </button>

        {open && (
          <div className="px-5 pb-4 space-y-3">
            {signals.map((s, i) => (
              <div key={i} className="bg-slate-50 rounded-lg p-3 space-y-1.5">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] uppercase tracking-wider font-semibold text-slate-400">{s.type}</span>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded font-semibold ${CONFIDENCE_COLOR[s.confidence] || CONFIDENCE_COLOR.low}`}>
                    {s.confidence}
                  </span>
                </div>
                <p className="text-xs text-slate-700 break-words leading-relaxed">{s.observation}</p>
                <p className="text-[10px] text-slate-400 break-all">Source: {s.source}</p>
              </div>
            ))}
            <p className="text-[10px] text-slate-400 leading-relaxed">
              Signals can be imitated. A declared version does not establish runtime applicability.
              No backend or database is inferred without a supporting signal.
            </p>
          </div>
        )}
      </div>
    </article>
  );
}

export function TechnologyProfile({ assessment }: { assessment: Assessment }) {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('all');
  const [confidence, setConfidence] = useState('all');

  const technologies = assessment.technologies;
  const layers = [...new Set(technologies.map((t) => t.layer))].sort();
  const filtered = technologies.filter(
    (t) =>
      (category === 'all' || t.layer === category) &&
      (confidence === 'all' || t.confidence === confidence) &&
      `${t.name} ${t.layer} ${t.observation}`.toLowerCase().includes(query.toLowerCase())
  );
  const catalogCount = new Set(TECHNOLOGIES.map((t) => t.name)).size;
  const hasStaleFingerprints = technologies.some((t) => t.fingerprintVersion !== FINGERPRINT_VERSION);

  // Group filtered by layer for the grid map view
  const layerGroups = layers.reduce<Record<string, typeof technologies>>((acc, l) => {
    const items = technologies.filter((t) => t.layer === l);
    if (items.length) acc[l] = items;
    return acc;
  }, {});

  return (
    <div className="p-6 space-y-6 max-w-full">
      {/* Header card */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="px-6 py-5 border-b border-slate-100 bg-slate-50/50">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <h2 className="font-semibold text-slate-900">Technology Profile</h2>
              <p className="text-sm text-slate-500 mt-0.5">
                {technologies.length} technologies observed across {layers.length} categories
              </p>
            </div>
            <div className="flex items-center gap-3 text-xs text-slate-400">
              <span className="bg-slate-100 rounded-md px-2 py-1">Catalog: {catalogCount} fingerprints</span>
              <span className="bg-slate-100 rounded-md px-2 py-1">{FINGERPRINT_VERSION}</span>
            </div>
          </div>
        </div>

        {/* Disclaimer */}
        <div className="px-6 py-4 flex items-start gap-3 border-b border-slate-100">
          <Info className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
          <p className="text-xs text-slate-500 leading-relaxed">
            Only signals exposed by the inspected page are available. Headers and generator tags are
            self-reported; resource filenames may be renamed or misleading. Bundled or lazily loaded
            libraries may expose no passive fingerprint.
          </p>
        </div>

        {/* Stale fingerprint warning */}
        {hasStaleFingerprints && (
          <div className="px-6 py-3 flex items-start gap-3 bg-amber-50 border-b border-amber-100">
            <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
            <p className="text-xs text-amber-700">
              This record contains older fingerprint results. Re-inspect the website to apply the
              current detector; historical assessments are not continuously refreshed.
            </p>
          </div>
        )}

        {/* Filters */}
        <div className="px-6 py-4 flex flex-wrap gap-3">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
            <input
              aria-label="Search technologies"
              className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-lg bg-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-400"
              placeholder="Search by name or evidence…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          <Dropdown
            value={category}
            onChange={setCategory}
            options={[
              { value: 'all', label: 'All categories' },
              ...layers.map((l) => ({ value: l, label: l })),
            ]}
          />
          <Dropdown
            value={confidence}
            onChange={setConfidence}
            options={[
              { value: 'all', label: 'All confidence levels' },
              { value: 'high', label: 'High' },
              { value: 'medium', label: 'Medium' },
              { value: 'low', label: 'Low' },
            ]}
          />
        </div>
      </div>


      {/* Summary map — only shown with no active filters */}
      {query === '' && category === 'all' && confidence === 'all' && technologies.length > 0 && (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50">
            <h3 className="text-sm font-semibold text-slate-700">Observed Technology Map</h3>
            <p className="text-xs text-slate-400 mt-0.5 truncate">{assessment.origin}</p>
          </div>
          <div className="px-6 py-4 grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {Object.entries(layerGroups).map(([layer, techs]) => (
              <div key={layer} className="space-y-2">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{layer}</p>
                {techs.map((t) => (
                  <div key={t.name} className="flex items-center gap-2 py-1">
                    <TechnologyLogo name={t.name} size={16} />
                    <span className="text-sm text-slate-700 truncate">{t.name}</span>
                    <span className={`ml-auto text-[9px] font-bold uppercase px-1 py-0.5 rounded ${CONFIDENCE_COLOR[t.confidence] || CONFIDENCE_COLOR.low}`}>
                      {t.confidence[0]}
                    </span>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Technology cards */}
      {filtered.length > 0 ? (
        <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map((t) => <TechCard key={t.name} t={t} />)}
        </div>
      ) : technologies.length > 0 ? (
        <div className="bg-white border border-slate-200 rounded-xl px-6 py-10 text-center">
          <p className="text-sm text-slate-500">No technologies match these filters.</p>
        </div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-xl px-6 py-10 text-center">
          <p className="text-sm font-medium text-slate-600">No supported fingerprints observed</p>
          <p className="text-xs text-slate-400 mt-1">
            Backend framework, language and database remain unknown from passive inspection.
          </p>
        </div>
      )}
    </div>
  );
}
