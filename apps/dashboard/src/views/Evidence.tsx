import { useState } from 'react';
import { Search, Code } from 'lucide-react';
import type { Assessment } from '@sitelens/shared-types';

export const EvidenceExplorer = ({ assessment }: { assessment: Assessment }) => {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  const filtered = assessment.evidence.filter(
    (e) =>
      !search ||
      e.id.toLowerCase().includes(search.toLowerCase()) ||
      e.label.toLowerCase().includes(search.toLowerCase()) ||
      e.type.toLowerCase().includes(search.toLowerCase())
  );

  const selected = assessment.evidence.find((e) => e.id === selectedId);

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex h-[calc(100vh-140px)]">
      <div className="w-1/3 border-r border-slate-200 bg-slate-50 flex flex-col">
        <div className="p-4 border-b border-slate-200">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="Filter evidence..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 border border-slate-300 rounded-md text-sm"
            />
          </div>
        </div>
        <div className="flex-1 overflow-y-auto">
          {filtered.map((e) => (
            <div
              key={e.id}
              onClick={() => setSelectedId(e.id)}
              className={`p-4 border-b border-slate-200 hover:bg-white cursor-pointer transition-colors border-l-2 ${selectedId === e.id ? 'bg-white border-emerald-500 shadow-[inset_4px_0_0_0_rgba(16,185,129,0.1)]' : 'border-transparent'}`}
            >
              <div className="flex justify-between items-start mb-1">
                <span className="font-mono text-xs text-slate-500">{e.id}</span>
                <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-full bg-slate-200 text-slate-600">
                  {e.type}
                </span>
              </div>
              <h4 className="font-medium text-sm text-slate-800 line-clamp-1">{e.label}</h4>
            </div>
          ))}
          {filtered.length === 0 && (
            <div className="p-8 text-center text-slate-500 text-sm">
              No evidence matches your search.
            </div>
          )}
        </div>
      </div>
      <div className="flex-1 flex flex-col bg-slate-900 text-slate-300 overflow-hidden">
        <div className="p-4 border-b border-slate-800 bg-slate-950 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Code className="h-5 w-5 text-emerald-500" />
            <h3 className="font-mono text-sm font-medium text-white">
              {selected ? selected.id : 'Select an evidence block'}
            </h3>
          </div>
          {selected && (
            <div className="text-xs text-slate-400">
              Collected at {new Date(selected.collectedAt).toLocaleTimeString()}
            </div>
          )}
        </div>
        <div className="flex-1 p-6 overflow-auto">
          {!selected ? (
            <div className="text-center mt-20 text-slate-600">
              <Code className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Select evidence from the sidebar to view raw JSON data</p>
            </div>
          ) : (
            <div className="space-y-6">
              <div>
                <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                  Metadata & provenance
                </h4>
                <pre className="text-xs whitespace-pre-wrap mb-4">
                  {JSON.stringify(
                    selected.provenance || { source: 'Legacy record — provenance unavailable' },
                    null,
                    2
                  )}
                </pre>
                <div className="grid grid-cols-2 gap-4 bg-slate-800/50 p-4 rounded-lg border border-slate-700/50 text-sm">
                  <div>
                    <span className="text-slate-500 block mb-1">Source</span>
                    <span className="text-slate-200">{selected.source}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block mb-1">Type</span>
                    <span className="text-slate-200">{selected.type}</span>
                  </div>
                  <div className="col-span-2">
                    <span className="text-slate-500 block mb-1">Label</span>
                    <span className="text-slate-200">{selected.label}</span>
                  </div>
                </div>
              </div>
              <div>
                <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                  Raw Data
                </h4>
                <pre className="bg-slate-950 p-4 rounded-lg border border-slate-800 text-sm font-mono overflow-x-auto text-emerald-400">
                  {JSON.stringify(selected.data, null, 2)}
                </pre>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
