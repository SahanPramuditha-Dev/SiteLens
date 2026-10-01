import type { Assessment, Status } from '@sitelens/shared-types';
export const esc = (value: unknown) =>
  String(value ?? '').replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!
  );
export const labels: Record<Status, string> = {
  protection_observed: 'Protection observed',
  potential_weakness: 'Potential weakness',
  informational: 'Informational',
  not_applicable: 'Not applicable',
  unable_to_assess: 'Unable to assess',
};
export const date = (value: string) =>
  new Date(value).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
export const badge = (status: string, label = labels[status as Status] || status) =>
  `<span class="badge ${esc(status)}">${esc(label)}</span>`;
export function table(heads: string[], rows: string[][], empty = 'No items observed.') {
  return rows.length
    ? `<div class="table-wrap"><table><thead><tr>${heads.map((h) => `<th scope="col">${esc(h)}</th>`).join('')}</tr></thead><tbody>${rows.map((row) => `<tr>${row.map((v) => `<td>${v}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`
    : `<p class="muted">${esc(empty)}</p>`;
}
export function download(name: string, type: string, body: string) {
  const url = URL.createObjectURL(new Blob([body], { type }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export async function send<T = any>(message: Record<string, unknown>): Promise<T> {
  const result = await chrome.runtime.sendMessage(message);
  if (result?.error) throw new Error(result.error);
  return result;
}
export function portable(a: Assessment) {
  return {
    ...a,
    exportedAt: new Date().toISOString(),
    notice: 'Passive, browser-visible assessment; not a certification of application security.',
  };
}
export const safeReference = (url: string) =>
  /^https:\/\/(developer\.mozilla\.org|owasp\.org|developer\.chrome\.com|osv\.dev|cwe\.mitre\.org)\//.test(
    url
  )
    ? url
    : '#';
