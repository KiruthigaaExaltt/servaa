import { useState } from "react";
import {
  Store,
  Receipt,
  ChefHat,
  Shield,
  Save,
  Plus,
  Trash2,
  Pencil,
  Check,
  X,
  Eye,
  EyeOff,
} from "lucide-react";
import { useSettings, type KDSStation } from "@/context/SettingsContext";

type TabId = "profile" | "tax" | "stations" | "security";

const TABS: { id: TabId; label: string; icon: typeof Store }[] = [
  { id: "profile", label: "Store Profile", icon: Store },
  { id: "tax", label: "Tax & Billing", icon: Receipt },
  { id: "stations", label: "Kitchen Stations", icon: ChefHat },
  { id: "security", label: "Security", icon: Shield },
];

/* ─── helpers ─────────────────────────────────────────────────────────── */

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1">
      <label className="block text-sm font-semibold text-gray-700">{label}</label>
      {children}
      {hint && <p className="text-[11px] text-gray-400">{hint}</p>}
    </div>
  );
}

function Input({
  value,
  onChange,
  placeholder,
  type = "text",
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
}) {
  return (
    <input
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100"
    />
  );
}

function NumberInput({
  value,
  onChange,
  min = 0,
  max = 50,
  step = 0.5,
}: {
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  step?: number;
}) {
  return (
    <input
      type="number"
      min={min}
      max={max}
      step={step}
      value={value}
      onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
      className="w-28 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-bold tabular-nums text-gray-900 shadow-sm outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100"
    />
  );
}

/* ─── Tab: Store Profile ───────────────────────────────────────────────── */

