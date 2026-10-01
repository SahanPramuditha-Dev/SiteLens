import type { Check } from '@sitelens/shared-types';
const base = {
  category: 'Client-Side Security',
  severity: 'medium' as const,
  version: '2.0.0',
  impact:
    'An externally influenced value reaching a code or HTML execution API may require review.',
  limitation:
    'Static inline-script analysis does not confirm an executable path, failed sanitization or exploitability. External script contents are not inspected.',
  recommendation:
    'Review observed source-to-sink expressions; prefer safe APIs, validated messages and contextual sanitization.',
  learning:
    'API presence, a potential source-to-sink relationship, and a confirmed exploit are different levels of evidence. SiteLens does not confirm exploits.',
  references: ['https://developer.mozilla.org/en-US/docs/Web/API/Element/innerHTML'],
};
export const clientSideSinkCheck: Check = {
  ...base,
  id: 'SL-JSDOM-001',
  name: 'Dangerous API observations',
  method: 'Parse inline scripts into an AST and locate selected assignments and calls.',
  run: (i) => ({
    status: i.page.analysis ? 'informational' : 'unable_to_assess',
    observation: i.page.analysis
      ? `${i.page.analysis.apis.length} API patterns observed; absence is not a protection claim.`
      : 'JavaScript analysis was not collected.',
    evidenceKeys: ['client-security'],
  }),
};
export const clientSideFlowCheck: Check = {
  ...base,
  id: 'SL-JSDOM-002',
  name: 'Potential source-to-sink expressions',
  method:
    'Trace direct expressions and simple lexical variable aliases in collected inline scripts.',
  run: (i) => ({
    status: !i.page.analysis
      ? 'unable_to_assess'
      : i.page.analysis.flows.length
        ? 'potential_weakness'
        : 'informational',
    confidence: 'medium',
    observation: i.page.analysis
      ? `${i.page.analysis.flows.length} potential direct source-to-sink relationships observed. No exploitability confirmed.`
      : 'JavaScript analysis was not collected.',
    evidenceKeys: ['client-security'],
  }),
};
export const postMessageCheck: Check = {
  ...base,
  id: 'SL-JSDOM-003',
  name: 'postMessage validation observations',
  method: 'Inspect AST event listener callbacks for origin and source comparison patterns.',
  run: (i) => ({
    status: i.page.analysis ? 'informational' : 'unable_to_assess',
    confidence: 'low',
    observation: i.page.analysis
      ? `${i.page.analysis.handlers.length} message handlers; ${i.page.analysis.handlers.filter((h) => !h.originCheck).length} without a resolved origin comparison. Pattern presence does not establish validation correctness.`
      : 'Message handlers were not collected.',
    evidenceKeys: ['client-security'],
  }),
};
export const sourceMapCheck: Check = {
  ...base,
  id: 'SL-SRCMAP-001',
  name: 'Source map references',
  category: 'Information exposure',
  method:
    'Observe sourceMappingURL references; inspect contents only under explicitly authorized supplemental scope.',
  impact:
    'Source maps may expose original source structure and accidental configuration. They are legitimate debugging artifacts.',
  recommendation:
    'Review intended exposure and inspect public map contents for accidental sensitive data.',
  run: (i) => ({
    status: 'informational',
    observation: `${i.page.sourceMaps?.length || i.page.sourceMapUrls?.length || 0} source map references; accessibility and sensitivity are not inferred from presence.`,
    evidenceKeys: ['source-maps'],
  }),
};
