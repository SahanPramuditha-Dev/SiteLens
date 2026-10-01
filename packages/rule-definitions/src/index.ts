import { secretExposureCheck } from './rules/environment';
import { modernChecks } from './rules/modern';
import { activeProbingCheck } from './rules/probing';
import { storageSecurityCheck } from './rules/storage';
import { techVulnerabilityCheck } from './rules/tech';
import {
  clientSideSinkCheck,
  clientSideFlowCheck,
  postMessageCheck,
  sourceMapCheck,
} from './rules/clientside';
import {
  coopCheck,
  coepCheck,
  corpCheck,
  corsCheck,
  trustedTypesCheck,
  redirectCheck,
} from './rules/crossorigin';
import type { AssessmentInput, Check, Outcome, Status } from '@sitelens/shared-types';
import { policies, sources, positiveHsts, sriValid, restrictiveAncestors } from './policies';
import { originOf } from './privacy';
const MDN = 'https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/';
const outcome = (status: Status, observation: string, evidenceKeys: string[]): Outcome => ({
  status,
  observation,
  evidenceKeys,
});
const unavailable = (keys: string[]) =>
  outcome(
    'unable_to_assess',
    'No matching document response was captured. Grant access to this site, reload it, and inspect again.',
    keys
  );
const values = (i: AssessmentInput, key: string) => i.response?.headers[key] || [];
const csp = (i: AssessmentInput) =>
  policies([...values(i, 'content-security-policy'), ...i.page.metaCsp]);
const check = (
  id: string,
  name: string,
  category: string,
  severity: Check['severity'],
  method: string,
  impact: string,
  limitation: string,
  recommendation: string,
  learning: string,
  run: Check['run'],
  reference = MDN
): Check => ({
  id,
  name,
  category,
  severity,
  method,
  impact,
  limitation,
  recommendation,
  learning,
  run,
  references: [reference],
});
const header = (
  id: string,
  name: string,
  key: string,
  valid: (v: string, i: AssessmentInput) => boolean,
  recommendation: string,
  impact: string,
  severity: Check['severity'] = 'medium'
) =>
  check(
    id,
    name,
    'Security headers',
    severity,
    `Inspect captured ${key} response values.`,
    impact,
    'This checks configuration syntax or presence, not whole-policy effectiveness.',
    recommendation,
    `${name} is a browser-directed response policy. Its usefulness depends on the application and the browser.`,
    (i) => {
      if (!i.response) return unavailable([key]);
      const v = values(i, key);
      return outcome(
        v.some((x) => valid(x, i)) ? 'protection_observed' : 'potential_weakness',
        v.length
          ? `${name}: ${v.some((x) => valid(x, i)) ? 'expected configuration observed' : 'review the observed value'}.`
          : `${name} was not observed in the document response.`,
        [key]
      );
    },
    MDN + key
  );
const cookieCheck = (
  id: string,
  name: string,
  predicate: (c: AssessmentInput['cookies']['cookies'][number]) => boolean,
  advice: string,
  limitation: string,
  severity: Check['severity'] = 'low'
) =>
  check(
    id,
    name,
    'Cookies',
    severity,
    'Inspect metadata of cookies matching the document URL; never retain values.',
    'Cookie attributes limit transport, script access, or cross-site use.',
    limitation,
    advice,
    'Secure restricts transport; HttpOnly restricts script access; SameSite affects cross-site sending. These flags do not prove authentication security.',
    (i) => {
      if (!i.cookies.available)
        return outcome('unable_to_assess', i.cookies.limitation, ['cookies']);
      const eligible = i.cookies.cookies.filter((c) =>
        id === 'SL-COOKIE-002'
          ? /(session|auth|token|sid$)/i.test(c.name)
          : id === 'SL-COOKIE-004'
            ? /^__(Secure|Host)-/.test(c.name)
            : true
      );
      const bad = eligible.filter(predicate);
      return outcome(
        !eligible.length
          ? 'not_applicable'
          : bad.length
            ? 'potential_weakness'
            : 'protection_observed',
        `${bad.length} of ${eligible.length} applicable matching cookies require review for this check.`,
        ['cookies']
      );
    },
    'https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Set-Cookie'
  );
