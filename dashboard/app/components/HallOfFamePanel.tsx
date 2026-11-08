import { formatDate, serverName, type Period } from '../../lib/format';
import type { HallOfFameRow } from '../../lib/queries';
import { JumpLink } from './JumpLink';
import { Panel } from './Panel';
import { PeriodFilter } from './PeriodFilter';
import { SortableTable, type TableColumn } from './SortableTable';
import type { UserProfile } from '../../lib/discord';
import { UserName, userLabel } from './UserName';

export const HALL_SORT_PARAM = 'hsort';

export function HallOfFamePanel({ rows, names, users, showServer, period, sort, current }: {
  rows: HallOfFameRow[];
  names: Record<string, string>;
  users: Record<string, UserProfile>;
  showServer: boolean;
  period: Period;
  sort: string | undefined;
  current: Record<string, string | undefined>;
}) {
  const columns: TableColumn<HallOfFameRow>[] = [
    { key: 'rank', label: '#', value: (r) => r.rank, numeric: true, render: (r) => r.rank },
    { key: 'votes', label: 'Votes', value: (r) => r.score, defaultDir: 'desc', numeric: true, render: (r) => r.score },
    {
      key: 'nominator',
      label: 'Nominated by',
      value: (r) => userLabel(r.nominator, users),
      render: (r) => <UserName id={r.nominator} users={users} />,
    },
    { key: 'nominated', label: 'Nominated', value: (r) => r.created_at, defaultDir: 'desc', numeric: true, render: (r) => formatDate(r.created_at) },
    ...(showServer
      ? [{ key: 'server', label: 'Server', value: (r: HallOfFameRow) => serverName(r.guild_id, names), render: (r: HallOfFameRow) => serverName(r.guild_id, names) }]
      : []),
    { key: 'message', label: 'Message', render: (r) => <JumpLink href={r.message_link} /> },
  ];

  return (
    <Panel id="hall-of-fame" title="Hall of fame" hint="Top 10 nominations by net votes from everyone except the nominator.">
      <PeriodFilter period={period} current={current} anchor="hall-of-fame" />
      <SortableTable
        rows={rows}
        columns={columns}
        sort={sort}
        param={HALL_SORT_PARAM}
        fallback={{ key: 'rank', dir: 'asc' }}
        current={current}
        anchor="hall-of-fame"
        rowKey={(r) => r.id}
      />
      {rows.length === 0 && <p className="muted">No nominations in this period.</p>}
    </Panel>
  );
}
