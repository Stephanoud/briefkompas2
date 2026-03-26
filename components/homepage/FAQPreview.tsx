import Link from "next/link";

interface FAQPreviewProps {
  items: Array<{
    question: string;
    answer: string;
  }>;
  href: string;
}

export function FAQPreview(props: FAQPreviewProps) {
  const { items, href } = props;

  return (
    <section className="rounded-2xl border border-[var(--border)] bg-white px-5 py-6 shadow-[0_12px_28px_rgba(17,33,28,0.06)] sm:px-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-[var(--foreground)]">Veelgestelde vragen</h2>
          <p className="mt-2 text-sm leading-7 text-[var(--muted-strong)]">
            Korte uitleg voor als je nog twijfelt over de juiste route.
          </p>
        </div>
        <Link
          href={href}
          className="shrink-0 text-sm font-medium text-[var(--muted)] underline underline-offset-4 hover:text-[var(--foreground)]"
        >
          Bekijk FAQ
        </Link>
      </div>

      <div className="mt-5 grid gap-4">
        {items.map((item) => (
          <article key={item.question} className="rounded-xl border border-[var(--border)] bg-[var(--surface-soft)] p-4">
            <h3 className="text-sm font-semibold text-[var(--foreground)]">{item.question}</h3>
            <p className="mt-2 text-sm leading-7 text-[var(--muted)]">{item.answer}</p>
          </article>
        ))}
      </div>
    </section>
  );
}
