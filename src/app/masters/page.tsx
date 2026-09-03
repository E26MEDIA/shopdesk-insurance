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
import { useSoftwareUpdate } from "@/components/UpdatePopup";
import type { FormFieldType, MasterType } from "@/lib/types";
import {
  checkOfficeServer,
  configureOfficeAccessKey,
  createOfficeBackup,
  discoverOfficeServers,
  getOfficeStatus,
  getOfficeActivity,
  getOfficeAccessKey,
  getOfficeComputerLabel,
  getOfficeLanInfo,
  getOfficeServerUrl,
  isLoopbackOfficeUrl,
  listOfficeBackups,
  restoreOfficeBackup,
  normalizeOfficeServerUrl,
  officeAdminPinConfigured,
  requireOfficeAdminPin,
  setOfficeAdminPin,
  setOfficeAccessKey,
  setOfficeComputerLabel,
  startOfficeServerOnThisPc,
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
  const {
    update,
    currentVersion,
    checking,
    checkNow,
    openModal,
    downloadUpdate,
  } = useSoftwareUpdate();

  const [listType, setListType] = useState<MasterType>("companies");
  const [listDraft, setListDraft] = useState("");
  const [newLabel, setNewLabel] = useState("");
  const [newType, setNewType] = useState<FormFieldType>("text");
  const [serverUrl, setServerUrl] = useState("");
  const [serverStatus, setServerStatus] = useState<"idle" | "checking" | "error">("idle");
  const [connectError, setConnectError] = useState("");
  const [lanUrls, setLanUrls] = useState<string[]>([]);
  const [copiedUrl, setCopiedUrl] = useState("");
  const [discovering, setDiscovering] = useState(false);
  const [firewallOpened, setFirewallOpened] = useState<boolean | null>(null);
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

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.sessionStorage.getItem("shopdesk-office-firewall") === "blocked") {
      setFirewallOpened(false);
    }
  }, []);

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

  useEffect(() => {
    if (!offlineDesktop || !isLoopbackOfficeUrl(getOfficeServerUrl() || "")) return;
    const refresh = () => {
      void getOfficeLanInfo().then((info) => {
        if (info?.urls?.length) setLanUrls(info.urls);
      }).catch(() => undefined);
    };
    refresh();
    const timer = window.setInterval(refresh, 10000);
    return () => window.clearInterval(timer);
  }, [offlineDesktop]);

  useEffect(() => {
    if (!isLoopbackOfficeUrl(getOfficeServerUrl() || "")) return;
    if (!officeStatus?.urls?.length) return;
    setLanUrls(officeStatus.urls);
  }, [officeStatus]);

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
        <h2 className="mb-1 text-base font-semibold">Software updates</h2>
        <p className="mb-3 text-sm text-slate-600">
          Insurance Desk checks the E26 website for a new installer and shows a
          popup when one is published.
        </p>
        <p className="text-sm text-slate-700">
          This computer: <span className="font-medium">v{currentVersion}</span>
          {update?.error ? (
            <> · Could not reach the update server</>
          ) : update?.available && update.latestVersion ? (
            <>
              {" "}
              · New:{" "}
              <span className="font-medium text-[#0f3d3e]">
                v{update.latestVersion}
              </span>
            </>
          ) : checking && !update ? (
            <> · Checking…</>
          ) : (
            <> · Up to date</>
          )}
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button
            type="button"
            variant="secondary"
            disabled={checking}
            onClick={() => void checkNow()}
          >
            {checking ? "Checking…" : "Check for updates"}
          </Button>
          {update?.available ? (
            <>
              <Button type="button" onClick={openModal}>
                View update
              </Button>
              <Button type="button" variant="secondary" onClick={downloadUpdate}>
                Download
              </Button>
            </>
          ) : null}
        </div>
      </Panel>

      <Panel className="mb-6">
        <h2 className="mb-1 text-base font-semibold">Shared office connection</h2>
        <p className="mb-4 text-sm text-slate-600">
          Start the Office Server on the main PC, then on every other computer enter that PC's Wi-Fi address
          — not localhost. Example:{" "}
          <code>{lanUrls[0] || "http://192.168.1.50:3457"}</code>
        </p>
        {offlineDesktop ? (
          <div className="mb-4 rounded-md bg-teal-50 p-3 text-sm text-[#0f3d3e]">
            <p className="font-medium">Main office PC only</p>
            <p className="mt-1 text-xs">Click once each morning to run the shared Office Server from this installed app. Keep ShopDesk open on this PC while the office is working.</p>
            <Button type="button" className="mt-2" disabled={startingServer} onClick={() => void (async () => {
              setStartingServer(true);
              setConnectError("");
              try {
                const result = await startOfficeServerOnThisPc();
                const localUrl = result.localUrl || "http://127.0.0.1:3457";
                setLanUrls(result.urls || []);
                setFirewallOpened(result.firewallOpened ?? null);
                if (result.firewallOpened === false) {
                  window.sessionStorage.setItem("shopdesk-office-firewall", "blocked");
                } else {
                  window.sessionStorage.removeItem("shopdesk-office-firewall");
                }
                setServerUrl(localUrl);
                setServerStatus("idle");
                setOfficeServerUrl(localUrl);
                const other = (result.urls && result.urls[0]) || "the Wi-Fi address shown below";
                alert(
                  result.started
                    ? `Office Server started on this PC.\n\nOn the other laptop, open Admin and connect to:\n${other}\n\nDo not type localhost on the other laptop.`
                    : `Office Server is already running on this PC.\n\nOn the other laptop, connect to:\n${other}`,
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
          </div>
        ) : null}
        {offlineDesktop && isLoopbackOfficeUrl(getOfficeServerUrl() || "") && lanUrls.length ? (
          <div className="mb-4 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950">
            <p className="font-medium">Address for the other laptop</p>
            <p className="mt-1 text-xs">Type this on the second computer. localhost / 127.0.0.1 only works on this main PC.</p>
            <ul className="mt-2 space-y-1">
              {lanUrls.map((url) => (
                <li key={url} className="flex flex-wrap items-center gap-2">
                  <code className="rounded bg-white px-2 py-1 text-sm">{url}</code>
                  <Button type="button" variant="secondary" onClick={() => {
                    void navigator.clipboard.writeText(url).then(() => {
                      setCopiedUrl(url);
                      window.setTimeout(() => setCopiedUrl(""), 2000);
                    }).catch(() => undefined);
                  }}>
                    {copiedUrl === url ? "Copied" : "Copy"}
                  </Button>
                </li>
              ))}
            </ul>
            {firewallOpened === false ? (
              <p className="mt-2 text-xs text-red-800">Windows Firewall may still be blocking port 3457. On the main PC, allow ShopDesk / port 3457 for Private and Public networks, then try Connect again on the laptop.</p>
            ) : (
              <p className="mt-2 text-xs">Both computers must be on the same Wi-Fi. Keep ShopDesk open on this main PC.</p>
            )}
          </div>
        ) : null}
        <div className="flex flex-wrap items-end gap-2">
          <Field label="Main PC address">
            <Input
              className="min-w-[17rem]"
              value={serverUrl}
              onChange={(e) => { setServerUrl(e.target.value); setServerStatus("idle"); setConnectError(""); }}
              placeholder={lanUrls[0] || "192.168.1.50 or http://192.168.1.50:3457"}
            />
          </Field>
          <Button
            type="button"
            disabled={!serverUrl.trim() || serverStatus === "checking"}
            onClick={() => void (async () => {
              if (!(await requireOfficeAdminPin("change the office connection"))) return;
              setServerStatus("checking");
              setConnectError("");
              const address = normalizeOfficeServerUrl(serverUrl);
              setServerUrl(address || serverUrl.trim());
              const result = await checkOfficeServer(address || serverUrl);
              if (!result.ok) {
                setServerStatus("error");
                setConnectError(result.error || "Cannot reach the main PC.");
                if (result.urls?.length) setLanUrls(result.urls);
                return;
              }
              if (result.urls?.length) setLanUrls(result.urls);
              setOfficeServerUrl(result.url || address);
              window.location.reload();
            })()}
          >
            {serverStatus === "checking" ? "Connecting…" : "Connect"}
          </Button>
          {offlineDesktop ? (
            <Button type="button" variant="secondary" disabled={discovering} onClick={() => void (async () => {
              setDiscovering(true);
              setConnectError("");
              try {
                const found = await discoverOfficeServers();
                const urls = [...new Set(found.flatMap((item) => item.urls || [item.url]).filter(Boolean))];
                const remote = urls.filter((url) => !isLoopbackOfficeUrl(url));
                const pick = remote[0] || urls[0];
                if (!pick) {
                  setServerStatus("error");
                  setConnectError("No office server found on this Wi-Fi. On the main PC click Start Office Server, keep ShopDesk open, and allow port 3457 in Windows Firewall.");
                  return;
                }
                setLanUrls(remote.length ? remote : urls);
                setServerUrl(pick);
                setServerStatus("idle");
              } catch (error) {
                setServerStatus("error");
                setConnectError(error instanceof Error ? error.message : "Could not search the office network");
              } finally {
                setDiscovering(false);
              }
            })()}>
              {discovering ? "Searching Wi-Fi…" : "Find the main PC"}
            </Button>
          ) : null}
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
          <p className="mt-3 text-sm text-red-700">{connectError || "Cannot reach the main PC. Check its address, that the Office Server is running, and Windows Firewall."}</p>
        ) : getOfficeServerUrl() ? (
          <p className="mt-3 text-sm text-emerald-700">
            Connected to shared office data: {getOfficeServerUrl()}
            {isLoopbackOfficeUrl(getOfficeServerUrl() || "") && lanUrls[0]
              ? ` — other computers must use ${lanUrls[0]}`
              : ""}
          </p>
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
                  {officeStatus.urls?.length ? (
                    <p className="mt-1">Other computers: {officeStatus.urls.join(" · ")}</p>
                  ) : null}
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
