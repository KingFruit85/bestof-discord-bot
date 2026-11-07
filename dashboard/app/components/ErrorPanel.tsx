import { Panel } from './Panel';

export function ErrorPanel({ error }: { error: unknown }) {
  const message = error instanceof Error ? error.message : String(error);
  return (
    <Panel title="Could not load data" className="error">
      <p>{message}</p>
      <p className="muted">Check DASHBOARD_DATABASE_URL in dashboard/.env.local and that the database is reachable.</p>
    </Panel>
  );
}
