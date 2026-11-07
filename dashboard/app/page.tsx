import { ErrorPanel } from './components/ErrorPanel';
import { NOMINATIONS_SORT_PARAM, NominationListPanel } from './components/NominationListPanel';
import { PoolProgressPanel } from './components/PoolProgressPanel';
import { RECENT_SORT_PARAM, RecentPostsPanel } from './components/RecentPostsPanel';
import { ServerFilter } from './components/ServerFilter';
import { SETTINGS_SORT_PARAM, SettingsPanel } from './components/SettingsPanel';
import { TOP_SORT_PARAM, VoteStatsPanel } from './components/VoteStatsPanel';
import { firstParam, parseStatus, serverName, type SearchParamValue } from '../lib/format';
import { lookupNames } from '../lib/names';
import {
  getGuildIds,
  getGuildSettings,
  getNominations,
  getPoolProgress,
  getRecentPosts,
  getVoteStats,
} from '../lib/queries';

export const dynamic = 'force-dynamic';

async function loadData(guildId: string | null, status: ReturnType<typeof parseStatus>) {
  const [guildIds, pool, recent, nominations, voteStats, topNominations, settings] = await Promise.all([
    getGuildIds(),
    getPoolProgress(guildId),
    getRecentPosts(guildId),
    // Default order only; the table re-sorts by the clicked column.
    getNominations({ guildId, status, sort: 'newest' }),
    getVoteStats(guildId),
    getNominations({ guildId, status: 'all', sort: 'score', limit: 10 }),
    getGuildSettings(guildId),
  ]);
  return { guildIds, pool, recent, nominations, voteStats, topNominations, settings };
}

export default async function Page({ searchParams }: { searchParams: Promise<Record<string, SearchParamValue>> }) {
  const params = await searchParams;
  const guildId = firstParam(params.guild) || null;
  const status = parseStatus(params.status);
  const showServer = guildId === null;

  // Each table keeps its own column sort in the URL.
  const sorts = {
    [RECENT_SORT_PARAM]: firstParam(params[RECENT_SORT_PARAM]) || undefined,
    [NOMINATIONS_SORT_PARAM]: firstParam(params[NOMINATIONS_SORT_PARAM]) || undefined,
    [TOP_SORT_PARAM]: firstParam(params[TOP_SORT_PARAM]) || undefined,
    [SETTINGS_SORT_PARAM]: firstParam(params[SETTINGS_SORT_PARAM]) || undefined,
  };

  // Params that differ from the defaults, carried through every link so that
  // changing one control keeps the others.
  const current: Record<string, string | undefined> = {
    guild: guildId ?? undefined,
    status: status === 'all' ? undefined : status,
    ...sorts,
  };

  let data: Awaited<ReturnType<typeof loadData>>;
  try {
    data = await loadData(guildId, status);
  } catch (error) {
    console.error('Dashboard failed to load data:', error);
    return (
      <main>
        <header className="top"><h1>Best-Of Dashboard</h1></header>
        <ErrorPanel error={error} />
      </main>
    );
  }

  // Live Discord names, cached a day per ID. Never throws; misses show raw IDs.
  const resolved = await lookupNames(
    data.nominations.map((n) => n.nominator),
    data.guildIds,
  );
  const names = resolved.guilds;

  const options = data.guildIds.map((id) => ({ id, label: serverName(id, names) }));

  return (
    <main>
      <header className="top">
        <h1>Best-Of Dashboard</h1>
        <ServerFilter options={options} selected={guildId} current={current} />
      </header>
      <PoolProgressPanel rows={data.pool} names={names} />
      <RecentPostsPanel
        rows={data.recent}
        names={names}
        showServer={showServer}
        sort={sorts[RECENT_SORT_PARAM]}
        current={current}
      />
      <NominationListPanel
        rows={data.nominations}
        names={names}
        showServer={showServer}
        status={status}
        userNames={resolved.users}
        namesAvailable={resolved.available}
        sort={sorts[NOMINATIONS_SORT_PARAM]}
        current={current}
      />
      <VoteStatsPanel
        stats={data.voteStats}
        top={data.topNominations}
        names={names}
        showServer={showServer}
        sort={sorts[TOP_SORT_PARAM]}
        current={current}
      />
      <SettingsPanel rows={data.settings} names={names} sort={sorts[SETTINGS_SORT_PARAM]} current={current} />
    </main>
  );
}
