import type { ReactNode } from 'react';

const SECTIONS = [
  { href: '#leaderboards', label: 'leaderboards' },
  { href: '#hall-of-fame', label: 'hall of fame' },
  { href: '#activity', label: 'activity' },
  { href: '#rotation', label: 'rotation' },
  { href: '#nominations', label: 'nominations' },
];

/** Wordmark, section links, and title, laid out like the nor.dev header. */
export function SiteHeader({ children }: { children?: ReactNode }) {
  return (
    <header className="site-header">
      <div className="brand-row">
        <a href="/" className="wordmark" aria-label="nor(DEV): best-of home">
          nor(<span className="dev">DEV</span>):
        </a>
        <nav className="site-nav" aria-label="Sections">
          {SECTIONS.map((s) => (
            <a key={s.href} href={s.href}>
              {s.label}
            </a>
          ))}
        </nav>
      </div>
      <div className="hero">
        <h1>
          The best of nor(DEV): <span className="heart" aria-hidden="true">♥</span>
        </h1>
        <p>The messages the server thought were worth keeping: who wrote them, who spotted them, and how everyone voted.</p>
      </div>
      {children}
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <span className="spin">nor(DEV): best-of bot</span>
    </footer>
  );
}
