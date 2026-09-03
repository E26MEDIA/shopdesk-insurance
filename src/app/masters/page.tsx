"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Button,
  Field,
  Input,
  PageHeader,
  Panel,
  Select,
} from "@/components/ui";
import { useStore } from "@/lib/store";
import type { FormFieldType, MasterType } from "@/lib/types";
import {
  checkOfficeServer,
  configureOfficeAccessKey,
  createOfficeBackup,
  getOfficeStatus,
  getOfficeActivity,
  getOfficeAccessKey,
  getOfficeComputerLabel,
  getOfficeServerUrl,
  listOfficeBackups,
  restoreOfficeBackup,
  officeAdminPinConfigured,
  requireOfficeAdminPin,
  setOfficeAdminPin,
  setOfficeAccessKey,
  setOfficeComputerLabel,
  startOfficeServerOnThisPc,
  getOfficeLanInfo,
  setOfficeServerUrl,
  type OfficeStatus,
  type OfficeActivity,
} from "@/lib/persist";

const LISTS: { type: MasterType; title: string }[] = [
  { type: "companies", title: "Companies" },
  { type: "portals", title: "Portals" },
  { type: "vehicleModes", title: "Vehicle type" },
  { type: "variants", title: "Variant" },
  { type: "paymentModes", title: "Payment mode" },
];

