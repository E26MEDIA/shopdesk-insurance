import { Section, SectionHeader } from "./Section";

const benefits = [
  {
    title: "Easy to use",
    description: "A straightforward interface your team can start using quickly.",
  },
  {
    title: "Designed for insurance professionals",
    description: "Built around real shop workflows — clients, policies, renewals, and PUC.",
  },
  {
    title: "Faster daily operations",
    description: "Less time searching records, more time serving customers.",
  },
  {
    title: "Organized customer records",
    description: "All client and policy information stored in structured lists.",
  },
  {
    title: "Better policy tracking",
    description: "Expiry dates, premiums, and vehicle details always at hand.",
  },
  {
    title: "Renewal management",
    description: "Upcoming renewals surfaced on the dashboard automatically.",
  },
  {
    title: "Desktop-based workflow",
    description: "Runs on your Windows computer — your data stays on your machine.",
  },
  {
    title: "Simple and professional interface",
    description: "Clean design with clear navigation and focused screens.",
  },
];

export function WhySection() {
  return (
    <Section id="why" className="bg-white/60">
      <SectionHeader
        title="Why Insurance Desk"
        subtitle="A focused desktop solution for insurance agencies and vehicle insurance shops."
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {benefits.map((item) => (
          <div
            key={item.title}
            className="rounded-2xl border border-slate-200 bg-white p-5"
          >
            <h3 className="text-sm font-semibold text-slate-900">{item.title}</h3>
            <p className="mt-2 text-sm leading-relaxed text-slate-600">
              {item.description}
            </p>
          </div>
        ))}
      </div>
    </Section>
  );
}
