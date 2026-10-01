import { parse } from 'acorn';
import { fullAncestor } from 'acorn-walk';
import type { SecretFinding } from '@sitelens/shared-types';
export function entropy(value: string) {
  const counts = new Map<string, number>();
  for (const c of value) counts.set(c, (counts.get(c) || 0) + 1);
  return -[...counts.values()].reduce(
    (n, c) => n + (c / value.length) * Math.log2(c / value.length),
    0
  );
}
async function digest(value: string) {
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return [...new Uint8Array(bytes)].map((b) => b.toString(16).padStart(2, '0')).join('');
}
async function scan(
  content: string,
  source: string,
  onValue?: (value: LiveSecretValue) => void
): Promise<SecretFinding[]> {
  const locations: { start: number; end: number; line: number; column: number; path: string }[] =
    [];
  const member = (n: any): string =>
    n?.type === 'Identifier'
      ? n.name
      : n?.type === 'MemberExpression'
        ? member(n.object) + '.' + (n.property.name || n.property.value)
        : '';
  try {
    const tree = parse(content.slice(0, 2000000), {
      ecmaVersion: 'latest',
      sourceType: 'module',
      locations: true,
    });
    fullAncestor(tree, (n: any, _s: any, ancestors: any[]) => {
      if (!['Property', 'VariableDeclarator', 'AssignmentExpression'].includes(n.type)) return;
      const value = n.value || n.init || n.right;
      if (value?.type !== 'Literal' || typeof value.value !== 'string') return;
      const names = ancestors
        .filter((a) => a.type === 'Property')
        .map((a) => a.key.name || a.key.value);
      const declaration = ancestors.find((a) => a.type === 'VariableDeclarator');
      const assignment = ancestors.find((a) => a.type === 'AssignmentExpression');
      const prefix = declaration?.id?.name || member(assignment?.left);
      let path = names.length ? [prefix, ...names].filter(Boolean).join('.') : prefix;
      locations.push({
        start: n.start,
        end: n.end,
        line: n.loc.start.line,
        column: n.loc.start.column + 1,
        path,
      });
    });
  } catch {}
  const results: SecretFinding[] = [];
  const seen = new Set<string>();
  const assignments = /["']?([A-Za-z_][\w.-]{0,100})["']?\s*[:=]\s*["']([^"'\r\n]{4,500})["']/g;
  for (const match of content.slice(0, 2000000).matchAll(assignments)) {
    const key = match[1],
      value = match[2];
    if (
      !/(secret|password|token|key|public|api.?url|database|mongodb|postgres|client.?id)/i.test(key)
    )
      continue;
    if (
      /^(example|placeholder|changeme|your[_ -]|undefined|null|true|false)/i.test(value) ||
      /\$\{|process\.env|import\.meta\.env/.test(value)
    )
      continue;
    const provider = /^sk_(live|test|dummy)_[A-Za-z0-9]{16,}$/.test(value)
      ? 'Stripe secret'
      : /^pk_(live|test)_/.test(value)
        ? 'Stripe publishable'
        : /^(ghp_|github_pat_)[\w]{20,}$/.test(value)
          ? 'GitHub'
          : /^AKIA[A-Z0-9]{16}$/.test(value)
            ? 'AWS access identifier'
            : /AWS_SECRET_ACCESS_KEY/i.test(key) && /^[\w/+]{40}$/.test(value)
              ? 'AWS secret'
              : /^AIza[\w-]{35}$/.test(value)
                ? 'Google browser API key'
                : 'Generic';
    const hardSecret =
      ['Stripe secret', 'GitHub', 'AWS secret'].includes(provider) ||
      /(?:^|_)(PRIVATE_KEY|JWT_SECRET|SESSION_SECRET|AWS_SECRET_ACCESS_KEY|STRIPE_SECRET_KEY)(?:$|_)/i.test(
        key
      );
    const publicSignal =
      /^(NEXT_PUBLIC_|VITE_|REACT_APP_|PUBLIC_|EXPO_PUBLIC_)/i.test(key) ||
      /publishable|client.?id$/i.test(key) ||
      ['Stripe publishable', 'Google browser API key', 'AWS access identifier'].includes(provider);
    let publicUrl = false;
    try {
      publicUrl = /^https?:\/\//.test(value) && !new URL(value).password;
    } catch {
      /* An invalid configuration value must not abort collection. */
    }
    const score = entropy(value);
    const structured = provider !== 'Generic';
    const secret =
      hardSecret ||
      (!publicSignal &&
        !publicUrl &&
        /(secret|password|token|key)/i.test(key) &&
        value.length >= 16 &&
        score >= 3);
    const fingerprint = await digest(value);
    if (seen.has(`${key}:${fingerprint}`)) continue;
    seen.add(`${key}:${fingerprint}`);
    onValue?.({ key, valueFingerprint: fingerprint, value });
    const prefix = value.length >= 12 ? value.slice(0, 3) : '',
      suffix = value.length >= 12 ? value.slice(-2) : '';
    results.push({
      key,
      source,
      location: {
        scriptId: source,
        url: '',
        line:
          locations.find((n) => n.start <= match.index! && n.end >= match.index!)?.line ||
          content.slice(0, match.index).split('\n').length,
        column:
          locations.find((n) => n.start <= match.index! && n.end >= match.index!)?.column ||
          match.index! - content.lastIndexOf('\n', match.index! - 1),
        propertyPath:
          locations.find((n) => n.start <= match.index! && n.end >= match.index!)?.path || key,
        method: locations.some((n) => n.start <= match.index! && n.end >= match.index!)
          ? 'AST property location + value pattern'
          : 'Text pattern location',
      },
      category: secret
        ? 'Potential credential'
        : publicSignal || publicUrl
          ? 'Browser-intended configuration'
          : 'Unclassified pattern',
      provider,
      isSecret: secret,
      isLikelyPublic: !hardSecret && (publicSignal || publicUrl),
      confidence:
        secret && structured
          ? 'High'
          : secret
            ? 'Medium'
            : publicSignal || publicUrl
              ? 'High'
              : 'Low',
      entropyScore: Math.round(score * 100) / 100,
      valueFingerprint: fingerprint,
      length: value.length,
      prefix,
      suffix,
      valueRedacted: prefix ? `${prefix}…${suffix} [${value.length} characters]` : '[REDACTED]',
      signals: [
        ...(hardSecret ? ['secret key name or provider format'] : []),
        ...(structured ? ['recognized format'] : []),
        ...(publicSignal ? ['public context'] : []),
        `entropy ${score.toFixed(2)}`,
      ],
    });
    if (results.length >= 100) break;
  }
  return results;
}
export interface LiveSecretValue {
  key: string;
  valueFingerprint: string;
  value: string;
}
export async function scanForSecrets(content: string, source: string): Promise<SecretFinding[]> {
  return scan(content, source);
}
// Full values are returned only for an explicit live display, never as assessment evidence.
export async function readSecretValues(content: string): Promise<LiveSecretValue[]> {
  const values: LiveSecretValue[] = [];
  await scan(content, 'Live DOM inline scripts', (value) => values.push(value));
  return values;
}

export async function scanScriptSecrets(scripts: { id: string; code: string }[], url: string) {
  const results: SecretFinding[] = [];
  let remaining = 2000000;
  for (const script of scripts.slice(0, 100)) {
    if (remaining <= 0 || results.length >= 100) break;
    const code = script.code.slice(0, remaining);
    remaining -= code.length;
    const found = await scanForSecrets(code, script.id);
    results.push(
      ...found.map((f) => ({
        ...f,
        location: f.location ? { ...f.location, scriptId: script.id, url } : undefined,
      }))
    );
  }
  return results.slice(0, 100);
}