const cspReview = (
  id: string,
  name: string,
  predicate: (p: Map<string, string[]>) => boolean,
  advice: string,
  learning: string
) =>
  check(
    id,
    name,
    'Content Security Policy',
    'medium',
    'Parse enforced header and meta policies, preserving separate policies.',
    'CSP can constrain the sources and execution of injected content.',
    'Multiple policies intersect. A permissive directive in one policy may be constrained by another; this is a review observation, not proof of exploitability. Script attribute overrides and browser-specific CSP support are not exhaustively evaluated.',
    advice,
    learning,
    (i) => {
      const p = csp(i);
      if (!p.length)
        return outcome(
          i.response ? 'not_applicable' : 'unable_to_assess',
          'No enforced CSP available for directive review.',
          ['content-security-policy', 'meta-csp']
        );
      const hit = p.some(predicate);
      return outcome(
        hit ? 'potential_weakness' : 'protection_observed',
        hit
          ? 'A policy contains the pattern described by this check; review all enforcing policies together.'
          : 'The reviewed pattern was not observed in available enforcing policies.',
        ['content-security-policy', 'meta-csp']
      );
    },
    MDN + 'Content-Security-Policy'
  );
export const CHECKS: Check[] = [
  ...modernChecks,
  clientSideSinkCheck,
  clientSideFlowCheck,
  postMessageCheck,
  sourceMapCheck,
  coopCheck,
  coepCheck,
  corpCheck,
  corsCheck,
  trustedTypesCheck,
  redirectCheck,
  techVulnerabilityCheck,
  storageSecurityCheck,
  activeProbingCheck,
  secretExposureCheck,
  check(
    'SL-TLS-001',
    'Document transport',
    'Transport',
    'high',
    'Inspect the top-level document URL scheme.',
    'HTTPS protects data in transit.',
    'Certificate validity, protocol versions, ciphers and application security are outside this check.',
    'Serve all pages over HTTPS.',
    'HTTPS encrypts transport between the browser and server. It does not guarantee that application logic is safe.',
    (i) =>
      outcome(
        i.page.url.startsWith('https:') ? 'protection_observed' : 'potential_weakness',
        `The document uses ${i.page.url.startsWith('https:') ? 'HTTPS' : 'HTTP'}.`,
        ['document']
      ),
    'https://developer.mozilla.org/en-US/docs/Web/Security/Transport_Layer_Security'
  ),
  check(
    'SL-TLS-002',
    'Mixed content',
    'Transport',
    'high',
    'Inspect URLs of loaded resources and embedded frames.',
    'Active mixed content can compromise the page; passive mixed content allows interception.',
    'Only currently loaded resources are visible. Dynamic resources loaded later are missed.',
    'Ensure all resources and frames are loaded over HTTPS.',
    'Mixed content occurs when an HTTPS page loads resources over HTTP.',
    (i) => {
      const insecureResources = i.page.resources.filter((r) => r.url.startsWith('http:'));
      const insecureFrames = i.page.frames.filter((f) => f.url.startsWith('http:'));
      if (!i.page.url.startsWith('https:'))
        return outcome('not_applicable', 'Page is not loaded over HTTPS.', ['document']);
      const bad = insecureResources.length + insecureFrames.length;
      return outcome(
        bad > 0 ? 'potential_weakness' : 'protection_observed',
        bad > 0
          ? `${bad} mixed-content resource(s) or frame(s) observed.`
          : 'No mixed content observed.',
        ['resources', 'frames']
      );
    },
    'https://developer.mozilla.org/en-US/docs/Web/Security/Mixed_content'
  ),
  check(
    'SL-TLS-003',
    'Insecure form submission',
    'Transport',
    'high',
    'Inspect destination URLs of forms.',
    'Submitting forms over HTTP exposes the data to interception.',
    'Forms modified by JavaScript prior to submission may evade this check.',
    'Ensure all form action URLs use HTTPS.',
    'Forms on HTTPS pages should not submit to HTTP destinations.',
    (i) => {
      if (!i.page.url.startsWith('https:'))
        return outcome('not_applicable', 'Page is not loaded over HTTPS.', ['document']);
      const insecureForms = i.page.forms.filter((f) => f.action.startsWith('http:'));
      return outcome(
        insecureForms.length > 0 ? 'potential_weakness' : 'protection_observed',
        insecureForms.length > 0
          ? `${insecureForms.length} form(s) submit to HTTP destinations.`
          : 'All forms submit to HTTPS or same-origin.',
        ['forms']
      );
    },
    'https://developer.mozilla.org/en-US/docs/Web/Security/Insecure_passwords'
  ),
  check(
    'SL-CSP-001',
    'Content Security Policy presence',
    'Content Security Policy',
    'medium',
    'Inspect enforced CSP headers and CSP meta elements.',
    'CSP can reduce the impact of some content injection attacks.',
    'Absence does not establish XSS. Meta policies have limitations. Presence alone does not establish effectiveness.',
    'Develop a restrictive policy gradually, using Report-Only for header-based rollout.',
    'A CSP tells a browser which sources may supply scripts, styles and other content. Report-Only reports violations without blocking.',
    (i) => {
      const present = csp(i).length > 0;
      return outcome(
        present ? 'protection_observed' : i.response ? 'potential_weakness' : 'unable_to_assess',
        present
          ? 'An enforced CSP was observed.'
          : i.response
            ? 'No enforced CSP was observed.'
            : 'Header evidence unavailable and no CSP meta element observed.',
        ['content-security-policy', 'meta-csp']
      );
    },
    MDN + 'Content-Security-Policy'
  ),
  cspReview(
    'SL-CSP-002',
    'CSP inline script allowance',
    (p) => {
      const s = p.get('script-src-elem') ?? sources(p, 'script-src');
      return (
        !!s?.includes("'unsafe-inline'") && !s.some((v) => /^'(nonce-|sha(?:256|384|512)-)/.test(v))
      );
    },
    'Replace unrestricted inline execution with nonces or hashes when feasible.',
    "'unsafe-inline' can allow inline scripts. In modern browsers it may be ignored when nonces or hashes are supplied in the applicable directive."
  ),
  cspReview(
    'SL-CSP-003',
    'CSP string evaluation allowance',
    (p) => !!sources(p, 'script-src')?.includes("'unsafe-eval'"),
    'Remove unsafe-eval where application dependencies permit.',
    "'unsafe-eval' allows some string-to-code execution functions. A restrictive CSP can block them."
  ),
  cspReview(
    'SL-CSP-004',
    'CSP broad script sources',
    (p) => {
      const s = p.get('script-src-elem') ?? sources(p, 'script-src');
      return !s || s.some((v) => ['*', 'https:', 'http:', 'data:'].includes(v));
    },
    'Define specific script sources and review data: and scheme-wide allowances.',
    'A scheme source such as https: permits a much wider set of sources than a named origin.'
  ),
  cspReview(
    'SL-CSP-005',
    'CSP object restrictions',
    (p) => {
      const s = sources(p, 'object-src');
      return !s || !(s.length === 1 && s[0] === "'none'");
    },
    "Use object-src 'none' if plugin content is unnecessary.",
    'object-src controls object and embed content; default-src is its fallback.'
  ),
  cspReview(
    'SL-CSP-006',
    'CSP base URI restrictions',
    (p) => {
      const s = p.get('base-uri');
      return !s || s.some((v) => ['*', 'https:', 'http:'].includes(v));
    },
    "Use base-uri 'self' or 'none' where appropriate.",
    'base-uri limits base elements that can change how relative URLs resolve. It has no default-src fallback.'
  ),
  check(
    'SL-CSP-007',
    'CSP reporting deployment',
    'Content Security Policy',
    'informational',
    'Observe Report-Only headers separately from enforced policies.',
    'Reporting supports gradual CSP deployment.',
    'Report-Only does not enforce protection; absence of reporting is not a weakness.',
    'Use a reporting policy when preparing CSP changes.',
    'A report-only policy allows activity while sending policy violation reports to configured reporting endpoints.',
    (i) =>
      i.response
        ? outcome(
            'informational',
            values(i, 'content-security-policy-report-only').length
              ? 'Report-Only CSP observed; it does not enforce protection.'
              : 'No Report-Only CSP observed.',
            ['content-security-policy-report-only']
          )
        : unavailable(['content-security-policy-report-only']),
    MDN + 'Content-Security-Policy-Report-Only'
  ),
  header(
    'SL-HEADER-001',
    'HTTP Strict Transport Security',
    'strict-transport-security',
    (v, i) => i.page.url.startsWith('https:') && positiveHsts(v),
    'On HTTPS, deploy an appropriate positive max-age after testing.',
    'HSTS directs future connections to use HTTPS.'
  ),
  header(
    'SL-HEADER-002',
    'Content type protection',
    'x-content-type-options',
    (v) => v.trim().toLowerCase() === 'nosniff',
    'Return X-Content-Type-Options: nosniff.',
    'nosniff reduces MIME type guessing.'
  ),
  check(
    'SL-HEADER-003',
    'Referrer policy',
    'Security headers',
    'low',
    'Inspect the last recognized response token or a recognized meta referrer policy.',
    'Referrer policies control how much URL information is sent with requests.',
    'Browsers provide defaults. This check does not inspect per-element overrides.',
    'Review strict-origin-when-cross-origin, same-origin or no-referrer for your application.',
    'A referrer may disclose a referring URL. Modern browser defaults reduce this exposure even without an explicit policy.',
    (i) => {
      const tokens = values(i, 'referrer-policy')
        .join(',')
        .split(',')
        .map((x) => x.trim().toLowerCase());
      const known = [
        'no-referrer',
        'no-referrer-when-downgrade',
        'origin',
        'origin-when-cross-origin',
        'same-origin',
        'strict-origin',
        'strict-origin-when-cross-origin',
        'unsafe-url',
      ];
      const effective = tokens.filter((x) => known.includes(x)).at(-1) || i.page.metaReferrer;
      return effective && known.includes(effective)
        ? outcome(
            effective === 'unsafe-url' || effective === 'no-referrer-when-downgrade'
              ? 'potential_weakness'
              : 'protection_observed',
            `Recognized policy: ${effective}.`,
            ['referrer-policy', 'meta-referrer']
          )
        : i.response
          ? outcome('potential_weakness', 'No recognized explicit referrer policy observed.', [
              'referrer-policy',
              'meta-referrer',
            ])
          : unavailable(['referrer-policy', 'meta-referrer']);
    },
    MDN + 'Referrer-Policy'
  ),
  check(
    'SL-HEADER-004',
    'Framing protection',
    'Security headers',
    'medium',
    'Inspect header CSP frame-ancestors and X-Frame-Options.',
    'Restricting framing can reduce clickjacking exposure.',
    'frame-ancestors in meta CSP is ignored. Header presence does not establish all UI interaction security.',
    'Use a restrictive frame-ancestors directive or valid X-Frame-Options.',
    'frame-ancestors controls which pages may embed this document. It is independent of frame-src, which controls frames loaded by this document.',
    (i) => {
      if (!i.response) return unavailable(['content-security-policy', 'x-frame-options']);
      const ancestors = policies(values(i, 'content-security-policy'))
        .map((p) => p.get('frame-ancestors'))
        .filter(Boolean) as string[][];
      const xfo = values(i, 'x-frame-options');
      const ok = ancestors.length
        ? ancestors.some(restrictiveAncestors)
        : xfo.length === 1 && /^(deny|sameorigin)$/i.test(xfo[0].trim());
      return outcome(
        ok ? 'protection_observed' : 'potential_weakness',
        ok
          ? 'A restrictive header-based framing policy was observed.'
          : 'No recognized restrictive framing policy observed.',
        ['content-security-policy', 'x-frame-options']
      );
    },
    MDN + 'Content-Security-Policy/frame-ancestors'
  ),
  header(
    'SL-HEADER-005',
    'Permissions Policy',
    'permissions-policy',
    (v) => /^[a-z-]+\s*=\s*\(/i.test(v.trim()),
    'Review browser feature permissions and disable unnecessary features.',
    'Permissions Policy controls access to some browser capabilities.',
    'low'
  ),
  ...[
    [
      'SL-HEADER-006',
      'Cross-origin opener policy',
      'cross-origin-opener-policy',
      ['same-origin', 'same-origin-allow-popups', 'noopener-allow-popups'],
    ],
    [
      'SL-HEADER-007',
      'Cross-origin resource policy',
      'cross-origin-resource-policy',
      ['same-origin', 'same-site', 'cross-origin'],
    ],
    [
      'SL-HEADER-008',
      'Cross-origin embedder policy',
      'cross-origin-embedder-policy',
      ['require-corp', 'credentialless'],
    ],
  ].map(([id, name, key, accepted]) =>
    check(
      id as string,
      name as string,
      'Cross-origin policies',
      'informational',
      `Inspect ${key} header.`,
      'Cross-origin policies can provide isolation or control resource sharing.',
      'These policies are context dependent; absence is informational and not a general vulnerability.',
      'Review whether isolation is appropriate for the application.',
      'These policies may affect popups and third-party resources. Test compatibility before enabling.',
      (i) => {
        if (!i.response) return unavailable([key as string]);
        const v = values(i, key as string);
        return outcome(
          'informational',
          v.some((x) => (accepted as string[]).includes(x.split(';')[0].trim()))
            ? 'Recognized cross-origin policy observed.'
            : v.length
              ? 'Unrecognized policy value; review configuration.'
              : 'Policy not observed; applicability is context dependent.',
          [key as string]
        );
      },
      MDN + (key as string)
    )
  ),
  check(
    'SL-HEADER-009',
    'HSTS subdomain coverage',
    'Security headers',
    'informational',
    'Inspect includeSubDomains in a positive HSTS policy.',
    'Subdomain coverage extends transport policy to child hosts.',
    'Enabling this can break HTTP-only subdomains. Preload enrollment is not inferred from the preload token.',
    'Inventory subdomains before enabling includeSubDomains or considering preload.',
    'An HSTS policy without includeSubDomains applies to the current host only.',
    (i) =>
      i.response
        ? outcome(
            'informational',
            values(i, 'strict-transport-security').some(
              (v) => positiveHsts(v) && /(?:^|;)\s*includesubdomains\s*(?:;|$)/i.test(v)
            )
              ? 'includeSubDomains observed.'
              : 'No positive HSTS includeSubDomains configuration observed.',
            ['strict-transport-security']
          )
        : unavailable(['strict-transport-security']),
    MDN + 'Strict-Transport-Security'
  ),
  cookieCheck(
    'SL-COOKIE-001',
    'Secure cookie attribute',
    (c) => !c.secure,
    'Use Secure for cookies that should travel only over HTTPS.',
    'Some non-sensitive cookies may intentionally use HTTP. Matching cookies are a snapshot, not Set-Cookie history.',
    'medium'
  ),
  cookieCheck(
    'SL-COOKIE-002',
    'Probable session cookie script access',
    (c) => /(session|auth|token|sid$)/i.test(c.name) && !c.httpOnly,
    'Review HttpOnly for server-managed authentication cookies.',
    'Cookie purpose is inferred from its name with medium confidence. JavaScript-managed tokens may have different requirements.',
    'medium'
  ),
  cookieCheck(
    'SL-COOKIE-003',
    'SameSite cookie configuration',
    (c) => c.sameSite === 'unspecified' || (c.sameSite === 'no_restriction' && !c.secure),
    'Set an explicit suitable SameSite attribute; None requires Secure.',
    'Unspecified SameSite is subject to browser defaults; this does not prove CSRF.'
  ),
  cookieCheck(
    'SL-COOKIE-004',
    'Cookie prefix requirements',
    (c) =>
      (c.name.startsWith('__Secure-') && !c.secure) ||
      (c.name.startsWith('__Host-') && (!c.secure || !c.hostOnly || c.path !== '/')),
    'Respect __Secure- and __Host- prefix requirements.',
    'Browsers may reject invalid prefixed cookies; collected accepted cookies can differ from attempted Set-Cookie.'
  ),
  cookieCheck(
    'SL-COOKIE-005',
    'Cookie domain scope',
    (c) => !c.hostOnly,
    'Prefer host-only cookies for sensitive data where subdomain sharing is unnecessary.',
    'Domain cookies can be intentional; this is a scope review, not a vulnerability.'
  ),
  check(
    'SL-COOKIE-006',
    'Cookie persistence',
    'Cookies',
    'informational',
    'Observe session flag and expiration metadata.',
    'Long-lived cookies may retain identifiers across sessions.',
    'Cookie lifetime does not establish session timeout or server-side revocation behavior.',
    'Review expiration and server-side session policies.',
    'A session cookie has no explicit persistent expiration. Browser session restore may retain it.',
    (i) =>
      i.cookies.available
        ? outcome(
            'informational',
            `${i.cookies.cookies.filter((c) => !c.session).length} persistent cookies; ${i.cookies.cookies.filter((c) => c.session).length} session cookies.`,
            ['cookies']
          )
        : outcome('unable_to_assess', i.cookies.limitation, ['cookies']),
    MDN + 'Set-Cookie'
  ),
  check(
    'SL-RESOURCE-001',
    'Mixed content references',
    'Resources',
    'medium',
    'Inspect HTTP references in the HTTPS document DOM and resource timing entries.',
    'Insecure resource transport can affect confidentiality or integrity.',
    'References may be blocked or upgraded by the browser; resource timing is not a complete network log.',
    'Replace HTTP resource URLs with HTTPS.',
    'Active mixed content includes scripts; passive content includes images. Browser treatment varies.',
    (i) => {
      const bad = i.page.resources.filter((r) => r.url.startsWith('http:'));
      return outcome(
        !i.page.url.startsWith('https:')
          ? 'not_applicable'
          : bad.length
            ? 'potential_weakness'
            : 'protection_observed',
        `${bad.length} HTTP resource references observed.`,
        ['resources']
      );
    },
    'https://developer.mozilla.org/en-US/docs/Web/Security/Mixed_content'
  ),
  check(
    'SL-RESOURCE-002',
    'Third-party subresource integrity',
    'Resources',
    'low',
    'Inspect integrity on third-party DOM scripts and stylesheets.',
    'SRI checks that a fetched static resource matches an expected hash.',
    'Dynamic resources may not support stable hashes. Cross-origin SRI requires CORS support.',
    'Review SRI applicability for stable external scripts and stylesheets.',
    'An integrity hash pins expected content. Updating the content requires updating its hash.',
    (i) => {
      const eligible = i.page.resources.filter(
        (r) =>
          r.thirdParty && ['script', 'link'].includes(r.type) && r.observedBy !== 'Resource timing'
      );
      const bad = eligible.filter((r) => !r.integrity);
      return outcome(
        !eligible.length
          ? 'not_applicable'
          : bad.length
            ? 'potential_weakness'
            : 'protection_observed',
        `${bad.length} of ${eligible.length} third-party DOM scripts/stylesheets lack integrity.`,
        ['resources']
      );
    },
    'https://developer.mozilla.org/en-US/docs/Web/Security/Subresource_Integrity'
  ),
  check(
    'SL-RESOURCE-003',
    'Integrity attribute syntax',
    'Resources',
    'low',
    'Check for recognized SHA-256 / SHA-384 / SHA-512 integrity token syntax.',
    'An unrecognized token cannot supply expected integrity protection.',
    'This check does not compute hashes, fetch resources, or validate CORS responses.',
    'Use a valid integrity token and verify the resource with browser tools.',
    'Integrity contains an algorithm and Base64 hash; a syntactically valid token can still contain the wrong hash.',
    (i) => {
      const present = i.page.resources.filter((r) => r.integrity);
      const bad = present.filter((r) => !sriValid(r.integrity!));
      return outcome(
        !present.length
          ? 'not_applicable'
          : bad.length
            ? 'potential_weakness'
            : 'protection_observed',
        `${bad.length} integrity attributes have no recognized token.`,
        ['resources']
      );
    },
    'https://developer.mozilla.org/en-US/docs/Web/Security/Subresource_Integrity'
  ),
  check(
    'SL-RESOURCE-004',
    'New-window link relationships',
    'Resources',
    'informational',
    'Count target=_blank links without explicit noopener/noreferrer.',
    'Explicit noopener documents intended opener isolation.',
    'Modern browsers implicitly apply noopener to target=_blank. Missing rel alone is not treated as a weakness.',
    'Use explicit noopener where older browser compatibility is relevant.',
    'An opener reference connects a newly opened window to its originating page.',
    (i) =>
      outcome(
        'informational',
        `${i.page.blankLinks} new-window links lack an explicit isolation relationship.`,
        ['links']
      ),
    'https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Attributes/rel/noopener'
  ),
  check(
    'SL-RESOURCE-005',
    'Embedded frame sandboxing',
    'Resources',
    'low',
    'Inspect sandbox attributes of third-party iframe elements.',
    'Sandboxing can restrict capabilities of embedded documents.',
    'Some integrations require unsandboxed capabilities. Embedded document contents are not inspected.',
    'Review the minimum sandbox capabilities needed by third-party frames.',
    'A sandbox attribute restricts scripts, forms and navigation unless capabilities are explicitly allowed.',
    (i) => {
      const frames = i.page.frames.filter(
        (f) => originOf(f.url) && originOf(f.url) !== originOf(i.page.url)
      );
      return outcome(
        !frames.length
          ? 'not_applicable'
          : frames.some((f) => f.sandbox === null)
            ? 'potential_weakness'
            : 'protection_observed',
        `${frames.filter((f) => f.sandbox === null).length} of ${frames.length} third-party frames have no sandbox attribute.`,
        ['frames']
      );
    },
    'https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/iframe'
  ),
  check(
    'SL-RESOURCE-006',
    'Third-party dependency footprint',
    'Resources',
    'informational',
    'Group external resource URLs by origin.',
    'Third-party resources introduce external dependencies and data-sharing considerations.',
    'A referenced origin is not evidence of a compromised dependency. eTLD+1 ownership is not inferred.',
    'Inventory external dependencies and their data access.',
    'Same-origin means the same scheme, host and port; it differs from same-site.',
    (i) =>
      outcome(
        'informational',
        `${new Set(i.page.resources.filter((r) => r.thirdParty).map((r) => originOf(r.url))).size} third-party resource origins observed.`,
        ['resources']
      ),
    'https://developer.mozilla.org/en-US/docs/Web/Security/Same-origin_policy'
  ),
  check(
    'SL-FORM-001',
    'Password form transport',
    'Forms',
    'high',
    'Inspect declared action URLs of password forms and document transport.',
    'Passwords sent over HTTP may be exposed in transit.',
    'JavaScript may override submissions; no forms are submitted.',
    'Use HTTPS for both password pages and form destinations.',
    'An action is the declared submission destination. Client-side code can change it.',
    (i) => {
      const forms = i.page.forms.filter((f) => f.password);
      const bad = forms.filter(
        (f) => f.action.startsWith('http:') || i.page.url.startsWith('http:')
      );
      return outcome(
        !forms.length
          ? 'not_applicable'
          : bad.length
            ? 'potential_weakness'
            : 'protection_observed',
        `${bad.length} of ${forms.length} password forms use an HTTP document or destination.`,
        ['forms']
      );
    },
    'https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/form'
  ),
  check(
    'SL-FORM-002',
    'Password form method',
    'Forms',
    'high',
    'Inspect declared method on password forms.',
    'GET submissions can place passwords in URLs, logs and history.',
    'JavaScript-driven forms may not use the declared method.',
    'Use POST over HTTPS and avoid credentials in URLs.',
    'GET encodes form fields into a URL query. POST places them in a request body; transport still requires HTTPS.',
    (i) => {
      const forms = i.page.forms.filter((f) => f.password);
      return outcome(
        !forms.length
          ? 'not_applicable'
          : forms.some((f) => f.method === 'get')
            ? 'potential_weakness'
            : 'protection_observed',
        `${forms.filter((f) => f.method === 'get').length} password forms declare GET.`,
        ['forms']
      );
    },
    'https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/form'
  ),
  check(
    'SL-FORM-003',
    'External form destinations',
    'Forms',
    'informational',
    'Compare form action origins to the document origin.',
    'External submissions can share entered data with another origin.',
    'External identity providers and payment processors may be intentional. No data fields are collected.',
    'Confirm that external destinations are expected.',
    'An external action may be a legitimate service integration; review it in context.',
    (i) =>
      outcome(
        'informational',
        `${i.page.forms.filter((f) => originOf(f.action) !== originOf(i.page.url)).length} forms declare another origin.`,
        ['forms']
      ),
    'https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/form'
  ),
  ...[
    ['SL-INFO-001', 'Server disclosure', 'server'],
    ['SL-INFO-002', 'Runtime disclosure', 'x-powered-by'],
  ].map(([id, name, key]) =>
    check(
      id,
      name,
      'Information exposure',
      'low',
      `Observe ${key} response values.`,
      'Software details may help fingerprint deployments.',
      'Disclosures do not establish a vulnerable version. Proxy headers may describe the delivery layer.',
      'Remove unnecessary detailed version disclosures; maintain patched software.',
      'A response header is a clue, not a reliable account of the complete backend stack.',
      (i) =>
        i.response
          ? outcome(
              values(i, key).length ? 'informational' : 'not_applicable',
              values(i, key).length
                ? 'Software-identifying response header observed.'
                : 'Header not observed.',
              [key]
            )
          : unavailable([key]),
      MDN + key
    )
  ),
  check(
    'SL-TECH-001',
    'Client technology indicators',
    'Technology',
    'informational',
    'Inspect DOM markers, resource URL patterns and delivery headers.',
    'Technology indicators help explain the client and delivery environment.',
    'Fingerprints can be imitated. Backend and database technologies are unknown; versions are inferred only from explicit indicators.',
    'Use these indicators as leads, not a software inventory.',
    'Detected describes direct markers; inferred describes heuristic associations. Neither proves a deployed server stack.',
    (i) =>
      outcome(
        'informational',
        `${i.page.indicators.length} client technology indicators observed.`,
        ['technology']
      ),
    'https://developer.mozilla.org/en-US/docs/Web/API/Document_Object_Model'
  ),
  check(
    'SL-STORAGE-001',
    'Browser storage metadata',
    'Storage',
    'informational',
    'Read only localStorage and sessionStorage item counts.',
    'Client storage can retain application state.',
    'Keys and values are not read; sensitivity, token storage and expiration are not assessed.',
    'Review storage usage manually for sensitive data.',
    'Storage is accessible to same-origin scripts. A count alone cannot reveal what is stored.',
    (i) =>
      outcome(
        i.page.storage.local === null && i.page.storage.session === null
          ? 'unable_to_assess'
          : 'informational',
        `Local storage: ${i.page.storage.local ?? 'unavailable'} items. Session storage: ${i.page.storage.session ?? 'unavailable'} items.`,
        ['storage']
      ),
    'https://developer.mozilla.org/en-US/docs/Web/API/Web_Storage_API'
  ),
];
export const CHECK_BY_ID = new Map(CHECKS.map((c) => [c.id, c]));
