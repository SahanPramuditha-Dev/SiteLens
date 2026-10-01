import { REPORT_MARK } from '../../../assets/brand/report-mark';
import { TECHNOLOGY_REPORT_LOGOS } from '../../../assets/technologies/report-logos';
import type { Assessment, LifecycleEvent, ReportOptions } from '@sitelens/shared-types';
import { CHECK_BY_ID } from '@sitelens/rule-definitions';
import { esc, table, badge, safeReference } from './ui/shared';
export const REPORT_CSS = `body{font:14px/1.7 system-ui;color:#203641;background:#fff;max-width:1080px;margin:35px auto;padding:25px}h1{font-size:34px}.report-brand{display:flex;align-items:center;gap:12px;margin-bottom:20px}.report-brand strong{font-size:30px;letter-spacing:-1px}h2{font-size:21px;border-bottom:2px solid #087f70;margin-top:40px;padding-bottom:9px}h3{font-size:16px}table{width:100%;border-collapse:collapse;font-size:11px}td,th{text-align:left;border-bottom:1px solid #ddd;padding:10px;overflow-wrap:anywhere;vertical-align:top}pre{white-space:pre-wrap;overflow-wrap:anywhere;background:#f3f7f8;padding:15px;font-size:10px}article{border:1px solid #dde6e9;border-radius:8px;padding:20px;margin:18px 0;break-inside:avoid}.badge{display:inline-block;background:#edf4f3;padding:4px 7px;margin:3px;font-size:11px}.potential_weakness{background:#fff0d9}.protection_observed{background:#e4f4ed}p{overflow-wrap:anywhere}.toolbar{display:flex;gap:10px}.notice{padding:15px;border-left:3px solid #087f70;background:#f0f7f4}a{color:#087f70}@media print{body{margin:0;padding:0}.toolbar{display:none}h2{break-after:avoid}pre{font-size:9px}thead{display:table-header-group}.table-wrap{overflow:visible}}`;
export function reportBody(
  a: Assessment,
  events: LifecycleEvent[] = [],
  options: ReportOptions = {}
) {
  const original = a;
  if (options.selectedCheckIds)
    a = { ...a, findings: a.findings.filter((f) => options.selectedCheckIds!.includes(f.checkId)) };
  const logo =
    options.customLogo && /^data:image\/(png|jpeg);base64,[A-Za-z0-9+/=]+$/.test(options.customLogo)
      ? '<img alt="Project logo" style="max-width:200px;max-height:64px" src="' +
        esc(options.customLogo) +
        '">'
      : options.logo === 'none'
        ? ''
        : REPORT_MARK;
  const finding = (f: Assessment['findings'][number]) =>
    `<article id="${esc(f.checkId)}"><h3>${esc(f.checkId)} · ${esc(f.title)}</h3>${badge(f.status)}${badge(f.severity)}${badge(f.confidence, `${f.confidence} confidence`)}<p>Rule version: ${esc(f.ruleVersion || 'legacy')} · Lifecycle: ${esc(f.lifecycle)}</p>${f.suppression ? `<p>Exception: ${esc(f.suppression.reason)} · ${esc(f.suppression.exception?.rationale)}</p>` : ''}${[
      ['Observation', f.observation],
      ['Why it matters', f.impact],
      ['Limitation', f.limitation],
      ['Recommendation', f.recommendation],
      ['Validation', f.validation],
    ]
      .map(([name, value]) => `<p><b>${name}</b><br>${esc(value)}</p>`)
      .join(
        ''
      )}<p>Evidence: ${f.evidenceIds.map((id) => `<a href="#${esc(id)}">${esc(id)}</a>`).join(', ')} · First observed: ${esc(f.firstObserved)}</p></article>`;
  const weak = a.findings.filter((f) => f.status === 'potential_weakness'),
    protect = a.findings.filter((f) => f.status === 'protection_observed');
  let sectionNumber = 0;
  const section = (n: number, title: string, body: string) =>
    (options.audience === 'executive' && ![1, 2, 3, 11].includes(n)) ||
    (options.audience === 'developer' && n === 1)
      ? ''
      : `<section><h2>${++sectionNumber}. ${title}</h2>${body}</section>`;
  return (
    `<header><div class="report-brand">${logo}<strong>${esc(options.organization || options.project || 'SiteLens')}</strong></div><p>EVIDENCE-FIRST ASSESSMENT</p><h1>Website Security Assessment</h1>${table(
      ['Property', 'Value'],
      [
        ['Target', esc(a.url)],
        [
          'Assessor / organization',
          esc(
            (options.assessor || 'Not supplied') + ' / ' + (options.organization || 'Not supplied')
          ),
        ],
        [
          'Project / audience',
          esc(
            (options.project || a.projectId || 'Unassigned') +
              ' / ' +
              (options.audience || 'complete')
          ),
        ],
        [
          'Included observations',
          esc(
            a.findings.length +
              ' of ' +
              original.findings.length +
              '; original assessment scope remains recorded'
          ),
        ],
        [
          'Requested / effective URL',
          esc(`${a.requestedUrl || a.url} / ${a.effectiveUrl || a.url}`),
        ],
        ['Date', esc(a.createdAt)],
        ['Profile', esc(a.profile || 'legacy')],
        ['Browser', esc(a.browser)],
        [
          'SiteLens / engine / ruleset',
          esc(`${a.version} / ${a.engineVersion || 'legacy'} / ${a.ruleSetVersion || 'legacy'}`),
        ],
        ['Checks completed', `${a.checksCompleted} / ${a.checksTotal}`],
        [
          'Project / environment',
          esc(`${a.projectId || 'Unassigned'} / ${a.environment || 'Unassigned'}`),
        ],
      ]
    )}</header>` +
    section(
      1,
      'Executive summary',
      `<p>${protect.length} protections observed; ${weak.length} potential weaknesses; ${a.findings.filter((f) => f.status === 'unable_to_assess').length} unable to assess.</p><p class="notice">Browser-visible evidence is not a safety certification or proof of exploitability. No vulnerability payloads were sent.</p>`
    ) +
    section(
      2,
      'Assessment scope',
      `<p>${a.kind === 'verification' ? `Only ${esc(a.selectedCheckId)} was re-evaluated; baseline ${esc(a.baselineId)}.` : 'Top-level DOM metadata, captured responses, matching cookie attributes and permitted browser requests were inspected.'}</p><pre>${esc(JSON.stringify({ scope: a.scope, permissions: a.permissionsGranted, enabledChecks: a.enabledChecks, disabledChecks: a.disabledChecks, timeouts: a.timeouts }, null, 2))}</pre>`
    ) +
    section(
      3,
      'Coverage & limitations',
      table(
        ['Area', 'Coverage', 'Limitation'],
        a.coverage.map((c) => [esc(c.area), esc(c.status), esc(c.detail)])
      ) + `<p>${esc(a.limits.join(' '))}</p>`
    ) +
    section(
      4,
      'Protections observed',
      protect.map(finding).join('') || '<p>No protection established by these checks.</p>'
    ) +
    section(
      5,
      'Findings',
      ['critical', 'high', 'medium', 'low', 'informational']
        .map((s) => {
          const group = a.findings.filter(
            (f) => f.status !== 'protection_observed' && f.severity === s
          );
          return group.length
            ? `<h3>${esc(s.toUpperCase())}</h3>${group.map(finding).join('')}`
            : '';
        })
        .join('')
    ) +
    section(
      6,
      'Technology & advisory profile',
      table(
        [
          'Name / layer',
          'Detection / confidence',
          'Version',
          'Version confidence / source',
          'Indicator',
        ],
        a.technologies.map((t) => [
          (Object.hasOwn(TECHNOLOGY_REPORT_LOGOS, t.name)
            ? `<img alt="" width="24" height="24" style="object-fit:contain;vertical-align:middle;margin-right:8px" src="${TECHNOLOGY_REPORT_LOGOS[t.name]}">`
            : '') + esc(t.name + ' / ' + t.layer),
          esc((t.detection || 'observed') + ' / ' + t.confidence),
          esc(t.version),
          esc((t.versionConfidence || 'unknown') + ' / ' + (t.versionSource || 'Unknown')),
          esc(t.observation),
        ])
      ) +
        table(
          ['Advisory', 'Affected range', 'Fix', 'Runtime applicability', 'Updated'],
          (a.advisoryMatches || []).map((m) => [
            esc(m.id),
            esc(m.affectedRange),
            esc(m.fixedVersion),
            esc(m.runtimeApplicability),
            esc(m.updatedAt),
          ])
        )
    ) +
    section(
      7,
      'Header assessment',
      table(
        ['Header', 'Values', 'Collected'],
        a.evidence
          .filter((e) => e.type === 'header')
          .map((e) => [
            esc(e.label),
            `<pre>${esc(JSON.stringify(e.data, null, 2))}</pre>`,
            esc(e.collectedAt),
          ])
      )
    ) +
    section(
      8,
      'Cookie assessment',
      '<p>Values omitted. Other paths and third-party iframe cookies may not be visible.</p>' +
        table(
          ['Name', 'Domain / path', 'Secure', 'HttpOnly', 'SameSite', 'Value'],
          a.cookies.map((c) => [
            esc(c.name),
            esc(c.domain + c.path),
            c.secure ? 'Yes' : 'No',
            c.httpOnly ? 'Yes' : 'No',
            esc(c.sameSite),
            '[REDACTED]',
          ])
        )
    ) +
    section(
      9,
      'Resources & API surface',
      table(
        ['URL', 'Type', 'Third party', 'Integrity'],
        a.resources.map((r) => [
          esc(r.url),
          esc(r.type),
          r.thirdParty ? 'Yes' : 'No',
          esc(r.integrity || 'Not observed'),
        ])
      ) +
        table(
          ['Endpoint', 'Method', 'Status', 'Authentication evidence'],
          (a.apiEndpoints || []).map((r) => [
            esc(r.url),
            esc(r.method),
            esc(r.statusCode ?? 'unknown'),
            esc(r.authentication),
          ])
        )
    ) +
    section(
      10,
      'Evidence & provenance',
      a.evidence
        .map(
          (e) =>
            `<article id="${esc(e.id)}"><h3>${esc(e.id)} · ${esc(e.label)}</h3><p>Collected: ${esc(e.collectedAt)} · Source: ${esc(e.source)}</p><pre>${esc(JSON.stringify({ provenance: e.provenance || 'Legacy provenance unavailable', data: e.data }, null, 2))}</pre></article>`
        )
        .join('')
    ) +
    section(
      11,
      'Recommendations & verification history',
      table(
        ['Check', 'Recommendation'],
        weak.map((f) => [esc(f.checkId), esc(f.recommendation)])
      ) +
        table(
          ['Date', 'Check', 'State', 'Actor', 'Expiry', 'Note'],
          events
            .filter((e) => e.targetKey === a.targetKey)
            .map((e) => [
              esc(e.at),
              esc(e.checkId),
              esc(e.state),
              esc(e.actor || 'Local analyst'),
              esc(e.expiresAt || 'N/A'),
              esc(e.note),
            ])
        )
    ) +
    section(
      12,
      'Methodology & rule versions',
      table(
        ['Check', 'Version', 'Method', 'Limitation'],
        a.findings.map((f) => [
          esc(f.checkId),
          esc(f.ruleVersion || 'legacy'),
          esc(CHECK_BY_ID.get(f.checkId)?.method || 'Archived rule'),
          esc(f.limitation),
        ])
      )
    ) +
    section(
      13,
      'References',
      `<ul>${[...new Set(a.findings.flatMap((f) => f.references))].map((url) => `<li><a href="${esc(safeReference(url))}">${esc(url)}</a></li>`).join('')}</ul>`
    )
  );
}
export function reportHtml(
  a: Assessment,
  events: LifecycleEvent[] = [],
  options: ReportOptions = {}
) {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src data:; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'"><link rel="icon" type="image/svg+xml" href="data:image/svg+xml,${encodeURIComponent(REPORT_MARK)}"><title>SiteLens assessment</title><style>${REPORT_CSS}</style></head><body>${reportBody(a, events, options)}</body></html>`;
}
