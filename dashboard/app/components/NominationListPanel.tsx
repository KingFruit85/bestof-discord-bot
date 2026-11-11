import type { NominationRow } from '../../lib/queries';
import { buildHref, formatDate, serverName, type StatusFilter } from '../../lib/format';
import { JumpLink } from './JumpLink';
import { Panel } from './Panel';
import { SortableTable, type TableColumn } from './SortableTable';
import type { UserProfile } from '../../lib/discord';
import { nominatorLabel, UnknownNominator, UserName, userLabel } from './UserName';

export const NOMINATIONS_SORT_PARAM = 'nsort';
export const NOMINATIONS_PAGE_PARAM = 'npage';
const PAGE_SIZE = 25;

const STATUS_LINKS: { value: StatusFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'pool', label: 'Still in pool' },
];

function statusLabel(r: NominationRow): string {
  return r.history_status ?? (r.too_new ? 'too new' : 'in pool');
}

export function NominationListPanel({ rows, names, users, namesAvailable, showServer, status, sort, page, current }: {
  rows: NominationRow[];
  names: Record<string, string>;
  /** Nominator names and avatars from Discord; missing IDs render raw. */
  users: Record<string, UserProfile>;
  namesAvailable: boolean;
  showServer: boolean;
  status: StatusFilter;
  sort: string | undefined;
  page: number;
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
      value: (r) => nominatorLabel(r, users),
      render: (r) => (r.nominator_known ? <UserName id={r.nominator} users={users} /> : <UnknownNominator />),
    },
    {
      key: 'author',
      label: 'Author',
      value: (r) => (r.author_id ? userLabel(r.author_id, users) : null),
      render: (r) => (r.author_id ? <UserName id={r.author_id} users={users} /> : <span className="muted">deleted</span>),
    },
    { key: 'up', label: 'Up', value: (r) => r.up_votes, defaultDir: 'desc', numeric: true, render: (r) => r.up_votes },
    { key: 'down', label: 'Down', value: (r) => r.down_votes, defaultDir: 'desc', numeric: true, render: (r) => r.down_votes },
    { key: 'net', label: 'Net', value: (r) => r.net_score, defaultDir: 'desc', numeric: true, render: (r) => r.net_score },
    {
      key: 'status',
      label: 'Status',
      value: (r) => statusLabel(r),
      render: (r) => (r.history_status || r.too_new ? <span className="muted">{statusLabel(r)}</span> : 'in pool'),
    },
    { key: 'message', label: 'Message', render: (r) => <JumpLink href={r.message_link} /> },
  ];

  return (
    <Panel
      id="nominations"
      title="Nominations"
      hint={`${rows.length.toLocaleString('en-GB')} nominations, ${PAGE_SIZE} per page.${namesAvailable ? '' : ' Names unavailable: DASHBOARD_DISCORD_TOKEN is not set.'}`}
    >
      <nav className="tabs" aria-label="Show">
        <span className="tabs-label">Show</span>
        {STATUS_LINKS.map((link) => (
          <a
            key={link.value}
            href={`${buildHref(current, { status: link.value === 'all' ? undefined : link.value, [NOMINATIONS_PAGE_PARAM]: undefined })}#nominations`}
            aria-current={status === link.value}
          >
            {link.label}
          </a>
        ))}
      </nav>
      <SortableTable
        rows={rows}
        columns={columns}
        sort={sort}
        param={NOMINATIONS_SORT_PARAM}
        fallback={{ key: 'nominated', dir: 'desc' }}
        current={current}
        anchor="nominations"
        rowKey={(r) => r.id}
        pagination={{ param: NOMINATIONS_PAGE_PARAM, page, pageSize: PAGE_SIZE }}
      />
    </Panel>
  );
}
