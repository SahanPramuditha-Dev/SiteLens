import { useState } from 'react';
import { TechnologyLogo } from '../components/TechnologyLogo';
import type { Assessment } from '@sitelens/shared-types';
import { TECHNOLOGIES, FINGERPRINT_VERSION } from '@sitelens/technology-detector';
export function TechnologyProfile({ assessment }: { assessment: Assessment }) {
  const [query, setQuery] = useState(''),
    [category, setCategory] = useState('all'),
    [confidence, setConfidence] = useState('all');
  const technologies = assessment.technologies;
  const layers = [...new Set(technologies.map((t) => t.layer))].sort();
  const filtered = technologies.filter(
    (t) =>
      (category === 'all' || t.layer === category) &&
      (confidence === 'all' || t.confidence === confidence) &&
      `${t.name} ${t.layer} ${t.observation}`.toLowerCase().includes(query.toLowerCase())
  );
  const count = new Set(TECHNOLOGIES.map((t) => t.name)).size;
  return (
    <div className="space-y-5">
      <section className="bg-white border border-slate-200 rounded-xl p-6 space-y-3">
        <h3 className="font-semibold text-lg">Technology Profile</h3>
        <p className="text-sm text-slate-600">
          {technologies.length} technologies with observed or inferred indicators across{' '}
          {layers.length} categories. Local fingerprint catalog: {count} technologies ·{' '}
          {FINGERPRINT_VERSION}.
        </p>
        <p className="text-sm text-slate-500">
          Only signals exposed by the inspected page are available. Headers and generator tags are
          self-reported; resource filenames may be renamed or misleading. Detection does not
          establish an installed version, runtime use or backend architecture.
        </p>
        <p className="text-sm text-slate-500">
          Bundled or lazily loaded libraries may expose no passive fingerprint. For additional
          evidence, use Developer Tools → Bundle inspection. Selected bundles are requested only
          with your saved authorization and scope.
        </p>
        {technologies.some((t) => t.fingerprintVersion !== FINGERPRINT_VERSION) && (
          <p className="text-sm bg-amber-50 border border-amber-200 rounded-lg p-3">
            This record contains older fingerprint results. Re-inspect the website to apply the
            current detector; historical assessments are not continuously refreshed.
          </p>
        )}
        <div className="grid md:grid-cols-3 gap-3">
          <input
            aria-label="Search technologies"
            className="border border-slate-200 rounded-lg p-2"
            placeholder="Search name or evidence…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <select
            aria-label="Technology category"
            className="border border-slate-200 rounded-lg p-2"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
          >
            <option value="all">All categories</option>
            {layers.map((l) => (
              <option key={l}>{l}</option>
            ))}
          </select>
          <select
            aria-label="Detection confidence"
            className="border border-slate-200 rounded-lg p-2"
            value={confidence}
            onChange={(e) => setConfidence(e.target.value)}
          >
            <option value="all">All confidence levels</option>
            {['high', 'medium', 'low'].map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </div>
      </section>
      <section className="bg-white border border-slate-200 rounded-xl p-6">
        <h3 className="font-semibold">Observed technology map</h3>
        <p className="text-sm text-slate-500 break-all mb-4">{assessment.origin}</p>
        <div className="grid md:grid-cols-3 gap-4">
          {layers.map((l) => (
            <div className="rounded-lg bg-slate-50 p-4" key={l}>
              <h4 className="font-semibold text-sm mb-2">{l}</h4>
              {technologies
                .filter((t) => t.layer === l)
                .map((t) => (
                  <p className="text-sm text-slate-600 py-1 flex items-center gap-2" key={t.name}>
                    <TechnologyLogo name={t.name} size={18} />
                    {t.name}
                    {t.detection === 'inferred' ? ' ?' : ''}{' '}
                    <span className="text-xs">· {t.confidence}</span>
                  </p>
                ))}
            </div>
          ))}
        </div>
        {!technologies.length && (
          <p className="text-sm">
            No supported fingerprints observed. Backend framework, language and database remain
            unknown.
          </p>
        )}
      </section>
      {filtered.map((t) => (
        <article className="bg-white border border-slate-200 rounded-xl p-5" key={t.name}>
          <div className="flex flex-wrap justify-between gap-3">
            <div className="flex gap-3 items-center">
              <span className="rounded-lg bg-slate-50 border border-slate-100 p-2">
                <TechnologyLogo name={t.name} size={32} />
              </span>
              <div>
                <h3 className="font-semibold">
                  {t.name}
                  {t.variant ? ' · ' + t.variant : ''}
                  {t.detection === 'inferred' ? ' ?' : ''}
                </h3>
                <p className="text-xs text-slate-500">{t.layer}</p>
              </div>
            </div>
            <div className="text-sm">
              <span className="bg-slate-100 rounded px-2 py-1">
                {t.detection || 'observed'} · {t.confidence} confidence
              </span>
            </div>
          </div>
          <p className="text-sm mt-4">
            Version: <b>{t.version}</b> · {t.versionConfidence || 'low'} version confidence
          </p>
          {t.versionSource && (
            <p className="text-xs text-slate-500 break-all mt-1">
              Version source: {t.versionSource}
            </p>
          )}
          <details className="mt-4">
            <summary className="cursor-pointer text-sm font-medium text-emerald-700">
              Why am I seeing this? · {t.signals?.length || 1} signals
            </summary>
            {(
              t.signals || [
                {
                  type: 'inference',
                  source: 'Retained observation',
                  confidence: t.confidence,
                  observation: t.observation,
                },
              ]
            ).map((s, i) => (
              <div className="border-t border-slate-100 mt-3 pt-3" key={i}>
                <p className="text-xs uppercase text-slate-500">
                  {s.type} · {s.confidence} confidence
                </p>
                <p className="text-sm break-all mt-1">{s.observation}</p>
                <p className="text-xs text-slate-500 break-all mt-1">Source: {s.source}</p>
              </div>
            ))}
            <p className="text-xs text-slate-500 mt-3">
              Signals can be imitated. A declared version or versioned asset path does not establish
              runtime applicability. No backend or database is inferred without a supporting signal.
            </p>
          </details>
        </article>
      ))}
      {!filtered.length && !!technologies.length && (
        <p className="text-sm text-slate-500">No technologies match these filters.</p>
      )}
    </div>
  );
}
