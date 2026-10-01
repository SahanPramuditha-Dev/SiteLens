export function parseCsp(value: string): Map<string, string[]> {
  const directives = new Map<string, string[]>();
  for (const part of value.split(';')) {
    const [name, ...tokens] = part.trim().split(/\s+/);
    if (name && !directives.has(name.toLowerCase())) directives.set(name.toLowerCase(), tokens);
  }
  return directives;
}
export function policies(values: string[]): Map<string, string[]>[] {
  return values
    .flatMap((v) => v.split(','))
    .filter((v) => v.trim())
    .map(parseCsp);
}
export function sources(policy: Map<string, string[]>, directive: string): string[] | undefined {
  return policy.get(directive) ?? policy.get('default-src');
}
export function positiveHsts(value: string): boolean {
  return /(?:^|;)\s*max-age\s*=\s*"?[1-9]\d*"?\s*(?:;|$)/i.test(value);
}
export function sriValid(value: string): boolean {
  return value
    .trim()
    .split(/\s+/)
    .some((v) => /^sha(?:256|384|512)-[A-Za-z0-9+/]+={0,2}(?:\?\S+)?$/.test(v));
}
export function restrictiveAncestors(tokens: string[]): boolean {
  return (
    tokens.length > 0 &&
    !tokens.includes('*') &&
    !tokens.some((t) => /^(https?:|https?:\/\/\*)$/.test(t)) &&
    tokens.every((t) => t === "'none'" || t === "'self'" || /^https?:\/\/[^\s]+$/.test(t))
  );
}
