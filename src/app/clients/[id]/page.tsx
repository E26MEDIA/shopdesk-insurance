"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import {
  Button,
  Field,
  Input,
  PageHeader,
  Panel,
} from "@/components/ui";
import { SearchSelect } from "@/components/SearchSelect";
import { BalanceDue } from "@/components/BalanceDue";
import { useStore } from "@/lib/store";
import { requireOfficeAdminPin } from "@/lib/persist";
import { formatINR } from "@/lib/utils";
import { customerBalanceDue, policyProfit } from "@/lib/types";

export default function ClientDetailPage() {
  const params = useParams<{ id: string }>();
  const { data, ready, addVehicle, deleteClient } = useStore();
  const client = data.clients.find((c) => c.id === params.id);

  const [regNo, setRegNo] = useState("");
  const [mode, setMode] = useState("");
  const [variant, setVariant] = useState("");
  const [rcNumber, setRcNumber] = useState("");
  const [contact, setContact] = useState("");

  if (!ready) return <p className="text-sm text-slate-600">Loading…</p>;
  if (!client) return <p className="text-sm text-slate-600">Client not found.</p>;

  const vehicles = data.vehicles.filter((v) => v.clientId === client.id);
  const policies = data.policies.filter(
    (p) =>
      p.clientName.trim().toLowerCase() === client.name.trim().toLowerCase() ||
      (client.phone && p.phone === client.phone),
  );
  const balanceDue = policies.reduce((sum, p) => sum + customerBalanceDue(p), 0);

  function saveVehicle(e: React.FormEvent) {
    e.preventDefault();
    if (!regNo.trim()) return;
    addVehicle({
      clientId: client!.id,
      regNo: regNo.trim().toUpperCase(),
      mode,
      variant,
      rcNumber: rcNumber.trim(),
      contact: contact.trim() || client!.phone,
    });
    setRegNo("");
    setMode("");
    setVariant("");
    setRcNumber("");
    setContact("");
  }

  return (
    <div>
      <PageHeader
        title={client.name}
        subtitle={`${client.phone}${client.address ? ` · ${client.address}` : ""}`}
        action={
          <div className="flex gap-2">
            <Link href="/insurance/new">
              <Button>New insurance</Button>
            </Link>
            <Button
              variant="danger"
              onClick={() => {
                void (async () => {
                if (!(await requireOfficeAdminPin("delete a client"))) return;
                if (confirm("Delete this client and related records?")) {
                  deleteClient(client.id);
                  window.location.href = "/clients";
                }
                })();
              }}
            >
              Delete
            </Button>
          </div>
        }
      />

      {client.notes ? (
        <Panel className="mb-6 text-sm text-slate-700">{client.notes}</Panel>
      ) : null}

      {balanceDue > 0 ? (
        <Panel className="mb-6 border-red-200 bg-red-50">
          <p className="text-sm font-semibold text-red-800">
            Customer credit / balance due: {formatINR(balanceDue)}
          </p>
          <p className="mt-1 text-sm text-red-800">
            {client.name}
            {client.phone ? ` · ${client.phone}` : ""}
            {client.address ? ` · ${client.address}` : ""} still has unpaid balance on insurance.
          </p>
        </Panel>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-2">
        <section>
          <h2 className="mb-3 text-base font-semibold">Vehicles</h2>
          <Panel className="mb-4">
            <form onSubmit={saveVehicle} className="grid gap-3">
              <Field label="Registration number">
                <Input
                  required
                  value={regNo}
                  onChange={(e) => setRegNo(e.target.value)}
                  placeholder="KA01AB1234"
                />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Vehicle mode">
                  <SearchSelect
                    value={mode}
                    options={data.masters.vehicleModes || []}
                    placeholder="Search vehicle mode"
                    onChange={setMode}
                  />
                </Field>
                <Field label="Variant">
                  <Input
                    value={variant}
                    onChange={(e) => setVariant(e.target.value)}
                    placeholder="Type variant"
                  />
                </Field>
              </div>
              <Field label="RC number">
                <Input
                  value={rcNumber}
                  onChange={(e) => setRcNumber(e.target.value)}
                />
              </Field>
              <Field label="Contact">
                <Input
                  value={contact}
                  onChange={(e) => setContact(e.target.value)}
                  placeholder={client.phone}
                />
              </Field>
              <Button type="submit">Add vehicle</Button>
            </form>
          </Panel>

          {vehicles.length === 0 ? (
            <p className="text-sm text-slate-600">No vehicles yet.</p>
          ) : (
            <ul className="space-y-2">
              {vehicles.map((v) => (
                <li
                  key={v.id}
                  className="rounded-md border border-slate-200 bg-white px-3 py-2 text-sm"
                >
                  <p className="font-medium text-slate-900">{v.regNo}</p>
                  <p className="text-slate-600">
                    {[v.mode, v.variant].filter(Boolean).join(" · ") || "—"}
                    {v.rcNumber ? ` · RC ${v.rcNumber}` : ""}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section>
          <h2 className="mb-3 text-base font-semibold">Insurance history</h2>
          {policies.length === 0 ? (
            <p className="text-sm text-slate-600">No policies yet.</p>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
              <table className="min-w-full text-left text-sm">
                <thead className="border-b border-slate-200 bg-slate-50 text-slate-600">
                  <tr>
                    <th className="px-3 py-2 font-medium">Date</th>
                    <th className="px-3 py-2 font-medium">Vehicle</th>
                    <th className="px-3 py-2 font-medium">Company</th>
                    <th className="px-3 py-2 font-medium">Received</th>
                    <th className="px-3 py-2 font-medium">Balance due</th>
                    <th className="px-3 py-2 font-medium">Profit</th>
                  </tr>
                </thead>
                <tbody>
                  {policies.map((p) => {
                    const due = customerBalanceDue(p);
                    return (
                    <tr key={p.id} className={`border-b border-slate-100 ${due ? "bg-red-50/70" : ""}`}>
                      <td className="px-3 py-2">
                        <Link
                          href={`/insurance/${p.id}`}
                          className="text-[#0f3d3e] hover:underline"
                        >
                          {p.date}
                        </Link>
                      </td>
                      <td className="px-3 py-2">{p.regNo || "—"}</td>
                      <td className="px-3 py-2">{p.company || "—"}</td>
                      <td className="px-3 py-2">{formatINR(p.received)}</td>
                      <td className="px-3 py-2">
                        <BalanceDue amount={due} />
                      </td>
                      <td className="px-3 py-2">{formatINR(policyProfit(p))}</td>
                    </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
