import { barShare } from '../../lib/chart';
import type { ReactNode } from 'react';
import type { Period } from '../../lib/format';
import { MIN_TASTE_NOMINATIONS, NOMINATOR_KNOWN_SINCE, type RankedUser } from '../../lib/queries';

const since = NOMINATOR_KNOWN_SINCE.toLocaleDateString('en-GB', { month: 'short', year: 'numeric', timeZone: 'UTC' });
import { Panel } from './Panel';
import { PeriodFilter } from './PeriodFilter';
import type { UserProfile } from '../../lib/discord';
import { UserName } from './UserName';

function Board({ title, caption, rows, users, formatValue, empty, renderWho }: {
  title: string;
  caption: string;
  rows: RankedUser[];
  users: Record<string, UserProfile>;
  formatValue: (row: RankedUser) => string;
  empty: string;
  /** Defaults to the row's user. */
  renderWho?: (row: RankedUser) => ReactNode;
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
            <li key={`${row.fan_id ?? ''}:${row.user_id}`}>
              <span className="rank num">{row.rank}</span>
              <span className="who">
                {renderWho ? renderWho(row) : <UserName id={row.user_id} users={users} />}
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

export function LeaderboardsPanel({ mostNominated, nominators, voters, taste, fans, users, period, current }: {
  mostNominated: RankedUser[];
  nominators: RankedUser[];
  fans: RankedUser[];
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
      hint={`Periods count nominations made in that window, and votes on those nominations. Votes from a message's nominator or author aren't counted. Who nominated what is only known since ${since}.`}
    >
      <PeriodFilter period={period} current={current} anchor="leaderboards" />
      <div className="boards">
        <Board
          title="Most nominated"
          caption="Whose messages get nominated"
          rows={mostNominated}
          users={users}
          formatValue={(r) => r.value.toLocaleString('en-GB')}
          empty="No nominations in this period."
        />
        <Board
          title="Top nominators"
          caption={`Messages nominated, since ${since}`}
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
          caption={`Average votes per nomination, ${MIN_TASTE_NOMINATIONS}+ nominations since ${since}`}
          rows={taste}
          users={users}
          formatValue={(r) => `${r.value.toFixed(1)} avg · ${r.nominations} noms`}
          empty={`Nobody has ${MIN_TASTE_NOMINATIONS} nominations in this period yet.`}
        />
        <Board
          title="Biggest fans"
          caption="Who keeps nominating whose messages (2+ times)"
          rows={fans}
          users={users}
          formatValue={(r) => `×${r.value}`}
          empty="Nobody has nominated the same person twice in this period."
          renderWho={(r) => (
            <span className="pair">
              <UserName id={r.fan_id ?? ''} users={users} />
              <span className="muted" aria-label="nominated">→</span>
              <UserName id={r.user_id} users={users} />
            </span>
          )}
        />
      </div>
    </Panel>
  );
}
