import { Section, SectionHeader } from "./Section";

const features = [
  {
    icon: "👥",
    title: "Customer Management",
    description: "Keep client contact details and policy history in one place.",
  },
  {
    icon: "📋",
    title: "Policy Management",
    description: "Record insurance policies with vehicle, premium, and expiry data.",
  },
  {
    icon: "🔔",
    title: "Renewal Tracking",
    description: "View upcoming renewals on the dashboard for the next 30 days.",
  },
  {
    icon: "💰",
    title: "Payment Records",
    description: "Track premiums, commissions, and profit on each policy.",
  },
  {
    icon: "📊",
    title: "Reports",
    description: "Date-range summaries, expenses, PUC income, and PDF export.",
  },
  {
    icon: "📁",
    title: "Document Management",
    description: "Attach RC, Aadhaar, and policy documents to records.",
  },
  {
    icon: "🔍",
    title: "Quick Search",
    description: "Filter and find clients and policies quickly in list views.",
  },
  {
    icon: "📈",
    title: "Dashboard",
    description: "See today’s insurance activity and income at a glance.",
  },
  {
    icon: "💻",
    title: "Offline Desktop Software",
    description: "Work locally on Windows after one-time license activation.",
  },
];

export function Features() {
  return (
    <Section id="features">
      <SectionHeader
        title="Built for Daily Insurance Work"
        subtitle="Practical tools that match how insurance shops actually operate."
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {features.map((feature) => (
          <div
            key={feature.title}
            className="rounded-2xl border border-slate-200 bg-white p-5 transition hover:border-[#0f3d3e]/20 hover:shadow-sm"
          >
            <span className="text-2xl" aria-hidden>
              {feature.icon}
            </span>
            <h3 className="mt-3 text-base font-semibold text-slate-900">
              {feature.title}
            </h3>
            <p className="mt-1 text-sm text-slate-600">{feature.description}</p>
          </div>
        ))}
      </div>
    </Section>
  );
}
