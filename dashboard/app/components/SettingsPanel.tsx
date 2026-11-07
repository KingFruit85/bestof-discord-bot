import type { GuildSettings } from '../../lib/queries';
import { formatDateTime, serverName } from '../../lib/format';
import { Panel } from './Panel';
import { SortableTable, type TableColumn } from './SortableTable';

export const SETTINGS_SORT_PARAM = 'ssort';

export function SettingsPanel({ rows, names, sort, current }: {
  rows: GuildSettings[];
  names: Record<string, string>;
  sort: string | undefined;
  current: Record<string, string | undefined>;
}) {
  const columns: TableColumn<GuildSettings>[] = [
    { key: 'server', label: 'Server', value: (r) => serverName(r.guild_id, names), render: (r) => serverName(r.guild_id, names) },
    {
      key: 'schedule',
      label: 'Schedule',
      value: (r) => r.random_post_schedule,
      render: (r) => r.random_post_schedule ?? <span className="muted">off</span>,
    },
    {
      key: 'next',
      label: 'Next post',
      value: (r) => r.next_random_post,
      numeric: true,
      render: (r) => (r.next_random_post ? formatDateTime(r.next_random_post) : '—'),
    },
    { key: 'recap', label: 'Monthly recap', value: (r) => r.enable_monthly_recap ?? false, defaultDir: 'desc', render: (r) => (r.enable_monthly_recap ? 'on' : 'off') },
    {
      key: 'channel',
      label: 'Nomination channel ID',
      value: (r) => r.nomination_channel,
      numeric: true,
      render: (r) => <span className="muted">{r.nomination_channel ?? '—'}</span>,
    },
  ];

  return (
    <Panel id="settings" title="Server settings">
      <SortableTable
        rows={rows}
        columns={columns}
        sort={sort}
        param={SETTINGS_SORT_PARAM}
        fallback={{ key: 'server', dir: 'asc' }}
        current={current}
        anchor="settings"
        rowKey={(r) => r.guild_id}
      />
      {rows.length === 0 && <p className="muted">This server has not run /configure.</p>}
    </Panel>
  );
}
