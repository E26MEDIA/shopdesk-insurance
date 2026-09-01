function MockupShell({
  title,
  subtitle,
  active,
  children,
}: {
  title: string;
  subtitle?: string;
  active?: string;
  children: React.ReactNode;
}) {
  const links = ["Dashboard", "Clients", "Insurance", "Reports", "Admin"];

  return (
    <div className="overflow-hidden rounded-xl bg-[#f4f7f7] text-left">
      <div className="flex items-center gap-1.5 border-b border-slate-200 bg-slate-100 px-3 py-2">
        <span className="h-2.5 w-2.5 rounded-full bg-red-400" />
        <span className="h-2.5 w-2.5 rounded-full bg-amber-400" />
        <span className="h-2.5 w-2.5 rounded-full bg-emerald-400" />
        <span className="ml-2 text-[10px] text-slate-500">Insurance Desk</span>
      </div>
      <div className="bg-[#0f3d3e] px-3 py-2 text-white">
        <p className="text-xs font-semibold">ShopDesk</p>
        <p className="text-[10px] text-teal-100/80">Insurance + PUC · Offline desktop</p>
        <div className="mt-2 flex flex-wrap gap-1">
          {links.map((l) => (
            <span
              key={l}
              className={`rounded px-2 py-0.5 text-[9px] ${
                l === active
                  ? "bg-white text-[#0f3d3e]"
                  : "text-teal-50/90"
              }`}
            >
              {l}
            </span>
          ))}
        </div>
      </div>
      <div className="p-3">
        <p className="text-sm font-semibold text-slate-900">{title}</p>
        {subtitle ? (
          <p className="mt-0.5 text-[10px] text-slate-500">{subtitle}</p>
        ) : null}
        <div className="mt-3">{children}</div>
      </div>
    </div>
  );
}

export function DashboardMockup() {
  return (
    <MockupShell
      title="Dashboard"
      subtitle="Today’s insurance, PUC income, and renewals"
      active="Dashboard"
    >
      <div className="grid grid-cols-2 gap-2">
        {[
          ["Insurance today", "12"],
          ["Profit today", "₹8,450"],
          ["PUC income", "₹1,200"],
          ["Total policies", "486"],
        ].map(([label, value]) => (
          <div
            key={label}
            className="rounded-md border border-slate-200 bg-white px-2 py-2"
          >
            <p className="text-[9px] text-slate-500">{label}</p>
            <p className="text-xs font-semibold text-slate-900">{value}</p>
          </div>
        ))}
      </div>
      <div className="mt-2 overflow-hidden rounded-md border border-slate-200 bg-white">
        <div className="border-b border-slate-100 bg-slate-50 px-2 py-1 text-[9px] font-medium text-slate-600">
          Renewals in next 30 days
        </div>
        {[
          ["Ramesh Kumar", "KA01AB1234", "12 days"],
          ["Priya Motors", "KA05CD5678", "18 days"],
        ].map(([client, vehicle, days]) => (
          <div
            key={client}
            className="flex justify-between border-b border-slate-50 px-2 py-1 text-[9px] last:border-0"
          >
            <span className="text-[#0f3d3e]">{client}</span>
            <span className="text-slate-500">{vehicle}</span>
            <span className="text-slate-600">{days}</span>
          </div>
        ))}
      </div>
    </MockupShell>
  );
}

export function ClientsMockup() {
  return (
    <MockupShell title="Clients" subtitle="Customer records" active="Clients">
      <div className="space-y-1.5">
        {[
          ["Ramesh Kumar", "9876543210", "3 policies"],
          ["Priya Motors", "9988776655", "8 policies"],
          ["Suresh Auto", "9123456789", "2 policies"],
        ].map(([name, phone, policies]) => (
          <div
            key={name}
            className="flex items-center justify-between rounded-md border border-slate-200 bg-white px-2 py-1.5 text-[9px]"
          >
            <span className="font-medium text-[#0f3d3e]">{name}</span>
            <span className="text-slate-500">{phone}</span>
            <span className="text-slate-600">{policies}</span>
          </div>
        ))}
      </div>
    </MockupShell>
  );
}

export function InsuranceMockup() {
  return (
    <MockupShell
      title="Insurance"
      subtitle="Policy records"
      active="Insurance"
    >
      <div className="overflow-hidden rounded-md border border-slate-200 bg-white text-[9px]">
        <div className="grid grid-cols-4 gap-1 border-b border-slate-100 bg-slate-50 px-2 py-1 font-medium text-slate-600">
          <span>Client</span>
          <span>Vehicle</span>
          <span>Expiry</span>
          <span>Premium</span>
        </div>
        {[
          ["Ramesh Kumar", "KA01AB1234", "2026-04-12", "₹4,200"],
          ["Priya Motors", "KA05CD5678", "2026-05-01", "₹6,800"],
        ].map((row) => (
          <div
            key={row[1]}
            className="grid grid-cols-4 gap-1 border-b border-slate-50 px-2 py-1 last:border-0"
          >
            {row.map((cell) => (
              <span key={cell} className="truncate text-slate-700">
                {cell}
              </span>
            ))}
          </div>
        ))}
      </div>
    </MockupShell>
  );
}

export function ReportsMockup() {
  return (
    <MockupShell
      title="Reports"
      subtitle="PUC income, expenses & monthly PDF"
      active="Reports"
    >
      <div className="grid grid-cols-2 gap-2">
        <div className="rounded-md border border-slate-200 bg-white px-2 py-2">
          <p className="text-[9px] text-slate-500">Range profit</p>
          <p className="text-xs font-semibold">₹42,300</p>
        </div>
        <div className="rounded-md border border-slate-200 bg-white px-2 py-2">
          <p className="text-[9px] text-slate-500">PUC income</p>
          <p className="text-xs font-semibold">₹9,600</p>
        </div>
      </div>
      <div className="mt-2 rounded-md border border-dashed border-[#0f3d3e]/30 bg-teal-50/50 px-2 py-2 text-center text-[9px] text-[#0f3d3e]">
        Download monthly PDF report
      </div>
    </MockupShell>
  );
}

export function DocumentsMockup() {
  return (
    <MockupShell
      title="Documents"
      subtitle="RC, Aadhaar & policy files per record"
      active="Insurance"
    >
      <div className="grid grid-cols-2 gap-2">
        {["RC Copy", "Aadhaar", "Policy PDF", "PUC Certificate"].map(
          (doc) => (
            <div
              key={doc}
              className="rounded-md border border-slate-200 bg-white px-2 py-2 text-center text-[9px] text-slate-700"
            >
              {doc}
            </div>
          ),
        )}
      </div>
    </MockupShell>
  );
}

export function MastersMockup() {
  return (
    <MockupShell
      title="Admin"
      subtitle="Masters & shop configuration"
      active="Admin"
    >
      <div className="flex flex-wrap gap-1.5">
        {["Insurers", "Vehicle types", "Payment modes", "Shop settings"].map(
          (item) => (
            <span
              key={item}
              className="rounded-full border border-slate-200 bg-white px-2 py-1 text-[9px] text-slate-700"
            >
              {item}
            </span>
          ),
        )}
      </div>
    </MockupShell>
  );
}
