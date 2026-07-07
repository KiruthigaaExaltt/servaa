import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  type ReactNode,
} from "react";
import { useCollectionState } from "@/lib/collectionState";
import { changeAdminPin } from "@/lib/authApi";

export interface TaxSettings {
  cgstPct: number;
  sgstPct: number;
}

export interface StoreProfile {
  name: string;
  gstin: string;
  address: string;
  phone: string;
}

export interface KDSStation {
  id: string;
  label: string;
  builtIn: boolean;
}

const GSTIN_RE = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;

interface SettingsContextValue {
  tax: TaxSettings;
  setTax: (patch: Partial<TaxSettings>) => void;
  storeProfile: StoreProfile;
  setStoreProfile: (patch: Partial<StoreProfile>) => { ok: boolean; error?: string };
  stations: KDSStation[];
  addStation: (label: string) => void;
  renameStation: (id: string, label: string) => void;
  removeStation: (id: string) => void;
  changePin: (currentPin: string, newPin: string) => Promise<boolean>;
  nextInvoiceNumber: () => string;
}

const SettingsContext = createContext<SettingsContextValue | null>(null);

const DEFAULT_STATIONS: KDSStation[] = [
  { id: "Hot", label: "Tandoor / Hot Station", builtIn: true },
  { id: "Cold", label: "Cold Station", builtIn: true },
  { id: "Bar", label: "Bar", builtIn: true },
];

const DEFAULT_TAX: TaxSettings = { cgstPct: 2.5, sgstPct: 2.5 };

const DEFAULT_PROFILE: StoreProfile = {
  name: "Servaa Restaurant",
  gstin: "29ABCDE1234F1Z5",
  address: "123 Main Street, Bangalore â€“ 560001",
  phone: "+91 98765 43210",
};

function clampTax(val: number): number {
  return Math.min(50, Math.max(0, isFinite(val) ? val : 0));
}

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [tax, setTaxState] = useCollectionState<TaxSettings>("settings_tax", DEFAULT_TAX);
  const [storeProfile, setStoreProfileState] = useCollectionState<StoreProfile>(
    "settings_profile",
    DEFAULT_PROFILE,
  );
  const [stations, setStations] = useCollectionState<KDSStation[]>(
    "settings_stations",
    DEFAULT_STATIONS,
  );
  const [invoiceSeq, setInvoiceSeq] = useCollectionState<number>("invoice_seq", 0);
  const invoiceSeqRef = useRef(invoiceSeq);

  const setTax = useCallback((patch: Partial<TaxSettings>) => {
    setTaxState((prev) => ({
      cgstPct: patch.cgstPct !== undefined ? clampTax(patch.cgstPct) : prev.cgstPct,
      sgstPct: patch.sgstPct !== undefined ? clampTax(patch.sgstPct) : prev.sgstPct,
    }));
  }, [setTaxState]);

  const setStoreProfile = useCallback(
    (patch: Partial<StoreProfile>): { ok: boolean; error?: string } => {
      const next = { ...storeProfile, ...patch };
      if (patch.name !== undefined && next.name.trim() === "") {
        return { ok: false, error: "Outlet name cannot be empty â€” it appears on every invoice." };
      }
      if (patch.gstin !== undefined && next.gstin.trim() !== "" && !GSTIN_RE.test(next.gstin.trim())) {
        return { ok: false, error: "GSTIN must be a valid 15-character alphanumeric format (e.g. 29ABCDE1234F1Z5)." };
      }
      setStoreProfileState(next);
      return { ok: true };
    },
    [storeProfile, setStoreProfileState],
  );

  const addStation = useCallback((label: string) => {
    setStations((prev) => [
      ...prev,
      { id: `stn-${Date.now()}`, label, builtIn: false },
    ]);
  }, [setStations]);

  const renameStation = useCallback((id: string, label: string) => {
    setStations((prev) =>
      prev.map((s) => (s.id === id ? { ...s, label } : s)),
    );
  }, [setStations]);

  const removeStation = useCallback((id: string) => {
    setStations((prev) => prev.filter((s) => s.id !== id || s.builtIn));
  }, [setStations]);

  const changePin = useCallback((currentPin: string, newPin: string) => {
    if (!/^\d{4,12}$/.test(newPin)) return Promise.resolve(false);
    return changeAdminPin(currentPin, newPin);
  }, []);

  const nextInvoiceNumber = useCallback((): string => {
    invoiceSeqRef.current += 1;
    const seq = invoiceSeqRef.current;
    setInvoiceSeq(seq);
    const now = new Date();
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, "0");
    const dd = String(now.getDate()).padStart(2, "0");
    return `INV-${yyyy}${mm}${dd}-${String(seq).padStart(4, "0")}`;
  }, [setInvoiceSeq]);

  const value = useMemo<SettingsContextValue>(
    () => ({
      tax,
      setTax,
      storeProfile,
      setStoreProfile,
      stations,
      addStation,
      renameStation,
      removeStation,
      changePin,
      nextInvoiceNumber,
    }),
    [
      tax,
      setTax,
      storeProfile,
      setStoreProfile,
      stations,
      addStation,
      renameStation,
      removeStation,
      changePin,
      nextInvoiceNumber,
    ],
  );

  return (
    <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>
  );
}

export function useSettings(): SettingsContextValue {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error("useSettings must be used within SettingsProvider");
  return ctx;
}
