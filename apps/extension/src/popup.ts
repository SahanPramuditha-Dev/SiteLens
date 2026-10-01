import { send } from './ui/shared';
import { httpUrl, originOf, redactUrl } from '@sitelens/rule-definitions/src/privacy.js';
const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
const target = document.querySelector<HTMLElement>('#popup-target')!,
  button = document.querySelector<HTMLButtonElement>('#inspect')!,
  message = document.querySelector<HTMLElement>('#message')!;
target.textContent = httpUrl(tab?.url || '')
  ? redactUrl(tab.url!)
  : 'Open a regular HTTP or HTTPS website.';
button.disabled = !httpUrl(tab?.url || '');
const cookieInput = document.querySelector<HTMLInputElement>('#cookies')!;
cookieInput.checked = await chrome.permissions.contains({ permissions: ['cookies'] });
document.querySelector<HTMLButtonElement>('#open')!.onclick = () =>
  chrome.tabs.create({ url: chrome.runtime.getURL('dashboard/index.html') });
button.onclick = async () => {
  button.disabled = true;
  message.textContent = 'Collecting browser-visible evidence…';
  try {
    if (!tab?.id || !httpUrl(tab.url || ''))
      throw new Error('Open an HTTP or HTTPS website first.');
    const headers = document.querySelector<HTMLInputElement>('#headers')!.checked;
    const cookies = cookieInput.checked;
    const origin = originOf(tab.url!);
    if (headers || cookies) {
      const granted = await chrome.permissions.request({
        origins: [`${origin}/*`],
        ...(cookies ? { permissions: ['cookies'] } : {}),
      });
      if (granted && headers) await send({ type: 'observe', origin });
    }
    const result = await send<{ id: string }>({
      type: 'inspect',
      tabId: tab.id,
      includeCookies: cookies,
    });
    await chrome.tabs.create({
      url: chrome.runtime.getURL(`dashboard/index.html?id=${result.id}`),
    });
    window.close();
  } catch (error) {
    message.textContent = error instanceof Error ? error.message : 'Inspection failed.';
  } finally {
    button.disabled = false;
  }
};
