import type {
  Assessment,
  AssessmentInput,
  PageSnapshot,
  ResponseSnapshot,
  Settings,
} from '@sitelens/shared-types';
import { assess } from './index';
export function replayAssessment(a: Assessment, settings: Settings): Assessment {
  const data = (label: string) => a.evidence.find((e) => e.label === label)?.data;
  const storage = (data('Storage item counts') as PageSnapshot['storage']) || {
    local: null,
    session: null,
  };
  const page: PageSnapshot = {
    url: a.url,
    timeOrigin: 0,
    resources: a.resources,
    forms: a.forms,
    frames: a.frames,
    indicators: a.technologies,
    metaCsp: (data('CSP meta policies') as string[]) || [],
    metaReferrer: (data('Referrer meta policy') as string | null) || null,
    blankLinks:
      (data('New-window relationships') as { withoutExplicitIsolation: number } | undefined)
        ?.withoutExplicitIsolation || 0,
    storage,
    limits: [...a.limits, 'Re-evaluation of stored evidence; no new website collection.'],
    collectedAt: a.evidence.find((e) => e.type === 'document')?.collectedAt || a.createdAt,
    analysis: data('Client-side AST observations') as PageSnapshot['analysis'],
    sourceMaps: data('Source map observations') as PageSnapshot['sourceMaps'],
    secrets: data('Redacted configuration patterns') as PageSnapshot['secrets'],
    serviceWorkers: data('Registered service workers') as PageSnapshot['serviceWorkers'],
    crossOriginIsolated: (data('Runtime isolation') as { crossOriginIsolated: boolean } | undefined)
      ?.crossOriginIsolated,
  };
  const headers: Record<string, string[]> = {};
  const captured = a.evidence.filter(
    (e) => e.type === 'header' && (e.data as { availability?: string })?.availability === 'captured'
  );
  for (const e of captured) {
    const h = e.data as { name: string; values: string[] };
    headers[h.name] = h.values;
  }
  const response: ResponseSnapshot | null = captured.length
    ? {
        url: a.url,
        headers,
        statusCode: captured[0].provenance?.statusCode || 200,
        collectedAt: captured[0].collectedAt,
        requestId: captured[0].provenance?.requestId || 'replayed',
        startedAt: 0,
        urlHash: a.targetKey,
        redirects:
          (data('Observed redirects') as { hops: ResponseSnapshot['redirects'] } | undefined)
            ?.hops || [],
        provenance: captured[0].provenance,
      }
    : null;
  const cookieData = data('Cookie attributes') as AssessmentInput['cookies'];
  const result = assess({
    page,
    response,
    cookies: cookieData || {
      available: false,
      cookies: [],
      limitation: 'Cookie evidence was not retained.',
    },
    browser: a.browser,
    targetKey: a.targetKey,
    profile: a.profile === 'cli-browser' ? 'cli-browser' : 'extension-passive',
    scope: a.scope,
    permissions: a.permissionsGranted,
    requests: a.requests,
    projectId: a.projectId,
    environment: a.environment,
    suppressions: settings.suppressions || [],
  });
  result.reproducibility = { reevaluatedFrom: a.id, evaluatedAt: result.createdAt };
  return result;
}