export default function MastersPage() {
  const {
    data,
    ready,
    offlineDesktop,
    addMaster,
    removeMaster,
    updateFormField,
    addCustomFormField,
    removeFormField,
  } = useStore();

  const [listType, setListType] = useState<MasterType>("companies");
  const [listDraft, setListDraft] = useState("");
  const [newLabel, setNewLabel] = useState("");
  const [newType, setNewType] = useState<FormFieldType>("text");
  const [serverUrl, setServerUrl] = useState("");
  const [serverStatus, setServerStatus] = useState<"idle" | "checking" | "error">("idle");
  const [backupMessage, setBackupMessage] = useState("");
  const [latestBackup, setLatestBackup] = useState("");
  const [backups, setBackups] = useState<{ file: string; createdAt: string }[]>([]);
  const [restoreFile, setRestoreFile] = useState("");
  const [pinConfigured, setPinConfigured] = useState(false);
  const [officeStatus, setOfficeStatus] = useState<OfficeStatus | null>(null);
  const [activity, setActivity] = useState<OfficeActivity[]>([]);
  const [computerLabel, setComputerLabel] = useState("");
  const [accessKey, setAccessKey] = useState("");
  const [startingServer, setStartingServer] = useState(false);
  const [lanUrls, setLanUrls] = useState<string[]>([]);
  const [copiedLan, setCopiedLan] = useState("");

  useEffect(() => {
    if (!offlineDesktop) return;
    void getOfficeLanInfo()
      .then((info) => setLanUrls(info.lanUrls || []))
      .catch(() => undefined);
  }, [offlineDesktop]);

  useEffect(() => {
    const timer = window.setTimeout(() => setServerUrl(getOfficeServerUrl() || ""), 0);
    const labelTimer = window.setTimeout(() => setComputerLabel(getOfficeComputerLabel()), 0);
    const keyTimer = window.setTimeout(() => setAccessKey(getOfficeAccessKey()), 0);
    return () => { window.clearTimeout(timer); window.clearTimeout(labelTimer); window.clearTimeout(keyTimer); };
  }, []);

  useEffect(() => {
    if (!getOfficeServerUrl()) return;
    const refresh = () => void getOfficeActivity().then(setActivity).catch(() => undefined);
    refresh();
    const timer = window.setInterval(refresh, 10000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!getOfficeServerUrl()) return;
    const refresh = () => void getOfficeStatus().then(setOfficeStatus);
    refresh();
    const timer = window.setInterval(refresh, 10000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!getOfficeServerUrl()) return;
    void listOfficeBackups()
      .then((items) => { setBackups(items); setLatestBackup(items[0]?.createdAt || ""); })
      .catch(() => undefined);
    void officeAdminPinConfigured().then(setPinConfigured).catch(() => undefined);
  }, []);

  const formFields = useMemo(
    () => [...(data.formFields || [])].sort((a, b) => a.order - b.order),
    [data.formFields],
  );

  const activeList = data.masters[listType] || [];

  if (!ready) return <p className="text-sm text-slate-600">Loading…</p>;

  return (
    <div>
      <PageHeader
        title="Admin"
        subtitle="Turn form fields on/off, rename them, and manage dropdown lists"
      />

      <Panel className="mb-6">
        <h2 className="mb-1 text-base font-semibold">Shared office connection</h2>
        <p className="mb-4 text-sm text-slate-600">
          Use this on each office computer to connect to the main PC. Example:
          {" "}<code>http://192.168.1.50:3457</code>
        </p>
        {offlineDesktop ? (
          <div className="mb-4 rounded-md bg-teal-50 p-3 text-sm text-[#0f3d3e]">
            <p className="font-medium">Main office PC only</p>
            <p className="mt-1 text-xs">Click once each morning on this main laptop. Keep Insurance Desk open while the other laptop is working. Do not open the address in Chrome — it is not a website.</p>
            <Button type="button" className="mt-2" disabled={startingServer} onClick={() => void (async () => {
              setStartingServer(true);
              try {
                const result = await startOfficeServerOnThisPc();
                const localUrl = result.localUrl || "http://127.0.0.1:3457";
                setServerUrl(localUrl);
                setLanUrls(result.lanUrls || []);
                setServerStatus("idle");
                setOfficeServerUrl(localUrl);
                const other = (result.lanUrls && result.lanUrls[0]) || "";
                alert(
                  other
                    ? `Office Server is running on this laptop.\n\nOn THIS laptop you are connected.\n\nOn the OTHER laptop go to Admin and paste:\n${other}\n\nDo not use localhost on the other laptop.`
                    : "Office Server is running on this laptop. Connect this PC with http://127.0.0.1:3457. On the other laptop use this laptop's Wi-Fi IP, not localhost.",
                );
                window.location.reload();
              } catch (error) {
                alert(error instanceof Error ? error.message : "Could not start Office Server");
              } finally {
                setStartingServer(false);
              }
            })()}>
              {startingServer ? "Starting Office Server…" : "Start Office Server on this PC"}
            </Button>
            {lanUrls.length ? (
              <div className="mt-3 rounded-md border border-teal-200 bg-white p-3 text-sm">
                <p className="font-medium text-slate-900">Address for the other laptop</p>
                <p className="mt-1 text-xs text-slate-600">Paste this in Admin → Main PC address on the second laptop. Never use localhost there.</p>
                {lanUrls.map((url) => (
                  <div key={url} className="mt-2 flex flex-wrap items-center gap-2">
                    <code className="rounded bg-slate-100 px-2 py-1 text-xs">{url}</code>
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={() => {
                        void navigator.clipboard.writeText(url);
                        setCopiedLan(url);
                        window.setTimeout(() => setCopiedLan(""), 2000);
                      }}
                    >
                      {copiedLan === url ? "Copied" : "Copy"}
                    </Button>
                  </div>
                ))}
              </div>
            ) : offlineDesktop ? (
              <p className="mt-3 text-xs text-slate-600">After the server starts, this screen will show a Wi-Fi address such as http://192.168.1.50:3457 for the other laptop.</p>
            ) : null}
          </div>
        ) : null}
        <div className="flex flex-wrap items-end gap-2">
          <Field label="Main PC address">
            <Input
              className="min-w-[17rem]"
              value={serverUrl}
              onChange={(e) => { setServerUrl(e.target.value); setServerStatus("idle"); }}
              placeholder="http://192.168.1.50:3457"
            />
          </Field>
          <Button
            type="button"
            disabled={!serverUrl.trim() || serverStatus === "checking"}
            onClick={() => void (async () => {
              if (!(await requireOfficeAdminPin("change the office connection"))) return;
              setServerStatus("checking");
              const address = serverUrl.trim().replace(/\/$/, "");
              if (!/^https?:\/\//.test(address) || !(await checkOfficeServer(address))) {
                setServerStatus("error");
                return;
              }
              setOfficeServerUrl(address);
              window.location.reload();
            })()}
          >
            {serverStatus === "checking" ? "Connecting…" : "Connect"}
          </Button>
          {getOfficeServerUrl() ? (
            <Button type="button" variant="secondary" onClick={() => {
              void (async () => {
                if (!(await requireOfficeAdminPin("disconnect this computer"))) return;
                if (confirm("Disconnect this computer from the shared office server? Its local copy will remain.")) {
                  setOfficeServerUrl("");
                  window.location.reload();
                }
              })();
            }}>
              Disconnect this PC
            </Button>
          ) : null}
        </div>
        {getOfficeServerUrl() ? (
          <div className="mt-3 flex flex-wrap items-end gap-2">
            <Field label="This computer name">
              <Input className="min-w-[13rem]" value={computerLabel} onChange={(e) => setComputerLabel(e.target.value)} placeholder="Father PC / Brother 1 PC" />
            </Field>
            <Button type="button" variant="secondary" onClick={() => setOfficeComputerLabel(computerLabel)}>Save computer name</Button>
          </div>
        ) : null}
        {getOfficeServerUrl() ? (
          <div className="mt-3 border-t border-slate-100 pt-3">
            <p className="mb-2 text-sm font-medium text-slate-800">Office Access Key</p>
            <p className="mb-2 text-xs text-slate-600">Optional but recommended: use one long secret key on all three office computers to block other devices on the Wi-Fi.</p>
            <div className="flex flex-wrap items-end gap-2">
              <Field label="Access Key">
                <Input className="min-w-[19rem]" type="password" value={accessKey} onChange={(e) => setAccessKey(e.target.value)} placeholder="Paste the same key on each office PC" />
              </Field>
              <Button type="button" variant="secondary" onClick={() => { setOfficeAccessKey(accessKey); alert("Access Key saved on this computer."); }}>
                Use on this PC
              </Button>
              <Button type="button" onClick={() => void (async () => {
                const pin = window.prompt("Enter Admin PIN to enable or change the Office Access Key");
                if (pin === null) return;
                const key = accessKey.trim() || crypto.randomUUID() + crypto.randomUUID();
                setAccessKey(key);
                try {
                  await configureOfficeAccessKey(key, pin);
                  alert("Office Access Key enabled. Copy this same key to the other two PCs using ‘Use on this PC’.");
                } catch (error) {
                  alert(error instanceof Error ? error.message : "Could not enable Office Access Key");
                }
              })()}>
                Enable / change shared key
              </Button>
            </div>
          </div>
        ) : null}
        {serverStatus === "error" ? (
          <p className="mt-3 text-sm text-red-700">Cannot reach the main PC. Check its address, that the Office Server is running, and Windows Firewall.</p>
        ) : getOfficeServerUrl() ? (
          <p className="mt-3 text-sm text-emerald-700">Connected to shared office data: {getOfficeServerUrl()}</p>
        ) : null}
        {getOfficeServerUrl() ? (
          <div className="mt-4 border-t border-slate-100 pt-4">
            <div className="mb-4 rounded-md bg-slate-50 p-3 text-sm text-slate-700">
              <p className="font-medium text-slate-900">
                Office Server: {officeStatus?.ok ? "Running" : "Checking…"}
              </p>
              {officeStatus ? (
                <>
                  <p className="mt-1">Started: {new Date(officeStatus.startedAt).toLocaleString("en-IN")} · Port {officeStatus.port}</p>
                  <p className="mt-1">Connected computers: {officeStatus.clients.length}</p>
                  {officeStatus.clients.length ? (
                    <ul className="mt-1 list-disc pl-5 text-xs">
                      {officeStatus.clients.map((client) => <li key={client.id}>{client.label} · active now</li>)}
                    </ul>
                  ) : null}
                </>
              ) : (
                <p className="mt-1 text-xs">Check that the Office Server is running on the main PC.</p>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button type="button" variant="secondary" onClick={() => void (async () => {
                if (!(await requireOfficeAdminPin("create a manual backup"))) return;
                setBackupMessage("Creating backup…");
                try {
                  const backup = await createOfficeBackup();
                  setLatestBackup(new Date().toISOString());
                  setBackupMessage(`Backup created: ${backup.database}`);
                } catch (error) {
                  setBackupMessage(error instanceof Error ? error.message : "Backup failed");
                }
              })()}>
                Back up shared data now
              </Button>
              {latestBackup ? <span className="text-xs text-slate-600">Latest backup: {new Date(latestBackup).toLocaleString("en-IN")}</span> : null}
            </div>
            {backupMessage ? <p className="mt-2 text-sm text-slate-600">{backupMessage}</p> : null}
            <p className="mt-2 text-xs text-slate-500">The main PC also creates a daily backup at 8:00 PM and keeps the latest 30 days.</p>
            {backups.length ? (
              <div className="mt-4 border-t border-slate-100 pt-4">
                <p className="font-medium text-slate-900">Restore an earlier backup</p>
                <p className="mt-1 text-xs text-amber-700">Restoring replaces the shared data and documents for every office computer. A new safety backup is created first.</p>
                <div className="mt-2 flex flex-wrap items-end gap-2">
                  <Field label="Backup to restore">
                    <Select className="min-w-[17rem]" value={restoreFile} onChange={(event) => setRestoreFile(event.target.value)}>
                      <option value="" disabled>Select a backup</option>
                      {backups.map((backup) => <option key={backup.file} value={backup.file}>{new Date(backup.createdAt).toLocaleString("en-IN")}</option>)}
                    </Select>
                  </Field>
                  <Button type="button" variant="danger" onClick={() => void (async () => {
                    if (!restoreFile) { alert("Choose a backup first."); return; }
                    const pin = window.prompt("Enter Admin PIN to restore this backup");
                    if (pin === null) return;
                    if (!confirm("Restore this backup for all office computers? Current shared data will be replaced.")) return;
                    try {
                      const result = await restoreOfficeBackup(restoreFile, pin);
                      alert(`Backup restored. Safety backup created: ${result.safetyBackup}`);
                      window.location.reload();
                    } catch (error) {
                      alert(error instanceof Error ? error.message : "Restore failed");
                    }
                  })()}>
                    Restore selected backup
                  </Button>
                </div>
              </div>
            ) : null}
            <p className="mt-2 text-xs text-slate-500">To start the server automatically every morning, run <code>scripts\install-office-server-startup.bat</code> once on the main PC.</p>
            <Button type="button" variant="secondary" className="mt-3" onClick={() => void (async () => {
              const current = pinConfigured ? window.prompt("Enter current Admin PIN") : "";
              if (current === null) return;
              const next = window.prompt(pinConfigured ? "Enter new 4–12 digit Admin PIN" : "Create a 4–12 digit Admin PIN");
              if (next === null) return;
              const confirmPin = window.prompt("Enter the new PIN again to confirm");
              if (next !== confirmPin) { alert("PIN confirmation does not match."); return; }
              try {
                await setOfficeAdminPin(next, current);
                setPinConfigured(true);
                alert("Admin PIN saved.");
              } catch (error) {
                alert(error instanceof Error ? error.message : "Could not save Admin PIN");
              }
            })()}>
              {pinConfigured ? "Change Admin PIN" : "Set Admin PIN"}
            </Button>
            <div className="mt-4 border-t border-slate-100 pt-4">
              <p className="font-medium text-slate-900">Recent shared activity</p>
              {activity.length ? (
                <ul className="mt-2 space-y-1 text-xs text-slate-600">
                  {activity.map((entry) => <li key={entry.id}><span className="font-medium text-slate-700">{new Date(entry.createdAt).toLocaleString("en-IN")}</span> · {entry.computer}: {entry.summary}</li>)}
                </ul>
              ) : <p className="mt-1 text-xs text-slate-500">No shared changes recorded yet.</p>}
            </div>
          </div>
        ) : null}
      </Panel>

      <Panel className="mb-6">
        <h2 className="mb-1 text-base font-semibold">Insurance form fields</h2>
        <p className="mb-4 text-sm text-slate-600">
          Tick <strong>Show</strong> to use a field on New insurance. Rename the
          label if you want. Add extra fields at the bottom.
        </p>

        <div className="mb-4 divide-y divide-slate-100 rounded-md border border-slate-200">
          {formFields.map((f) => (
            <div
              key={f.id}
              className="flex flex-wrap items-center gap-3 px-3 py-2.5 text-sm"
            >
              <label className="flex items-center gap-2 min-w-[5.5rem]">
                <input
                  type="checkbox"
                  checked={f.enabled}
                  disabled={Boolean(f.locked)}
                  onChange={(e) =>
                    updateFormField(f.id, { enabled: e.target.checked })
                  }
                />
                <span className="text-slate-600">Show</span>
              </label>
              <Input
                className="min-w-[12rem] flex-1"
                value={f.label}
                onChange={(e) =>
                  updateFormField(f.id, { label: e.target.value })
                }
              />
              {f.custom ? (
                <button
                  type="button"
                  className="text-xs text-red-600"
                  onClick={() => {
                    void (async () => {
                      if (!(await requireOfficeAdminPin("remove an insurance form field"))) return;
                      if (confirm(`Remove “${f.label}”?`)) removeFormField(f.id);
                    })();
                  }}
                >
                  Remove
                </button>
              ) : (
                <span className="text-xs text-slate-400">
                  {f.locked ? "Always on" : f.type}
                </span>
              )}
            </div>
          ))}
        </div>

        <form
          className="flex flex-wrap items-end gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (!newLabel.trim()) return;
            addCustomFormField({ label: newLabel, type: newType });
            setNewLabel("");
          }}
        >
          <Field label="Add new field">
            <Input
              value={newLabel}
              onChange={(e) => setNewLabel(e.target.value)}
              placeholder="e.g. Policy number"
            />
          </Field>
          <Field label="Type">
            <Select
              value={newType}
              onChange={(e) => setNewType(e.target.value as FormFieldType)}
            >
              <option value="text">Text</option>
              <option value="number">Number</option>
              <option value="money">Money</option>
              <option value="date">Date</option>
              <option value="textarea">Long text</option>
            </Select>
          </Field>
          <Button type="submit">Add</Button>
        </form>
      </Panel>

      <Panel>
        <h2 className="mb-1 text-base font-semibold">Dropdown lists</h2>
        <p className="mb-4 text-sm text-slate-600">
          Options for Company, Portal, Vehicle type, etc. on the insurance form.
        </p>

        <div className="mb-4 flex flex-wrap gap-2">
          {LISTS.map((l) => (
            <button
              key={l.type}
              type="button"
              onClick={() => {
                setListType(l.type);
                setListDraft("");
              }}
              className={`rounded-md px-3 py-1.5 text-sm ${
                listType === l.type
                  ? "bg-[#0f3d3e] text-white"
                  : "bg-slate-100 text-slate-700 hover:bg-slate-200"
              }`}
            >
              {l.title}
            </button>
          ))}
        </div>

        <ul className="mb-3 space-y-1">
          {activeList.length === 0 ? (
            <li className="text-sm text-slate-500">No items yet.</li>
          ) : (
            activeList.map((m) => (
              <li
                key={m.id}
                className="flex items-center justify-between gap-2 border-b border-slate-100 py-1.5 text-sm"
              >
                <span>{m.label}</span>
                <button
                  type="button"
                  className="text-xs text-red-600"
                  onClick={() => void (async () => {
                    if (await requireOfficeAdminPin("remove a dropdown option")) removeMaster(listType, m.id);
                  })()}
                >
                  Remove
                </button>
              </li>
            ))
          )}
        </ul>

        <form
          className="flex flex-wrap items-end gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (!listDraft.trim()) return;
            addMaster(listType, listDraft);
            setListDraft("");
          }}
        >
          <Field
            label={`Add to ${LISTS.find((l) => l.type === listType)?.title}`}
          >
            <Input
              value={listDraft}
              onChange={(e) => setListDraft(e.target.value)}
              placeholder="Type and add"
            />
          </Field>
          <Button type="submit">Add</Button>
        </form>
      </Panel>
    </div>
  );
}
