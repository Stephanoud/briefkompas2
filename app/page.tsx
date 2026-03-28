"use client";

import Container from "@/components/Container";
import { HomepageStartContent } from "@/components/homepage/HomepageStartContent";

const contentWidthClass = "mx-auto w-full max-w-[980px]";

export default function Page() {
  return (
    <section className="w-full py-10 sm:py-14">
      <Container>
        <div className={contentWidthClass}>
          <HomepageStartContent />
        </div>
      </Container>
    </section>
  );
}
