import Link from "next/link";

interface SecondaryRouteLinksProps {
  links: Array<{
    label: string;
    href: string;
  }>;
}

export function SecondaryRouteLinks(props: SecondaryRouteLinksProps) {
  const { links } = props;

  return (
    <div className="mt-5 border-t border-[var(--border)] pt-4">
      <p className="text-xs font-medium uppercase tracking-[0.16em] text-[var(--muted)]">
        Mogelijke routes in de intake
      </p>
      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-sm text-[var(--muted-strong)]">
        {links.map((link) => (
          <Link
            key={link.label}
            href={link.href}
            className="underline decoration-[var(--border-strong)] underline-offset-4 transition hover:text-[var(--foreground)]"
          >
            {link.label}
          </Link>
        ))}
      </div>
    </div>
  );
}
