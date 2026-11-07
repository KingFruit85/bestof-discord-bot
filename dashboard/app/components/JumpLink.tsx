export function JumpLink({ href }: { href: string }) {
  return (
    <a href={href} target="_blank" rel="noreferrer">
      Open ↗
    </a>
  );
}
