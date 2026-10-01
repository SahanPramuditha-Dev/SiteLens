import type { Assessment, Scope } from '@sitelens/shared-types';
import { redactUrl } from '@sitelens/rule-definitions/src/privacy.js';
import { inScope } from '@sitelens/rule-definitions/src/scope.js';
export function detailedChanges(before: Assessment, after: Assessment) {
  if (before.targetKey !== after.targetKey) throw new Error('Choose the same exact target.');
  const changes: { area: string; item: string; before: unknown; after: unknown }[] = [];
  const compare = (area: string, old: Map<string, unknown>, fresh: Map<string, unknown>) => {
    for (const key of new Set([...old.keys(), ...fresh.keys()]))
      if (JSON.stringify(old.get(key)) !== JSON.stringify(fresh.get(key)))
        changes.push({
          area,
          item: key,
          before: old.get(key) ?? null,
          after: fresh.get(key) ?? null,
        });
  };
  const headers = (a: Assessment) =>
    new Map(
      a.evidence
        .filter(
          (e) => e.type === 'header' && typeof e.data === 'object' && e.data && 'values' in e.data
        )
        .map((e) => [(e.data as { name: string }).name, (e.data as { values: unknown }).values])
    );
  compare('Headers', headers(before), headers(after));
  compare(
    'Cookies',
    new Map(before.cookies.map((c) => [`${c.name} @ ${c.domain}${c.path}`, c])),
    new Map(after.cookies.map((c) => [`${c.name} @ ${c.domain}${c.path}`, c]))
  );
  compare(
    'Dependencies',
    new Map(
      before.technologies.map((t) => [
        t.name,
        { version: t.version, confidence: t.versionConfidence || 'low' },
      ])
    ),
    new Map(
      after.technologies.map((t) => [
        t.name,
        { version: t.version, confidence: t.versionConfidence || 'low' },
      ])
    )
  );
  compare(
    'Resources',
    new Map(
      before.resources.map((r) => [
        r.url,
        { type: r.type, integrity: r.integrity, crossorigin: r.crossorigin },
      ])
    ),
    new Map(
      after.resources.map((r) => [
        r.url,
        { type: r.type, integrity: r.integrity, crossorigin: r.crossorigin },
      ])
    )
  );
  compare(
    'External domains',
    new Map(
      domainMap(before)
        .filter((d) => d.thirdParty)
        .map((d) => [d.domain, true])
    ),
    new Map(
      domainMap(after)
        .filter((d) => d.thirdParty)
        .map((d) => [d.domain, true])
    )
  );
  return changes;
}
export function domainMap(a: Assessment) {
  const map = new Map<
    string,
    { domain: string; thirdParty: boolean; items: { type: string; url: string; source: string }[] }
  >();
  for (const r of [
    ...a.resources.map((r) => ({ type: r.type, url: r.url, source: r.loadedBy || 'Document' })),
    ...a.frames.map((f) => ({ type: 'iframe', url: f.url, source: 'Document' })),
    ...(a.apiEndpoints || []).map((r) => ({ type: r.category, url: r.url, source: r.initiator })),
  ]) {
    try {
      const u = new URL(r.url);
      if (!/^https?:$|^wss?:$/.test(u.protocol)) continue;
      const domain = u.host;
      const d = map.get(domain) || {
        domain,
        thirdParty: u.host !== new URL(a.url).host,
        items: [],
      };
      if (!d.items.some((i) => i.type === r.type && i.url === r.url)) d.items.push(r);
      map.set(domain, d);
    } catch {}
  }
  return [...map.values()].sort((a, b) => a.domain.localeCompare(b.domain));
}
export function cspDraft(a: Assessment) {
  const origins = (types: string[]) =>
    [
      ...new Set(
        a.resources
          .filter((r) => types.includes(r.type))
          .flatMap((r) => {
            try {
              const u = new URL(r.url);
              return u.origin !== a.origin && u.protocol === 'https:' ? [u.origin] : [];
            } catch {
              return [];
            }
          })
      ),
    ].sort();
  const connections = [
    ...new Set(
      (a.apiEndpoints || []).flatMap((r) => {
        try {
          return new URL(r.url).origin !== a.origin ? [new URL(r.url).origin] : [];
        } catch {
          return [];
        }
      })
    ),
  ].sort();
  const frames = [
    ...new Set(
      a.frames.flatMap((f) => {
        try {
          return new URL(f.url).origin !== a.origin ? [new URL(f.url).origin] : [];
        } catch {
          return [];
        }
      })
    ),
  ];
  const directives = [
    "default-src 'self'",
    "base-uri 'self'",
    "object-src 'none'",
    "frame-ancestors 'self'",
    `script-src 'self' ${origins(['script']).join(' ')}`.trim(),
    `style-src 'self' ${origins(['link', 'css']).join(' ')}`.trim(),
    `img-src 'self' ${origins(['img', 'image']).join(' ')}`.trim(),
    `connect-src 'self' ${connections.join(' ')}`.trim(),
    `frame-src 'self' ${frames.join(' ')}`.trim(),
    "form-action 'self'",
  ];
  return {
    header: 'Content-Security-Policy-Report-Only',
    policy: directives.join('; '),
    directives: directives.map((text) => ({
      text,
      reason: text.startsWith('script-src')
        ? 'Observed script origins only; inline scripts need separately generated nonces or hashes.'
        : text.startsWith('connect-src')
          ? 'Only observed API origins; exercise all workflows before enforcement.'
          : text.startsWith('frame-ancestors')
            ? 'Same-origin framing assumption; review legitimate embedding requirements.'
            : text.startsWith('style-src')
              ? 'Stylesheet origins; inline styles and font delivery need separate review.'
              : 'Starting restriction, based on limited captured resources where applicable.',
    })),
    limitations: [
      'Draft only. No policy is installed or security strength guaranteed.',
      'Fonts, media, workers, dynamic resources and unvisited workflows may require additional directives.',
      'Use a reporting endpoint you control if collecting violation reports; this draft does not invent an endpoint.',
      'Test a report-only deployment, collect violations, refine allowlists, and then test enforcement.',
    ],
  };
}
export const FIX_RECIPES: Record<
  string,
  { title: string; context: string; examples: { platform: string; code: string }[] }
