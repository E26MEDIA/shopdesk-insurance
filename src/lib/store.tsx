"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type {
  Adjustment,
  AppData,
  Client,
  Expense,
  FormFieldDef,
  FormFieldType,
  MasterItem,
  MasterType,
  Policy,
  PucEntry,
  Vehicle,
} from "./types";
import { unionDeletedIds, withoutDeletedPolicies, hasExtraDeletedIds } from "./deletedRecords";
import { heartbeatOffice, isOfflineDesktop, loadAppData, pollOfficeData, saveAppData } from "./persist";
import { dateKey, emptyData, STORAGE_KEY, todayISO, uid } from "./utils";

type Store = {
  data: AppData;
  ready: boolean;
  offlineDesktop: boolean;
  addClient: (input: Omit<Client, "id" | "createdAt">) => Client;
  updateClient: (id: string, patch: Partial<Client>) => void;
  deleteClient: (id: string) => void;
  addVehicle: (input: Omit<Vehicle, "id" | "createdAt">) => Vehicle;
  updateVehicle: (id: string, patch: Partial<Vehicle>) => void;
  deleteVehicle: (id: string) => void;
  addPolicy: (input: Omit<Policy, "id" | "createdAt">) => Policy;
  updatePolicy: (id: string, patch: Partial<Policy>) => void;
  confirmPolicy: (id: string) => void;
  deletePolicy: (id: string) => Promise<void>;
  deletePolicies: (ids: string[]) => Promise<void>;
  addPuc: (input: Omit<PucEntry, "id" | "createdAt">) => PucEntry;
  updatePuc: (id: string, patch: Partial<PucEntry>) => void;
  deletePuc: (id: string) => void;
  setTodayPucAmount: (amount: number, notes?: string, date?: string) => void;
  addExpense: (input: Omit<Expense, "id" | "createdAt">) => Expense;
  deleteExpense: (id: string) => void;
  addAdjustment: (input: Omit<Adjustment, "id" | "createdAt">) => Adjustment;
  deleteAdjustment: (id: string) => void;
  addMaster: (type: MasterType, label: string) => void;
  removeMaster: (type: MasterType, id: string) => void;
  updateFormField: (id: string, patch: Partial<FormFieldDef>) => void;
  addCustomFormField: (input: {
    label: string;
    type: FormFieldType;
    required?: boolean;
  }) => void;
  removeFormField: (id: string) => void;
  moveFormField: (id: string, direction: "up" | "down") => void;
  seedSampleData: () => void;
  resetDemo: () => void;
};

