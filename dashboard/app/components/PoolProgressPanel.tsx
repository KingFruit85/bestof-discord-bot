import type { PoolProgress } from '../../lib/queries';
import { formatDate, formatPercent, fraction, RESET_THRESHOLD, serverName } from '../../lib/format';
import { Panel } from './Panel';

export function PoolProgressPanel({ rows, names }: { rows: PoolProgress[]; names: Record<string, string> }) {
  return (
    <Panel
      title="Rotation progress"
      hint={`Share of postable nominations posted this cycle. The bot starts a new cycle at the dashed line (${RESET_THRESHOLD * 100}%). Skipped nominations, whose message could not be fetched, don't count.`}
    >
      {rows.length === 0 && <p className="muted">No servers found.</p>}
      {rows.map((row) => {
        const postable = row.total - row.skipped;
        const share = fraction(row.posted, postable);
        return (
          <div className="progress-row" key={row.guild_id}>
            <strong>{serverName(row.guild_id, names)}</strong>
            <span className="num">
              {' · '}
              {row.posted} posted · {row.skipped} skipped · {postable - row.posted} left ·{' '}
              {formatPercent(share)}
            </span>
            <div className="bar" role="img" aria-label={`${formatPercent(share)} through the rotation`}>
              <div className="bar-fill" style={{ width: `${(share ?? 0) * 100}%` }} />
              <div className="bar-marker" style={{ left: `${RESET_THRESHOLD * 100}%` }} />
            </div>
            <small className="muted">
              {row.cycle_started ? `Cycle started ${formatDate(row.cycle_started)}` : 'No posts yet this cycle'}
            </small>
          </div>
        );
      })}
    </Panel>
  );
}
