import type { UserProfile } from '../../lib/discord';

/** Sort key for a user column: the display name, or the raw ID when unknown. */
export function userLabel(id: string, users: Record<string, UserProfile>): string {
  return users[id]?.name ?? id;
}

/**
 * Avatar and display name, with the raw ID as a tooltip; the muted raw ID when
 * the user is unknown. The avatar loads from Discord's CDN in the viewer's
 * browser. Its span draws a neutral circle, so an avatar link that went stale
 * (they changed it within our day-long cache) shows a blank circle rather than
 * a broken-image icon: alt="" makes the browser draw nothing for a failed load.
 */
/** Shown where the old bot's data doesn't say who nominated a message. */
export function UnknownNominator() {
  return (
    <span className="muted" title="Nominated before December 2025: the old bot's data doesn't record who nominated it.">
      unknown
    </span>
  );
}

/** Sort key for a nominator column; unknown nominators sort last (null). */
export function nominatorLabel(row: { nominator: string; nominator_known: boolean }, users: Record<string, UserProfile>): string | null {
  return row.nominator_known ? userLabel(row.nominator, users) : null;
}

export function UserName({ id, users }: { id: string; users: Record<string, UserProfile> }) {
  const user = users[id];
  if (!user) return <span className="muted">{id}</span>;
  return (
    <span className="user" title={id}>
      <span className="avatar">
        <img src={user.avatar} alt="" width={20} height={20} loading="lazy" decoding="async" />
      </span>
      <span className="user-name">{user.name}</span>
    </span>
  );
}
