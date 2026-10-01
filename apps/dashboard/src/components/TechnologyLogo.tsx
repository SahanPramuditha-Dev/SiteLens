import { TECHNOLOGY_LOGOS } from '../../../../assets/technologies/catalog';
export function TechnologyLogo({ name, size = 24 }: { name: string; size?: number }) {
  const logo = Object.hasOwn(TECHNOLOGY_LOGOS, name) ? TECHNOLOGY_LOGOS[name] : undefined;
  return (
    <span
      className="inline-flex shrink-0 items-center justify-center rounded bg-white"
      style={{ width: size, height: size }}
    >
      {logo ? (
        <img
          src={'./technologies/' + logo.file}
          alt=""
          title={name + ' technology logo'}
          width={size}
          height={size}
          style={{ width: size, height: size, objectFit: 'contain' }}
        />
      ) : (
        <span className="text-xs text-slate-500 font-semibold" aria-hidden="true">
          {name.slice(0, 2)}
        </span>
      )}
    </span>
  );
}
