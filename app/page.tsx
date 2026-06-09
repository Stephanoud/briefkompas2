"use client";

import Container from "@/components/Container";
import { HomepageLandingContent } from "@/components/homepage/HomepageLandingContent";

const contentWidthClass = "mx-auto w-full max-w-[1060px]";

export default function Page() {
  return (
    <section className="w-full py-10 sm:py-14">
      <Container>
        <div className={contentWidthClass}>
          <HomepageLandingContent />
        </div>
      </Container>
    </section>
  );
}
