import { ActivityPanel } from './components/ActivityPanel';
import { ErrorPanel } from './components/ErrorPanel';
import { HALL_SORT_PARAM, HallOfFamePanel } from './components/HallOfFamePanel';
import { LeaderboardsPanel } from './components/LeaderboardsPanel';
import { NOMINATIONS_SORT_PARAM, NominationListPanel } from './components/NominationListPanel';
import { PoolProgressPanel } from './components/PoolProgressPanel';
import { RECENT_SORT_PARAM, RecentPostsPanel } from './components/RecentPostsPanel';
import { ServerFilter } from './components/ServerFilter';
import { SiteFooter, SiteHeader } from './components/SiteHeader';
import { SETTINGS_SORT_PARAM, SettingsPanel } from './components/SettingsPanel';
import { VoteStatsPanel } from './components/VoteStatsPanel';
import { firstParam, parsePeriod, parseStatus, periodDays, resolveScope, serverName, type SearchParamValue } from '../lib/format';
import { lookupNames } from '../lib/names';
import {
  getBestTaste,
  getBiggestFans,
  getMostNominated,
  getGuildIds,
  getGuildSettings,
  getHallOfFame,
  getMonthlyNominations,
  getNominations,
  getPoolProgress,
  getRecentPosts,
  getTopNominators,
  getTopVoters,
  getVoteStats,
} from '../lib/queries';

export const dynamic = 'force-dynamic';

async function loadData(requestedGuild: string | undefined, status: ReturnType<typeof parseStatus>, days: number | null) {
  // Hidden servers are dropped here, before any other query runs.
  const scope = resolveScope(requestedGuild, await getGuildIds());
  const guildIds = scope.guildIds;
  const [mostNominated, nominators, voters, taste, fans, hallOfFame, monthly, pool, recent, nominations, voteStats, settings] =
    await Promise.all([
      getMostNominated(guildIds, days),
      getTopNominators(guildIds, days),
      getTopVoters(guildIds, days),
      getBestTaste(guildIds, days),
      getBiggestFans(guildIds, days),
      getHallOfFame(guildIds, days),
      getMonthlyNominations(guildIds),
      getPoolProgress(guildIds),
      getRecentPosts(guildIds),
      // Default order only; the table re-sorts by the clicked column.
      getNominations({ guildIds, status, sort: 'newest' }),
      getVoteStats(guildIds),
      getGuildSettings(guildIds),
    ]);
  return { scope, mostNominated, nominators, voters, taste, fans, hallOfFame, monthly, pool, recent, nominations, voteStats, settings };
}

export default async function Page({ searchParams }: { searchParams: Promise<Record<string, SearchParamValue>> }) {
  const params = await searchParams;
  const requestedGuild = firstParam(params.guild) || undefined;
  const status = parseStatus(params.status);
  const period = parsePeriod(params.period);

  // Each table keeps its own column sort in the URL.
  const sorts = {
    [HALL_SORT_PARAM]: firstParam(params[HALL_SORT_PARAM]) || undefined,
    [RECENT_SORT_PARAM]: firstParam(params[RECENT_SORT_PARAM]) || undefined,
    [NOMINATIONS_SORT_PARAM]: firstParam(params[NOMINATIONS_SORT_PARAM]) || undefined,
    [SETTINGS_SORT_PARAM]: firstParam(params[SETTINGS_SORT_PARAM]) || undefined,
  };

  // Params that differ from the defaults, carried through every link so that
  // changing one control keeps the others.
  const current: Record<string, string | undefined> = {
    guild: requestedGuild,
    status: status === 'all' ? undefined : status,
    period: period === 'all' ? undefined : period,
    ...sorts,
  };

  let data: Awaited<ReturnType<typeof loadData>>;
  try {
    data = await loadData(requestedGuild, status, periodDays(period));
  } catch (error) {
    console.error('Dashboard failed to load data:', error);
    return (
      <main>
        <SiteHeader />
        <ErrorPanel error={error} />
      </main>
    );
  }

  // Live Discord names, cached a day per ID. Never throws; misses show raw IDs.
  // Leaderboard IDs go first so they win any lookups the rate gate allows.
  const userIds = new Set<string | null | undefined>([
    ...[data.mostNominated, data.nominators, data.voters, data.taste, data.fans].flat().flatMap((r) => [r.user_id, r.fan_id]),
    ...data.hallOfFame.flatMap((r) => [r.author_id, r.nominator_known ? r.nominator : null]),
    ...data.nominations.flatMap((n) => [n.author_id, n.nominator_known ? n.nominator : null]),
  ]);
  const { scope } = data;
  // Links carry the server actually shown, not a hidden or unknown one from the URL.
  current.guild = scope.selected ?? undefined;
  const resolved = await lookupNames([...userIds].filter((id): id is string => Boolean(id)), scope.visible);
  const names = resolved.guilds;

  // With one visible server there is nothing to pick between or label.
  const options = scope.visible.map((id) => ({ id, label: serverName(id, names) }));
  const showServer = scope.guildIds.length > 1;

  return (
    <main>
      <SiteHeader>
        {options.length > 1 && <ServerFilter options={options} selected={scope.selected} current={current} />}
      </SiteHeader>
      <LeaderboardsPanel
        mostNominated={data.mostNominated}
        fans={data.fans}
        nominators={data.nominators}
        voters={data.voters}
        taste={data.taste}
        users={resolved.users}
        period={period}
        current={current}
      />
      <HallOfFamePanel
        rows={data.hallOfFame}
        names={names}
        users={resolved.users}
        showServer={showServer}
        period={period}
        sort={sorts[HALL_SORT_PARAM]}
        current={current}
      />
      <ActivityPanel rows={data.monthly} />
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
        users={resolved.users}
        namesAvailable={resolved.available}
        sort={sorts[NOMINATIONS_SORT_PARAM]}
        current={current}
      />
      <VoteStatsPanel stats={data.voteStats} />
      <SettingsPanel rows={data.settings} names={names} sort={sorts[SETTINGS_SORT_PARAM]} current={current} />
      <SiteFooter />
    </main>
  );
}
