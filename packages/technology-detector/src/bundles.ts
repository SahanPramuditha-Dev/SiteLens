import type { Technology } from '@sitelens/shared-types';
import { redactUrl } from '@sitelens/rule-definitions/src/privacy.js';
// Supplemental source inspection only. Fixed marker combinations avoid single generic name matches.
export function detectBundleTechnologies(code: string, url: string): Technology[] {
  const text = code.slice(0, 2000000),
    source = redactUrl(url),
    result: Technology[] = [];
  const add = (name: string, layer: string, marker: string, version?: string) =>
    result.push({
      name,
      layer,
      confidence: 'medium',
      version: version || 'Unknown',
      versionConfidence: version ? 'medium' : 'low',
      versionSource: version ? 'Static bundle declaration' : undefined,
      observation: `${name} static bundle fingerprint observed; inclusion does not establish execution.`,
      signals: [
        {
          type: 'bundle',
          source,
          observation: marker + '; raw source omitted and runtime use unverified.',
          confidence: 'medium',
        },
      ],
    });
  if (text.includes('FirebaseError') && text.includes('@firebase'))
    add('Firebase', 'Client services', 'Firebase SDK error type and package namespace');
  if (text.includes('__reactRouterVersion'))
    add(
      'React Router',
      'Frontend',
      'React Router explicit version marker',
      text.match(/__reactRouterVersion\s*=\s*["'](\d+\.\d+\.\d+)["']/)?.[1]
    );
  if (text.includes('GreenSock') && text.includes('gsapVersions'))
    add('GSAP', 'JavaScript libraries', 'GSAP registry and GreenSock identity markers');
  if (text.includes('lenisVersion') && text.includes('lenis-smooth'))
    add('Lenis', 'JavaScript libraries', 'Lenis runtime version and scrolling-class markers');
  if (
    (text.includes('framer-motion') || text.includes('MotionGlobalConfig')) &&
    (text.includes('data-projection-id') || text.includes('motionValue'))
  )
    add(
      'Framer Motion',
      'JavaScript libraries',
      'Motion package/configuration and projection/value markers'
    );
  if (
    (text.includes('createLucideIcon') &&
      (text.includes('lucide-') || text.includes('lucide-react'))) ||
    (text.includes('"lucide"') && text.includes('lucide-') && text.includes('strokeWidth'))
  )
    add('Lucide', 'Icon libraries', 'Lucide SVG factory and icon-class namespace');
  if (text.includes('react.transitional.element') && text.includes('react.fragment'))
    add('React', 'Frontend', 'React element and fragment symbol markers');
  return result;
}
