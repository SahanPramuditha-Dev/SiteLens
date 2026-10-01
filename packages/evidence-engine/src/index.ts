import type {
  AssessmentInput,
  Evidence,
  PageSnapshot,
  ResponseSnapshot,
  Technology,
  ProvenanceSource,
} from '@sitelens/shared-types';

export class EvidenceEngine {
  private evidence: Evidence[] = [];
  private keys = new Map<string, string>();
  private page: PageSnapshot;
  private response: ResponseSnapshot | null;
  private raw: AssessmentInput;
  private technologies: Technology[];

  constructor(
    raw: AssessmentInput,
    page: PageSnapshot,
    response: ResponseSnapshot | null,
    technologies: Technology[]
  ) {
    this.raw = raw;
    this.page = page;
    this.response = response;
    this.technologies = technologies;
  }

  public add(
    key: string,
    type: Evidence['type'],
    label: string,
    data: unknown,
    collectedAt = this.page.collectedAt,
    provenanceSource?: ProvenanceSource
  ) {
    const id = `EV-${String(this.evidence.length + 1).padStart(3, '0')}`;
    this.keys.set(key, id);
    const source =
      provenanceSource ||
      (type === 'header'
        ? this.response?.provenance?.source || 'original-page-response'
        : ['cookie', 'storage', 'redirect'].includes(type)
          ? 'browser-api'
          : type === 'technology'
            ? 'inference'
            : 'dom');
    this.evidence.push({
      id,
      type,
      label,
      source: this.page.url,
      data,
      redacted: true,
      collectedAt,
      provenance: {
        source,
        collector:
          this.raw.profile === 'cli-browser'
            ? 'SiteLens CLI browser'
            : 'SiteLens Chromium extension',
        ...(type === 'header' && this.response
          ? {
              documentId: this.response.documentId,
              requestId: this.response.requestId,
              statusCode: this.response.statusCode,
            }
          : {}),
        limitation:
          source === 'inference'
            ? 'Heuristic association; not an independently established fact.'
            : undefined,
      },
    });
  }

  public generateCoreEvidence() {
    this.add(
      'environment-secrets',
      'document',
      'Redacted configuration patterns',
      this.page.secrets || []
    );
    this.add('document', 'document', 'Document', {
      url: this.page.url,
      statusCode: this.response?.statusCode ?? 'Unavailable',
      responseCaptured: !!this.response,
    });

    const headerKeys = new Set([
      ...Object.keys(this.response?.headers || {}),
      'content-security-policy',
      'content-security-policy-report-only',
      'strict-transport-security',
      'x-content-type-options',
      'referrer-policy',
      'x-frame-options',
      'permissions-policy',
      'cross-origin-opener-policy',
      'cross-origin-resource-policy',
      'cross-origin-embedder-policy',
      'server',
      'x-powered-by',
      'cache-control',
      'pragma',
      'vary',
      'access-control-allow-origin',
      'access-control-allow-credentials',
    ]);
    for (const key of headerKeys) {
      this.add(
        key,
        'header',
        key,
        {
          name: key,
          values: this.response ? this.response.headers[key] || [] : null,
          availability: this.response ? 'captured' : 'unavailable',
        },
        this.response?.collectedAt || this.page.collectedAt
      );
    }

    this.add('meta-csp', 'document', 'CSP meta policies', this.page.metaCsp);
    this.add('meta-referrer', 'document', 'Referrer meta policy', this.page.metaReferrer);
    this.add('resources', 'resource', 'Resource references', this.page.resources);
    this.add('forms', 'form', 'Declared forms', this.page.forms);
    this.add('frames', 'frame', 'Embedded frames', this.page.frames);
    this.add('links', 'document', 'New-window relationships', {
      withoutExplicitIsolation: this.page.blankLinks,
    });

    this.add('cookies', 'cookie', 'Cookie attributes', {
      available: this.raw.cookies.available,
      limitation: this.raw.cookies.limitation,
      cookies: this.raw.cookies.cookies,
    });
    this.add('storage', 'storage', 'Storage item counts', this.page.storage);
    this.add('technology', 'technology', 'Technology indicators', this.technologies);
    this.add(
      'client-security',
      'document',
      'Client-side AST observations',
      this.page.analysis || null,
      this.page.collectedAt,
      'inference'
    );
    this.add(
      'source-maps',
      'document',
      'Source map observations',
      this.page.sourceMaps || this.page.sourceMapUrls || []
    );
    this.add(
      'service-workers',
      'document',
      'Registered service workers',
      this.page.serviceWorkers || [],
      this.page.collectedAt,
      'browser-api'
    );
    this.add(
      'isolation',
      'document',
      'Runtime isolation',
      { crossOriginIsolated: this.page.crossOriginIsolated ?? null },
      this.page.collectedAt,
      'browser-api'
    );
    this.add(
      'cors',
      'header',
      'CORS relationships',
      {
        document: this.response
          ? {
              origin: this.response.headers['access-control-allow-origin'] || [],
              credentials: this.response.headers['access-control-allow-credentials'] || [],
              vary: this.response.headers.vary || [],
            }
          : null,
        requests: this.raw.requests || [],
      },
      this.response?.collectedAt || this.page.collectedAt,
      'intercepted-request'
    );
    this.add(
      'requests',
      'resource',
      'Observed browser requests',
      this.raw.requests || [],
      this.page.collectedAt,
      'intercepted-request'
    );
    this.add('active-probes', 'document', 'Active tests', {
      status: 'unsupported',
      reason: 'Active vulnerability probing is not implemented or performed.',
    });

    this.add(
      'redirects',
      'redirect',
      'Observed redirects',
      {
        hops: this.response?.redirects || [],
        limitation:
          'Only permitted, selected-site hops are visible. This may not be the full redirect chain.',
      },
      this.response?.collectedAt || this.page.collectedAt
    );
  }

  public getEvidence() {
    return this.evidence;
  }

  public getKeys() {
    return this.keys;
  }
}

export * from './scanners/environment.js';
export * from './scanners/javascript.js';
export * from './scanners/source-maps.js';
