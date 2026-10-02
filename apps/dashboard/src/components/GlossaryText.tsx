import { GLOSSARY } from '../lib/glossary';

export const GlossaryText = ({ text }: { text: string }) => {
  // Sort keys by length descending to match longest phrases first
  
  const regex = new RegExp(`(\\b\${keys.join('\\\\b|\\\\b')}\\\\b)`, 'gi');

  const parts = text.split(regex);

  return (
    <span>
      {parts.map((part, i) => {
        const term = Object.keys(GLOSSARY).find((k) => k.toLowerCase() === part.toLowerCase());
        if (term) {
          return (
            <span key={i} className="relative group inline-block cursor-help border-b border-dotted border-indigo-400 text-indigo-700">
              {part}
              <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-64 p-2 bg-slate-800 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50 shadow-xl">
                <span className="font-bold block mb-1">{term}</span>
                {GLOSSARY[term]}
              </span>
            </span>
          );
        }
        return <span key={i}>{part}</span>;
      })}
    </span>
  );
};
