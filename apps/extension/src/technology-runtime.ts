import type { Technology } from '@sitelens/shared-types';
// Serialized in the page's MAIN world; return only fixed names and bounded version metadata.
export function collectRuntimeTechnologies() {
  const technologies: Technology[] = [];
  const data = (path: string): unknown => {
    let value: unknown = window;
    for (const key of path.split('.')) {
      if (!value || !['object', 'function'].includes(typeof value)) return;
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      if (!descriptor || !('value' in descriptor)) return;
      value = descriptor.value;
    }
    return value;
  };
  const add = (name: string, layer: string, path: string, version?: string) =>
    technologies.push({
      name,
      layer,
      confidence: 'medium',
      version: version || 'Unknown',
      versionConfidence: version ? 'high' : 'low',
      versionSource: version ? 'Runtime data property ' + path : undefined,
      observation: `${path} runtime marker observed; page-supplied metadata can be imitated.`,
      signals: [
        {
          type: 'runtime',
          source: path,
          observation: `${path} runtime data marker observed; no getter or library method invoked.`,
          confidence: 'medium',
        },
      ],
    });
  for (const [name, layer, path] of [
    ['React', 'Frontend', 'React.version'],
    ['React Router', 'Frontend', '__reactRouterVersion'],
    ['Lenis', 'JavaScript libraries', 'lenisVersion'],
    ['Lenis', 'JavaScript libraries', 'lenis.version'],
    ['GSAP', 'JavaScript libraries', 'gsap.version'],
    ['Vue.js', 'Frontend', 'Vue.version'],
    ['Firebase', 'Client services', 'firebase.SDK_VERSION'],
    ['Alpine.js', 'Frontend', 'Alpine.version'],
    ['HTMX', 'Frontend', 'htmx.version'],
  ]) {
    try {
      const value = data(path);
      if (
        typeof value === 'string' &&
        /^\d+(?:\.\d+){1,3}(?:[-\w.]*)?$/.test(value) &&
        value.length <= 32
      )
        add(name, layer, path, value);
    } catch {}
  }
  try {
    const versions = data('gsapVersions');
    if (Array.isArray(versions)) {
      for (let i = 0; i < Math.min(versions.length, 5); i++) {
        const descriptor = Object.getOwnPropertyDescriptor(versions, String(i));
        const v = descriptor?.value;
        if (typeof v === 'string' && /^\d+\.\d+\.\d+(?:[-\w.]*)?$/.test(v) && v.length <= 32)
          add('GSAP', 'JavaScript libraries', 'gsapVersions data array', v);
      }
    }
  } catch {}
  try {
    for (const el of [...document.querySelectorAll('*')].slice(0, 500)) {
      const keys = Object.getOwnPropertyNames(el);
      if (keys.some((k) => /^__(?:reactFiber|reactContainer|reactInternalInstance)\$/.test(k))) {
        add(
          'React',
          'Frontend',
          'React-owned DOM property prefix (__reactFiber$/__reactContainer$)'
        );
        break;
      }
    }
  } catch {}
  return { url: location.href, timeOrigin: performance.timeOrigin, technologies };
}
