import type { RecentPost } from '../../lib/queries';
import { formatAge, formatDate, isRecent, RECENT_WINDOW_DAYS, serverName } from '../../lib/format';
import { JumpLink } from './JumpLink';
import { Panel } from './Panel';
import { SortableTable, type TableColumn } from './SortableTable';

export const RECENT_SORT_PARAM = 'rsort';

function ageMs(row: RecentPost): number | null {
  return row.nominated_at ? row.posted_at.getTime() - row.nominated_at.getTime() : null;
}

export function RecentPostsPanel({ rows, names, showServer, sort, current }: {
  rows: RecentPost[];
  names: Record<string, string>;
  showServer: boolean;
  sort: string | undefined;
  current: Record<string, string | undefined>;
}) {
  const isRecentRow = (r: RecentPost) => r.nominated_at !== null && isRecent(r.posted_at, r.nominated_at);
  const recentCount = rows.filter(isRecentRow).length;

  const columns: TableColumn<RecentPost>[] = [
    { key: 'posted', label: 'Posted', value: (r) => r.posted_at, defaultDir: 'desc', numeric: true, render: (r) => formatDate(r.posted_at) },
    {
      key: 'nominated',
      label: 'Nominated',
      value: (r) => r.nominated_at,
      defaultDir: 'desc',
      numeric: true,
      render: (r) => (r.nominated_at ? formatDate(r.nominated_at) : <span className="muted">nomination deleted</span>),
    },
    {
      key: 'age',
      label: 'Age at posting',
      value: ageMs,
      defaultDir: 'desc',
      numeric: true,
      render: (r) => {
        const ms = ageMs(r);
        return ms === null ? '—' : formatAge(ms);
      },
    },
    ...(showServer
      ? [{ key: 'server', label: 'Server', value: (r: RecentPost) => serverName(r.guild_id, names), render: (r: RecentPost) => serverName(r.guild_id, names) }]
      : []),
    { key: 'message', label: 'Message', render: (r) => <JumpLink href={r.message_link} /> },
  ];

  return (
    <Panel
      id="recent"
      title="Recent random posts"
      hint={`Highlighted rows were nominated less than ${RECENT_WINDOW_DAYS} days before being posted (${recentCount} of ${rows.length}).`}
    >
      <SortableTable
        rows={rows}
        columns={columns}
        sort={sort}
        param={RECENT_SORT_PARAM}
        fallback={{ key: 'posted', dir: 'desc' }}
        current={current}
        anchor="recent"
        rowKey={(r) => `${r.message_link}-${r.posted_at.toISOString()}`}
        rowClassName={(r) => (isRecentRow(r) ? 'recent' : undefined)}
      />
      {rows.length === 0 && <p className="muted">Nothing posted yet this cycle.</p>}
    </Panel>
  );
}
