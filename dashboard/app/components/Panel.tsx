import type { ReactNode } from 'react';

export function Panel({ title, hint, children, className, id }: {
  title: string;
  hint?: string;
  children: ReactNode;
  className?: string;
  id?: string;
}) {
  return (
    <section id={id} className={className ? `panel ${className}` : 'panel'}>
      <h2>{title}</h2>
      {hint && <p className="hint">{hint}</p>}
      {children}
    </section>
  );
}
