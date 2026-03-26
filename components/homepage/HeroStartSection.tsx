import type { ReactNode } from "react";

interface HeroStartSectionProps {
  eyebrow?: string;
  title: string;
  subtitle: string;
  children: ReactNode;
}

export function HeroStartSection(props: HeroStartSectionProps) {
  const { eyebrow, title, subtitle, children } = props;

  return (
    <section className="rounded-[30px] border border-[var(--border)] bg-[linear-gradient(180deg,#ffffff_0%,#f7fbf9_100%)] px-5 py-8 shadow-[0_18px_40px_rgba(17,33,28,0.07)] sm:px-8 sm:py-10">
      {eyebrow && (
        <p className="inline-flex rounded-full border border-[var(--border)] bg-white px-3 py-1 text-xs font-medium text-[var(--muted)]">
          {eyebrow}
        </p>
      )}
      <h1 className="mt-4 text-4xl leading-[1.02] tracking-[-0.03em] text-[var(--foreground)] sm:text-5xl">
        {title}
      </h1>
      <p className="mt-4 max-w-[56ch] text-base leading-8 text-[var(--muted-strong)]">
        {subtitle}
      </p>
      <div className="mt-8">{children}</div>
    </section>
  );
}
