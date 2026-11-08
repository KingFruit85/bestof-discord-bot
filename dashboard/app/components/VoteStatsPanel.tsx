import type { VoteStats } from '../../lib/queries';
import { formatPercent, fraction } from '../../lib/format';
import { Panel } from './Panel';

function Stat({ value, label }: { value: string | number; label: string }) {
  return (
    <div className="stat">
      <div className="value num">{value}</div>
      <div className="label">{label}</div>
    </div>
  );
}

export function VoteStatsPanel({ stats }: { stats: VoteStats }) {
  return (
    <Panel id="voting" title="Voting">
      <div className="stats">
        <Stat value={stats.total.toLocaleString('en-GB')} label="active votes" />
        <Stat value={stats.voters} label="unique voters" />
        <Stat value={formatPercent(fraction(stats.button, stats.total))} label="via buttons" />
        <Stat value={formatPercent(fraction(stats.reaction, stats.total))} label="via 🏆 reactions" />
      </div>
    </Panel>
  );
}
