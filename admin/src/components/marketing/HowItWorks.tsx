import { Section, SectionHeader } from "./Section";

const steps = [
  {
    step: "1",
    title: "Request Access",
    description:
      "Submit the enquiry form with your business details and requirements.",
  },
  {
    step: "2",
    title: "Get Your Insurance Desk Setup",
    description:
      "Our team reviews your request and provides the appropriate software and shop setup.",
  },
  {
    step: "3",
    title: "Download & Start",
    description:
      "Download the assigned Windows installer, enter your verification key when asked, and start using Insurance Desk.",
  },
];

export function HowItWorks() {
  return (
    <Section id="how-it-works">
      <SectionHeader
        title="How It Works"
        subtitle="A simple process from enquiry to daily use."
      />

      <div className="grid gap-6 md:grid-cols-3">
        {steps.map((item) => (
          <div
            key={item.step}
            className="relative rounded-2xl border border-slate-200 bg-white p-6"
          >
            <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-[#0f3d3e] text-sm font-semibold text-white">
              {item.step}
            </span>
            <h3 className="mt-4 text-lg font-semibold text-slate-900">
              {item.title}
            </h3>
            <p className="mt-2 text-sm leading-relaxed text-slate-600">
              {item.description}
            </p>
          </div>
        ))}
      </div>
    </Section>
  );
}
