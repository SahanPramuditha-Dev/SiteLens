import type { Scope, SourceMapObservation } from '@sitelens/shared-types';
import { RequestBudget, inScope } from '@sitelens/rule-definitions/src/scope.js';
import { redactUrl, text } from '@sitelens/rule-definitions/src/privacy.js';
import { scanForSecrets } from './environment';
export async function inspectSourceMaps(
  urls: string[],
  scope: Scope,
  request: typeof fetch = fetch
): Promise<SourceMapObservation[]> {
  const budget = new RequestBudget(scope);
  const results: SourceMapObservation[] = [];
  for (const raw of [...new Set(urls)].slice(0, 20)) {
    const record: SourceMapObservation = {
      url: redactUrl(raw),
      status: 'blocked',
      sources: [],
      secrets: [],
      provenance: {
        source: 'extension-request',
        collector: 'Scoped supplemental source-map reader',
      },
      limitation:
        'Explicit supplemental request; public accessibility does not establish sensitivity. Credentials omitted.',
    };
    try {
      let url = raw,
        response: Response | undefined;
      for (let hop = 0; hop < 5; hop++) {
        await budget.reserve(url);
        response = await request(url, {
          credentials: 'omit',
          redirect: 'manual',
          cache: 'no-store',
          signal: AbortSignal.timeout(scope.timeoutMs),
        });
        if (response.status >= 300 && response.status < 400) {
          const location = response.headers.get('location');
          await response.body?.cancel();
          if (!location) throw new Error('Redirect destination unavailable.');
          url = new URL(location, url).href;
          if (!inScope(url, scope)) throw new Error('Redirect outside scope.');
          continue;
        }
        break;
      }
      if (!response?.ok) throw new Error('Map response unavailable.');
      const reader = response.body?.getReader();
      if (!reader) throw new Error('No response body.');
      const chunks: Uint8Array[] = [];
      let size = 0;
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        size += value.length;
        if (size > scope.maxBytes) {
          await reader.cancel();
          throw new Error('Map exceeds the byte limit.');
        }
        chunks.push(value);
      }
      const bytes = new Uint8Array(size);
      let position = 0;
      for (const chunk of chunks) {
        bytes.set(chunk, position);
        position += chunk.length;
      }
      const map = JSON.parse(new TextDecoder().decode(bytes));
      if (map.version !== 3 || !Array.isArray(map.sources))
        throw new Error('Not a supported source map.');
      record.sources = map.sources
        .slice(0, 200)
        .map((p: unknown) => text(p, 256).replace(/[?#].*$/, ''));
      const content = (Array.isArray(map.sourcesContent) ? map.sourcesContent : [])
        .filter((s: unknown) => typeof s === 'string')
        .join('\n')
        .slice(0, scope.maxBytes);
      record.secrets = await scanForSecrets(content, 'Authorized source map');
      record.status = 'inspected';
      record.provenance.statusCode = response.status;
    } catch (e) {
      record.limitation = (e as Error).message;
      record.status = inScope(raw, scope) ? 'failed' : 'blocked';
    }
    results.push(record);
  }
  return results;
}
