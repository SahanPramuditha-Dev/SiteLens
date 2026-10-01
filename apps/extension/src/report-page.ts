import { reportBody, reportHtml, REPORT_CSS } from './report';
import { download, send } from './ui/shared';
import type { Assessment, LifecycleEvent, Settings } from '@sitelens/shared-types';
const data = await send<{
  assessments: Assessment[];
  events: LifecycleEvent[];
  settings: Settings;
}>({ type: 'state' });
const a = data.assessments.find((a) => a.id === new URLSearchParams(location.search).get('id'));
const content = document.querySelector<HTMLElement>('#report-content')!;
if (a) {
  const style = document.createElement('style');
  style.textContent = REPORT_CSS;
  document.head.appendChild(style);
  content.innerHTML = reportBody(a, data.events, data.settings.reportOptions);
  document.querySelector<HTMLButtonElement>('#print')!.onclick = () => window.print();
  document.querySelector<HTMLButtonElement>('#download')!.onclick = () =>
    download(
      'sitelens-assessment.html',
      'text/html',
      reportHtml(a, data.events, data.settings.reportOptions)
    );
} else {
  content.textContent =
    'This assessment is no longer available. Return to SiteLens and select another assessment.';
  document.querySelectorAll<HTMLButtonElement>('button').forEach((b) => (b.disabled = true));
}
