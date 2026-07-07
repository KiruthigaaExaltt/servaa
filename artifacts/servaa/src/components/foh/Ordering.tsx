import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Plus,
  Minus,
  Trash2,
  Search,
  Pause,
  Printer,
  Send,
  Receipt,
  Tag,
  Users,
  Phone,
  Hash,
  Flame,
} from "lucide-react";
import { useKDS } from "@/context/KDSContext";
import { useFOH } from "@/context/FOHContext";
import { useCRM } from "@/context/CRMContext";
import { useSettings } from "@/context/SettingsContext";
import { useRole } from "@/context/RoleContext";
import { tierOf, SEED_TIERS, TIER_TONE, type LoyaltyTier } from "@/lib/crmData";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  MENU_CATEGORIES,
  MENU_ITEMS,
  TABLE_OPTIONS,
  getItemImageUrl,
  type MenuCategoryId,
  type MenuItem,
  type MenuItemAddon,
  type MenuItemSize,
} from "@/lib/menu";
import {
  lineUnitPrice,
  modifierLabels,
  type CartLine,
} from "@/lib/cart";
import type { KOT, KOTItem, KOTItemStatus, OrderSource } from "@/types";

const ORDER_SOURCES: OrderSource[] = ["Walk-In", "Zomato", "Swiggy"];

const TIER_DISCOUNT_PCT: Record<LoyaltyTier, number> = {
  Bronze: 0,
  Silver: 5,
  Gold: 10,
  Platinum: 15,
};

