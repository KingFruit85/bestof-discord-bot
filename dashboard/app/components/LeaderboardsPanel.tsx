import { barShare } from '../../lib/chart';
import type { Period } from '../../lib/format';
import { MIN_TASTE_NOMINATIONS, type RankedUser } from '../../lib/queries';
import { Panel } from './Panel';
import { PeriodFilter } from './PeriodFilter';
import type { UserProfile } from '../../lib/discord';
import { UserName } from './UserName';

function Board({ title, caption, rows, users, formatValue, empty }: {
  title: string;
  caption: string;
  rows: RankedUser[];
  users: Record<string, UserProfile>;
  formatValue: (row: RankedUser) => string;
  empty: string;
}) {
  const max = Math.max(0, ...rows.map((r) => r.value));
  return (
    <div className="board">
      <h3>{title}</h3>
      <p className="hint">{caption}</p>
      {rows.length === 0 ? (
        <p className="muted">{empty}</p>
      ) : (
        <ol className="board-list">
          {rows.map((row) => (
            <li key={row.user_id}>
              <span className="rank num">{row.rank}</span>
              <span className="who">
                <UserName id={row.user_id} users={users} />
              </span>
              <span className="value num">{formatValue(row)}</span>
              <span className="board-bar" aria-hidden="true">
                <span style={{ width: `${barShare(row.value, max) * 100}%` }} />
              </span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

export function LeaderboardsPanel({ nominators, voters, taste, users, period, current }: {
  nominators: RankedUser[];
  voters: RankedUser[];
  taste: RankedUser[];
  users: Record<string, UserProfile>;
  period: Period;
  current: Record<string, string | undefined>;
}) {
  return (
    <Panel
      id="leaderboards"
      title="Leaderboards"
      hint="Periods count nominations made in that window, and votes on those nominations. Nominators' automatic upvotes on their own nominations aren't counted."
    >
      <PeriodFilter period={period} current={current} anchor="leaderboards" />
      <div className="boards">
        <Board
          title="Top nominators"
          caption="Messages nominated"
          rows={nominators}
          users={users}
          formatValue={(r) => r.value.toLocaleString('en-GB')}
          empty="No nominations in this period."
        />
        <Board
          title="Top voters"
          caption="Votes cast on other people's nominations"
          rows={voters}
          users={users}
          formatValue={(r) => r.value.toLocaleString('en-GB')}
          empty="No votes in this period."
        />
        <Board
          title="Best taste"
          caption={`Average votes per nomination, for anyone with ${MIN_TASTE_NOMINATIONS}+ nominations`}
          rows={taste}
          users={users}
          formatValue={(r) => `${r.value.toFixed(1)} avg · ${r.nominations} noms`}
          empty={`Nobody has ${MIN_TASTE_NOMINATIONS} nominations in this period yet.`}
        />
      </div>
    </Panel>
  );
}
