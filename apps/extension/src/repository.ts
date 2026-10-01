import type { Assessment, LifecycleEvent, Settings } from '@sitelens/shared-types';
export const DEFAULT_SETTINGS: Settings = {
  learningMode: false,
  retention: 50,
  observedOrigins: [],
};
let queue: Promise<unknown> = Promise.resolve();
export function transaction<T>(action: () => Promise<T>): Promise<T> {
  const next = queue.then(action, action);
  queue = next.catch(() => {});
  return next;
}
export async function getState(): Promise<{
  assessments: Assessment[];
  events: LifecycleEvent[];
  settings: Settings;
  legacyCount: number;
}> {
  const data = await chrome.storage.local.get(['records', 'events', 'settings', 'assessments']);
  return {
    assessments: Array.isArray(data.records) ? (data.records as Assessment[]) : [],
    events: Array.isArray(data.events) ? (data.events as LifecycleEvent[]) : [],
    settings: {
      ...DEFAULT_SETTINGS,
      ...(typeof data.settings === 'object' && data.settings
        ? (data.settings as Partial<Settings>)
        : {}),
    },
    legacyCount: Array.isArray(data.assessments) ? data.assessments.length : 0,
  };
}
export async function saveAssessment(assessment: Assessment) {
  return transaction(async () => {
    const state = await getState();
    const records = [assessment, ...state.assessments].slice(0, state.settings.retention);
    const ids = new Set(records.map((a) => a.id));
    await chrome.storage.local.set({
      records,
      events: state.events.filter((e) => ids.has(e.assessmentId)),
    });
    return assessment;
  });
}
export async function setSettings(patch: Partial<Settings>) {
  return transaction(async () => {
    const state = await getState();
    const settings = {
      ...state.settings,
      ...patch,
      retention: Math.min(
        200,
        Math.max(5, Math.trunc(patch.retention ?? state.settings.retention))
      ),
    };
    await chrome.storage.local.set({
      settings,
      records: state.assessments.slice(0, settings.retention),
    });
    return settings;
  });
}
export const STATES = [
  'new',
  'acknowledged',
  'investigating',
  'accepted risk',
  'fixed',
  'needs verification',
  'verified',
  'false positive',
] as const;
export async function setLifecycle(
  assessmentId: string,
  checkId: string,
  state: string,
  note: string,
  metadata: { actor?: string; owner?: string; expiresAt?: string; reviewRequired?: boolean } = {}
) {
  if (!STATES.includes(state as never)) throw new Error('Invalid lifecycle state.');
  if (
    ['accepted risk', 'false positive'].includes(state) &&
    (!note.trim() ||
      !metadata.actor?.trim() ||
      !metadata.expiresAt ||
      !Number.isFinite(Date.parse(metadata.expiresAt)) ||
      Date.parse(metadata.expiresAt) <= Date.now())
  )
    throw new Error(
      'Accepted risk and false positive annotations require a reason, analyst and future review expiry.'
    );
  return transaction(async () => {
    const data = await getState();
    const a = data.assessments.find((a) => a.id === assessmentId);
    const f = a?.findings.find((f) => f.checkId === checkId);
    if (!a || !f) throw new Error('Finding no longer exists.');
    f.lifecycle = state as typeof f.lifecycle;
    const event: LifecycleEvent = {
      id: crypto.randomUUID(),
      targetKey: a.targetKey,
      assessmentId,
      checkId,
      state: f.lifecycle,
      note: note.slice(0, 2000),
      at: new Date().toISOString(),
      actor: String(metadata.actor || 'Local analyst').slice(0, 128),
      owner: String(metadata.owner || '').slice(0, 128),
      expiresAt: metadata.expiresAt,
      reviewRequired:
        metadata.reviewRequired ?? ['accepted risk', 'false positive'].includes(state),
    };
    await chrome.storage.local.set({
      records: data.assessments,
      events: [...data.events, event].slice(-2000),
    });
    return event;
  });
}
export async function deleteAssessment(id: string) {
  return transaction(async () => {
    const state = await getState();
    await chrome.storage.local.set({
      records: state.assessments.filter((a) => a.id !== id),
      events: state.events.filter((e) => e.assessmentId !== id),
    });
  });
}
