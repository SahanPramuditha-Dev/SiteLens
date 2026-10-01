const fs = require('fs');
let code = fs.readFileSync('apps/dashboard/src/views/Overview.tsx', 'utf8');

// Fix Coverage mapping
code = code.replace(
  /\{Object\.entries\(assessment\.coverage\)\.map\(\(\[category, status\]\) => \([\s\S]*?\{String\(status\)\}[\s\S]*?<\/div>\s*\)\)\}/,
  `{assessment.coverage.map((c) => (
                <div key={c.area} className="flex justify-between items-center text-sm">
                  <span className="text-slate-600">{c.area}</span>
                  <span className={\`font-semibold text-[11px] px-2 py-0.5 rounded-full uppercase
                    \${c.status === 'assessed' ? 'bg-emerald-100 text-emerald-700' : 
                      c.status === 'partial' ? 'bg-amber-100 text-amber-700' : 
                      'bg-slate-100 text-slate-600'}\`}>
                    {c.status}
                  </span>
                </div>
              ))}`
);

fs.writeFileSync('apps/dashboard/src/views/Overview.tsx', code);
