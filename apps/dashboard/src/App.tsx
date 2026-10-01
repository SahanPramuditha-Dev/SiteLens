import { DeveloperTools } from './views/DeveloperTools';
import { TechnologyProfile } from './views/TechnologyProfile';
import { FreshnessIndicator } from './components/Freshness';
import { CoverageView } from './views/Coverage';
declare var chrome: any;
import { useEffect, useState } from 'react';
import { Menu, ChevronLeft, Shield, ShieldAlert, Zap, FileSearch, Download, RefreshCw } from 'lucide-react';
import type { Assessment, LifecycleEvent } from '@sitelens/shared-types';
import { Overview } from './views/Overview';
import { HistoryView } from './views/History';
import { ComparisonView } from './views/Comparison';
import { MethodologyView } from './views/Methodology';
import { Findings } from './views/Findings';
import { EvidenceExplorer } from './views/Evidence';
import { HeadersView } from './views/Headers';
import { EnvironmentView } from './views/Environment';
import { CookiesView } from './views/Cookies';
import { SupplyChainView } from './views/SupplyChain';
import { RuntimeResourcesView } from './views/RuntimeResources';
import { ClientSideSecurityView } from './views/ClientSideSecurity';
import { CrossOriginView } from './views/CrossOrigin';
import { ApiSurfaceView } from './views/ApiSurface';
import { SecurityTimelineView } from './views/SecurityTimeline';
import { ControlsView } from './views/Controls';
import { Cookie, Link2, Bug } from 'lucide-react';
import { FileKey2 } from 'lucide-react';
import {
  Lock,
  History,
  GitCompare,
  BookOpen,
  Globe2,
  Server,
  LineChart,
  Activity,
} from 'lucide-react';
import './App.css';

