import type {
  Assessment,
  Evidence,
  Finding,
  LifecycleEvent,
  Settings,
} from '@sitelens/shared-types';
import { CHECKS, CHECK_BY_ID } from '@sitelens/rule-definitions';
import { compareAssessments } from './core/history';
import { originOf } from '@sitelens/rule-definitions/src/privacy.js';
import { STATES, DEFAULT_SETTINGS } from './repository';
import {
  badge,
  date,
  download,
  esc,
  labels,
  portable,
  safeReference,
  send,
  table,
} from './ui/shared';
import { reportHtml } from './report';
const $ = <T extends HTMLElement = HTMLElement>(selector: string) =>
  document.querySelector<T>(selector)!;
let assessments: Assessment[] = [],
  events: LifecycleEvent[] = [],
  settings: Settings = DEFAULT_SETTINGS,
  current: Assessment | undefined,
  legacyCount = 0;
let view = location.hash.slice(1) || 'overview',
  query = '',
  status = '',
  severity = '',
  category = '',
  evidenceType = '',
  busy = false;
let compareBefore = '',
  compareAfter = '',
  deletePending = '';
const TITLES: Record<string, string> = {
  overview: 'Assessment overview',
  findings: 'Findings',
  evidence: 'Evidence explorer',
  coverage: 'Assessment coverage',
  headers: 'Security headers',
  cookies: 'Cookie inspector',
  resources: 'Resources & domains',
  technology: 'Technology map',
  relationships: 'Finding relationships',
  history: 'History & comparison',
  methodology: 'Inspection methodology',
  settings: 'Settings & privacy',
};
function notice(message: string) {
  $('#notice').hidden = !message;
  $('#notice').textContent = message;
}
function empty(title: string, body: string) {
  return `<div class="card empty"><div class="empty-icon">◈</div><h2>${esc(title)}</h2><p>${esc(body)}</p></div>`;
}
function option(value: string, label = value, selected = '') {
  return `<option value="${esc(value)}"${value === selected ? ' selected' : ''}>${esc(label)}</option>`;
}
function evidenceCard(e: Evidence) {
  return `<details class="evidence-card" id="evidence-${esc(e.id)}"><summary><span class="mono">${esc(e.id)}</span><strong>${esc(e.label)}</strong>${badge(e.type)}</summary><div class="detail-body"><div class="meta-line">${esc(date(e.collectedAt))} · ${esc(e.source)}</div><pre>${esc(JSON.stringify(e.data, null, 2))}</pre><p class="fine">Sensitive fields omitted or redacted.</p><h3>Findings that depend on this evidence</h3><div class="related-links">${
    current!.findings
      .filter((f) => f.evidenceIds.includes(e.id))
      .map(
        (f) =>
          `<button class="text-button" data-finding="${esc(f.checkId)}">${esc(f.title)} ${badge(f.status)}</button>`
      )
      .join('') || '<p>No check depends directly on this collection.</p>'
  }</div></div></details>`;
}
function findingCard(f: Finding) {
  const method = CHECK_BY_ID.get(f.checkId),
    history = events.filter((e) => e.targetKey === current!.targetKey && e.checkId === f.checkId);
  return `<details class="finding-card" id="finding-${esc(f.checkId)}"><summary><span class="finding-dot ${esc(f.status)}"></span><div class="finding-summary"><strong>${esc(f.title)}</strong><span>${esc(f.checkId)} · ${esc(f.category)}</span></div><div class="finding-badges">${badge(f.status)}${badge(f.severity)}${badge(f.confidence, `${f.confidence} confidence`)}</div></summary><div class="detail-body"><div class="observation"><div class="eyebrow">OBSERVATION</div><p>${esc(f.observation)}</p></div><div class="two"><div><h3>Why it matters</h3><p>${esc(f.impact)}</p></div><div><h3>Important limitation</h3><p>${esc(f.limitation)}</p></div></div><h3>Recommendation</h3><p>${esc(f.recommendation)}</p>${settings.learningMode ? `<div class="learning-box"><h3>Learn about this check</h3><p>${esc(method?.learning)}</p><p><b>How SiteLens checks it:</b> ${esc(method?.method)}</p></div>` : ''}<h3>Why am I seeing this?</h3><div class="evidence-buttons">${f.evidenceIds.map((id) => `<button class="secondary small" data-evidence="${esc(id)}">${esc(id)} · ${esc(current!.evidence.find((e) => e.id === id)?.label)}</button>`).join('')}</div><h3>Verify an improvement</h3><p>${esc(f.validation)} Selective verification evaluates only ${esc(f.checkId)} and preserves a separate assessment.</p><button class="secondary" data-verify="${esc(f.checkId)}"${busy ? ' disabled' : ''}>Verify fix →</button><div class="lifecycle-panel"><h3>Finding lifecycle</h3><p class="fine">First observed ${esc(date(f.firstObserved))}. Lifecycle annotations describe your workflow; they do not change inspection results.</p><form class="lifecycle-form" data-check="${esc(f.checkId)}"><label>State<select name="state">${STATES.map((s) => option(s, s, f.lifecycle)).join('')}</select></label><label class="note-label">Note<input name="note" maxlength="2000" placeholder="Optional investigation or remediation note"></label><button type="submit" class="secondary">Save state</button></form>${
    history.length
      ? table(
          ['Time', 'State', 'Note'],
          history.map((e) => [esc(date(e.at)), esc(e.state), esc(e.note)])
        )
      : ''
  }</div><h3>References</h3>${f.references.map((url) => `<a class="reference" href="${esc(safeReference(url))}" target="_blank" rel="noopener noreferrer">${esc(url)} ↗</a>`).join('')}</div></details>`;
}
function overview() {
  const a = current!,
    weaknesses = a.findings.filter((f) => f.status === 'potential_weakness');
  const previous = assessments.find(
    (p) =>
      p.id !== a.id && p.targetKey === a.targetKey && p.kind === 'full' && p.createdAt < a.createdAt
  );
  const changes = previous ? compareAssessments(previous, a) : [];
  return `<div class="stats">${(['protection_observed', 'potential_weakness', 'informational', 'unable_to_assess'] as const).map((s, index) => `<div class="stat stat-${index}"><div class="stat-label">${['◈', '△', 'ⓘ', '◌'][index]} ${esc(labels[s])}</div><strong>${a.findings.filter((f) => f.status === s).length}</strong><span>${['Browser-visible configurations', 'Contextual review recommended', 'Useful environmental observations', 'Evidence or scope unavailable'][index]}</span></div>`).join('')}</div><div class="two overview-grid"><div class="card"><div class="card-heading"><h2>Priorities for review</h2><button class="text-button" data-view="findings">All findings →</button></div>${
    weaknesses.length
      ? weaknesses
          .slice(0, 6)
          .map(
            (f) =>
              `<button class="priority-row" data-finding="${esc(f.checkId)}"><span class="finding-dot potential_weakness"></span><div><strong>${esc(f.title)}</strong><small>${esc(f.category)}</small></div>${badge(f.severity)}<span>↗</span></button>`
          )
          .join('')
      : '<p>No potential weaknesses observed by the available checks. Review assessment coverage before drawing conclusions.</p>'
  }</div><div class="card coverage-summary"><div class="card-heading"><h2>Inspection coverage</h2><button class="text-button" data-view="coverage">View scope →</button></div><div class="coverage-number">${a.checksCompleted}<span>/ ${a.checksTotal}</span></div><p>Checks completed with available evidence</p><progress max="${a.checksTotal}" value="${a.checksCompleted}" aria-label="Checks completed"></progress><div class="coverage-preview">${a.coverage
    .slice(0, 4)
    .map((c) => `<div><span>${esc(c.area)}</span>${badge(c.status)}</div>`)
    .join(
      ''
    )}</div><p class="fine">Coverage describes inspection scope, not website security.</p></div></div><div class="two"><div class="card"><div class="card-heading"><h2>Changes since the previous assessment</h2><button class="text-button" data-view="history">Timeline →</button></div>${
    previous
      ? changes.length
        ? changes
            .slice(0, 7)
            .map(
              (c) =>
                `<div class="change-row"><span>${c.type === 'evidence' ? '~' : '↗'}</span><div><b>${esc(c.title)}</b><small>${c.type === 'evidence' ? 'Evidence changed; observation status unchanged.' : `${esc(labels[c.before as keyof typeof labels] || c.before)} → ${esc(labels[c.after])}`}</small></div></div>`
            )
            .join('')
        : '<p>No status or normalized evidence changes observed.</p>'
      : '<p>Your next assessment of this exact URL will create a comparison.</p>'
  }</div><div class="card trust-card"><div class="eyebrow">EVIDENCE, WITH CONTEXT</div><h2>Understand what was observed.</h2><p>Each finding connects to collected evidence, explains why it matters, and states what it cannot establish.</p><button class="secondary" data-view="evidence">Explore the evidence →</button></div></div>`;
}
function findingView() {
  const categories = [...new Set(current!.findings.map((f) => f.category))];
  return `<div class="filters"><input id="search" aria-label="Search findings" placeholder="Search findings, check IDs, or observations" value="${esc(query)}"><select id="status-filter" aria-label="Filter status">${option('', 'All observations', status)}${Object.entries(
    labels
  )
    .map(([s, l]) => option(s, l, status))
    .join(
      ''
    )}</select><select id="severity-filter" aria-label="Filter severity">${option('', 'All severities', severity)}${['high', 'medium', 'low', 'informational'].map((s) => option(s, s, severity)).join('')}</select><select id="category-filter" aria-label="Filter category">${option('', 'All categories', category)}${categories.map((c) => option(c, c, category)).join('')}</select></div><div id="finding-results"></div>`;
}
function updateFindingResults() {
  const matches = current!.findings.filter(
    (f) =>
      (!status || f.status === status) &&
      (!severity || f.severity === severity) &&
      (!category || f.category === category) &&
      `${f.title} ${f.checkId} ${f.observation}`.toLowerCase().includes(query.toLowerCase())
  );
  $('#finding-results').innerHTML =
    `<p class="result-count">${matches.length} of ${current!.findings.length} observations</p>${matches.map(findingCard).join('') || empty('No matching findings', 'Try another search or clear a filter.')}`;
}
function evidenceView() {
  return `<div class="section-intro"><h2>Collected information, connected to findings</h2><p>Inspect the structured evidence and follow the checks that depend on it.</p></div><div class="filters"><input id="evidence-search" placeholder="Search evidence labels or IDs" aria-label="Search evidence" value="${esc(query)}"><select id="evidence-type" aria-label="Evidence type">${option('', 'All evidence types', evidenceType)}${[...new Set(current!.evidence.map((e) => e.type))].map((t) => option(t, t, evidenceType)).join('')}</select></div><div id="evidence-results"></div>`;
}
function updateEvidenceResults() {
  const matches = current!.evidence.filter(
    (e) =>
      (!evidenceType || e.type === evidenceType) &&
      `${e.label} ${e.id}`.toLowerCase().includes(query.toLowerCase())
  );
  $('#evidence-results').innerHTML =
    matches.map(evidenceCard).join('') ||
    empty('No matching evidence', 'Change your search or evidence type.');
}
function coverageView() {
  return `<div class="card"><h2>What this assessment can establish</h2><p>${current!.checksCompleted} / ${current!.checksTotal} checks had sufficient evidence to return an observation. ${current!.findings.filter((f) => f.status === 'not_applicable').length} checks were not applicable.</p>${table(
    ['Area', 'Coverage', 'Method and limitations'],
    current!.coverage.map((c) => [esc(c.area), badge(c.status), esc(c.detail)])
  )}${current!.limits.length ? `<div class="notice">${esc(current!.limits.join(' '))}</div>` : ''}</div><div class="card"><h2>Unable to assess</h2>${
    current!.findings
      .filter((f) => f.status === 'unable_to_assess')
      .map(
        (f) =>
          `<p><button class="text-button" data-finding="${esc(f.checkId)}">${esc(f.title)} →</button> ${esc(f.observation)}</p>`
      )
      .join('') ||
    '<p>Every selected check returned an observation. Areas outside the scope remain unassessed.</p>'
  }</div>`;
}
function headersView() {
  return `<div class="section-intro"><h2>Document response headers</h2><p>Evidence is bound to the inspected browser document. Reload after granting site access to capture a new response.</p></div><div class="card">${table(
    ['Header', 'Captured value', 'Collected', 'Evidence'],
    current!.evidence
      .filter((e) => e.type === 'header' && e.data && typeof e.data === 'object' && 'values' in e.data)
      .map((e) => {
        const data = e.data as { values: string[] | null };
        return [
          esc(e.label),
          data.values === null
            ? badge('unable_to_assess', 'Unavailable')
            : data.values.length
              ? `<code>${esc(data.values.join('\n'))}</code>`
              : '<span class="muted">Not present</span>',
          esc(date(e.collectedAt)),
          `<button class="text-button" data-evidence="${esc(e.id)}">${esc(e.id)} ↗</button>`,
        ];
      })
  )}</div><div class="card"><h2>HTML meta policies</h2>${current!.evidence
    .filter((e) => ['CSP meta policies', 'Referrer meta policy'].includes(e.label))
    .map((e) => `<h3>${esc(e.label)}</h3><pre>${esc(JSON.stringify(e.data, null, 2))}</pre>`)
    .join('')}</div>`;
}
function cookiesView() {
  const cookieEvidence = current!.evidence.find((e) => e.type === 'cookie'),
    info = cookieEvidence?.data as { limitation?: string; available?: boolean } | undefined;
  return `<div class="section-intro"><h2>Attributes, without values</h2><p>${esc(info?.limitation || 'Cookie metadata was not part of this selective assessment.')}</p></div>${
    current!.cookies.length
      ? `<div class="cookie-grid">${current!.cookies
          .map(
            (c) =>
              `<div class="card cookie-card"><div class="card-heading"><h2>${esc(c.name || '(unnamed)')}</h2>${badge(c.session ? 'Session' : 'Persistent')}</div><div class="redacted-value">Value <code>[REDACTED]</code></div>${table(
                ['Attribute', 'Observed'],
                [
                  [
                    'Secure',
                    badge(
                      c.secure ? 'protection_observed' : 'potential_weakness',
                      c.secure ? 'Yes' : 'No'
                    ),
                  ],
                  ['HttpOnly', esc(c.httpOnly ? 'Yes' : 'No')],
                  ['SameSite', esc(c.sameSite)],
                  ['Domain', esc(c.domain)],
                  ['Path', esc(c.path)],
                  ['Scope', c.hostOnly ? 'Host only' : 'Domain cookie'],
                  [
                    'Prefix',
                    esc(
                      c.name.startsWith('__Host-')
                        ? '__Host-'
                        : c.name.startsWith('__Secure-')
                          ? '__Secure-'
                          : 'None'
                    ),
                  ],
                  ['Partitioned', c.partitioned ? 'Yes' : 'No'],
                  [
                    'Expires',
                    c.session
                      ? 'Session'
                      : c.expirationDate
                        ? esc(date(new Date(c.expirationDate * 1000).toISOString()))
                        : 'Unknown',
                  ],
                ]
              )}${/(session|auth|token|sid$)/i.test(c.name) ? '<p class="fine">This name resembles a session or token cookie. Purpose is inferred with medium confidence.</p>' : ''}</div>`
          )
          .join('')}</div>`
      : empty(
          info?.available ? 'No matching cookies observed' : 'Cookie attributes unavailable',
          info?.available
            ? 'Other cookie paths and embedded third-party cookies may exist.'
            : 'Enable cookie inspection in the popup and inspect the website again.'
        )
  }`;
}
function resourcesView() {
  const grouped = new Map<string, number>();
  for (const r of current!.resources) {
    const origin = originOf(r.url);
    if (origin && origin !== 'null') grouped.set(origin, (grouped.get(origin) || 0) + 1);
  }
  return `<div class="card"><h2>Dependency origins</h2><p>Origins group observed references; they do not establish organizational ownership.</p><div class="domain-grid">${[...grouped].map(([domain, n]) => `<div class="domain-node"><span>${domain === current!.origin ? '◈' : '◇'}</span><b>${esc(domain)}</b><small>${n} resources · ${domain === current!.origin ? 'same origin' : 'third party'}</small></div>`).join('') || '<p>No resource origins observed.</p>'}</div></div><div class="card"><h2>Resource references</h2>${table(
    ['URL', 'Type / source', 'Origin', 'HTTPS', 'Integrity', 'Crossorigin'],
    current!.resources.map((r) => [
      esc(r.url),
      `${esc(r.type)}<small>${esc(r.observedBy)}</small>`,
      r.thirdParty ? 'Third party' : 'Same origin / non-network',
      r.url.startsWith('https:') ? 'Yes' : r.url.startsWith('http:') ? 'No' : 'N/A',
      esc(r.integrity || 'Not observed'),
      esc(r.crossorigin || 'Not specified'),
    ])
  )}</div><div class="two"><div class="card"><h2>Forms</h2>${table(
    ['Declared action', 'Method', 'Password'],
    current!.forms.map((f) => [
      esc(f.action),
      esc(f.method.toUpperCase()),
      f.password ? 'Yes' : 'No',
    ])
  )}</div><div class="card"><h2>Frames</h2>${table(
    ['Source', 'Sandbox'],
    current!.frames.map((f) => [
      esc(f.url),
      esc(f.sandbox === null ? 'Not observed' : f.sandbox || 'All restrictions'),
    ])
  )}</div></div>`;
}
function technologyView() {
  const layers = [...new Set(current!.technologies.map((t) => t.layer))];
  return `<div class="section-intro"><h2>A map of browser-visible indicators</h2><p>Direct markers and heuristic associations are shown with confidence. Unknown versions stay unknown.</p></div><div class="tech-root">◈ ${esc(current!.origin)}</div><div class="technology-grid">${
    layers
      .map(
        (layer) =>
          `<div class="card tech-layer"><div class="eyebrow">${esc(layer)}</div>${current!.technologies
            .filter((t) => t.layer === layer)
            .map(
              (t) =>
                `<div class="tech-item"><h2>${esc(t.name)}</h2>${badge(t.confidence, `${t.confidence} confidence`)}<p>${esc(t.observation)}</p><small>Version: ${esc(t.version)}${t.version !== 'Unknown' ? ' · Explicit marker, not independently verified' : ''}</small></div>`
            )
            .join('')}</div>`
      )
      .join('') ||
    empty(
      'No technology indicators observed',
      'This does not mean the website has no client libraries.'
    )
  }</div><div class="card"><h2>Backend & database</h2>${badge('unable_to_assess', 'Unknown')}<p>Backend frameworks, database engines, patch levels and server-side authentication are not established by these indicators.</p></div>`;
}
function relationshipsView() {
  const a = current!;
  const groups = [
    {
      title: 'Password form context',
      text: 'Observed forms, transport, and configuration relate to how credentials may move through the page.',
      ids: [
        'SL-FORM-001',
        'SL-FORM-002',
        'SL-FORM-003',
        'SL-TLS-001',
        'SL-COOKIE-001',
        'SL-CSP-001',
      ],
    },
    {
      title: 'Third-party script context',
      text: 'External sources, integrity attributes and CSP constraints describe different parts of the dependency boundary.',
      ids: ['SL-RESOURCE-002', 'SL-RESOURCE-003', 'SL-RESOURCE-006', 'SL-CSP-004'],
    },
    {
      title: 'Browser policy context',
      text: 'Framing, CSP and cross-origin policies have distinct purposes and may interact.',
      ids: ['SL-HEADER-004', 'SL-CSP-001', 'SL-HEADER-006', 'SL-HEADER-008'],
    },
  ];
  return `<div class="section-intro"><h2>Understand related observations</h2><p>These are conceptual relationships, not proof that one observation caused another or that an exploit exists.</p></div>${groups
    .map(
      (g) =>
        `<div class="card"><h2>${g.title}</h2><p>${g.text}</p><div class="relationship-tree">${g.ids
          .map((id) => a.findings.find((f) => f.checkId === id))
          .filter((f): f is Finding => !!f)
          .map(
            (f) =>
              `<button class="relationship-node" data-finding="${esc(f.checkId)}"><span>↳</span><b>${esc(f.title)}</b>${badge(f.status)}</button>`
          )
          .join('')}</div></div>`
    )
    .join('')}`;
}
function historyView() {
  const full = assessments.filter((a) => a.kind === 'full');
  const target = current?.targetKey;
  const same = full.filter((a) => a.targetKey === target);
  if (!compareBefore) compareBefore = same[1]?.id || '';
  if (!compareAfter) compareAfter = same[0]?.id || '';
  const before = assessments.find((a) => a.id === compareBefore),
    after = assessments.find((a) => a.id === compareAfter);
  let comparison = 'Choose two full assessments of the same exact URL.';
  if (before && after) {
    try {
      const changes = compareAssessments(before, after);
      comparison = changes.length
        ? table(
            ['Check', 'Change', 'Previous', 'Current'],
            changes.map((c) => [
              esc(c.title),
              esc(c.type),
              esc(labels[c.before as keyof typeof labels] || c.before),
              esc(labels[c.after]),
            ])
          )
        : 'No status or normalized evidence changes observed.';
    } catch (e) {
      comparison = esc((e as Error).message);
    }
  }
  return `<div class="card"><h2>Compare assessments</h2><p>Query-sensitive target identities keep different pages separate even when their displayed URLs are redacted.</p><div class="compare-controls"><label>Previous<select id="compare-before">${option('', 'Choose an assessment')}${full.map((a) => option(a.id, `${date(a.createdAt)} · ${a.url}`, compareBefore)).join('')}</select></label><span>→</span><label>Current<select id="compare-after">${option('', 'Choose an assessment')}${full.map((a) => option(a.id, `${date(a.createdAt)} · ${a.url}`, compareAfter)).join('')}</select></label></div><div class="comparison-result">${comparison}</div></div><div class="card"><h2>Assessment timeline</h2>${assessments.map((a) => `<div class="timeline-row"><div class="timeline-marker"></div><div><button class="text-button" data-assessment="${esc(a.id)}"><strong>${esc(a.url)}</strong></button><p>${esc(date(a.createdAt))} · ${a.kind === 'verification' ? `Selective verification · ${esc(a.selectedCheckId)}` : `${a.checksCompleted} / ${a.checksTotal} checks completed`}</p>${badge('protection_observed', `${a.findings.filter((f) => f.status === 'protection_observed').length} protections`)}${badge('potential_weakness', `${a.findings.filter((f) => f.status === 'potential_weakness').length} potential weaknesses`)}</div><button class="text-button delete-link" data-delete="${esc(a.id)}">${deletePending === a.id ? 'Confirm delete' : 'Delete'}</button></div>`).join('') || '<p>No saved assessments.</p>'}</div>`;
}
function methodologyView() {
  return `<div class="card"><h2>Reproducible methods, explicit limits</h2><p>Every check has a stable ID, a documented method, a recommendation, and a limitation. Results reflect evidence available during collection.</p><div class="methodology-legend">${Object.entries(
    labels
  )
    .map(([s, l]) => badge(s, l))
    .join(
      ''
    )}</div></div>${CHECKS.map((c) => `<details class="methodology-card"><summary><span class="mono">${esc(c.id)}</span><strong>${esc(c.name)}</strong>${badge(c.category)}</summary><div class="detail-body"><h3>Method</h3><p>${esc(c.method)}</p><h3>Severity rule</h3><p>${esc(c.severity)} when a potential weakness is observed. Other observations are informational. Confidence reflects the observation, not exploitability.</p><h3>Limitation</h3><p>${esc(c.limitation)}</p><h3>Recommendation</h3><p>${esc(c.recommendation)}</p><h3>Learning note</h3><p>${esc(c.learning)}</p></div></details>`).join('')}`;
}
function settingsView() {
  return `<div class="two"><div class="card"><h2>Your local workspace</h2><form id="settings-form"><label>Assessment retention<select name="retention">${[10, 25, 50, 100, 200].map((n) => option(String(n), `${n} assessments`, String(settings.retention))).join('')}</select></label><p>Older records are removed when the retention limit is reached. JSON and HTML exports remain under your control.</p><button class="secondary" type="submit">Save preferences</button></form><h3>Local data</h3><p>${assessments.length} assessments · ${events.length} lifecycle events${legacyCount ? ` · ${legacyCount} legacy records from v0.1 (not compatible with the new schema)` : ''}</p><button class="danger secondary" id="clear-data">${deletePending === 'all' ? 'Confirm permanent deletion' : 'Delete all local assessments'}</button></div><div class="card"><h2>Permission transparency</h2><p>SiteLens reads the website you select, observes permitted document responses, stores assessments locally, and generates reports.</p><ul class="plain-list"><li>Cookie values, passwords, storage keys and values are omitted.</li><li>No telemetry, remote scripts or report uploads.</li><li>No vulnerability payloads or automatic requests.</li><li>No private file access or private browsing inspection.</li></ul><p>Site access remains granted until revoked. Observation is limited to origins enabled below.</p></div></div><div class="card"><h2>Enabled response observation</h2>${
    settings.observedOrigins.length
      ? table(
          ['Origin', 'Access'],
          settings.observedOrigins.map((origin) => [
            esc(origin),
            `<button class="secondary small" data-revoke="${esc(origin)}">Revoke site access</button>`,
          ])
        )
      : '<p>No sites enabled. Grant access from the popup for the website you choose.</p>'
  }<button class="secondary" id="revoke-cookies">Revoke cookie permission</button></div><div class="card"><h2>Sharing reports</h2><p>URLs omit credentials, query strings and fragments. CSP nonces are redacted. Header policies and cookie names remain part of the evidence; inspect your report before sharing it.</p></div>`;
}
function render() {
  if (!TITLES[view]) view = 'overview';
  $('#heading').textContent = TITLES[view];
  document.title = `SiteLens · ${TITLES[view]}`;
  document.querySelectorAll<HTMLButtonElement>('nav button').forEach((b) => {
    const active = b.dataset.view === view;
    b.classList.toggle('active', active);
    if (active) b.setAttribute('aria-current', 'page');
    else b.removeAttribute('aria-current');
  });
  $('#finding-count').textContent = current
    ? String(current.findings.filter((f) => f.status === 'potential_weakness').length)
    : '';
  $<HTMLInputElement>('#learning').checked = settings.learningMode;
  for (const id of ['reinspect', 'report', 'exports'])
    $<HTMLButtonElement>('#' + id).disabled = !current || busy;
  $('#target').innerHTML = current
    ? `<div class="target"><div class="target-icon">◈</div><div class="target-info"><strong>${esc(current.url)}</strong><div>${esc(date(current.createdAt))} <span>·</span> ${current.kind === 'verification' ? `Selective verification · ${esc(current.selectedCheckId)}` : 'Passive inspection'} <span>·</span> ${current.durationMs} ms</div></div><div class="target-type"><span class="local-dot"></span> Local assessment</div></div>`
    : '';
  if (['methodology', 'settings', 'history'].includes(view))
    $('#content').innerHTML =
      view === 'methodology'
        ? methodologyView()
        : view === 'settings'
          ? settingsView()
          : historyView();
  else if (!current)
    $('#content').innerHTML =
      `${empty('Start with the website in front of you', 'Open a website, click the SiteLens extension, and select Inspect this website.')}<div class="three"><div class="card"><span class="step">01</span><h2>Inspect</h2><p>Collect browser-visible evidence from the website you select.</p></div><div class="card"><span class="step">02</span><h2>Understand</h2><p>Explore observations, confidence and assessment coverage.</p></div><div class="card"><span class="step">03</span><h2>Improve</h2><p>Verify changes and produce a reproducible assessment report.</p></div></div>`;
  else {
    const views: Record<string, () => string> = {
      overview,
      findings: findingView,
      evidence: evidenceView,
      coverage: coverageView,
      headers: headersView,
      cookies: cookiesView,
      resources: resourcesView,
      technology: technologyView,
      relationships: relationshipsView,
    };
    $('#content').innerHTML = views[view]();
    if (view === 'findings') updateFindingResults();
    if (view === 'evidence') updateEvidenceResults();
  }
}
function navigate(next: string) {
  view = next;
  query = '';
  location.hash = next;
  render();
}
async function refresh(id = current?.id) {
  const data = await send<{
    assessments: Assessment[];
    events: LifecycleEvent[];
    settings: Settings;
    legacyCount: number;
  }>({ type: 'state' });
  ({ assessments, events, settings, legacyCount } = data);
  current = assessments.find((a) => a.id === id) || assessments[0];
  render();
}
function selectAssessment(id: string) {
  current = assessments.find((a) => a.id === id);
  compareBefore = '';
  compareAfter = '';
  const url = new URL(location.href);
  url.searchParams.set('id', id);
  url.hash = 'overview';
  history.replaceState(null, '', url);
  navigate('overview');
}
async function runInspection(checkId?: string) {
  if (!current || busy) return;
  busy = true;
  notice(
    checkId
      ? 'Collecting fresh evidence for the selected check…'
      : 'Collecting a new passive assessment…'
  );
  render();
  try {
    const result = await send<{ id: string; verification?: { verified: boolean; reason: string } }>(
      {
        type: checkId ? 'verify' : 'reinspect',
        assessmentId: current.id,
        ...(checkId ? { checkId } : {}),
      }
    );
    await refresh(result.id);
    selectAssessment(result.id);
    notice(
      result.verification?.reason ||
        'Assessment saved. Reload the target before inspection when you need newly captured header evidence.'
    );
    if (checkId) navigate('findings');
  } catch (e) {
    notice((e as Error).message);
  } finally {
    busy = false;
    render();
  }
}
$('#navigation').onclick = (e) => {
  const button = (e.target as HTMLElement).closest<HTMLElement>('[data-view]');
  if (button) navigate(button.dataset.view!);
};
$('#content').onclick = async (e) => {
  const button = (e.target as HTMLElement).closest<HTMLElement>('button');
  if (!button) return;
  try {
    if (button.dataset.view) navigate(button.dataset.view);
    if (button.dataset.assessment) selectAssessment(button.dataset.assessment);
    if (button.dataset.finding) {
      status = '';
      severity = '';
      category = '';
      navigate('findings');
      const detail = $<HTMLDetailsElement>('#finding-' + button.dataset.finding);
      if (detail) {
        detail.open = true;
        detail.scrollIntoView({ block: 'start', behavior: 'smooth' });
      }
    }
    if (button.dataset.evidence) {
      evidenceType = '';
      navigate('evidence');
      const detail = $<HTMLDetailsElement>('#evidence-' + button.dataset.evidence);
      if (detail) {
        detail.open = true;
        detail.scrollIntoView({ block: 'start', behavior: 'smooth' });
      }
    }
    if (button.dataset.verify) await runInspection(button.dataset.verify);
    if (button.dataset.delete) {
      if (deletePending === button.dataset.delete) {
        await send({ type: 'delete', id: deletePending });
        deletePending = '';
        await refresh();
      } else {
        deletePending = button.dataset.delete;
        render();
      }
    }
    if (button.dataset.revoke) {
      await send({ type: 'revoke', origin: button.dataset.revoke });
      await refresh();
      notice('Site access revoked. Saved assessments remain local.');
    }
    if (button.id === 'revoke-cookies') {
      await chrome.permissions.remove({ permissions: ['cookies'] });
      notice('Cookie permission revoked. Future assessments will mark cookie checks unavailable.');
    }
    if (button.id === 'clear-data') {
      if (deletePending === 'all') {
        await send({ type: 'clear' });
        deletePending = '';
        await refresh();
        notice('Local assessment data deleted.');
      } else {
        deletePending = 'all';
        render();
      }
    }
  } catch (error) {
    notice((error as Error).message);
  }
};
$('#content').oninput = (e) => {
  const input = e.target as HTMLInputElement;
  if (input.id === 'search') {
    query = input.value;
    updateFindingResults();
  }
  if (input.id === 'evidence-search') {
    query = input.value;
    updateEvidenceResults();
  }
};
$('#content').onchange = (e) => {
  const input = e.target as HTMLSelectElement;
  if (input.id === 'status-filter') {
    status = input.value;
    updateFindingResults();
  }
  if (input.id === 'severity-filter') {
    severity = input.value;
    updateFindingResults();
  }
  if (input.id === 'category-filter') {
    category = input.value;
    updateFindingResults();
  }
  if (input.id === 'evidence-type') {
    evidenceType = input.value;
    updateEvidenceResults();
  }
  if (input.id === 'compare-before') {
    compareBefore = input.value;
    render();
  }
  if (input.id === 'compare-after') {
    compareAfter = input.value;
    render();
  }
};
$('#content').onsubmit = async (e) => {
  e.preventDefault();
  const form = e.target as HTMLFormElement;
  const data = new FormData(form);
  try {
    if (form.classList.contains('lifecycle-form')) {
      const checkId = form.dataset.check!;
      await send({
        type: 'lifecycle',
        assessmentId: current!.id,
        checkId,
        state: data.get('state'),
        note: data.get('note'),
      });
      await refresh();
      const detail = $<HTMLDetailsElement>('#finding-' + checkId);
      if (detail) detail.open = true;
      notice('Lifecycle state saved.');
    }
    if (form.id === 'settings-form') {
      await send({
        type: 'settings',
        learningMode: settings.learningMode,
        retention: Number(data.get('retention')),
      });
      await refresh();
      notice('Preferences saved.');
    }
  } catch (error) {
    notice((error as Error).message);
  }
};
$<HTMLInputElement>('#learning').onchange = async (e) => {
  try {
    settings.learningMode = (e.target as HTMLInputElement).checked;
    await send({ type: 'settings', ...settings });
    render();
  } catch (error) {
    notice((error as Error).message);
  }
};
$('#reinspect').onclick = () => runInspection();
$('#report').onclick = () =>
  current && chrome.tabs.create({ url: chrome.runtime.getURL(`report.html?id=${current.id}`) });
$('#exports').onclick = () => {
  const menu = $('#export-options');
  menu.hidden = !menu.hidden;
  $('#exports').setAttribute('aria-expanded', String(!menu.hidden));
};
$('#json').onclick = () => {
  if (current)
    download(
      `sitelens-${current.id}.json`,
      'application/json',
      JSON.stringify(portable(current), null, 2)
    );
  $('#export-options').hidden = true;
};
$('#html').onclick = () => {
  if (current) download(`sitelens-${current.id}.html`, 'text/html', reportHtml(current, events));
  $('#export-options').hidden = true;
};
window.onhashchange = () => {
  const next = location.hash.slice(1) || 'overview';
  if (next !== view) {
    view = next;
    query = '';
    render();
  }
};
try {
  await refresh(new URLSearchParams(location.search).get('id') || undefined);
} catch (error) {
  notice(`Unable to load local assessments: ${(error as Error).message}`);
  render();
}
