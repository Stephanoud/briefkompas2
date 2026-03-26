import Link from "next/link";

interface PrimaryRouteCardProps {
  title: string;
  description: string;
  href: string;
  actionLabel: string;
}

const primaryButtonClass =
  "inline-flex h-12 items-center justify-center rounded-lg bg-[var(--brand)] px-5 text-sm font-semibold text-white shadow-[0_12px_28px_rgba(31,102,87,0.22)] transition hover:bg-[var(--brand-strong)]";

export function PrimaryRouteCard(props: PrimaryRouteCardProps) {
  const { title, description, href, actionLabel } = props;

  return (
    <article className="rounded-2xl border border-[var(--border)] bg-white p-5 shadow-[0_14px_32px_rgba(17,33,28,0.06)] sm:p-6">
      <h2 className="text-xl font-semibold leading-snug text-[var(--foreground)]">{title}</h2>
      <p className="mt-3 text-sm leading-7 text-[var(--muted-strong)]">{description}</p>
      <div className="mt-6">
        <Link href={href} className={primaryButtonClass}>
          {actionLabel}
        </Link>
      </div>
    </article>
  );
}
