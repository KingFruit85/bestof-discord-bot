import { buildHref } from '../../lib/format';

// Plain links rather than a <select> with an onChange handler: links work
// before (or without) React hydrating the page, the same as the Show/Sort
// controls. A JS-driven dropdown silently did nothing when hydration failed,
// e.g. when the dev server was opened on 127.0.0.1 instead of localhost.
export function ServerFilter({ options, selected, current }: {
  options: { id: string; label: string }[];
  selected: string | null;
  current: Record<string, string | undefined>;
}) {
  const items: { id: string | null; label: string }[] = [{ id: null, label: 'All servers' }, ...options];
  return (
    <nav className="tabs" aria-label="Server">
      <span className="tabs-label">Server</span>
      {items.map((item) => (
        <a
          key={item.id ?? 'all'}
          href={buildHref(current, { guild: item.id ?? undefined })}
          aria-current={selected === item.id ? 'page' : undefined}
        >
          {item.label}
        </a>
      ))}
    </nav>
  );
}