function buildBillHtml(params: {
  tableId: string;
  waiterName: string;
  customerName: string;
  customerPhone: string;
  lines: CartLine[];
  subtotal: number;
  discountAmount: number;
  discountLabel: string;
  cgst: number;
  sgst: number;
  grandTotal: number;
  cgstPct: number;
  sgstPct: number;
  storeName: string;
  storeAddress: string;
  storePhone: string;
  storeGstin: string;
}): string {
  const {
    tableId, waiterName, customerName, customerPhone,
    lines, subtotal, discountAmount, discountLabel,
    cgst, sgst, grandTotal,
    cgstPct, sgstPct,
    storeName, storeAddress, storePhone, storeGstin,
  } = params;
  const now = new Date();
  const dateStr = now.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
  const timeStr = now.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
  const sep = `<div style="border-top:1px dashed #999;margin:6px 0;"></div>`;
  const itemRows = lines
    .map((l) => {
      const price = lineUnitPrice(l);
      const total = price * l.quantity;
      return `<div style="display:flex;justify-content:space-between;font-size:12px;padding:2px 0;">
        <span style="max-width:60%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${l.quantity}× ${l.item.name}</span>
        <span style="white-space:nowrap;">₹${total.toLocaleString("en-IN")}</span>
      </div>`;
    })
    .join("");
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8"/>
  <title>Bill – ${storeName}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; font-family: 'Courier New', monospace; }
    body { width: 300px; padding: 16px; color: #111; }
    .center { text-align: center; }
    .brand { font-size: 20px; font-weight: 900; letter-spacing: 2px; color: #FF7A1A; }
    .sub { font-size: 11px; color: #555; margin-top: 2px; }
    .ledger-row { display: flex; justify-content: space-between; font-size: 12px; padding: 2px 0; }
    .total-row { display: flex; justify-content: space-between; font-size: 15px; font-weight: 900; padding: 4px 0; }
    .footer { text-align: center; font-size: 11px; color: #666; margin-top: 10px; }
    @media print { @page { margin: 0; size: 80mm auto; } body { padding: 8px; } }
  </style>
</head>
<body>
  <div class="center">
    <div class="brand">${storeName.toUpperCase()}</div>
    ${storeAddress ? `<div class="sub">${storeAddress}</div>` : ""}
    ${storePhone ? `<div class="sub">${storePhone}</div>` : ""}
    ${storeGstin ? `<div class="sub">GSTIN: ${storeGstin}</div>` : ""}
    <div class="sub">${dateStr} · ${timeStr}</div>
  </div>
  ${sep}
  <div style="font-size:11px;display:flex;justify-content:space-between;">
    <span>Table: <b>${tableId}</b></span>
    <span>Waiter: <b>${waiterName || "—"}</b></span>
  </div>
  ${customerName || customerPhone ? `<div style="font-size:11px;margin-top:2px;">Guest: <b>${customerName || customerPhone}</b>${customerPhone && customerName ? ` · ${customerPhone}` : ""}</div>` : ""}
  ${sep}
  ${itemRows}
  ${sep}
  <div class="ledger-row"><span>Subtotal</span><span>₹${subtotal.toLocaleString("en-IN")}</span></div>
  ${discountAmount > 0 ? `<div class="ledger-row" style="color:#16a34a;"><span>Discount ${discountLabel}</span><span>−₹${discountAmount.toLocaleString("en-IN")}</span></div>` : ""}
  <div class="ledger-row" style="color:#555;"><span>CGST (${cgstPct}%)</span><span>₹${cgst.toLocaleString("en-IN")}</span></div>
  <div class="ledger-row" style="color:#555;"><span>SGST (${sgstPct}%)</span><span>₹${sgst.toLocaleString("en-IN")}</span></div>
  ${sep}
  <div class="total-row"><span>TOTAL</span><span>₹${grandTotal.toLocaleString("en-IN")}</span></div>
  <div class="footer">
    <div>Thank you for dining with us!</div>
    <div style="margin-top:4px;color:#FF7A1A;font-weight:bold;">★ Powered by Servaa ★</div>
  </div>
  <script>window.addEventListener("load", () => { window.print(); });</script>
</body>
</html>`;
}

const KOT_STATUS_TONE: Record<KOTItemStatus, { label: string; cls: string }> = {
  Pending: { label: "Queued", cls: "bg-gray-100 text-gray-600" },
  Cooking: { label: "Cooking", cls: "bg-amber-100 text-amber-700" },
  Ready: { label: "Ready", cls: "bg-emerald-100 text-emerald-700" },
  Served: { label: "Served", cls: "bg-blue-100 text-blue-700" },
  Voided: { label: "Voided", cls: "bg-red-100 text-red-700" },
};

export function Ordering() {
  const { addOrder, activeKOTs } = useKDS();
  const {
    cart,
    setCart,
    meta,
    updateMeta,
    holdCart,
    commitSentCart,
    generateBill,
    pendingBills,
  } = useFOH();
  const { findCustomerByPhone } = useCRM();
  const { tax, storeProfile } = useSettings();
  const { can, requestOverride } = useRole();
  const { toast } = useToast();

  const [activeCategory, setActiveCategory] =
    useState<MenuCategoryId>("appetizers");
  const [search, setSearch] = useState("");
  const [discountKind, setDiscountKind] = useState<"percent" | "amount">("percent");
  const [discountValue, setDiscountValue] = useState<number>(0);
  const [modItem, setModItem] = useState<MenuItem | null>(null);

  const visibleItems = useMemo(() => {
    const q = search.trim().toLowerCase();
    return MENU_ITEMS.filter((m) =>
      q ? m.name.toLowerCase().includes(q) : m.category === activeCategory,
    );
  }, [activeCategory, search]);

  // Live KDS status for each already-fired line, keyed by its KOT item id.
  const kdsStatus = useMemo(() => {
    const m: Record<string, KOTItemStatus> = {};
    for (const k of activeKOTs) for (const it of k.items) m[it.id] = it.status;
    return m;
  }, [activeKOTs]);

  // Split the session: fired-to-kitchen lines vs. new (editable) additions.
  const cookingLines = useMemo(() => cart.filter((l) => l.sentAt), [cart]);
  const newLines = useMemo(() => cart.filter((l) => !l.sentAt), [cart]);

  const subtotal = useMemo(
    () => cart.reduce((s, l) => s + lineUnitPrice(l) * l.quantity, 0),
    [cart],
  );
  const discountAmount = useMemo(() => {
    if (!discountValue) return 0;
    return discountKind === "percent"
      ? Math.round((subtotal * discountValue) / 100)
      : Math.min(discountValue, subtotal);
  }, [discountKind, discountValue, subtotal]);
  const taxedBase = Math.max(0, subtotal - discountAmount);
  const cgst = Math.round(taxedBase * (tax.cgstPct / 100));
  const sgst = Math.round(taxedBase * (tax.sgstPct / 100));
  const grandTotal = taxedBase + cgst + sgst;
  const itemCount = cart.reduce((n, l) => n + l.quantity, 0);
  const newItemCount = newLines.reduce((n, l) => n + l.quantity, 0);

  const matchedCustomer = useMemo(
    () => (meta.customerPhone ? findCustomerByPhone(meta.customerPhone) : undefined),
    [meta.customerPhone, findCustomerByPhone],
  );
  const matchedTier = matchedCustomer
    ? tierOf(matchedCustomer.lifetimeSpend, SEED_TIERS)
    : undefined;

  // Track if the current discount was auto-set by tier so manual overrides aren't stomped.
  const autoAppliedTierRef = useRef<LoyaltyTier | null>(null);

  useEffect(() => {
    if (!matchedTier) {
      // Customer cleared — clear any tier-auto discount, leave manual ones.
      if (autoAppliedTierRef.current !== null) {
        setDiscountValue(0);
        autoAppliedTierRef.current = null;
      }
      return;
    }
    if (matchedTier === autoAppliedTierRef.current) return; // already applied
    const pct = TIER_DISCOUNT_PCT[matchedTier];
    if (pct > 0) {
      setDiscountKind("percent");
      setDiscountValue(pct);
    }
    autoAppliedTierRef.current = matchedTier;
  }, [matchedTier]);

  const addLine = (
    item: MenuItem,
    size: MenuItemSize | undefined,
    addons: MenuItemAddon[],
    instructions: string,
  ) => {
    setCart((prev) => [
      ...prev,
      {
        lineId: `line-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        item,
        quantity: 1,
        size,
        addons,
        specialInstructions: instructions || undefined,
      },
    ]);
  };

  // Quantity/removal only ever apply to unsent lines (sent lines are locked).
  const updateQty = (lineId: string, delta: number) => {
    setCart((prev) =>
      prev
        .map((l: CartLine) =>
          l.lineId === lineId && !l.sentAt
            ? { ...l, quantity: l.quantity + delta }
            : l,
        )
        .filter((l: CartLine) => l.quantity > 0),
    );
  };

  const removeLine = (lineId: string) =>
    setCart((prev) =>
      prev.filter((l: CartLine) => l.lineId !== lineId || !!l.sentAt),
    );

  const sendToKOT = () => {
    const unsent = cart.filter((l) => !l.sentAt);
    if (unsent.length === 0) return;
    const ts = Date.now();
    const orderId = `ORD-${ts.toString().slice(-5)}`;
    const kotId = `kot-${ts}`;
    const items: KOTItem[] = unsent.map((l, i) => ({
      id: `i-${ts}-${i}`,
      name: l.item.name,
      quantity: l.quantity,
      price: lineUnitPrice(l),
      status: "Pending",
      stationId: l.item.station,
      modifiers: modifierLabels(l),
      isVoided: false,
    }));
    const kot: KOT = {
      id: kotId,
      tableId: meta.tableId,
      orderId,
      waiterName: meta.waiterName || "Unknown",
      timestamp: ts,
      orderSource: meta.orderSource,
      orderType: "Dine In",
      guestCount: meta.pax,
      customerName: meta.customerName || undefined,
      customerPhone: meta.customerPhone || undefined,
      items,
    };
    addOrder(kot);

    // Stamp the freshly-fired lines so they move into "Items Cooking" without
    // leaving the basket — the table stays open for continuous additions.
    let idx = 0;
    const stamped = cart.map((l) =>
      l.sentAt
        ? l
        : { ...l, sentAt: ts, kotId, kotItemId: items[idx++].id },
    );
    commitSentCart(stamped);

    toast({
      title: "Sent to KOT",
      description: `${items.length} item${items.length === 1 ? "" : "s"} → Table ${meta.tableId} kitchen. Table stays open.`,
    });
  };

  const onHold = () => {
    if (cart.length === 0) return;
    const tid = meta.tableId;
    holdCart();
    toast({
      title: "Order on hold",
      description: `${itemCount} item${itemCount === 1 ? "" : "s"} held for Table ${tid}.`,
    });
  };

  const onPrintBill = () => {
    if (cart.length === 0) return;
    const discountLabel =
      discountValue > 0
        ? discountKind === "percent"
          ? `(${discountValue}%)`
          : `(flat)`
        : "";
    const html = buildBillHtml({
      tableId: meta.tableId,
      waiterName: meta.waiterName,
      customerName: meta.customerName,
      customerPhone: meta.customerPhone,
      lines: cart,
      subtotal,
      discountAmount,
      discountLabel,
      cgst,
      sgst,
      grandTotal,
      cgstPct: tax.cgstPct,
      sgstPct: tax.sgstPct,
      storeName: storeProfile.name,
      storeAddress: storeProfile.address,
      storePhone: storeProfile.phone,
      storeGstin: storeProfile.gstin,
    });
    const win = window.open("", "_blank", "width=400,height=600");
    if (win) {
      win.document.write(html);
      win.document.close();
    }
  };

  const onGenerateBill = () => {
    if (cart.length === 0) return;
    const tid = meta.tableId;
    if (pendingBills[tid]) {
      toast({
        title: "Bill already pending",
        description: `Table ${tid} is awaiting settlement (₹${pendingBills[tid].total.toLocaleString("en-IN")}). Settle it from the Floor Map first.`,
        variant: "destructive",
      });
      return;
    }
    generateBill({
      tableId: tid,
      meta,
      lines: cart,
      subtotal,
      discount: discountAmount,
      cgst,
      sgst,
      total: grandTotal,
    });
    // KDS tickets stay live through "Waiting for Settlement" — they're cleared
    // only when the bill is actually settled (from the Floor Map), so a
    // cancelled bill keeps the kitchen state intact.
    setDiscountValue(0);
    toast({
      title: "Bill generated",
      description: `Table ${tid} → Waiting for Settlement (₹${grandTotal.toLocaleString("en-IN")}). Settle from the Floor Map.`,
    });
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_380px]">
        <section className="space-y-3">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search menu items..."
              className="w-full rounded-lg border border-gray-200 bg-white py-2.5 pl-10 pr-3 text-sm shadow-sm focus:border-orange-400 focus:outline-none focus:ring-2 focus:ring-orange-200"
            />
          </div>

          <div className="no-scrollbar -mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
            {MENU_CATEGORIES.map((c) => {
              const Icon = c.icon;
              const isActive = c.id === activeCategory && !search;
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => {
                    setSearch("");
                    setActiveCategory(c.id);
                  }}
                  className={`relative flex shrink-0 items-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold transition ${
                    isActive
                      ? "border-transparent text-white shadow"
                      : "border-gray-200 bg-white text-gray-700 hover:border-orange-300"
                  }`}
                  style={isActive ? { backgroundColor: "var(--primary-orange)" } : undefined}
                >
                  <Icon className="h-4 w-4" />
                  {c.label}
                </button>
              );
            })}
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {visibleItems.length === 0 ? (
              <div className="col-span-full rounded-xl border border-dashed border-gray-300 bg-white p-8 text-center text-sm text-gray-400">
                No items match your search.
              </div>
            ) : (
              visibleItems.map((item) => (
                <MenuCard key={item.id} item={item} onClick={() => setModItem(item)} />
              ))
            )}
          </div>
        </section>

        <aside className="flex flex-col rounded-xl border border-gray-200 bg-white shadow-sm">
          <div className="space-y-2 border-b border-gray-100 p-4">
            <div className="grid grid-cols-2 gap-2">
              <SidebarField label="Table No." icon={<Hash className="h-3.5 w-3.5" />}>
                <select
                  value={meta.tableId}
                  onChange={(e) => updateMeta({ tableId: e.target.value })}
                  className="w-full rounded-md border border-gray-300 bg-white px-2 py-1.5 text-sm font-medium text-gray-900 focus:border-orange-400 focus:outline-none focus:ring-2 focus:ring-orange-200"
                >
                  {TABLE_OPTIONS.map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </SidebarField>
              <SidebarField label="Pax" icon={<Users className="h-3.5 w-3.5" />}>
                <input
                  type="number"
                  min={1}
                  value={meta.pax}
                  onChange={(e) => updateMeta({ pax: Math.max(1, Number(e.target.value) || 1) })}
                  className="w-full rounded-md border border-gray-300 bg-white px-2 py-1.5 text-sm font-medium text-gray-900 focus:border-orange-400 focus:outline-none focus:ring-2 focus:ring-orange-200"
                />
              </SidebarField>
            </div>
            <SidebarField label="Customer" icon={<Phone className="h-3.5 w-3.5" />}>
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="text"
                  value={meta.customerName}
                  onChange={(e) => updateMeta({ customerName: e.target.value })}
                  placeholder="Name"
                  className="w-full rounded-md border border-gray-300 bg-white px-2 py-1.5 text-sm focus:border-orange-400 focus:outline-none focus:ring-2 focus:ring-orange-200"
                />
                <input
                  type="tel"
                  value={meta.customerPhone}
                  onChange={(e) => updateMeta({ customerPhone: e.target.value })}
                  placeholder="Phone"
                  className="w-full rounded-md border border-gray-300 bg-white px-2 py-1.5 text-sm focus:border-orange-400 focus:outline-none focus:ring-2 focus:ring-orange-200"
                />
              </div>
              {matchedCustomer && matchedTier && (
                <div className="mt-1.5 flex flex-wrap items-center gap-1.5 rounded-md bg-orange-50 px-2 py-1.5 text-[11px]">
                  <span className={`rounded-full px-1.5 py-0.5 font-bold ${TIER_TONE[matchedTier]}`}>
                    {matchedTier}
                  </span>
                  <span className="font-semibold text-gray-800">{matchedCustomer.name}</span>
                  <span className="text-gray-500">· {matchedCustomer.visits} visits</span>
                  <span className="text-gray-500">
                    · {matchedCustomer.points.toLocaleString("en-IN")} pts
                  </span>
                  {meta.customerName.trim() !== matchedCustomer.name && (
                    <button
                      type="button"
                      onClick={() => updateMeta({ customerName: matchedCustomer.name })}
                      className="ml-auto rounded-md border border-orange-300 bg-white px-1.5 py-0.5 font-semibold text-orange-600 hover:bg-orange-100"
                    >
                      Use profile
                    </button>
                  )}
                </div>
              )}
            </SidebarField>
            <div className="grid grid-cols-2 gap-2">
              <SidebarField label="Waiter">
                <input
                  type="text"
                  value={meta.waiterName}
                  onChange={(e) => updateMeta({ waiterName: e.target.value })}
                  className="w-full rounded-md border border-gray-300 bg-white px-2 py-1.5 text-sm focus:border-orange-400 focus:outline-none focus:ring-2 focus:ring-orange-200"
                />
              </SidebarField>
              <SidebarField label="Source">
                <select
                  value={meta.orderSource}
                  onChange={(e) => updateMeta({ orderSource: e.target.value as OrderSource })}
                  className="w-full rounded-md border border-gray-300 bg-white px-2 py-1.5 text-sm focus:border-orange-400 focus:outline-none focus:ring-2 focus:ring-orange-200"
                >
                  {ORDER_SOURCES.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </SidebarField>
            </div>
          </div>

          <div className="flex max-h-[46vh] flex-1 flex-col">
            <div className="flex items-center justify-between px-4 pt-3 text-xs font-semibold uppercase tracking-wide text-gray-500">
              <span>Current Order</span>
              <span>{itemCount} {itemCount === 1 ? "item" : "items"}</span>
            </div>
            <div className="flex-1 overflow-y-auto p-3">
              {cart.length === 0 ? (
                <div className="flex h-full min-h-[120px] items-center justify-center rounded-lg border border-dashed border-gray-300 p-4 text-center text-sm text-gray-400">
                  Tap menu items to add them.
                </div>
              ) : (
                <div className="space-y-3">
                  {cookingLines.length > 0 && (
                    <div className="space-y-2">
                      <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-amber-600">
                        <Flame className="h-3.5 w-3.5" />
                        Items Cooking
                        <span className="text-gray-400">· sent to kitchen</span>
                      </div>
                      <ul className="space-y-2">
                        {cookingLines.map((line) => {
                          const status: KOTItemStatus =
                            (line.kotItemId && kdsStatus[line.kotItemId]) || "Pending";
                          const tone = KOT_STATUS_TONE[status];
                          const done = status === "Served" || status === "Voided";
                          const mods = modifierLabels(line);
                          return (
                            <li
                              key={line.lineId}
                              className="rounded-lg border border-amber-200 bg-amber-50/50 p-2.5"
                            >
                              <div className="flex items-start justify-between gap-2">
                                <div className="min-w-0 flex-1">
                                  <div
                                    className={`truncate text-sm font-semibold text-gray-900 ${done ? "line-through opacity-60" : ""}`}
                                  >
                                    {line.item.name}
                                  </div>
                                  {mods.length > 0 && (
                                    <ul className="mt-0.5 space-y-0.5">
                                      {mods.map((m, i) => (
                                        <li
                                          key={i}
                                          className="text-[11px] font-medium leading-tight text-amber-700"
                                        >
                                          {m}
                                        </li>
                                      ))}
                                    </ul>
                                  )}
                                  <div className="mt-1 text-xs text-gray-500">
                                    ₹{lineUnitPrice(line)} ea
                                  </div>
                                </div>
                                <div className="flex flex-col items-end gap-1">
                                  <span
                                    className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${tone.cls}`}
                                  >
                                    {tone.label}
                                  </span>
                                  <span className="text-sm font-bold tabular-nums text-gray-700">
                                    ×{line.quantity}
                                  </span>
                                </div>
                              </div>
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                  )}

                  {newLines.length > 0 && (
                    <div className="space-y-2">
                      {cookingLines.length > 0 && (
                        <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-[color:var(--primary-orange)]">
                          <Plus className="h-3.5 w-3.5" />
                          New Additions
                          <span className="text-gray-400">· not yet sent</span>
                        </div>
                      )}
                      <ul className="space-y-2">
                        <AnimatePresence initial={false}>
                          {newLines.map((line) => {
                            const mods = modifierLabels(line);
                            return (
                              <motion.li
                                key={line.lineId}
                                layout
                                initial={{ opacity: 0, y: 8 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, x: 30, transition: { duration: 0.2 } }}
                                transition={{ type: "spring", stiffness: 320, damping: 26 }}
                                className="rounded-lg border border-gray-200 bg-white p-2.5"
                              >
                                <div className="flex items-start justify-between gap-2">
                                  <div className="min-w-0 flex-1">
                                    <div className="truncate text-sm font-semibold text-gray-900">
                                      {line.item.name}
                                    </div>
                                    {mods.length > 0 && (
                                      <ul className="mt-0.5 space-y-0.5">
                                        {mods.map((m, i) => (
                                          <li
                                            key={i}
                                            className="text-[11px] font-medium leading-tight"
                                            style={{ color: "var(--primary-orange)" }}
                                          >
                                            {m}
                                          </li>
                                        ))}
                                      </ul>
                                    )}
                                    <div className="mt-1 text-xs text-gray-500">
                                      ₹{lineUnitPrice(line)} ea
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-1 rounded-full border border-gray-200 px-1 py-0.5">
                                    <button
                                      type="button"
                                      aria-label="Decrease"
                                      onClick={() => updateQty(line.lineId, -1)}
                                      className="flex h-6 w-6 items-center justify-center rounded-full text-gray-600 hover:bg-gray-100"
                                    >
                                      <Minus className="h-3.5 w-3.5" />
                                    </button>
                                    <span className="min-w-[1.25rem] text-center text-sm font-bold tabular-nums">
                                      {line.quantity}
                                    </span>
                                    <button
                                      type="button"
                                      aria-label="Increase"
                                      onClick={() => updateQty(line.lineId, 1)}
                                      className="flex h-6 w-6 items-center justify-center rounded-full text-white"
                                      style={{ backgroundColor: "var(--primary-orange)" }}
                                    >
                                      <Plus className="h-3.5 w-3.5" />
                                    </button>
                                  </div>
                                </div>
                                <div className="mt-1.5 flex justify-end">
                                  <button
                                    type="button"
                                    onClick={() => removeLine(line.lineId)}
                                    className="inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-medium text-gray-500 hover:bg-red-50 hover:text-red-600"
                                  >
                                    <Trash2 className="h-3 w-3" /> Remove
                                  </button>
                                </div>
                              </motion.li>
                            );
                          })}
                        </AnimatePresence>
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="space-y-1.5 border-t border-gray-100 px-4 py-3 text-sm">
            <LedgerRow label="Subtotal" value={subtotal} />
            <div className="flex items-center justify-between">
              <button
                type="button"
                onClick={() => {
                  const v = window.prompt(
                    "Discount: enter % (e.g. 10) or amount prefixed with ₹ (e.g. ₹50). Type 0 to clear.",
                    discountKind === "percent" ? `${discountValue}` : `₹${discountValue}`,
                  );
                  if (v == null) return;
                  const trimmed = v.trim();
                  if (trimmed === "0" || trimmed === "") {
                    setDiscountValue(0);
                    return;
                  }
                  if (trimmed.startsWith("₹")) {
                    const n = Number(trimmed.slice(1));
                    if (!Number.isNaN(n)) {
                      setDiscountKind("amount");
                      setDiscountValue(Math.max(0, n));
                    }
                  } else {
                    const n = Number(trimmed.replace("%", ""));
                    if (!Number.isNaN(n)) {
                      setDiscountKind("percent");
                      setDiscountValue(Math.max(0, Math.min(100, n)));
                    }
                  }
                }}
                className="inline-flex items-center gap-1 text-gray-600 hover:text-[color:var(--primary-orange)]"
              >
                <Tag className="h-3.5 w-3.5" />
                Discount
                {discountValue > 0 && (
                  <span className="text-xs font-medium text-gray-500">
                    ({discountKind === "percent" ? `${discountValue}%` : `₹${discountValue}`})
                  </span>
                )}
              </button>
              <span className="font-medium tabular-nums text-gray-700">
                −₹{discountAmount.toLocaleString("en-IN")}
              </span>
            </div>
            <LedgerRow label={`CGST (${tax.cgstPct}%)`} value={cgst} muted />
            <LedgerRow label={`SGST (${tax.sgstPct}%)`} value={sgst} muted />
            <div className="mt-2 flex items-baseline justify-between border-t border-gray-100 pt-2">
              <span className="text-sm font-semibold text-gray-700">Grand Total</span>
              <span className="text-2xl font-extrabold text-gray-900 tabular-nums">
                ₹{grandTotal.toLocaleString("en-IN")}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2 border-t border-gray-100 p-3">
            <ActionButton onClick={onHold} disabled={cart.length === 0} className="bg-yellow-100 text-yellow-800 hover:bg-yellow-200">
              <Pause className="h-4 w-4" /> Hold
            </ActionButton>
            <ActionButton onClick={onPrintBill} disabled={cart.length === 0} className="bg-blue-100 text-blue-800 hover:bg-blue-200">
              <Printer className="h-4 w-4" /> Print
            </ActionButton>
            <ActionButton
              onClick={onGenerateBill}
              disabled={cart.length === 0}
              className="bg-emerald-100 text-emerald-800 hover:bg-emerald-200"
            >
              <Receipt className="h-4 w-4" /> Generate Bill
            </ActionButton>
          </div>
          <div className="px-3 pb-3">
            <motion.button
              type="button"
              disabled={newLines.length === 0}
              onClick={sendToKOT}
              whileTap={newLines.length > 0 ? { scale: 0.97 } : {}}
              className="flex w-full items-center justify-center gap-2 rounded-lg px-4 py-3.5 text-sm font-bold uppercase tracking-wide text-white shadow-sm transition disabled:cursor-not-allowed disabled:opacity-50"
              style={{ backgroundColor: "var(--primary-orange)" }}
            >
              <Send className="h-4 w-4" />
              {newLines.length > 0
                ? `Send ${newItemCount} to KOT`
                : "Send to KOT"}
            </motion.button>
          </div>
        </aside>
      </div>

      <ModifierModal
        item={modItem}
        onClose={() => setModItem(null)}
        onConfirm={(size, addons, instructions) => {
          if (modItem) addLine(modItem, size, addons, instructions);
          setModItem(null);
        }}
      />
    </div>
  );
}

/* ---------- Subcomponents ---------- */

function MenuCard({ item, onClick }: { item: MenuItem; onClick: () => void }) {
  return (
    <motion.button
      type="button"
      onClick={onClick}
      whileHover={{ y: -3 }}
      whileTap={{ scale: 0.98 }}
      className="group flex flex-col overflow-hidden rounded-xl border border-gray-200 bg-white text-left shadow-sm transition hover:border-orange-300 hover:shadow-md"
    >
      <div className="relative aspect-[16/10] w-full overflow-hidden bg-gray-100">
        <img
          src={getItemImageUrl(item.imageSeed)}
          alt={item.name}
          loading="lazy"
          className="h-full w-full object-cover transition group-hover:scale-105"
        />
        <span
          className={`absolute left-2 top-2 flex h-4 w-4 items-center justify-center rounded-sm border-[1.5px] bg-white ${
            item.isVeg ? "border-emerald-600" : "border-red-600"
          }`}
          title={item.isVeg ? "Veg" : "Non-Veg"}
        >
          <span className={`h-2 w-2 rounded-full ${item.isVeg ? "bg-emerald-600" : "bg-red-600"}`} />
        </span>
      </div>
      <div className="flex flex-1 items-start justify-between gap-2 p-3">
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-semibold text-gray-900">{item.name}</div>
          {item.description && (
            <div className="mt-0.5 truncate text-xs text-gray-500">{item.description}</div>
          )}
          <div className="mt-1.5 text-sm font-bold text-gray-900">₹{item.price}</div>
        </div>
        <span
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-white shadow-sm group-hover:brightness-110"
          style={{ backgroundColor: "var(--primary-orange)" }}
        >
          <Plus className="h-4 w-4" />
        </span>
      </div>
    </motion.button>
  );
}

function SidebarField({
  label,
  icon,
  children,
}: {
  label: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1 flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wide text-gray-500">
        {icon}
        {label}
      </span>
      {children}
    </label>
  );
}

function LedgerRow({ label, value, muted }: { label: string; value: number; muted?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <span className={muted ? "text-gray-500" : "text-gray-700"}>{label}</span>
      <span className={`tabular-nums ${muted ? "text-gray-500" : "font-medium text-gray-700"}`}>
        ₹{value.toLocaleString("en-IN")}
      </span>
    </div>
  );
}

function ActionButton({
  children,
  onClick,
  disabled,
  className,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex items-center justify-center gap-1.5 rounded-lg px-3 py-2.5 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50 ${className ?? ""}`}
    >
      {children}
    </button>
  );
}

/* ---------- Modifier Modal ---------- */

function ModifierModal({
  item,
  onClose,
  onConfirm,
}: {
  item: MenuItem | null;
  onClose: () => void;
  onConfirm: (size: MenuItemSize | undefined, addons: MenuItemAddon[], instructions: string) => void;
}) {
  const [sizeId, setSizeId] = useState<string | undefined>(undefined);
  const [addonIds, setAddonIds] = useState<Set<string>>(new Set());
  const [instructions, setInstructions] = useState("");

  const itemId = item?.id;
  useMemo(() => {
    setSizeId(item?.sizes?.[0]?.id);
    setAddonIds(new Set());
    setInstructions("");
  }, [itemId]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!item) return null;
  const size = item.sizes?.find((s) => s.id === sizeId);
  const addons = (item.addons ?? []).filter((a) => addonIds.has(a.id));
  const total = item.price + (size?.priceDelta ?? 0) + addons.reduce((s, a) => s + a.price, 0);

  return (
    <Dialog open={!!item} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span
              className={`flex h-4 w-4 items-center justify-center rounded-sm border-[1.5px] bg-white ${
                item.isVeg ? "border-emerald-600" : "border-red-600"
              }`}
            >
              <span className={`h-2 w-2 rounded-full ${item.isVeg ? "bg-emerald-600" : "bg-red-600"}`} />
            </span>
            {item.name}
          </DialogTitle>
          {item.description && <DialogDescription>{item.description}</DialogDescription>}
        </DialogHeader>

        <div className="space-y-4">
          {item.sizes && item.sizes.length > 0 && (
            <div>
              <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">Size</div>
              <div className="grid grid-cols-3 gap-2">
                {item.sizes.map((s) => {
                  const active = s.id === sizeId;
                  return (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => setSizeId(s.id)}
                      className={`rounded-lg border px-3 py-2 text-sm font-medium transition ${
                        active
                          ? "border-transparent text-white shadow"
                          : "border-gray-200 bg-white text-gray-700 hover:border-orange-300"
                      }`}
                      style={active ? { backgroundColor: "var(--primary-orange)" } : undefined}
                    >
                      <div>{s.label}</div>
                      {s.priceDelta > 0 && (
                        <div className={`text-[11px] ${active ? "text-white/80" : "text-gray-500"}`}>
                          +₹{s.priceDelta}
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {item.addons && item.addons.length > 0 && (
            <div>
              <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">Add-ons</div>
              <div className="space-y-1.5">
                {item.addons.map((a) => {
                  const checked = addonIds.has(a.id);
                  return (
                    <label
                      key={a.id}
                      className={`flex cursor-pointer items-center justify-between rounded-lg border px-3 py-2 text-sm transition ${
                        checked ? "border-orange-300 bg-orange-50" : "border-gray-200 bg-white hover:border-orange-200"
                      }`}
                    >
                      <span className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={(e) => {
                            setAddonIds((prev) => {
                              const next = new Set(prev);
                              if (e.target.checked) next.add(a.id);
                              else next.delete(a.id);
                              return next;
                            });
                          }}
                          className="h-4 w-4 accent-[color:var(--primary-orange)]"
                        />
                        <span className="font-medium text-gray-800">{a.label}</span>
                      </span>
                      <span className="text-sm text-gray-600">{a.price > 0 ? `+₹${a.price}` : "—"}</span>
                    </label>
                  );
                })}
              </div>
            </div>
          )}

          <div>
            <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">Special Instructions</div>
            <textarea
              rows={2}
              value={instructions}
              onChange={(e) => setInstructions(e.target.value)}
              placeholder="e.g. less spicy, allergic to peanuts..."
              className="w-full resize-none rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:border-orange-400 focus:outline-none focus:ring-2 focus:ring-orange-200"
            />
          </div>
        </div>

        <DialogFooter className="flex items-center justify-between gap-3 sm:justify-between">
          <div className="text-left">
            <div className="text-[11px] uppercase tracking-wide text-gray-500">Item Total</div>
            <div className="text-xl font-bold text-gray-900">₹{total.toLocaleString("en-IN")}</div>
          </div>
          <button
            type="button"
            onClick={() => onConfirm(size, addons, instructions)}
            className="inline-flex items-center gap-2 rounded-lg px-5 py-2.5 text-sm font-bold uppercase tracking-wide text-white shadow"
            style={{ backgroundColor: "var(--primary-orange)" }}
          >
            <Plus className="h-4 w-4" /> Add to Order
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