function ProfileTab() {
  const { storeProfile, setStoreProfile } = useSettings();
  const [draft, setDraft] = useState({ ...storeProfile });
  const [saved, setSaved] = useState(false);

  const isDirty =
    draft.name !== storeProfile.name ||
    draft.gstin !== storeProfile.gstin ||
    draft.address !== storeProfile.address ||
    draft.phone !== storeProfile.phone;

  const onSave = async () => {
    setStoreProfile(draft);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-base font-extrabold text-gray-900">Store Profile</h2>
        <p className="mt-0.5 text-sm text-gray-500">
          These details print on every digital invoice.
        </p>
      </div>

      <div className="space-y-4">
        <Field label="Outlet Name" hint="Appears as the heading on printed bills.">
          <Input
            value={draft.name}
            onChange={(v) => setDraft((d) => ({ ...d, name: v }))}
            placeholder="e.g. Servaa Restaurant"
          />
        </Field>

        <Field label="GSTIN" hint="15-character GST Identification Number.">
          <Input
            value={draft.gstin}
            onChange={(v) => setDraft((d) => ({ ...d, gstin: v.toUpperCase() }))}
            placeholder="29ABCDE1234F1Z5"
          />
        </Field>

        <Field label="Address" hint="Full outlet address for the invoice footer.">
          <textarea
            value={draft.address}
            onChange={(e) => setDraft((d) => ({ ...d, address: e.target.value }))}
            rows={2}
            placeholder="123 Main Street, Bangalore – 560001"
            className="w-full resize-none rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100"
          />
        </Field>

        <Field label="Primary Contact Phone">
          <Input
            value={draft.phone}
            onChange={(v) => setDraft((d) => ({ ...d, phone: v }))}
            placeholder="+91 98765 43210"
          />
        </Field>
      </div>

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onSave}
          disabled={!isDirty}
          className="inline-flex items-center gap-1.5 rounded-lg bg-orange-500 px-4 py-2 text-sm font-bold text-white shadow-sm transition hover:bg-orange-600 disabled:opacity-40"
        >
          {saved ? <Check className="h-4 w-4" /> : <Save className="h-4 w-4" />}
          {saved ? "Saved!" : "Save Profile"}
        </button>
        {isDirty && (
          <button
            type="button"
            onClick={() => setDraft({ ...storeProfile })}
            className="text-sm text-gray-400 hover:text-gray-700"
          >
            Discard changes
          </button>
        )}
      </div>

      {/* Live preview */}
      <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50 p-4">
        <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-gray-400">
          Bill Preview
        </p>
        <div className="mx-auto max-w-[260px] rounded-lg border border-gray-200 bg-white p-3 font-mono text-[11px] shadow-sm">
          <div className="text-center">
            <div className="text-base font-black uppercase tracking-widest" style={{ color: "#FF7A1A" }}>
              {draft.name || "OUTLET NAME"}
            </div>
            <div className="mt-0.5 text-[10px] text-gray-500">
              {draft.address || "Address"}
            </div>
            <div className="text-[10px] text-gray-500">{draft.phone || "Phone"}</div>
            <div className="text-[10px] text-gray-400">GSTIN: {draft.gstin || "—"}</div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── Tab: Tax & Billing ───────────────────────────────────────────────── */

function TaxTab() {
  const { tax, setTax } = useSettings();

  const totalTax = tax.cgstPct + tax.sgstPct;
  const sampleBase = 1000;
  const sampleCgst = Math.round(sampleBase * (tax.cgstPct / 100));
  const sampleSgst = Math.round(sampleBase * (tax.sgstPct / 100));
  const sampleTotal = sampleBase + sampleCgst + sampleSgst;

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-base font-extrabold text-gray-900">Tax & Billing</h2>
        <p className="mt-0.5 text-sm text-gray-500">
          Changes apply instantly to all FOH checkout calculations.
        </p>
      </div>

      <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
        <h3 className="mb-4 text-sm font-bold text-gray-700">GST Configuration</h3>
        <div className="grid grid-cols-2 gap-6">
          <Field
            label="CGST %"
            hint="Central Goods & Services Tax"
          >
            <div className="flex items-center gap-2">
              <NumberInput
                value={tax.cgstPct}
                onChange={(v) => setTax({ cgstPct: v })}
              />
              <span className="text-sm text-gray-400">%</span>
            </div>
          </Field>
          <Field
            label="SGST %"
            hint="State Goods & Services Tax"
          >
            <div className="flex items-center gap-2">
              <NumberInput
                value={tax.sgstPct}
                onChange={(v) => setTax({ sgstPct: v })}
              />
              <span className="text-sm text-gray-400">%</span>
            </div>
          </Field>
        </div>
        <div className="mt-4 rounded-lg bg-orange-50 px-3 py-2 text-sm text-orange-700">
          Effective total tax rate: <strong>{totalTax.toFixed(1)}%</strong>
        </div>
      </div>

      {/* Live calculation preview */}
      <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
        <h3 className="mb-3 text-sm font-bold text-gray-700">
          Live Checkout Preview · ₹{sampleBase.toLocaleString("en-IN")} order
        </h3>
        <div className="space-y-1 font-mono text-sm">
          <div className="flex justify-between">
            <span className="text-gray-500">Subtotal</span>
            <span className="font-semibold text-gray-900">
              ₹{sampleBase.toLocaleString("en-IN")}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">CGST ({tax.cgstPct}%)</span>
            <span className="text-gray-600">₹{sampleCgst.toLocaleString("en-IN")}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">SGST ({tax.sgstPct}%)</span>
            <span className="text-gray-600">₹{sampleSgst.toLocaleString("en-IN")}</span>
          </div>
          <div className="mt-1 flex justify-between border-t border-gray-100 pt-1">
            <span className="font-bold text-gray-900">Grand Total</span>
            <span className="font-extrabold text-gray-900">
              ₹{sampleTotal.toLocaleString("en-IN")}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── Tab: Kitchen Stations ────────────────────────────────────────────── */

function StationsTab() {
  const { stations, addStation, renameStation, removeStation } = useSettings();
  const [newLabel, setNewLabel] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editLabel, setEditLabel] = useState("");

  const startEdit = (s: KDSStation) => {
    setEditingId(s.id);
    setEditLabel(s.label);
  };

  const commitEdit = () => {
    if (editingId && editLabel.trim()) {
      renameStation(editingId, editLabel.trim());
    }
    setEditingId(null);
    setEditLabel("");
  };

  const onAdd = () => {
    if (!newLabel.trim()) return;
    addStation(newLabel.trim());
    setNewLabel("");
  };

  const STATION_CHIP: Record<string, string> = {
    Hot: "bg-red-50 text-red-700 ring-red-200",
    Cold: "bg-blue-50 text-blue-700 ring-blue-200",
    Bar: "bg-purple-50 text-purple-700 ring-purple-200",
  };

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-base font-extrabold text-gray-900">Kitchen Stations</h2>
        <p className="mt-0.5 text-sm text-gray-500">
          Active KDS stations. New stations appear instantly as routing targets
          in Menu Management.
        </p>
      </div>

      <ul className="divide-y divide-gray-100 overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
        {stations.map((s) => (
          <li key={s.id} className="flex items-center gap-3 px-4 py-3">
            <span
              className={`inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ring-1 ${
                STATION_CHIP[s.id] ??
                "bg-gray-100 text-gray-600 ring-gray-200"
              }`}
            >
              {s.builtIn ? "Built-in" : "Custom"}
            </span>

            {editingId === s.id ? (
              <input
                autoFocus
                value={editLabel}
                onChange={(e) => setEditLabel(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") commitEdit();
                  if (e.key === "Escape") setEditingId(null);
                }}
                className="flex-1 rounded-lg border border-orange-300 px-2 py-1 text-sm outline-none focus:ring-2 focus:ring-orange-100"
              />
            ) : (
              <span className="flex-1 text-sm font-semibold text-gray-900">
                {s.label}
              </span>
            )}

            <div className="flex items-center gap-1">
              {editingId === s.id ? (
                <>
                  <button
                    type="button"
                    onClick={commitEdit}
                    className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600 hover:bg-emerald-100"
                  >
                    <Check className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditingId(null)}
                    className="flex h-7 w-7 items-center justify-center rounded-lg bg-gray-50 text-gray-400 hover:bg-gray-100"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={() => startEdit(s)}
                    className="flex h-7 w-7 items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-700"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                  {!s.builtIn && (
                    <button
                      type="button"
                      onClick={() => removeStation(s.id)}
                      className="flex h-7 w-7 items-center justify-center rounded-lg text-red-300 hover:bg-red-50 hover:text-red-600"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </>
              )}
            </div>
          </li>
        ))}
      </ul>

      {/* Add new station */}
      <div className="flex items-center gap-2">
        <input
          value={newLabel}
          onChange={(e) => setNewLabel(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && onAdd()}
          placeholder="e.g. Bakery Station, Pizza Deck…"
          className="flex-1 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100"
        />
        <button
          type="button"
          onClick={onAdd}
          disabled={!newLabel.trim()}
          className="inline-flex items-center gap-1.5 rounded-lg bg-orange-500 px-4 py-2 text-sm font-bold text-white shadow-sm transition hover:bg-orange-600 disabled:opacity-40"
        >
          <Plus className="h-4 w-4" />
          Add Station
        </button>
      </div>
    </div>
  );
}

/* ─── Tab: Security ────────────────────────────────────────────────────── */

function SecurityTab() {
  const { changePin } = useSettings();
  const [currentPin, setCurrentPin] = useState("");
  const [newPin, setNewPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [showPin, setShowPin] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  const onSave = async () => {
    setError("");
    if (newPin.length < 4) {
      setError("New PIN must be at least 4 digits.");
      return;
    }
    if (newPin !== confirmPin) {
      setError("New PIN and confirmation do not match.");
      return;
    }
    const ok = await changePin(currentPin, newPin);
    if (!ok) {
      setError("Current PIN is incorrect.");
      return;
    }
    setSaved(true);
    setCurrentPin("");
    setNewPin("");
    setConfirmPin("");
    setTimeout(() => setSaved(false), 2500);
  };

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-base font-extrabold text-gray-900">Security</h2>
        <p className="mt-0.5 text-sm text-gray-500">
          Admin Override PIN is required when a restricted user attempts a
          critical action (refund, delete row, pull-back bill).
        </p>
      </div>

      <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm space-y-4">
        <h3 className="text-sm font-bold text-gray-700">Change Admin Override PIN</h3>

        <Field label="Current PIN" hint="Enter the existing PIN to authenticate.">
          <div className="flex items-center gap-2">
            <input
              type={showPin ? "text" : "password"}
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={8}
              value={currentPin}
              onChange={(e) => setCurrentPin(e.target.value.replace(/\D/g, ""))}
              placeholder="••••"
              className="w-40 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-bold tabular-nums tracking-widest text-gray-900 shadow-sm outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100"
            />
            <button
              type="button"
              onClick={() => setShowPin((v) => !v)}
              className="flex h-9 w-9 items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-700"
            >
              {showPin ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </Field>

        <Field label="New PIN" hint="Minimum 4 digits.">
          <input
            type={showPin ? "text" : "password"}
            inputMode="numeric"
            pattern="[0-9]*"
            maxLength={8}
            value={newPin}
            onChange={(e) => setNewPin(e.target.value.replace(/\D/g, ""))}
            placeholder="••••"
            className="w-40 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-bold tabular-nums tracking-widest text-gray-900 shadow-sm outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100"
          />
        </Field>

        <Field label="Confirm New PIN">
          <input
            type={showPin ? "text" : "password"}
            inputMode="numeric"
            pattern="[0-9]*"
            maxLength={8}
            value={confirmPin}
            onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, ""))}
            placeholder="••••"
            className="w-40 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-bold tabular-nums tracking-widest text-gray-900 shadow-sm outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100"
          />
        </Field>

        {error && (
          <p className="text-xs font-semibold text-red-500">{error}</p>
        )}
        {saved && (
          <p className="text-xs font-semibold text-emerald-600">PIN updated successfully.</p>
        )}

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onSave}
            disabled={!currentPin || newPin.length < 4 || !confirmPin}
            className="inline-flex items-center gap-1.5 rounded-lg bg-orange-500 px-4 py-2 text-sm font-bold text-white shadow-sm transition hover:bg-orange-600 disabled:opacity-40"
          >
            {saved ? <Check className="h-4 w-4" /> : <Save className="h-4 w-4" />}
            {saved ? "Saved!" : "Update PIN"}
          </button>
        </div>
      </div>

      <div className="rounded-2xl border border-amber-100 bg-amber-50 p-4 text-sm text-amber-800">
        <p className="font-semibold">When is the PIN prompted?</p>
        <ul className="mt-1 list-inside list-disc space-y-0.5 text-amber-700">
          <li>Cashier or Server tries to pull back a settled bill</li>
          <li>Server tries to delete a KOT item after firing</li>
          <li>Any role below Manager processes a refund</li>
          <li>Restricted user tries to override a locked entry</li>
        </ul>
      </div>
    </div>
  );
}

/* ─── Main export ──────────────────────────────────────────────────────── */

export function SettingsHub() {
  const [tab, setTab] = useState<TabId>("profile");

  return (
    <div className="flex min-h-[480px] gap-6">
      {/* Left nav */}
      <nav className="w-48 shrink-0">
        <ul className="space-y-1">
          {TABS.map(({ id, label, icon: Icon }) => (
            <li key={id}>
              <button
                type="button"
                onClick={() => setTab(id)}
                className={`flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-semibold transition ${
                  tab === id
                    ? "bg-orange-50 text-orange-600"
                    : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
                }`}
              >
                <Icon className="h-4 w-4 shrink-0" />
                {label}
              </button>
            </li>
          ))}
        </ul>
      </nav>

      {/* Content */}
      <div className="flex-1 overflow-y-auto rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
        {tab === "profile" && <ProfileTab />}
        {tab === "tax" && <TaxTab />}
        {tab === "stations" && <StationsTab />}
        {tab === "security" && <SecurityTab />}
      </div>
    </div>
  );
}
