import Container from "@/components/Container";
import { normalizeNextPath } from "@/lib/testAuth";

const inputClass =
  "mt-2 w-full rounded-xl border border-[var(--border)] bg-white px-4 py-3 text-base text-[var(--foreground)] shadow-[0_8px_24px_rgba(17,33,28,0.06)] outline-none focus:border-[var(--ring)] focus:ring-2 focus:ring-[var(--ring)]/50";

type LoginPageProps = {
  searchParams: Promise<{
    error?: string;
    next?: string;
  }>;
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = await searchParams;
  const hasError = params.error === "1";
  const nextPath = normalizeNextPath(params.next);

  return (
    <section className="relative flex min-h-screen items-center overflow-hidden py-10 sm:py-14">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(15,143,109,0.16),transparent_34%),radial-gradient(circle_at_bottom_right,rgba(31,102,87,0.16),transparent_30%)]" />

      <Container className="relative flex justify-center">
        <div className="w-full max-w-md rounded-[28px] border border-[var(--border)] bg-white/95 p-7 shadow-[0_24px_60px_rgba(17,33,28,0.12)] backdrop-blur sm:p-9">
          <div className="inline-flex items-center rounded-full border border-[var(--border)] bg-[var(--surface-soft)] px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-[var(--accent)]">
            Testmodus
          </div>

          <h1 className="mt-5 text-4xl leading-tight text-[var(--foreground)]">Log in op BriefKompas</h1>
          <p className="mt-3 text-sm leading-relaxed text-[var(--muted)]">
            Deze omgeving staat tijdelijk achter een testlogin.
          </p>

          <div className="mt-6 rounded-2xl border border-[var(--border)] bg-[var(--surface-soft)] px-4 py-3 text-sm text-[var(--muted-strong)]">
            Gebruik de testgegevens die voor deze omgeving zijn gedeeld om verder te gaan.
          </div>

          <form method="POST" action="/api/test-login" className="mt-7 space-y-4">
            <input type="hidden" name="next" value={nextPath} />

            <div>
              <label htmlFor="username" className="text-sm font-medium text-[var(--foreground)]">
                Inlognaam
              </label>
              <input
                id="username"
                name="username"
                type="text"
                autoComplete="username"
                required
                className={inputClass}
              />
            </div>

            <div>
              <label htmlFor="password" className="text-sm font-medium text-[var(--foreground)]">
                Wachtwoord
              </label>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
                className={inputClass}
              />
            </div>

            {hasError && (
              <p
                className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
                role="alert"
              >
                Onjuiste inlognaam of wachtwoord.
              </p>
            )}

            <button
              type="submit"
              className="cta-button-link inline-flex h-12 w-full items-center justify-center rounded-xl bg-[var(--brand)] px-5 text-base font-semibold text-white shadow-[0_12px_28px_rgba(31,102,87,0.24)] hover:bg-[var(--brand-strong)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:ring-offset-2"
            >
              Verder naar de site
            </button>
          </form>
        </div>
      </Container>
    </section>
  );
}
