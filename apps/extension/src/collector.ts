import type { PageSnapshot, Technology, Resource } from '@sitelens/shared-types';
// Serialized by Chrome and reused by the CLI; all runtime helpers are local.
export async function collectPage(): Promise<PageSnapshot> {
  const limits: string[] = [];
  const cap = <T>(items: T[], max: number, label: string) => {
    if (items.length > max) limits.push(`${label}: ${max} of ${items.length} retained.`);
    return items.slice(0, max);
  };
  const resources: Resource[] = cap(
    [
      ...document.querySelectorAll<HTMLScriptElement | HTMLLinkElement | HTMLImageElement>(
        'script[src],link[rel="stylesheet"][href],link[rel="modulepreload"][href],link[rel="preload"][as="script"][href],img[src],video[src],audio[src],source[src]'
      ),
    ],
    1000,
    'DOM resources'
  ).map((el) => ({
    url: 'src' in el ? el.src : (el as HTMLLinkElement).href,
    type:
      el.tagName === 'LINK' && ['modulepreload', 'preload'].includes((el as HTMLLinkElement).rel)
        ? 'script'
        : el.tagName.toLowerCase(),
    integrity: el.getAttribute('integrity'),
    crossorigin: el.getAttribute('crossorigin'),
    loadedBy: 'Main document',
    observedBy: 'DOM',
  }));
  const known = new Set(resources.map((r) => r.url));
  for (const e of cap(
    performance.getEntriesByType('resource') as PerformanceResourceTiming[],
    1000,
    'Resource timing'
  ))
    if (!known.has(e.name)) {
      known.add(e.name);
      resources.push({
        url: e.name,
        type: e.initiatorType || 'resource',
        integrity: null,
        crossorigin: null,
        loadedBy: 'Runtime / unspecified',
        observedBy: 'Resource timing',
      });
    }
  const forms = cap([...document.forms], 200, 'Forms').map((f) => ({
    action: f.action || location.href,
    method: f.method.toLowerCase(),
    password: !!f.querySelector('input[type="password"]'),
  }));
  const frames = cap(
    [...document.querySelectorAll<HTMLIFrameElement>('iframe')],
    200,
    'Frames'
  ).map((f) => ({ url: f.src || 'about:blank', sandbox: f.getAttribute('sandbox') }));
  const indicators: Technology[] = [];
  for (const [selector, name] of [
    ['[data-reactroot]', 'React'],
    ['[ng-version]', 'Angular'],
    ['[data-v-app]', 'Vue.js'],
    ['[class*="svelte-"]', 'Svelte'],
    ['#__next,#__NEXT_DATA__', 'Next.js'],
    ['#__nuxt', 'Nuxt.js'],
    ['html[data-wf-site]', 'Webflow'],
    ['meta[name="generator"][content^="Gatsby" i],#___gatsby', 'Gatsby'],
    ['[data-astro-cid]', 'Astro'],
    ['[x-data][x-init],[x-data][x-show]', 'Alpine.js'],
    ['[hx-get],[hx-post]', 'HTMX'],
    ['svg.lucide', 'Lucide'],
    ['html.lenis', 'Lenis'],
    ['[data-projection-id]', 'Framer Motion'],
    ['link[href*="/wp-content/plugins/woocommerce/"]', 'WooCommerce'],
  ])
    if (document.querySelector(selector))
      indicators.push({
        name,
        layer: ['Lucide'].includes(name)
          ? 'Icon libraries'
          : ['Lenis', 'Framer Motion'].includes(name)
            ? 'JavaScript libraries'
            : name === 'Webflow'
              ? 'Website builders'
              : name === 'WooCommerce'
                ? 'Commerce'
                : 'Frontend',
        confidence: 'medium',
        observation: `${selector} DOM marker observed.`,
        version:
          name === 'Angular'
            ? document.querySelector('[ng-version]')?.getAttribute('ng-version')?.slice(0, 32) ||
              'Unknown'
            : 'Unknown',
        versionConfidence: name === 'Angular' ? 'high' : 'low',
        versionSource: 'DOM marker',
        signals: [
          {
            type: 'dom',
            source: selector,
            observation: `${selector} DOM marker observed.`,
            confidence: 'medium',
          },
        ],
      });
  let rulesRead = 0;
  const tailwindMarkers = new Set<string>();
  for (const sheet of [...document.styleSheets].slice(0, 30)) {
    try {
      const rules = [...sheet.cssRules];
      for (let n = 0; n < rules.length && rulesRead < 2000; n++, rulesRead++) {
        const rule = rules[n];
        const text = rule.cssText.slice(0, 8000);
        for (const m of text.matchAll(
          /--tw-(?:translate|rotate|scale|ring|shadow|space|border|gradient|backdrop|blur|divide|inset)[\w-]*/g
        ))
          tailwindMarkers.add(m[0]);
        if ('cssRules' in rule)
          rules.push(...Array.from((rule as CSSGroupingRule).cssRules).slice(0, 2000 - rulesRead));
      }
    } catch {}
    if (rulesRead >= 2000) break;
  }
  if (tailwindMarkers.size >= 2)
    indicators.push({
      name: 'Tailwind CSS',
      layer: 'UI frameworks',
      confidence: 'medium',
      version: 'Unknown',
      observation:
        'Multiple Tailwind-specific --tw-* CSS custom-property names observed in readable stylesheet rules.',
      signals: [
        {
          type: 'stylesheet',
          source: 'Browser-readable CSS rules',
          observation:
            'Tailwind CSS custom-property marker families observed; stylesheet values are omitted.',
          confidence: 'medium',
        },
      ],
    });
  let local: number | null = null,
    session: number | null = null;
  const keys: string[] = [];
  try {
    local = localStorage.length;
    for (let i = 0; i < Math.min(local, 200); i++) {
      const k = localStorage.key(i) || '';
      if (/token|jwt|session|auth|secret|credential/i.test(k)) keys.push('sensitive-name pattern');
    }
  } catch {}
  try {
    session = sessionStorage.length;
  } catch {}
  const inlineScripts = cap(
    [...document.querySelectorAll('script:not([src])')].filter(
      (s) =>
        !s.getAttribute('type') ||
        ['module', 'text/javascript', 'application/javascript'].includes(
          s.getAttribute('type') || ''
        )
    ),
    100,
    'Inline scripts'
  ).map((s, i) => ({ id: `inline-${i + 1}`, code: (s.textContent || '').slice(0, 500001) }));
  const sourceMapUrls: string[] = [];
  for (const s of inlineScripts)
    for (const m of s.code.matchAll(/\/\/[#@]\s*sourceMappingURL=([^\s]+)/g))
      try {
        sourceMapUrls.push(new URL(m[1], location.href).href);
      } catch {}
  let serviceWorkers: PageSnapshot['serviceWorkers'];
  try {
    serviceWorkers = (await navigator.serviceWorker.getRegistrations()).slice(0, 100).map((r) => ({
      scope: r.scope,
      scriptUrl: r.active?.scriptURL || r.waiting?.scriptURL || r.installing?.scriptURL || '',
      state: r.active?.state || r.waiting?.state || r.installing?.state || 'unknown',
    }));
  } catch {}
  const nav = performance.getEntriesByType('navigation')[0] as
    PerformanceNavigationTiming | undefined;
  return {
    url: location.href,
    timeOrigin: performance.timeOrigin,
    resources,
    forms,
    frames,
    indicators,
    technologyMeta: [...document.querySelectorAll<HTMLMetaElement>('meta[name="generator" i]')]
      .slice(0, 10)
      .map((m) => ({ name: 'generator', content: m.content.slice(0, 256) })),
    metaCsp: cap(
      [...document.querySelectorAll<HTMLMetaElement>('meta[http-equiv]')]
        .filter((m) => m.httpEquiv.toLowerCase() === 'content-security-policy')
        .map((m) => m.content.slice(0, 16000)),
      10,
      'Meta CSP'
    ),
    metaReferrer:
      document.querySelector<HTMLMetaElement>('meta[name="referrer" i]')?.content.toLowerCase() ||
      null,
    blankLinks: document.querySelectorAll(
      'a[target="_blank"]:not([rel~="noopener"]):not([rel~="noreferrer"])'
    ).length,
    storage: { local, session, keys },
    limits, windowKeys: Object.keys(window).slice(0, 5000),
    collectedAt: new Date().toISOString(),
    inlineScripts,
    sourceMapUrls: sourceMapUrls.slice(0, 20),
    serviceWorkers,
    manifestUrl: document.querySelector<HTMLLinkElement>('link[rel="manifest"]')?.href || null,
    crossOriginIsolated: window.crossOriginIsolated,
    performance: {
      fcp:
        performance.getEntriesByType('paint').find((p) => p.name === 'first-contentful-paint')
          ?.startTime || 0,
      domInteractive: nav?.domInteractive || 0,
      domComplete: nav?.domComplete || 0,
      loadEvent: nav?.loadEventEnd || 0,
    },
  };
}

