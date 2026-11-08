import { buildHref, PERIODS, type Period } from '../../lib/format';

/** Period links; every panel showing one sets the same ?period= param. */
export function PeriodFilter({ period, current, anchor }: {
  period: Period;
  current: Record<string, string | undefined>;
  anchor: string;
}) {
  return (
    <div className="controls">
      <span>
        Period:{' '}
        {PERIODS.map((p, i) => (
          <span key={p.value}>
            {i > 0 && ' · '}
            <a
              href={`${buildHref(current, { period: p.value === 'all' ? undefined : p.value })}#${anchor}`}
              aria-current={period === p.value}
            >
              {p.label}
            </a>
          </span>
        ))}
      </span>
    </div>
  );
}
