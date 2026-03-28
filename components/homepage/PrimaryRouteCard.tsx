import Link from "next/link";

interface PrimaryRouteCardProps {
  title: string;
  description: string;
  href: string;
  actionLabel: string;
}

export function PrimaryRouteCard(props: PrimaryRouteCardProps) {
  const { title, description, href, actionLabel } = props;

  return (
    <Link
      href={href}
      className="group block h-full rounded-[26px] border border-[var(--border)] bg-white p-6 shadow-[0_18px_38px_rgba(17,33,28,0.06)] transition hover:-translate-y-0.5 hover:border-[var(--border-strong)] hover:shadow-[0_22px_44px_rgba(17,33,28,0.1)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand)] focus-visible:ring-offset-2 sm:p-7"
    >
      <div className="flex h-full flex-col justify-between">
        <div>
          <h2 className="text-[1.45rem] font-semibold leading-tight text-[var(--foreground)]">{title}</h2>
          <p className="mt-3 text-sm leading-7 text-[var(--muted-strong)]">{description}</p>
        </div>
        <div className="mt-8 inline-flex items-center gap-2 text-sm font-semibold text-[var(--brand)]">
          <span>{actionLabel}</span>
          <span
            aria-hidden="true"
            className="transition group-hover:translate-x-1"
          >
            →
          </span>
        </div>
      </div>
    </Link>
  );
}
