// Password gate for the dashboard, mainly to stop crawlers and bots from
// running database queries (Neon free-tier compute) on a public URL.
// Uses HTTP Basic auth so the browser shows its own password prompt.

export type AccessDecision = 'allow' | 'challenge' | 'misconfigured';

/** Constant-time comparison, so response timing doesn't reveal how much of a guess matched. */
export function safeEqual(a: string, b: string): boolean {
  const encoder = new TextEncoder();
  const bytesA = encoder.encode(a);
  const bytesB = encoder.encode(b);
  let diff = bytesA.length ^ bytesB.length;
  const length = Math.max(bytesA.length, bytesB.length);
  for (let i = 0; i < length; i++) {
    diff |= (bytesA[i] ?? 0) ^ (bytesB[i] ?? 0);
  }
  return diff === 0;
}

/** The password from an `Authorization: Basic …` header. The username is ignored. */
export function passwordFromBasicAuth(header: string | null): string | null {
  if (!header) return null;
  const match = /^Basic\s+([A-Za-z0-9+/=]+)$/i.exec(header.trim());
  if (!match?.[1]) return null;
  let decoded: string;
  try {
    // atob yields one char per byte; re-decode as UTF-8 for non-ASCII passwords.
    decoded = new TextDecoder().decode(Uint8Array.from(atob(match[1]), (c) => c.charCodeAt(0)));
  } catch {
    return null;
  }
  const colon = decoded.indexOf(':');
  return colon === -1 ? null : decoded.slice(colon + 1);
}

/**
 * No password configured: open locally for convenience, but locked on Vercel,
 * so a forgotten env var can't silently make the deployment public.
 */
export function decideAccess({ password, onVercel, authorization }: {
  password: string | undefined;
  onVercel: boolean;
  authorization: string | null;
}): AccessDecision {
  if (!password) return onVercel ? 'misconfigured' : 'allow';
  const supplied = passwordFromBasicAuth(authorization);
  return supplied !== null && safeEqual(supplied, password) ? 'allow' : 'challenge';
}
