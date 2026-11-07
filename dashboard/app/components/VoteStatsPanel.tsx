import type { NominationRow, VoteStats } from '../../lib/queries';
import { formatDate, formatPercent, fraction, serverName } from '../../lib/format';
import { JumpLink } from './JumpLink';
import { Panel } from './Panel';
import { SortableTable, type TableColumn } from './SortableTable';

export const TOP_SORT_PARAM = 'tsort';

function Stat({ value, label }: { value: string | number; label: string }) {
  return (
    <div className="stat">
      <div className="value num">{value}</div>
      <div className="label">{label}</div>
    </div>
  );
}

export function VoteStatsPanel({ stats, top, names, showServer, sort, current }: {
  stats: VoteStats;
  top: NominationRow[];
  names: Record<string, string>;
  showServer: boolean;
  sort: string | undefined;
  current: Record<string, string | undefined>;
}) {
  const columns: TableColumn<NominationRow>[] = [
    { key: 'net', label: 'Net', value: (r) => r.net_score, defaultDir: 'desc', numeric: true, render: (r) => r.net_score },
    { key: 'nominated', label: 'Nominated', value: (r) => r.created_at, defaultDir: 'desc', numeric: true, render: (r) => formatDate(r.created_at) },
    ...(showServer
      ? [{ key: 'server', label: 'Server', value: (r: NominationRow) => serverName(r.guild_id, names), render: (r: NominationRow) => serverName(r.guild_id, names) }]
      : []),
    { key: 'message', label: 'Message', render: (r) => <JumpLink href={r.message_link} /> },
  ];

  return (
    <Panel id="voting" title="Voting">
      <div className="stats">
        <Stat value={stats.total.toLocaleString('en-GB')} label="active votes" />
        <Stat value={stats.voters} label="unique voters" />
        <Stat value={formatPercent(fraction(stats.button, stats.total))} label="via buttons" />
        <Stat value={formatPercent(fraction(stats.reaction, stats.total))} label="via 🏆 reactions" />
      </div>
      <h3 className="hint">Top 10 by net score</h3>
      <SortableTable
        rows={top}
        columns={columns}
        sort={sort}
        param={TOP_SORT_PARAM}
        fallback={{ key: 'net', dir: 'desc' }}
        current={current}
        anchor="voting"
        rowKey={(r) => r.id}
      />
    </Panel>
  );
}