> = {
  'SL-HEADER-002': {
    title: 'Set nosniff',
    context:
      'Send the header on applicable document/resource responses and use correct Content-Type values.',
    examples: [
      {
        platform: 'Express',
        code: "app.use((req, res, next) => { res.setHeader('X-Content-Type-Options', 'nosniff'); next(); });",
      },
      { platform: 'Nginx', code: 'add_header X-Content-Type-Options "nosniff" always;' },
      { platform: 'Apache', code: 'Header always set X-Content-Type-Options "nosniff"' },
      { platform: 'Netlify (_headers)', code: '/*\n  X-Content-Type-Options: nosniff' },
      {
        platform: 'Vercel (vercel.json)',
        code: '{"headers":[{"source":"/(.*)","headers":[{"key":"X-Content-Type-Options","value":"nosniff"}]}]}',
      },
    ],
  },
  'SL-CSP-001': {
    title: 'Introduce CSP in report-only mode',
    context:
      'Replace the sample with the reviewed rollout-assistant draft. Inline scripts and styles may need nonces/hashes. A reporting endpoint is a separate decision.',
    examples: [
      {
        platform: 'Express',
        code: "res.setHeader('Content-Security-Policy-Report-Only', \"default-src 'self'; object-src 'none'; base-uri 'self'\");",
      },
      {
        platform: 'Nginx',
        code: "add_header Content-Security-Policy-Report-Only \"default-src 'self'; object-src 'none'; base-uri 'self'\" always;",
      },
      {
        platform: 'Apache',
        code: "Header always set Content-Security-Policy-Report-Only \"default-src 'self'; object-src 'none'; base-uri 'self'\"",
      },
      {
        platform: 'Netlify (_headers)',
        code: "/*\n  Content-Security-Policy-Report-Only: default-src 'self'; object-src 'none'; base-uri 'self'",
      },
    ],
  },
  'SL-HEADER-003': {
    title: 'Choose a referrer policy',
    context:
      'strict-origin-when-cross-origin is a starting choice; review application requirements and browser behavior.',
    examples: [
      {
        platform: 'Express',
        code: "res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');",
      },
      {
        platform: 'Nginx',
        code: 'add_header Referrer-Policy "strict-origin-when-cross-origin" always;',
      },
      {
        platform: 'Apache',
        code: 'Header always set Referrer-Policy "strict-origin-when-cross-origin"',
      },
      {
        platform: 'Netlify (_headers)',
        code: '/*\n  Referrer-Policy: strict-origin-when-cross-origin',
      },
    ],
  },
};
export function recipeReference(platform: string) {
  return platform.startsWith('Express')
    ? 'https://expressjs.com/en/4x/api.html#res.set'
    : platform.startsWith('Nginx')
      ? 'https://nginx.org/en/docs/http/ngx_http_headers_module.html'
      : platform.startsWith('Apache')
        ? 'https://httpd.apache.org/docs/2.4/mod/mod_headers.html'
        : platform.startsWith('Netlify')
          ? 'https://docs.netlify.com/manage/routing/headers/'
          : 'https://vercel.com/docs/project-configuration/vercel-json';
}
export function freshness(
  a: Assessment,
  binding: { documentId: string } | undefined,
  currentDocumentId: string | undefined,
  currentTargetKey: string | undefined
) {
    return a.importedAt || a.reproducibility?.reevaluatedFrom || a.supplemental
    ? 'older assessment'
    : !binding
      ? 'unavailable'
      : currentTargetKey && a.targetKey !== currentTargetKey
        ? 'page changed'
        : currentDocumentId && binding.documentId !== currentDocumentId
          ? 'page changed'
          : (!currentDocumentId && !currentTargetKey) ? 'current' : 'current';
}
export async function scopedText(
  url: string,
  scope: Scope,
  budget: { reserve: (url: string) => Promise<void> },
  request: typeof fetch = fetch,
  assessmentOrigin = new URL(url).origin
) {
  let target = url;
  for (let hop = 0; hop < 5; hop++) {
    if (!inScope(target, scope, new URL(target).origin !== assessmentOrigin))
      throw new Error('Bundle destination is outside the authorized scope.');
    await budget.reserve(target);
    const r = await request(target, {
      credentials: 'omit',
      redirect: 'manual',
      cache: 'no-store',
      signal: AbortSignal.timeout(scope.timeoutMs),
    });
    if (r.status >= 300 && r.status < 400) {
      await r.body?.cancel();
      const location = r.headers.get('location');
      if (!location) throw new Error('Redirect destination unavailable.');
      target = new URL(location, target).href;
      continue;
    }
    if (!r.ok) throw new Error(`Response unavailable (${r.status}).`);
    const contentType = (r.headers.get('content-type') || '').split(';')[0].trim().toLowerCase();
    if (
      contentType &&
      ![
        'application/javascript',
        'text/javascript',
        'application/x-javascript',
        'text/plain',
        'application/octet-stream',
      ].includes(contentType)
    ) {
      await r.body?.cancel();
      throw new Error('Response is not a JavaScript bundle.');
    }
    const reader = r.body?.getReader();
    if (!reader) throw new Error('No body.');
    const chunks: Uint8Array[] = [];
    let size = 0;
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > scope.maxBytes) {
        await reader.cancel();
        throw new Error('Response exceeds byte limit.');
      }
      chunks.push(value);
    }
    const bytes = new Uint8Array(size);
    let p = 0;
    for (const c of chunks) {
      bytes.set(c, p);
      p += c.length;
    }
    return {
      text: new TextDecoder().decode(bytes),
      url: redactUrl(target),
      bytes: size,
      status: r.status,
    };
  }
  throw new Error('Redirect limit exceeded.');
}

