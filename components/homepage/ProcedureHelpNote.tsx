import Link from "next/link";

interface ProcedureHelpNoteProps {
  href: string;
  text: string;
}

export function ProcedureHelpNote(props: ProcedureHelpNoteProps) {
  const { href, text } = props;

  return (
    <div className="rounded-2xl border border-[var(--border)] bg-white px-5 py-4 text-sm leading-7 text-[var(--muted-strong)] shadow-[0_10px_24px_rgba(17,33,28,0.05)]">
      <Link href={href} className="font-medium text-[var(--foreground)] underline underline-offset-4">
        {text}
      </Link>
    </div>
  );
}