const StoreContext = createContext<Store | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<AppData>(emptyData);
  const [ready, setReady] = useState(false);
  const [offlineDesktop, setOfflineDesktop] = useState(false);
  /** Block saves until first load finishes — prevents wiping localStorage */
  const allowSaveRef = useRef(false);
  const skipNextSaveRef = useRef(false);
  const dataRef = useRef<AppData>(emptyData());
  const loadGenRef = useRef(0);

  const persist = useCallback(async (next: AppData) => {
    if (!allowSaveRef.current) {
      await new Promise<void>((resolve) => queueMicrotask(resolve));
    }
    if (!allowSaveRef.current) return false;
    return saveAppData(next);
  }, []);

  const applyRemote = useCallback((remote: AppData) => {
    const deletedPolicyIds = unionDeletedIds(
      dataRef.current.deletedPolicyIds,
      remote.deletedPolicyIds,
    );
    const next: AppData = {
      ...remote,
      deletedPolicyIds,
      policies: withoutDeletedPolicies(remote.policies, deletedPolicyIds),
    };
    const pushDeletes = hasExtraDeletedIds(deletedPolicyIds, remote.deletedPolicyIds);
    dataRef.current = next;
    skipNextSaveRef.current = true;
    setData(next);
    if (pushDeletes && allowSaveRef.current) {
      void persist(next);
    }
  }, [persist]);

  useEffect(() => {
    const gen = ++loadGenRef.current;
    let cancelled = false;
    (async () => {
      try {
        setOfflineDesktop(isOfflineDesktop());
        const loaded = await loadAppData();
        if (cancelled || gen !== loadGenRef.current) return;
        dataRef.current = loaded;
        skipNextSaveRef.current = !(loaded.deletedPolicyIds || []).length;
        setData(loaded);
      } catch (err) {
        console.error("ShopDesk load failed", err);
      } finally {
        if (!cancelled && gen === loadGenRef.current) {
          // Enable saves before ready so the persist effect can push tombstones.
          allowSaveRef.current = true;
          setReady(true);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Other office computers save to the same server. Refresh this screen when
  // the server revision changes; no internet is involved.
  useEffect(() => {
    if (!ready) return;
    const timer = window.setInterval(() => {
      void pollOfficeData().then((remote) => {
        if (!remote) return;
        applyRemote(remote);
      });
    }, 2500);
    return () => window.clearInterval(timer);
  }, [ready, applyRemote]);

  useEffect(() => {
    if (!ready) return;
    const send = () => void heartbeatOffice().catch(() => undefined);
    send();
    const timer = window.setInterval(send, 10000);
    return () => window.clearInterval(timer);
  }, [ready]);

  useEffect(() => {
    const onMerged = (event: Event) => {
      const remote = (event as CustomEvent<AppData>).detail;
      if (!remote) return;
      applyRemote(remote);
    };
    window.addEventListener("shopdesk:office-merged", onMerged);
    return () => window.removeEventListener("shopdesk:office-merged", onMerged);
  }, [applyRemote]);

  useEffect(() => {
    if (!ready || !allowSaveRef.current) return;
    if (skipNextSaveRef.current) {
      skipNextSaveRef.current = false;
      return;
    }
    persist(data);
  }, [data, ready, persist]);

  // Apply + persist outside React's setState updater. Save immediately so a
  // Delete + navigate cannot lose the write before React's effect runs.
  const set = useCallback(
    (fn: (prev: AppData) => AppData) => {
      const next = fn(dataRef.current);
      dataRef.current = next;
      skipNextSaveRef.current = true;
      setData(next);
      void persist(next);
      return next;
    },
    [persist],
  );

  const setAndSave = useCallback(
    async (fn: (prev: AppData) => AppData) => {
      const next = fn(dataRef.current);
      dataRef.current = next;
      skipNextSaveRef.current = true;
      setData(next);
      const saved = await persist(next);
      if (!saved) {
        throw new Error("Could not save the delete. Check the office server and try again.");
      }
      return next;
    },
    [persist],
  );

  const value = useMemo<Store>(
    () => ({
      data,
      ready,
      offlineDesktop,
      addClient: (input) => {
        const client: Client = {
          ...input,
          id: uid("cli"),
          createdAt: new Date().toISOString(),
        };
        set((d) => ({ ...d, clients: [client, ...d.clients] }));
        return client;
      },
      updateClient: (id, patch) =>
        set((d) => ({
          ...d,
          clients: d.clients.map((c) => (c.id === id ? { ...c, ...patch } : c)),
        })),
      deleteClient: (id) =>
        set((d) => ({
          ...d,
          clients: d.clients.filter((c) => c.id !== id),
          vehicles: d.vehicles.filter((v) => v.clientId !== id),
        })),
      addVehicle: (input) => {
        const vehicle: Vehicle = {
          ...input,
          id: uid("veh"),
          createdAt: new Date().toISOString(),
        };
        set((d) => ({ ...d, vehicles: [vehicle, ...d.vehicles] }));
        return vehicle;
      },
      updateVehicle: (id, patch) =>
        set((d) => ({
          ...d,
          vehicles: d.vehicles.map((v) => (v.id === id ? { ...v, ...patch } : v)),
        })),
      deleteVehicle: (id) =>
        set((d) => ({
          ...d,
          vehicles: d.vehicles.filter((v) => v.id !== id),
        })),
      addPolicy: (input) => {
        const policy: Policy = {
          ...input,
          customFields: { ...(input.customFields || {}) },
          id: uid("pol"),
          createdAt: new Date().toISOString(),
        };
        set((d) => ({ ...d, policies: [policy, ...d.policies] }));
        return policy;
      },
      updatePolicy: (id, patch) =>
        set((d) => ({
          ...d,
          policies: d.policies.map((p) =>
            p.id === id
              ? {
                  ...p,
                  ...patch,
                  confirmed:
                    patch.confirmed !== undefined
                      ? Boolean(patch.confirmed)
                      : Boolean(p.confirmed),
                  customFields: {
                    ...(p.customFields || {}),
                    ...(patch.customFields || {}),
                  },
                }
              : p,
          ),
        })),
      confirmPolicy: (id) =>
        set((d) => ({
          ...d,
          policies: d.policies.map((p) =>
            p.id === id ? { ...p, confirmed: true } : p,
          ),
        })),
      deletePolicy: async (id) => {
        await setAndSave((d) => ({
          ...d,
          policies: d.policies.filter((p) => p.id !== id),
          deletedPolicyIds: unionDeletedIds(d.deletedPolicyIds, [id]),
        }));
      },
      deletePolicies: async (ids) => {
        const remove = new Set(ids.filter(Boolean));
        if (!remove.size) return;
        await setAndSave((d) => ({
          ...d,
          policies: d.policies.filter((p) => !remove.has(p.id)),
          deletedPolicyIds: unionDeletedIds(d.deletedPolicyIds, [...remove]),
        }));
      },
      addPuc: (input) => {
        const entry: PucEntry = {
          ...input,
          id: uid("puc"),
          createdAt: new Date().toISOString(),
        };
        set((d) => ({ ...d, pucEntries: [entry, ...d.pucEntries] }));
        return entry;
      },
      updatePuc: (id, patch) =>
        set((d) => ({
          ...d,
          pucEntries: d.pucEntries.map((p) =>
            p.id === id ? { ...p, ...patch } : p,
          ),
        })),
      deletePuc: (id) =>
        set((d) => ({
          ...d,
          pucEntries: d.pucEntries.filter((p) => p.id !== id),
        })),
      setTodayPucAmount: (amount, notes = "", date) => {
        const day = dateKey(date) || todayISO();
        set((d) => {
          const existing = d.pucEntries.find(
            (p) => p.date === day && p.notes === "Daily PUC total",
          );
          if (existing) {
            return {
              ...d,
              pucEntries: d.pucEntries.map((p) =>
                p.id === existing.id
                  ? { ...p, amount, notes: notes || p.notes }
                  : p,
              ),
            };
          }
          const entry: PucEntry = {
            id: uid("puc"),
            date: day,
            clientName: "",
            regNo: "",
            vehicleMode: "",
            amount,
            notes: notes || "Daily PUC total",
            createdAt: new Date().toISOString(),
          };
          return { ...d, pucEntries: [entry, ...d.pucEntries] };
        });
      },
      addExpense: (input) => {
        const expense: Expense = {
          ...input,
          id: uid("exp"),
          createdAt: new Date().toISOString(),
        };
        set((d) => ({ ...d, expenses: [expense, ...(d.expenses || [])] }));
        return expense;
      },
      deleteExpense: (id) =>
        set((d) => ({
          ...d,
          expenses: (d.expenses || []).filter((e) => e.id !== id),
        })),
      addAdjustment: (input) => {
        const adj: Adjustment = {
          ...input,
          id: uid("adj"),
          createdAt: new Date().toISOString(),
        };
        set((d) => ({
          ...d,
          adjustments: [adj, ...(d.adjustments || [])],
        }));
        return adj;
      },
      deleteAdjustment: (id) =>
        set((d) => ({
          ...d,
          adjustments: (d.adjustments || []).filter((a) => a.id !== id),
        })),
      addMaster: (type, label) => {
        const item: MasterItem = { id: uid("m"), label: label.trim() };
        if (!item.label) return;
        set((d) => ({
          ...d,
          masters: {
            ...d.masters,
            [type]: [...d.masters[type], item],
          },
        }));
      },
      removeMaster: (type, id) =>
        set((d) => ({
          ...d,
          masters: {
            ...d.masters,
            [type]: d.masters[type].filter((m) => m.id !== id),
          },
        })),
      updateFormField: (id, patch) =>
        set((d) => ({
          ...d,
          formFields: d.formFields.map((f) => {
            if (f.id !== id) return f;
            const next = { ...f, ...patch, id: f.id, key: f.key };
            if (f.locked) {
              next.enabled = true;
              next.locked = true;
            }
            return next;
          }),
        })),
      addCustomFormField: ({ label, type, required }) => {
        const trimmed = label.trim();
        if (!trimmed) return;
        const key = `custom_${uid("col").replace(/^col_/, "")}`;
        set((d) => {
          const maxOrder = d.formFields.reduce(
            (m, f) => Math.max(m, f.order),
            0,
          );
          const field: FormFieldDef = {
            id: uid("ff"),
            key,
            label: trimmed,
            type,
            enabled: true,
            required: Boolean(required),
            custom: true,
            order: maxOrder + 10,
          };
          return { ...d, formFields: [...d.formFields, field] };
        });
      },
      removeFormField: (id) =>
        set((d) => {
          const field = d.formFields.find((f) => f.id === id);
          if (!field || field.locked || !field.custom) return d;
          return {
            ...d,
            formFields: d.formFields.filter((f) => f.id !== id),
          };
        }),
      moveFormField: (id, direction) =>
        set((d) => {
          const sorted = [...d.formFields].sort((a, b) => a.order - b.order);
          const idx = sorted.findIndex((f) => f.id === id);
          if (idx < 0) return d;
          const swapWith = direction === "up" ? idx - 1 : idx + 1;
          if (swapWith < 0 || swapWith >= sorted.length) return d;
          const a = sorted[idx];
          const b = sorted[swapWith];
          const orderA = a.order;
          sorted[idx] = { ...a, order: b.order };
          sorted[swapWith] = { ...b, order: orderA };
          return { ...d, formFields: sorted };
        }),
      seedSampleData: () => {
        const day = todayISO();
        set((d) => {
          const samples: Policy[] = [
            {
              id: uid("pol"),
              clientName: "Ramesh Kumar",
              phone: "9876543210",
              contact: "",
              regNo: "KA05MJ4821",
              rcNumber: "RC4821",
              date: day,
              description: "Comprehensive",
              customerSidePayment: 10500,
              received: 10500,
              payment: 10700,
              expiryDate: "2027-08-01",
              discount: 200,
              payoutType: "",
              vehicleMode: "4 Wheeler",
              variant: "Petrol",
              portal: "PolicyBazaar",
              company: "ICICI Lombard",
              paymentMode: "UPI",
              points: 0,
              customerPayments: [{ id: "pay_sample_1", mode: "UPI", amount: 10500 }],
              renewal: false,
              paid: false,
              companyOfferPercent: 7,
              tdsPercent: 2,
              companyOffer: 7,
              netPremium: 9800,
              pendingNotes: "",
              documents: [],
              customFields: {},
              confirmed: true,
              createdAt: new Date().toISOString(),
            },
            {
              id: uid("pol"),
              clientName: "Sita Devi",
              phone: "9988776655",
              contact: "Husband",
              regNo: "KA01AB2290",
              rcNumber: "",
              date: day,
              description: "Third party",
              customerSidePayment: 3200,
              received: 2000,
              payment: 3000,
              expiryDate: "2027-07-15",
              discount: 0,
              payoutType: "",
              vehicleMode: "2 Wheeler",
              variant: "Petrol",
              portal: "Offline / Direct",
              company: "Bajaj Allianz",
              paymentMode: "Cash + Credit",
              points: 0,
              customerPayments: [
                { id: "pay_sample_2", mode: "Cash", amount: 2000 },
                { id: "pay_sample_2c", mode: "Credit", amount: 1200 },
              ],
              renewal: false,
              paid: false,
              companyOfferPercent: 10,
              tdsPercent: 2,
              companyOffer: 10,
              netPremium: 2800,
              pendingNotes: "RC copy pending",
              documents: [],
              customFields: {},
              confirmed: false,
              createdAt: new Date().toISOString(),
            },
            {
              id: uid("pol"),
              clientName: "Arjun Motors",
              phone: "9123456780",
              contact: "Office",
              regNo: "KA03CD7788",
              rcNumber: "RC7788",
              date: day,
              description: "Commercial package",
              customerSidePayment: 18500,
              received: 18500,
              payment: 19000,
              expiryDate: "2027-08-01",
              discount: 500,
              payoutType: "",
              vehicleMode: "Commercial",
              variant: "Diesel",
              portal: "Company Portal",
              company: "HDFC Ergo",
              paymentMode: "Bank Transfer",
              points: 0,
              customerPayments: [{ id: "pay_sample_3", mode: "Bank Transfer", amount: 18500 }],
              renewal: false,
              paid: false,
              companyOfferPercent: 8,
              tdsPercent: 2,
              companyOffer: 8,
              netPremium: 16500,
              pendingNotes: "",
              documents: [],
              customFields: {},
              confirmed: true,
              createdAt: new Date().toISOString(),
            },
          ];
          const puc = {
            id: uid("puc"),
            date: day,
            clientName: "",
            regNo: "",
            vehicleMode: "",
            amount: 2400,
            notes: "Daily PUC total",
            createdAt: new Date().toISOString(),
          };
          const officeExpense = {
            id: uid("exp"),
            date: day,
            amount: 500,
            sign: "-" as const,
            description: "Office tea / misc",
            category: "office" as const,
            createdAt: new Date().toISOString(),
          };
          const houseExpense = {
            id: uid("exp"),
            date: day,
            amount: 1200,
            sign: "-" as const,
            description: "House rent",
            category: "house" as const,
            createdAt: new Date().toISOString(),
          };
          return {
            ...d,
            policies: [...samples, ...d.policies],
            pucEntries: [
              puc,
              ...d.pucEntries.filter(
                (p) => !(p.date === day && p.notes === "Daily PUC total"),
              ),
            ],
            expenses: [houseExpense, officeExpense, ...(d.expenses || [])],
          };
        });
      },
      resetDemo: () => {
        allowSaveRef.current = true;
        const cleared = emptyData();
        dataRef.current = cleared;
        setData(cleared);
        // Force wipe even though guard blocks empty overwrite
        try {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(cleared));
        } catch {
          /* ignore */
        }
      },
    }),
    [data, ready, offlineDesktop, set, setAndSave],
  );

  return (
    <StoreContext.Provider value={value}>{children}</StoreContext.Provider>
  );
}

export function useStore() {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error("useStore must be used inside StoreProvider");
  return ctx;
}
