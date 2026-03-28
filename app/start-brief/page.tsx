"use client";

import { useRouter } from "next/navigation";
import { Card } from "@/components/Card";
import { HomepageStartContent } from "@/components/homepage/HomepageStartContent";

export default function StartBrief() {
  const router = useRouter();

  return (
    <div className="mx-auto max-w-5xl">
      <Card>
        <HomepageStartContent />

        <div className="mt-6">
          <button
            type="button"
            onClick={() => router.push("/")}
            className="text-sm font-medium text-[var(--muted)] underline underline-offset-4 hover:text-[var(--foreground)]"
          >
            Terug naar homepage
          </button>
        </div>
      </Card>
    </div>
  );
}
