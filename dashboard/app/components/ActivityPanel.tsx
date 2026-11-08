import { axisMid, barShare, fillMonths, monthLabel, niceMax, type MonthCount } from '../../lib/chart';
import { Panel } from './Panel';

/**
 * Nominations per month as an HTML/CSS bar chart: text stays readable at any
 * width, and hover tooltips are native title attributes, so no client JS.
 * Votes aren't charted: their timestamps date from a Dec 2025 import.
 */
export function ActivityPanel({ rows, now = new Date() }: { rows: MonthCount[]; now?: Date }) {
  const months = fillMonths(rows, now.toISOString().slice(0, 7));
  const peak = months.reduce<MonthCount | null>((best, m) => (best === null || m.count > best.count ? m : best), null);
  const top = niceMax(peak?.count ?? 0);
  const total = months.reduce((sum, m) => sum + m.count, 0);

  return (
    <Panel id="activity" title="Nominations per month" hint={`${total.toLocaleString('en-GB')} nominations since ${months[0] ? monthLabel(months[0].month) : '—'}. Hover a bar for its month.`}>
      {months.length === 0 ? (
        <p className="muted">No nominations yet.</p>
      ) : (
        <>
          <div className="chart" role="img" aria-label={`Nominations per month. Busiest: ${peak ? `${monthLabel(peak.month)}, ${peak.count}` : 'none'}.`}>
            <div className="chart-y num" aria-hidden="true">
              <span>{top}</span>
              <span>{axisMid(top) ?? ''}</span>
              <span>0</span>
            </div>
            <div className="chart-plot">
              <div className="chart-grid" aria-hidden="true">
                <span />
                <span />
                <span />
              </div>
              <div className="chart-cols">
                {months.map((m) => (
                  <div key={m.month} className="chart-col" title={`${monthLabel(m.month)}: ${m.count} nomination${m.count === 1 ? '' : 's'}`}>
                    {m === peak && <span className="chart-peak num">{m.count}</span>}
                    {m.count > 0 && <span className="chart-bar" style={{ height: `${barShare(m.count, top) * 100}%` }} />}
                  </div>
                ))}
              </div>
              <div className="chart-x" aria-hidden="true">
                {months.map((m, i) => (
                  <span key={m.month}>{i === 0 || m.month.endsWith('-01') ? m.month.slice(0, 4) : ''}</span>
                ))}
              </div>
            </div>
          </div>
          <details className="chart-table">
            <summary>Show as table</summary>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Month</th>
                    <th>Nominations</th>
                  </tr>
                </thead>
                <tbody>
                  {[...months].reverse().map((m) => (
                    <tr key={m.month}>
                      <td>{monthLabel(m.month)}</td>
                      <td className="num">{m.count}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
        </>
      )}
    </Panel>
  );
}
