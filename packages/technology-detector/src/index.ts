import type {
  Technology,
  Resource,
  CookieMetadata,
  PageSnapshot,
  Confidence,
} from '@sitelens/shared-types';
import { redactUrl } from '@sitelens/rule-definitions/src/privacy.js';
export const FINGERPRINT_VERSION = '2026.10.01.2';
export interface TechDefinition {
  name: string;
  layer: string;
  hosts?: string[];
  paths?: RegExp[];
  headers?: Record<string, RegExp>;
  cookies?: RegExp[];
  generator?: RegExp;
  version?: RegExp;
  window?: string[];
}
const host = (name: string, layer: string, ...hosts: string[]): TechDefinition => ({
  name,
  layer,
  hosts,
});
const asset = (name: string, layer: string, paths: RegExp[], version?: RegExp): TechDefinition => ({
  name,
  layer,
  paths,
  version,
});
const generator = (name: string, layer: string): TechDefinition => ({
  name,
  layer,
  generator: new RegExp('^' + name + '(?:\\s|$)', 'i'),
});
export const TECHNOLOGIES: TechDefinition[] = [
  { name: 'React Router', layer: 'Frontend' },
  { name: 'Lenis', layer: 'JavaScript libraries' },
  { name: 'Framer Motion', layer: 'JavaScript libraries' },
  { name: 'Lucide', layer: 'Icon libraries' },
  host('Cloudflare Browser Insights', 'Analytics', 'static.cloudflareinsights.com'),
  {
    name: 'Firebase',
    layer: 'Client services',
    hosts: ['www.gstatic.com'],
    paths: [/^\/firebasejs\//],
  },
  asset('Firebase', 'Client services', [/^\/assets\/firebase-[A-Za-z0-9_-]+\.js$/]),
  asset('React', 'Frontend', [/^\/assets\/react-[A-Za-z0-9_-]+\.js$/]),
  asset('React Three Fiber', 'Visualization', [/^\/assets\/react-three-fiber-[A-Za-z0-9_-]+\.js$/]),
  asset('React Three Drei', 'Visualization', [/^\/assets\/react-three-drei-[A-Za-z0-9_-]+\.js$/]),
  asset('Three.js', 'Visualization', [/^\/assets\/three-core-[A-Za-z0-9_-]+\.js$/]),
  { name: 'Angular', layer: 'Frontend' },
  { name: 'Svelte', layer: 'Frontend' },
  host('Tailwind CSS', 'UI frameworks', 'cdn.tailwindcss.com'),
  asset('Vite', 'Build tools', [/^\/@vite\/client$/, /\/node_modules\/\.vite\//]),
  asset(
    'React',
    'Frontend',
    [/\/react-dom(?:@|[-.])\d/, /\/react-dom(?:\.production)?(?:\.min)?\.js$/],
    /\/react-dom(?:@|-)(\d+\.\d+\.\d+)(?:\/|\.)/
  ),
  asset('Next.js', 'Frontend', [/^\/_next\//]),
  asset('Nuxt.js', 'Frontend', [/^\/_nuxt\//]),
  ...['React', 'Vue', 'jQuery', 'Bootstrap', 'Axios', 'Lodash'].map((name) => {
    const slug = name.toLowerCase();
    return asset(
      name === 'Vue' ? 'Vue.js' : name,
      ['React', 'Vue'].includes(name)
        ? 'Frontend'
        : name === 'Bootstrap'
          ? 'UI frameworks'
          : 'JavaScript libraries',
      [
        new RegExp('/' + slug + '(?:@|[-.])\\d', 'i'),
        new RegExp(
          '/' + slug + '(?:\\.production|\\.global|\\.bundle)?(?:\\.min)?\\.(?:js|css)$',
          'i'
        ),
      ],
      new RegExp('/' + slug + '(?:@|-)(\\d+\\.\\d+\\.\\d+)(?:/|\\.)', 'i')
    );
  }),
  asset('Alpine.js', 'Frontend', [/\/alpinejs(?:@|\/)/]),
  asset('HTMX', 'Frontend', [/\/htmx(?:\.org)?(?:@|\/)/, /\/htmx(?:\.min)?\.js$/]),
  asset('D3.js', 'Visualization', [/\/d3(?:@|[-.])\d/, /\/d3(?:\.min)?\.js$/]),
  asset('Chart.js', 'Visualization', [/\/chart\.js(?:@|\/)/, /\/chart(?:\.umd)?(?:\.min)?\.js$/]),
  asset('Three.js', 'Visualization', [/\/three(?:@|\/)/, /\/three(?:\.min)?\.js$/]),
  asset('GSAP', 'JavaScript libraries', [/\/gsap(?:@|\/)/, /\/gsap(?:\.min)?\.js$/]),
  asset('WordPress', 'Content management', [/\/wp-(?:content|includes)\//]),
  ...['WordPress', 'Drupal', 'Joomla', 'Ghost'].map((n) => generator(n, 'Content management')),
  ...['Wix', 'Squarespace', 'Webflow'].map((n) => generator(n, 'Website builders')),
  ...['Hugo', 'Jekyll', 'Gatsby', 'Astro', 'Docusaurus'].map((n) =>
    generator(n, 'Static site generators')
  ),
  host('Shopify', 'Commerce', 'cdn.shopify.com'),
  asset('WooCommerce', 'Commerce', [/\/wp-content\/plugins\/woocommerce\//]),
  asset('Magento', 'Commerce', [/\/static\/version\d+\/frontend\/Magento\//]),
  host('Google Analytics', 'Analytics', 'www.google-analytics.com', 'google-analytics.com'),
  {
    name: 'Google Analytics',
    layer: 'Analytics',
    hosts: ['www.googletagmanager.com'],
    paths: [/^\/gtag\/js$/],
  },
  {
    name: 'Google Tag Manager',
    layer: 'Tag management',
    hosts: ['www.googletagmanager.com'],
    paths: [/^\/gtm\.js$/],
  },
  host('Plausible', 'Analytics', 'plausible.io'),
  host('PostHog', 'Analytics', 'us.i.posthog.com', 'eu.i.posthog.com', 'app.posthog.com'),
  host('Mixpanel', 'Analytics', 'cdn.mxpnl.com'),
  host('Hotjar', 'Analytics', 'static.hotjar.com', 'script.hotjar.com'),
  host('Microsoft Clarity', 'Analytics', 'www.clarity.ms'),
  host('Matomo', 'Analytics', 'cdn.matomo.cloud'),
  host('Segment', 'Analytics', 'cdn.segment.com'),
  host('Amplitude', 'Analytics', 'cdn.amplitude.com'),
  host('Sentry', 'Monitoring', 'browser.sentry-cdn.com', 'js.sentry-cdn.com'),
  host('Datadog', 'Monitoring', 'www.datadoghq-browser-agent.com'),
  host('New Relic', 'Monitoring', 'js-agent.newrelic.com', 'bam.nr-data.net'),
  host('Intercom', 'Customer support', 'widget.intercom.io', 'js.intercomcdn.com'),
  host('Zendesk', 'Customer support', 'static.zdassets.com'),
  host('Crisp', 'Customer support', 'client.crisp.chat'),
  host('Tawk.to', 'Customer support', 'embed.tawk.to'),
  host('HubSpot', 'Marketing', 'js.hs-scripts.com', 'js.hs-analytics.net'),
  host('Stripe', 'Payments', 'js.stripe.com'),
  { name: 'PayPal', layer: 'Payments', hosts: ['www.paypal.com'], paths: [/^\/sdk\/js$/] },
  {
    name: 'Google reCAPTCHA',
    layer: 'Security',
    hosts: ['www.google.com', 'www.recaptcha.net'],
    paths: [/^\/recaptcha\//],
  },
  {
    name: 'Cloudflare Turnstile',
    layer: 'Security',
    hosts: ['challenges.cloudflare.com'],
    paths: [/^\/turnstile\//],
  },
  host('hCaptcha', 'Security', 'js.hcaptcha.com'),
  host('Google Fonts', 'Fonts', 'fonts.googleapis.com', 'fonts.gstatic.com'),
  host('Adobe Fonts', 'Fonts', 'use.typekit.net'),
  host('jsDelivr', 'Delivery', 'cdn.jsdelivr.net'),
  host('UNPKG', 'Delivery', 'unpkg.com'),
  host('cdnjs', 'Delivery', 'cdnjs.cloudflare.com'),
  {
    name: 'Cloudflare',
    layer: 'Delivery',
    headers: { server: /^cloudflare$/i, 'cf-ray': /^[a-f0-9]+-/i },
  },
  {
    name: 'AWS CloudFront',
    layer: 'Delivery',
    headers: { via: /\bcloudfront\b/i, 'x-amz-cf-id': /.+/ },
  },
  {
    name: 'Fastly',
    layer: 'Delivery',
    headers: { 'x-served-by': /\bcache-/i, 'x-fastly-request-id': /.+/ },
  },
  { name: 'Vercel', layer: 'Delivery', headers: { server: /^vercel$/i, 'x-vercel-id': /.+/ } },
  {
    name: 'Netlify',
    layer: 'Delivery',
    headers: { server: /^netlify$/i, 'x-nf-request-id': /.+/ },
  },
  { name: 'Nginx', layer: 'Server', headers: { server: /\bnginx(?:\/([\d.]+))?\b/i } },
  { name: 'Apache', layer: 'Server', headers: { server: /\bApache(?:\/([\d.]+))?\b/i } },
  {
    name: 'Microsoft IIS',
    layer: 'Server',
    headers: { server: /\bMicrosoft-IIS(?:\/([\d.]+))?\b/i },
  },
  { name: 'LiteSpeed', layer: 'Server', headers: { server: /\bLiteSpeed\b/i } },
  { name: 'Express', layer: 'Backend clues', headers: { 'x-powered-by': /^Express$/i } },
  {
    name: 'PHP',
    layer: 'Backend clues',
    headers: { 'x-powered-by': /^PHP(?:\/([\d.]+))?/i },
    cookies: [/^PHPSESSID$/],
  },
  {
    name: 'ASP.NET',
    layer: 'Backend clues',
    headers: { 'x-powered-by': /^ASP\.NET$/i, 'x-aspnet-version': /^([\d.]+)$/ },
    cookies: [/^ASP\.NET_SessionId$/],
  },
  { name: 'Django', layer: 'Backend clues', cookies: [/^csrftoken$/] },
  { name: 'Laravel', layer: 'Backend clues', cookies: [/^laravel_session$/] },
];
const rank: Record<Confidence, number> = { low: 0, medium: 1, high: 2 };
export function detectTechnologies(
  _html: string,
  resources: Resource[],
  headers: Record<string, string[]>,
  cookies: CookieMetadata[],
  _windowKeys: string[] = [],
  meta: PageSnapshot['technologyMeta'] = [],
  existing: Technology[] = []
): Technology[] {
  const result = new Map<string, Technology>();
  const add = (
    def: Pick<TechDefinition, 'name' | 'layer'>,
    signal: NonNullable<Technology['signals']>[number],
    version?: string,
    versionConfidence: Confidence = 'low'
  ) => {
    let t = result.get(def.name);
    if (!t) {
      t = {
        name: def.name,
        layer: def.layer,
        confidence: signal.confidence,
        observation: '',
        version: 'Unknown',
        versionConfidence: 'low',
        detection: 'observed',
        fingerprintVersion: FINGERPRINT_VERSION,
        signals: [],
      };
      result.set(def.name, t);
    }
    if (
      !t.signals!.some(
        (s) =>
          s.type === signal.type &&
          s.source === signal.source &&
          s.observation === signal.observation
      )
    )
      t.signals!.push(signal);
    if (rank[signal.confidence] > rank[t.confidence]) t.confidence = signal.confidence;
    if (signal.type !== 'inference') t.detection = 'observed';
    if (version && /^\d+(?:\.\d+){0,3}(?:[-\w.]*)?$/.test(version)) {
      if (t.version !== 'Unknown' && t.version !== version) {
        t.version = 'Conflicting indicators';
        t.versionConfidence = 'low';
        t.versionSource = 'Conflicting version signals';
      } else if (
        t.version !== 'Conflicting indicators' &&
        (t.version === 'Unknown' || rank[versionConfidence] >= rank[t.versionConfidence || 'low'])
      ) {
        t.version = version;
        t.versionConfidence = versionConfidence;
        t.versionSource = signal.source;
      }
    }
    t.observation = t.signals!.map((s) => s.observation).join(' ');
  };
  for (const old of existing) {
    for (const signal of old.signals?.length
      ? old.signals
      : [
          {
            type: 'dom' as const,
            source: 'Captured DOM marker',
            observation: old.observation,
            confidence: old.confidence,
          },
        ])
      add(old, signal, old.version, old.versionConfidence);
    if (old.variant) result.get(old.name)!.variant = old.variant;
  }
  for (const def of TECHNOLOGIES) {
    for (const r of resources.slice(0, 2000)) {
      let u: URL;
      try {
        u = new URL(r.url);
      } catch {
        continue;
      }
      if (
        !['http:', 'https:'].includes(u.protocol) ||
        (def.hosts && !def.hosts.includes(u.hostname)) ||
        (def.paths && !def.paths.some((p) => p.test(u.pathname))) ||
        (!def.hosts && !def.paths)
      )
        continue;
      const source = redactUrl(r.url);
      add(
        def,
        {
          type: 'resource',
          source,
          observation: `${def.name} resource fingerprint: ${source}.`,
          confidence: 'medium',
        },
        def.version?.exec(u.pathname)?.[1],
        'medium'
      );
      if (
        def.name === 'Google Analytics' &&
        u.hostname === 'www.googletagmanager.com' &&
        u.pathname === '/gtag/js' &&
        /^G-[A-Z0-9]+$/.test(u.searchParams.get('id') || '')
      ) {
        const ga = result.get(def.name)!;
        ga.variant = 'GA4';
        if (!ga.signals!.some((s) => s.observation.includes('GA4 identifier')))
          ga.signals!.push({
            type: 'resource',
            source,
            observation:
              'GA4 identifier format observed in the script-loader URL; identifier omitted.',
            confidence: 'medium',
          });
      }
    }
    for (const [key, pattern] of Object.entries(def.headers || {}))
      for (const value of (headers[key] || []).slice(0, 10)) {
        const match = pattern.exec(value.slice(0, 4096));
        if (match)
          add(
            def,
            {
              type: 'header',
              source: key,
              observation: `${key} matched the ${def.name} fingerprint (self-reported header).`,
              confidence: 'medium',
            },
            match[1],
            'high'
          );
      }
    for (const pattern of def.cookies || [])
      if (cookies.some((c) => pattern.test(c.name)))
        add(def, {
          type: 'cookie',
          source: 'Cookie name pattern',
          observation: `Cookie name matches ${def.name}; shared names are weak evidence.`,
          confidence: 'low',
        });
    if (def.generator)
      for (const m of meta || [])
        if (m.name === 'generator' && def.generator.test(m.content)) {
          const v = m.content.match(/\b(\d+\.\d+(?:\.\d+)?)\b/)?.[1];
          add(
            def,
            {
              type: 'meta',
              source: 'meta[name="generator"]',
              observation: `Generator declares ${def.name}${v ? ' ' + v : ''}; this is self-reported.`,
              confidence: 'medium',
            },
            v,
            'high'
          );
        }
  }
  for (const [parent, child] of [
    ['Next.js', 'React'],
    ['Nuxt.js', 'Vue.js'],
    ['WooCommerce', 'WordPress'],
  ])
    if (result.has(parent) && !result.has(child)) {
      add(
        { name: child, layer: child === 'WordPress' ? 'Content management' : 'Frontend' },
        {
          type: 'inference',
          source: parent,
          observation: `Inferred from ${parent}; no independent ${child} fingerprint observed.`,
          confidence: 'low',
        }
      );
      result.get(child)!.detection = 'inferred';
    }
  for (const t of result.values())
    if (t.signals?.every((s) => s.type === 'inference')) t.detection = 'inferred';
  return [...result.values()].sort(
    (a, b) => a.layer.localeCompare(b.layer) || a.name.localeCompare(b.name)
  );
}

