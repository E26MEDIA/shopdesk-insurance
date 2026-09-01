import { ButtonLink } from "./Button";

export function CtaSection() {
  return (
    <section className="py-16 md:py-20">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="rounded-3xl bg-[#0f3d3e] px-6 py-12 text-center text-white md:px-12 md:py-16">
          <h2 className="text-2xl font-semibold tracking-tight md:text-3xl">
            Ready to simplify your insurance operations?
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-sm leading-relaxed text-teal-50/90 md:text-base">
            Get Insurance Desk for your business and manage your daily insurance
            operations with a simple, professional desktop solution.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <ButtonLink
              href="#contact"
              className="bg-white text-[#0f3d3e] hover:bg-teal-50"
            >
              Request Insurance Desk
            </ButtonLink>
            <ButtonLink
              href="/download"
              variant="secondary"
              className="border-white/30 bg-transparent text-white hover:bg-white/10"
            >
              Download Software
            </ButtonLink>
          </div>
        </div>
      </div>
    </section>
  );
}
