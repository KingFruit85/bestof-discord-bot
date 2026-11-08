import type { NominationRow } from '../../lib/queries';
import { buildHref, formatDate, serverName, type StatusFilter } from '../../lib/format';
import { JumpLink } from './JumpLink';
import { Panel } from './Panel';
import { SortableTable, type TableColumn } from './SortableTable';
import type { UserProfile } from '../../lib/discord';
import { UserName, userLabel } from './UserName';

export const NOMINATIONS_SORT_PARAM = 'nsort';

const STATUS_LINKS: { value: StatusFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'pool', label: 'Still in pool' },
];

export function NominationListPanel({ rows, names, users, namesAvailable, showServer, status, sort, current }: {
  rows: NominationRow[];
  names: Record<string, string>;
  /** Nominator names and avatars from Discord; missing IDs render raw. */
  users: Record<string, UserProfile>;
  namesAvailable: boolean;
  showServer: boolean;
  status: StatusFilter;
  sort: string | undefined;
  current: Record<string, string | undefined>;
}) {
  const columns: TableColumn<NominationRow>[] = [
    { key: 'nominated', label: 'Nominated', value: (r) => r.created_at, defaultDir: 'desc', numeric: true, render: (r) => formatDate(r.created_at) },
    ...(showServer
      ? [{ key: 'server', label: 'Server', value: (r: NominationRow) => serverName(r.guild_id, names), render: (r: NominationRow) => serverName(r.guild_id, names) }]
      : []),
    {
      key: 'nominator',
      label: 'Nominator',
      value: (r) => userLabel(r.nominator, users),
      render: (r) => <UserName id={r.nominator} users={users} />,
    },
    { key: 'up', label: 'Up', value: (r) => r.up_votes, defaultDir: 'desc', numeric: true, render: (r) => r.up_votes },
    { key: 'down', label: 'Down', value: (r) => r.down_votes, defaultDir: 'desc', numeric: true, render: (r) => r.down_votes },
    { key: 'net', label: 'Net', value: (r) => r.net_score, defaultDir: 'desc', numeric: true, render: (r) => r.net_score },
    {
      key: 'status',
      label: 'Status',
      value: (r) => r.history_status ?? 'in pool',
      render: (r) => (r.history_status ? <span className="muted">{r.history_status}</span> : 'in pool'),
    },
    { key: 'message', label: 'Message', render: (r) => <JumpLink href={r.message_link} /> },
  ];

  return (
    <Panel
      id="nominations"
      title="Nominations"
      hint={`${rows.length} shown.${namesAvailable ? '' : ' Names unavailable: DASHBOARD_DISCORD_TOKEN is not set.'}`}
    >
      <div className="controls">
        <span>
          Show:{' '}
          {STATUS_LINKS.map((link, i) => (
            <span key={link.value}>
              {i > 0 && ' · '}
              <a
                href={`${buildHref(current, { status: link.value === 'all' ? undefined : link.value })}#nominations`}
                aria-current={status === link.value}
              >
                {link.label}
              </a>
            </span>
          ))}
        </span>
      </div>
      <SortableTable
        rows={rows}
        columns={columns}
        sort={sort}
        param={NOMINATIONS_SORT_PARAM}
        fallback={{ key: 'nominated', dir: 'desc' }}
        current={current}
        anchor="nominations"
        rowKey={(r) => r.id}
      />
    </Panel>
  );
}
