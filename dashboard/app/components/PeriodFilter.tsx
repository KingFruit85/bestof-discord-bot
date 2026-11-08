import { buildHref, PERIODS, type Period } from '../../lib/format';

/** Period links; every panel showing one sets the same ?period= param. */
export function PeriodFilter({ period, current, anchor }: {
  period: Period;
  current: Record<string, string | undefined>;
  anchor: string;
}) {
  return (
    <nav className="tabs" aria-label="Period">
      <span className="tabs-label">Period</span>
      {PERIODS.map((p) => (
        <a
          key={p.value}
          href={`${buildHref(current, { period: p.value === 'all' ? undefined : p.value })}#${anchor}`}
          aria-current={period === p.value}
        >
          {p.label}
        </a>
      ))}
    </nav>
  );
}
