import { useEffect, useState } from 'react';
export function FreshnessIndicator({ id }: { id: string }) {
  const [data, setData] = useState({ status: 'checking', collectedAt: '' });
  useEffect(() => {
    let active = true;
    const refresh = async () => {
      try {
        const r = await chrome.runtime.sendMessage({ type: 'freshness', assessmentId: id });
        if (active) setData(r?.error ? { status: 'unavailable', collectedAt: '' } : r);
      } catch {
        if (active) setData({ status: 'unavailable', collectedAt: '' });
      }
    };
    void refresh();
    const timer = setInterval(() => {
      if (document.visibilityState === 'visible') void refresh();
    }, 15000);
    document.addEventListener('visibilitychange', refresh);
    return () => {
      active = false;
      clearInterval(timer);
      document.removeEventListener('visibilitychange', refresh);
    };
  }, [id]);
  return (
    <div role="status" className="bg-white border border-slate-200 rounded-lg p-3 mb-5 text-sm">
      <strong>Evidence: {data.status}</strong>
      {data.collectedAt && <span> · collected {data.collectedAt}</span>}
      <p className="text-xs text-slate-500 mt-1">
        {data.status === 'current'
          ? 'Original browser document is still open. Runtime content can change; collection timestamps remain authoritative.'
          : data.status === 'page changed'
            ? 'The original page navigated or reloaded. Re-inspect before investigating or verifying changes.'
            : data.status === 'older assessment'
              ? 'This is imported, supplemented or re-evaluated evidence. Its original scope and collection times are retained.'
              : 'Original document cannot be checked. Open the website and create a new assessment.'}
      </p>
    </div>
  );
}