const App = () => {
  const handleExportJson = () => {
    const dataStr =
      'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(current || {}, null, 2));
    const dlAnchorElem = document.createElement('a');
    dlAnchorElem.setAttribute('href', dataStr);
    dlAnchorElem.setAttribute(
      'download',
      `sitelens_${(current?.url || '').replace(/[^a-z0-9]/gi, '_').toLowerCase()}.json`
    );
    dlAnchorElem.click();
  };

  const [isProfessionalMode, setIsProfessionalMode] = useState(false);
  const [data, setData] = useState<{ assessments: Assessment[]; events: LifecycleEvent[] }>({
    assessments: [],
    events: [],
  });
  const [currentId, setCurrentId] = useState<string>('');
  const [view, setView] = useState('overview');
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  useEffect(() => {
    if (typeof chrome !== 'undefined' && chrome.runtime?.sendMessage) {
      chrome.runtime.sendMessage({ type: 'state' }, (res: any) => {
        if (res && res.assessments) {
          setData(res);
          const params = new URLSearchParams(window.location.search);
          const id = params.get('id');
          setCurrentId(id || res.assessments[0]?.id);
        }
      });
    }
  }, []);

  useEffect(() => {
    const changed = (_changes: unknown, area: string) => {
      if (area !== 'local') return;
      chrome.runtime.sendMessage({ type: 'state' }, (res: any) => {
        if (res?.assessments) {
          setData(res);
          setCurrentId((id) =>
            res.assessments.some((a: Assessment) => a.id === id) ? id : res.assessments[0]?.id || ''
          );
        }
      });
    };
    chrome.storage?.onChanged?.addListener(changed);
    return () => chrome.storage?.onChanged?.removeListener(changed);
  }, []);

  const current = data.assessments.find((a) => a.id === currentId);

  if (!current) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-50">
        <div className="text-center">
          <img
            src="./brand/mark.svg"
            alt="SiteLens"
            width="64"
            height="64"
            className="mx-auto mb-4"
          />
          <h2 className="text-xl font-semibold text-slate-700">
            Start with the website in front of you
          </h2>
          <p className="text-slate-500 mt-2">
            Open a website, click the SiteLens extension, and choose Inspect this website.
            Assessments stay on this device.
          </p>
        </div>
      </div>
    );
  }

  const weaknesses = current.findings.filter((f) => f.status === 'potential_weakness');

  return (
    <div className="flex flex-col md:flex-row h-screen bg-slate-50 text-slate-900 font-sans overflow-hidden">
      <aside className={`h-48 md:h-auto shrink-0 bg-white border-r border-slate-200 flex flex-col transition-all duration-300 ${isSidebarCollapsed ? 'w-20' : 'w-full md:w-64'}`}>
        <div className={`p-4 border-b border-slate-100 flex items-center ${isSidebarCollapsed ? 'justify-center' : 'justify-between'}`}>
          {!isSidebarCollapsed && (
            <h1>
              <img src="./brand/logo.svg" alt="SiteLens" width="150" height="38" />
            </h1>
          )}
          <button 
            onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
            className="p-1.5 rounded-md text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
            title={isSidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {isSidebarCollapsed ? <Menu className="w-5 h-5" /> : <ChevronLeft className="w-5 h-5" />}
          </button>
        </div>
        <div className="p-3 flex-1 overflow-y-auto space-y-1 overflow-x-hidden">
          {!isSidebarCollapsed && (
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2 ml-3 mt-2">
              Workspace
            </p>
          )}
          {[
            { id: 'overview', label: 'Overview', icon: Zap },
            { id: 'tools', label: 'Developer Tools', icon: FileSearch },
            { id: 'technologies', label: 'Technology Profile', icon: Server },
            { id: 'coverage', label: 'Assessment Coverage', icon: Shield },
            { id: 'findings', label: 'Findings', icon: ShieldAlert, count: weaknesses.length },
            { id: 'headers', label: 'CSP & Headers', icon: Lock },
            { id: 'crossorigin', label: 'Cross-Origin & Isolation', icon: Globe2 },
            { id: 'environment', label: 'Secrets & Configuration', icon: FileKey2 },
            { id: 'cookies', label: 'Cookies', icon: Cookie },
            { id: 'dom-sinks', label: 'Client-Side Security', icon: Bug },
            { id: 'supply-chain', label: 'Dependencies & Supply Chain', icon: Link2 },
            { id: 'api-surface', label: 'API Surface', icon: Server },
            { id: 'performance', label: 'Runtime & Resources', icon: Activity },
            { id: 'evidence', label: 'Evidence Explorer', icon: FileSearch },
            { id: 'history', label: 'History', icon: History },
            { id: 'timeline', label: 'Security Timeline', icon: LineChart },
            { id: 'comparison', label: 'Comparison', icon: GitCompare },
            { id: 'methodology', label: 'Methodology', icon: BookOpen },
            { id: 'controls', label: 'Scope, projects & exceptions', icon: Shield },
          ].map((nav) => (
            <button
              key={nav.id}
              onClick={() => setView(nav.id)}
              title={isSidebarCollapsed ? nav.label : undefined}
              className={`w-full flex items-center ${isSidebarCollapsed ? 'justify-center p-3' : 'gap-3 px-3 py-2.5'} rounded-md text-sm font-medium transition-colors ${view === nav.id ? 'bg-emerald-50 text-emerald-700' : 'text-slate-600 hover:bg-slate-100'}`}
            >
              <nav.icon className="h-[18px] w-[18px] shrink-0" />
              {!isSidebarCollapsed && (
                <span className="text-left whitespace-normal leading-tight">{nav.label}</span>
              )}
              {!isSidebarCollapsed && (nav.count ?? 0) > 0 && (
                <span className="ml-auto bg-amber-100 text-amber-800 py-0.5 px-2 rounded-full text-xs shrink-0">
                  {nav.count}
                </span>
              )}
            </button>
          ))}
        </div>
      </aside>

      <main className="flex-1 min-w-0 flex flex-col overflow-hidden">
        <header className="bg-white border-b border-slate-200 px-4 md:px-8 py-5 flex flex-wrap gap-4 justify-between items-center z-10 shrink-0">
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
              Website Security Inspector
            </p>
            <h2 className="text-2xl font-bold">
              {view === 'technologies'
                ? 'Technology Profile'
                : view.charAt(0).toUpperCase() + view.slice(1)}
            </h2>
          </div>
          <div className="flex gap-3">
            <button
              onClick={async () => {
                try {
                  const granted = await new Promise((resolve) => {
                    chrome.permissions.request(
                      { origins: ['http://*/*', 'https://*/*'] },
                      (granted: boolean) => resolve(granted)
                    );
                  });
                  if (!granted) {
                    alert('Re-inspecting from the dashboard requires background permissions. Please go to the website tab and click the SiteLens icon instead.');
                    return;
                  }
                  const r = await chrome.runtime.sendMessage({
                    type: 'reinspect',
                    assessmentId: current.id,
                  });
                  if (r?.error) alert(r.error);
                  else location.href = `index.html?id=${r.id}`;
                } catch (e: any) {
                  alert(e.message || 'Failed to request permissions.');
                }
              }}
              className="flex items-center gap-2 bg-white border border-slate-200 text-slate-700 px-4 py-2 rounded-md hover:bg-slate-50 transition-colors shadow-sm text-sm font-medium"
            >
              <RefreshCw className="h-4 w-4" /> Re-inspect
            </button>
            <button
              className="flex items-center gap-2 bg-emerald-600 text-white px-4 py-2 rounded-md hover:bg-emerald-700 transition-colors shadow-sm text-sm font-medium"
              onClick={() =>
                chrome.tabs?.create({ url: chrome.runtime.getURL(`report.html?id=${current.id}`) })
              }
            >
              <Download className="h-4 w-4" /> Export Report
            </button>

            <button
              className="flex items-center gap-2 bg-slate-100 text-slate-700 px-4 py-2 rounded-md hover:bg-slate-200 transition-colors shadow-sm text-sm font-medium"
              onClick={handleExportJson}
            >
              <Download className="h-4 w-4" /> Export JSON
            </button>
            <div className="flex items-center gap-2.5 pl-2 ml-1 border-l border-slate-200">
              <button
                role="switch"
                aria-checked={isProfessionalMode}
                aria-label="Professional Mode"
                onClick={() => setIsProfessionalMode(!isProfessionalMode)}
                className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-1 ${isProfessionalMode ? 'bg-emerald-500' : 'bg-slate-200'}`}
              >
                <span
                  className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform duration-200 ${isProfessionalMode ? 'translate-x-[18px]' : 'translate-x-[3px]'}`}
                />
              </button>
              <span
                className={`text-sm font-medium cursor-pointer select-none transition-colors ${isProfessionalMode ? 'text-emerald-700' : 'text-slate-500'}`}
                onClick={() => setIsProfessionalMode(!isProfessionalMode)}
              >
                Professional Mode
              </span>
            </div>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-4 md:p-8">
          <div className="max-w-6xl mx-auto">
            <FreshnessIndicator id={current.id} />
            {view === 'tools' && <DeveloperTools assessment={current} />}
            {view === 'technologies' && <TechnologyProfile assessment={current} />}
            {view === 'overview' && (
              <Overview assessment={current} allAssessments={data.assessments} setView={setView} />
            )}
            {view === 'findings' && (
              <Findings
                assessment={current}
                isProfessionalMode={isProfessionalMode}
                events={data.events}
              />
            )}
            {view === 'coverage' && <CoverageView assessment={current} />}
            {view === 'headers' && <HeadersView assessment={current} />}
            {view === 'crossorigin' && <CrossOriginView assessment={current} />}
            {view === 'environment' && <EnvironmentView assessment={current} />}
            {view === 'cookies' && <CookiesView assessment={current} />}
            {view === 'dom-sinks' && <ClientSideSecurityView assessment={current} />}
            {view === 'supply-chain' && <SupplyChainView assessment={current} />}
            {view === 'api-surface' && <ApiSurfaceView assessment={current} />}
            {view === 'performance' && <RuntimeResourcesView assessment={current} />}
            {view === 'evidence' && <EvidenceExplorer assessment={current} />}
            {view === 'history' && <HistoryView assessments={data.assessments} current={current} />}
            {view === 'timeline' && (
              <SecurityTimelineView assessment={current} allAssessments={data.assessments} />
            )}
            {view === 'comparison' && (
              <ComparisonView assessments={data.assessments} current={current} />
            )}
            {view === 'methodology' && <MethodologyView />}
            {view === 'controls' && <ControlsView assessment={current} />}
          </div>
        </div>
      </main>
    </div>
  );
};

export default App;

