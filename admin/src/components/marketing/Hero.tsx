import { ButtonLink } from "./Button";
import { DashboardMockup } from "./mockups/DashboardMockup";

export function Hero() {
  return (
    <section
      id="home"
      className="scroll-mt-24 pt-28 pb-16 md:pt-36 md:pb-24"
    >
      <div className="mx-auto grid max-w-6xl items-center gap-12 px-4 sm:px-6 lg:grid-cols-2 lg:gap-16">
        <div className="animate-fade-up">
          <p className="mb-4 inline-flex rounded-full border border-teal-200 bg-teal-50 px-3 py-1 text-xs font-medium text-[#0f3d3e]">
            E26 Insurance Desk · Desktop Software
          </p>
          <h1 className="text-4xl font-semibold tracking-tight text-slate-900 md:text-5xl lg:text-[3.25rem] lg:leading-tight">
            Insurance Management, Simplified.
          </h1>
          <p className="mt-5 max-w-xl text-base leading-relaxed text-slate-600 md:text-lg">
            Insurance Desk helps insurance professionals manage customers,
            policies, renewals, payments and daily operations from one powerful
            desktop solution.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <ButtonLink href="#contact">Request Insurance Desk</ButtonLink>
            <ButtonLink href="/download" variant="secondary">
              Download Software
            </ButtonLink>
          </div>
        </div>

        <div className="animate-fade-up lg:justify-self-end" style={{ animationDelay: "0.1s" }}>
          <div className="rounded-2xl border border-slate-200 bg-white p-2 shadow-xl shadow-slate-900/5">
            <DashboardMockup />
          </div>
          <p className="mt-3 text-center text-xs text-slate-500">
            Insurance Desk dashboard — renewals, income &amp; daily overview
          </p>
        </div>
      </div>
    </section>
  );
}
