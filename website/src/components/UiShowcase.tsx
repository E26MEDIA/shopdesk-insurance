import { Section, SectionHeader } from "./Section";
import {
  ClientsMockup,
  DashboardMockup,
  DocumentsMockup,
  InsuranceMockup,
  MastersMockup,
  ReportsMockup,
} from "./mockups/DashboardMockup";

const showcases = [
  {
    title: "Dashboard",
    description: "Daily overview with insurance stats, PUC income, and upcoming renewals.",
    Mockup: DashboardMockup,
  },
  {
    title: "Customer Management",
    description: "Organized client records with contact details and linked policies.",
    Mockup: ClientsMockup,
  },
  {
    title: "Policy Management",
    description: "Track premiums, expiry dates, vehicle details, and policy history.",
    Mockup: InsuranceMockup,
  },
  {
    title: "Renewals",
    description: "See policies expiring in the next 30 days directly on the dashboard.",
    Mockup: DashboardMockup,
  },
  {
    title: "Reports",
    description: "Date-range profit, PUC income, expenses, and monthly PDF export.",
    Mockup: ReportsMockup,
  },
  {
    title: "Documents",
    description: "Attach RC, Aadhaar, policy PDFs and other files to insurance records.",
    Mockup: DocumentsMockup,
  },
  {
    title: "PUC Income",
    description: "Record daily PUC amounts alongside insurance operations in Reports.",
    Mockup: ReportsMockup,
  },
  {
    title: "Admin & Masters",
    description: "Configure insurers, vehicle types, payment modes, and shop settings.",
    Mockup: MastersMockup,
  },
];

export function UiShowcase() {
  return (
    <Section id="showcase" className="bg-white/60">
      <SectionHeader
        title="Everything You Need to Manage Insurance Operations"
        subtitle="A clean, purpose-built interface designed for insurance shops — based on the actual Insurance Desk software."
      />

      <div className="flex gap-5 overflow-x-auto pb-4 snap-x snap-mandatory [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {showcases.map(({ title, description, Mockup }) => (
          <article
            key={title}
            className="w-[min(100%,320px)] shrink-0 snap-start rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-[#0f3d3e]/20 hover:shadow-md"
          >
            <div className="mb-4 overflow-hidden rounded-xl">
              <Mockup />
            </div>
            <h3 className="text-base font-semibold text-slate-900">{title}</h3>
            <p className="mt-1 text-sm leading-relaxed text-slate-600">
              {description}
            </p>
          </article>
        ))}
      </div>
    </Section>
  );
}
