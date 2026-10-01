import { satisfies, valid, validRange } from 'semver';
import type { Advisory, AdvisoryMatch, Technology } from '@sitelens/shared-types';
export function validateAdvisories(value: unknown): Advisory[] {
  if (!Array.isArray(value) || value.length > 10000)
    throw new Error('Advisories must be a bounded array.');
  return value.map((a) => {
    if (
      !a?.id ||
      !a.component ||
      !validRange(a.affectedRange) ||
      !valid(a.fixedVersion) ||
      !Number.isFinite(Date.parse(a.updatedAt)) ||
      !Number.isFinite(Date.parse(a.publishedAt)) ||
      !/^https:\/\//.test(a.source)
    )
      throw new Error(
        'Advisory requires a valid range, fix version, dates and authoritative source URL.'
      );
    return {
      id: String(a.id),
      component: String(a.component),
      affectedRange: a.affectedRange,
      fixedVersion: a.fixedVersion,
      publishedAt: a.publishedAt,
      updatedAt: a.updatedAt,
      source: a.source,
    };
  });
}
export function matchAdvisories(
  technologies: Technology[],
  advisories: Advisory[]
): AdvisoryMatch[] {
  return technologies
    .filter((t) => t.versionConfidence === 'high' && !!valid(t.version))
    .flatMap((t) =>
      advisories
        .filter(
          (a) =>
            a.component.toLowerCase() === t.name.toLowerCase() &&
            satisfies(t.version, a.affectedRange)
        )
        .map((a) => ({
          ...a,
          detectedVersion: t.version,
          versionConfidence: t.versionConfidence!,
          versionMatch: true,
          runtimeApplicability: 'unknown' as const,
        }))
    );
}
