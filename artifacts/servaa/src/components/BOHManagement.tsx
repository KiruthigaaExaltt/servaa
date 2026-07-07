import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  TrendingUp,
  Trash2,
  PackageOpen,
  Timer,
  ChefHat,
  ClipboardList,
  Truck,
  Flame,
  Plus,
  X,
  Check,
  Search,
  Pencil,
  Send,
  PackageCheck,
  AlertTriangle,
  CheckCircle2,
  Circle,
  CheckSquare,
  Square,
  IndianRupee,
  ArrowRight,
  Gauge,
  BarChart3,
} from "lucide-react";
import {
  SEED_RECIPES,
  SEED_POS,
  SEED_WASTAGE,
  SEED_PREP,
  WASTAGE_REASONS,
  calcRecipeCost,
  formatINR,
  formatDate,
  getMenuItem,
  wastageValue,
  type Recipe,
  type RecipeIngredient,
  type PurchaseOrder,
  type POStatus,
  type POLine,
  type WastageEntry,
  type WastageReason,
  type PrepTask,
} from "@/lib/bohData";
import { useCollectionState } from "@/lib/collectionState";
import { commitPoReceipt, commitWastage } from "@/lib/workflowsApi";
import { statusOf, type InventoryItem } from "@/lib/inventoryData";
import { KDS_CATEGORY_STATS } from "@/lib/reportsData";
import { useInventory } from "@/context/InventoryContext";
import { SEED_MENU_ITEMS } from "@/lib/menuAdmin";

type TabId = "dashboard" | "recipes" | "procurement" | "wastage" | "prep";

const TABS: { id: TabId; label: string; icon: typeof Flame }[] = [
  { id: "dashboard", label: "Dashboard", icon: Gauge },
  { id: "recipes", label: "Recipes", icon: ChefHat },
  { id: "procurement", label: "Procurement", icon: Truck },
  { id: "wastage", label: "Wastage", icon: Trash2 },
  { id: "prep", label: "Prep List", icon: ClipboardList },
];

const STATUS_TONE: Record<POStatus, string> = {
  Draft: "bg-gray-100 text-gray-700 ring-gray-200",
  Sent: "bg-blue-50 text-blue-700 ring-blue-200",
  "Partially Received": "bg-amber-50 text-amber-700 ring-amber-200",
  Received: "bg-emerald-50 text-emerald-700 ring-emerald-200",
};

const REASON_TONE: Record<WastageReason, string> = {
  Expired: "bg-amber-50 text-amber-700 ring-amber-200",
  Burnt: "bg-red-50 text-red-700 ring-red-200",
  Dropped: "bg-orange-50 text-orange-700 ring-orange-200",
  "Returned by Guest": "bg-purple-50 text-purple-700 ring-purple-200",
  Spoilage: "bg-rose-50 text-rose-700 ring-rose-200",
};

interface Toast {
  id: number;
  text: string;
  tone: "success" | "info" | "warn";
}

export function BOHManagement() {
  const [tab, setTab] = useState<TabId>("dashboard");
  const [recipes, setRecipes] = useCollectionState<Recipe[]>("boh_recipes", SEED_RECIPES);
  const [pos, setPOs] = useCollectionState<PurchaseOrder[]>("boh_purchase_orders", SEED_POS);
  const { items: inventory } = useInventory();
  const [wastage, setWastage] = useCollectionState<WastageEntry[]>("boh_wastage", SEED_WASTAGE);
  const [prep, setPrep] = useCollectionState<PrepTask[]>("boh_prep_tasks", SEED_PREP);
  const [toasts, setToasts] = useState<Toast[]>([]);

  const pushToast = (text: string, tone: Toast["tone"] = "success") => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, text, tone }]);
    window.setTimeout(
      () => setToasts((t) => t.filter((x) => x.id !== id)),
      2800,
    );
  };

  /* ---------- KPIs ---------- */
  const kpis = useMemo(() => {
    let totalCost = 0;
    let totalRev = 0;
    for (const r of recipes) {
      const item = getMenuItem(r.menuItemId);
      if (!item) continue;
      const c = calcRecipeCost(r);
      totalCost += c.totalCost;
      totalRev += item.basePrice;
    }
    const foodCostPct = totalRev > 0 ? (totalCost / totalRev) * 100 : 0;
    const last30 = wastage.filter(
      (w) => Date.now() - w.at < 30 * 24 * 60 * 60 * 1000,
    );
    const wastageVal = last30.reduce((s, w) => s + wastageValue(w), 0);
    const openPOs = pos.filter(
      (p) => p.status === "Sent" || p.status === "Partially Received",
    ).length;
    // Weighted average of KDS station avg-mins (orders-weighted)
    const kdsStats = KDS_CATEGORY_STATS;
    const kdsTotalOrders = kdsStats.reduce((s, k) => s + k.orders, 0);
    const efficiencyMin = kdsTotalOrders > 0
      ? Math.round(kdsStats.reduce((s, k) => s + k.avgMin * k.orders, 0) / kdsTotalOrders)
      : 0;
    return {
      foodCostPct: Math.round(foodCostPct * 10) / 10,
      wastageVal: Math.round(wastageVal),
      openPOs,
      efficiencyMin,
    };
  }, [recipes, pos, wastage]);

  /* ---------- Recipe Updates ---------- */
  const upsertRecipe = (next: Recipe) => {
    setRecipes((arr) => {
      const exists = arr.some((r) => r.menuItemId === next.menuItemId);
      return exists
        ? arr.map((r) => (r.menuItemId === next.menuItemId ? next : r))
        : [...arr, next];
    });
    pushToast("Recipe saved");
  };

  /* ---------- PO Updates ---------- */
  const createPO = (po: PurchaseOrder) => {
    setPOs((arr) => [po, ...arr]);
    pushToast(`PO ${po.id} created`);
  };

  const sendPO = (id: string) => {
    setPOs((arr) =>
      arr.map((p) => (p.id === id ? { ...p, status: "Sent" } : p)),
    );
    pushToast(`PO ${id} sent to supplier`, "info");
  };

  const checkInPO = (
    id: string,
    deliveredQtys: Record<string, number>,
  ) => {
    const po = pos.find((p) => p.id === id);
    if (!po) return;

    let totalReceived = 0;
    for (const line of po.lines) {
      const delivered = deliveredQtys[line.inventoryId] ?? 0;
      if (delivered > 0) {
        totalReceived += delivered * line.unitPrice;
      }
    }

    void commitPoReceipt(id, deliveredQtys);
    pushToast(
      `${id} checked-in Â· ${formatINR(totalReceived)} received â†’ Inventory & Accounts updated`,
    );
  };

  /* ---------- Wastage ---------- */
  const addWastage = (w: WastageEntry) => {
    const loss = wastageValue(w);
    void commitWastage(w).catch(() => pushToast("Could not record wastage", "warn"));
    pushToast(`Wastage logged Â· ${formatINR(loss)} loss`, "warn");
  };

  /* ---------- Prep ---------- */
  const togglePrep = (id: string) => {
    setPrep((arr) =>
      arr.map((p) => (p.id === id ? { ...p, done: !p.done } : p)),
    );
  };
  const addPrepTask = (t: PrepTask) => {
    setPrep((arr) => [...arr, t]);
    pushToast("Prep task added");
  };

  return (
    <div className="space-y-4">
      {/* Tab navigation */}
      <div className="flex flex-wrap items-center gap-1 rounded-xl border border-gray-200 bg-white p-1 shadow-sm">
        {TABS.map((t) => {
          const Icon = t.icon;
          const isActive = tab === t.id;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`relative inline-flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-xs font-bold uppercase tracking-wide transition ${
                isActive
                  ? "text-white"
                  : "text-gray-600 hover:text-gray-900"
              }`}
            >
              {isActive && (
                <motion.span
                  layoutId="boh-tab-pill"
                  className="absolute inset-0 rounded-lg shadow-sm"
                  style={{ backgroundColor: "var(--primary-orange)" }}
                  transition={{ type: "spring", stiffness: 400, damping: 32 }}
                />
              )}
              <Icon className="relative z-10 h-3.5 w-3.5" />
              <span className="relative z-10">{t.label}</span>
            </button>
          );
        })}
      </div>

      {tab === "dashboard" && (
        <DashboardView
          kpis={kpis}
          recipes={recipes}
          pos={pos}
          wastage={wastage}
          onJump={setTab}
        />
      )}
      {tab === "recipes" && (
        <RecipesView
          recipes={recipes}
          inventory={inventory}
          onSave={upsertRecipe}
        />
      )}
      {tab === "procurement" && (
        <ProcurementView
          pos={pos}
          inventory={inventory}
          onCreate={createPO}
          onSend={sendPO}
          onCheckIn={checkInPO}
        />
      )}
      {tab === "wastage" && (
        <WastageView
          wastage={wastage}
          inventory={inventory}
          onAdd={addWastage}
        />
      )}
      {tab === "prep" && (
        <PrepView prep={prep} onToggle={togglePrep} onAdd={addPrepTask} />
      )}

      {/* Toasts */}
      <div className="pointer-events-none fixed bottom-6 right-6 z-50 flex flex-col gap-2">
        <AnimatePresence>
          {toasts.map((t) => (
            <motion.div
              key={t.id}
              initial={{ opacity: 0, x: 40, scale: 0.95 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: 40, scale: 0.95 }}
              className={`pointer-events-auto rounded-lg px-4 py-2.5 text-sm font-semibold text-white shadow-lg ${
                t.tone === "success"
                  ? "bg-emerald-600"
                  : t.tone === "warn"
                    ? "bg-red-600"
                    : "bg-gray-900"
              }`}
            >
              {t.text}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}

/* ============================================================
   DASHBOARD
   ============================================================ */

function DashboardView({
  kpis,
  recipes,
  pos,
  wastage,
  onJump,
}: {
  kpis: {
    foodCostPct: number;
    wastageVal: number;
    openPOs: number;
    efficiencyMin: number;
  };
  recipes: Recipe[];
  pos: PurchaseOrder[];
  wastage: WastageEntry[];
  onJump: (t: TabId) => void;
}) {
  const target = 30;
  const fcAccent =
    kpis.foodCostPct <= target
      ? "text-emerald-600"
      : kpis.foodCostPct <= target + 5
        ? "text-amber-600"
        : "text-red-600";

  // Top 5 highest food cost % dishes
  const dishMargins = useMemo(() => {
    return recipes
      .map((r) => {
        const item = getMenuItem(r.menuItemId);
        if (!item) return null;
        const c = calcRecipeCost(r);
        const pct = (c.totalCost / item.basePrice) * 100;
        return {
          name: item.name,
          price: item.basePrice,
          cost: c.totalCost,
          pct: Math.round(pct * 10) / 10,
        };
      })
      .filter((x): x is NonNullable<typeof x> => x !== null)
      .sort((a, b) => b.pct - a.pct)
      .slice(0, 5);
  }, [recipes]);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard
          icon={Flame}
          label="Food Cost %"
          value={`${kpis.foodCostPct}%`}
          accent={fcAccent}
          sub={`Target â‰¤ ${target}%`}
          progress={Math.min(100, kpis.foodCostPct)}
          progressTone={
            kpis.foodCostPct <= target
              ? "emerald"
              : kpis.foodCostPct <= target + 5
                ? "amber"
                : "red"
          }
        />
        <KpiCard
          icon={Trash2}
          label="Wastage (30d)"
          value={formatINR(kpis.wastageVal)}
          accent="text-red-600"
          sub={`${wastage.length} entries`}
        />
        <KpiCard
          icon={PackageOpen}
          label="Open POs"
          value={kpis.openPOs.toString()}
          accent="text-[color:var(--primary-orange)]"
          sub={`${pos.filter((p) => p.status === "Draft").length} draft`}
        />
        <KpiCard
          icon={Timer}
          label="Kitchen Efficiency"
          value={`${kpis.efficiencyMin} min`}
          accent="text-emerald-600"
          sub="Avg KOT â†’ Ready"
        />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Top food-cost dishes */}
        <div className="lg:col-span-2 overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
            <div className="flex items-center gap-1.5">
              <TrendingUp className="h-4 w-4 text-gray-400" />
              <h3 className="text-sm font-bold text-gray-900">
                Highest Food-Cost Dishes
              </h3>
            </div>
            <button
              type="button"
              onClick={() => onJump("recipes")}
              className="inline-flex items-center gap-1 text-[11px] font-bold uppercase tracking-wide text-orange-600 hover:underline"
            >
              Manage Recipes <ArrowRight className="h-3 w-3" />
            </button>
          </div>
          <ul className="divide-y divide-gray-100">
            {dishMargins.length === 0 ? (
              <li className="px-4 py-8 text-center text-sm text-gray-400">
                No recipes yet â€” add one to see margins.
              </li>
            ) : (
              dishMargins.map((d) => {
                const margin = 100 - d.pct;
                const tone =
                  d.pct >= 40
                    ? "bg-red-500"
                    : d.pct >= 30
                      ? "bg-amber-500"
                      : "bg-emerald-500";
                return (
                  <li
                    key={d.name}
                    className="grid grid-cols-[1fr_auto_auto] items-center gap-3 px-4 py-3"
                  >
                    <div className="min-w-0">
                      <div className="truncate text-sm font-semibold text-gray-900">
                        {d.name}
                      </div>
                      <div className="text-[11px] text-gray-500">
                        {formatINR(d.cost)} cost / {formatINR(d.price)} sell
                      </div>
                      <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-gray-100">
                        <div
                          className={`h-full rounded-full ${tone}`}
                          style={{ width: `${Math.min(100, d.pct)}%` }}
                        />
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-extrabold tabular-nums text-gray-900">
                        {d.pct}%
                      </div>
                      <div className="text-[10px] uppercase tracking-wider text-gray-400">
                        food cost
                      </div>
                    </div>
                    <div className="text-right">
                      <div
                        className={`text-sm font-extrabold tabular-nums ${
                          margin >= 70
                            ? "text-emerald-600"
                            : margin >= 50
                              ? "text-amber-600"
                              : "text-red-600"
                        }`}
                      >
                        {Math.round(margin * 10) / 10}%
                      </div>
                      <div className="text-[10px] uppercase tracking-wider text-gray-400">
                        margin
                      </div>
                    </div>
                  </li>
                );
              })
            )}
          </ul>
        </div>

        {/* PO snapshot */}
        <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
            <div className="flex items-center gap-1.5">
              <Truck className="h-4 w-4 text-gray-400" />
              <h3 className="text-sm font-bold text-gray-900">
                Open Purchase Orders
              </h3>
            </div>
            <button
              type="button"
              onClick={() => onJump("procurement")}
              className="inline-flex items-center gap-1 text-[11px] font-bold uppercase tracking-wide text-orange-600 hover:underline"
            >
              View All <ArrowRight className="h-3 w-3" />
            </button>
          </div>
          <ul className="divide-y divide-gray-100">
            {pos
              .filter(
                (p) =>
                  p.status === "Sent" || p.status === "Partially Received",
              )
              .slice(0, 4)
              .map((p) => (
                <li
                  key={p.id}
                  className="flex items-center justify-between gap-2 px-4 py-3"
                >
                  <div className="min-w-0">
                    <div className="font-mono text-[13px] font-bold text-gray-900">
                      {p.id}
                    </div>
                    <div className="truncate text-[11px] text-gray-500">
                      {p.supplierName}
                    </div>
                  </div>
                  <span
                    className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ring-1 ${STATUS_TONE[p.status]}`}
                  >
                    {p.status}
                  </span>
                </li>
              ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

function KpiCard({
  icon: Icon,
  label,
  value,
  sub,
  accent = "text-gray-900",
  progress,
  progressTone,
}: {
  icon: typeof Flame;
  label: string;
  value: string;
  sub?: string;
  accent?: string;
  progress?: number;
  progressTone?: "emerald" | "amber" | "red";
}) {
  const barTone =
    progressTone === "red"
      ? "bg-red-500"
      : progressTone === "amber"
        ? "bg-amber-500"
        : "bg-emerald-500";
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between text-[11px] font-bold uppercase tracking-wider text-gray-500">
        <span>{label}</span>
        <Icon className="h-4 w-4 text-gray-300" />
      </div>
      <div className={`mt-1 text-2xl font-extrabold ${accent}`}>{value}</div>
      {sub && <div className="text-[11px] text-gray-400">{sub}</div>}
      {typeof progress === "number" && (
        <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-gray-100">
          <div
            className={`h-full rounded-full ${barTone}`}
            style={{ width: `${progress}%` }}
          />
        </div>
      )}
    </div>
  );
}

/* ============================================================
   RECIPES â€” Food Lab
   ============================================================ */

function RecipesView({
  recipes,
  inventory,
  onSave,
}: {
  recipes: Recipe[];
  inventory: InventoryItem[];
  onSave: (r: Recipe) => void;
}) {
  const [activeMenuId, setActiveMenuId] = useState<string>(
    recipes[0]?.menuItemId ?? SEED_MENU_ITEMS[0]?.id ?? "",
  );
  const [query, setQuery] = useState("");

  const visibleMenu = useMemo(() => {
    const q = query.trim().toLowerCase();
    return SEED_MENU_ITEMS.filter(
      (m) => !q || m.name.toLowerCase().includes(q),
    );
  }, [query]);

  const activeItem = SEED_MENU_ITEMS.find((m) => m.id === activeMenuId);
  const activeRecipe =
    recipes.find((r) => r.menuItemId === activeMenuId) ?? {
      menuItemId: activeMenuId,
      ingredients: [],
    };
  const cost = calcRecipeCost(activeRecipe);
  const margin = activeItem
    ? Math.round((1 - cost.totalCost / activeItem.basePrice) * 1000) / 10
    : 0;
  const fcPct = activeItem
    ? Math.round((cost.totalCost / activeItem.basePrice) * 1000) / 10
    : 0;

  const [draft, setDraft] = useState<RecipeIngredient[]>(
    activeRecipe.ingredients,
  );
  useEffect(() => {
    setDraft(activeRecipe.ingredients);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeMenuId]);

  const updateLine = (idx: number, patch: Partial<RecipeIngredient>) => {
    setDraft((arr) => arr.map((r, i) => (i === idx ? { ...r, ...patch } : r)));
  };
  const removeLine = (idx: number) =>
    setDraft((arr) => arr.filter((_, i) => i !== idx));
  const addLine = () => {
    const first = inventory[0];
    if (!first) return;
    setDraft((arr) => [...arr, { inventoryId: first.id, qty: 0.1 }]);
  };
  const save = () => {
    if (!activeItem) return;
    onSave({ menuItemId: activeMenuId, ingredients: draft });
  };

  const draftCost = calcRecipeCost({
    menuItemId: activeMenuId,
    ingredients: draft,
  });
  const draftMargin = activeItem
    ? Math.round((1 - draftCost.totalCost / activeItem.basePrice) * 1000) / 10
    : 0;
  const draftFc = activeItem
    ? Math.round((draftCost.totalCost / activeItem.basePrice) * 1000) / 10
    : 0;

  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-[300px_minmax(0,1fr)]">
      {/* Menu list */}
      <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
        <div className="border-b border-gray-100 p-3">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search dishesâ€¦"
              className="w-full rounded-lg border border-gray-200 bg-white py-2 pl-9 pr-3 text-sm placeholder:text-gray-400 focus:border-orange-300 focus:outline-none focus:ring-2 focus:ring-orange-100"
            />
          </div>
        </div>
        <ul className="max-h-[60vh] divide-y divide-gray-100 overflow-y-auto">
          {visibleMenu.map((m) => {
            const has = recipes.some((r) => r.menuItemId === m.id);
            const isActive = m.id === activeMenuId;
            return (
              <li key={m.id}>
                <button
                  type="button"
                  onClick={() => setActiveMenuId(m.id)}
                  className={`flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left transition ${
                    isActive
                      ? "bg-orange-50"
                      : "hover:bg-gray-50"
                  }`}
                >
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold text-gray-900">
                      {m.name}
                    </div>
                    <div className="text-[11px] text-gray-500">
                      {formatINR(m.basePrice)}
                    </div>
                  </div>
                  {has ? (
                    <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" />
                  ) : (
                    <Circle className="h-4 w-4 shrink-0 text-gray-300" />
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      </div>

      {/* Cost calculator */}
      <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
        {!activeItem ? (
          <div className="p-12 text-center text-sm text-gray-400">
            Select a dish to engineer its recipe.
          </div>
        ) : (
          <>
            <div className="flex flex-wrap items-start justify-between gap-3 border-b border-gray-100 p-4">
              <div>
                <div className="text-[11px] font-bold uppercase tracking-wider text-orange-600">
                  Food Lab â€” Recipe Engineering
                </div>
                <h3 className="mt-0.5 text-xl font-extrabold text-gray-900">
                  {activeItem.name}
                </h3>
                <div className="mt-1 text-[11px] text-gray-500">
                  Selling Price{" "}
                  <strong className="text-gray-900">
                    {formatINR(activeItem.basePrice)}
                  </strong>
                </div>
              </div>
              <button
                type="button"
                onClick={save}
                className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-bold uppercase tracking-wide text-white shadow-sm transition hover:brightness-110"
                style={{ backgroundColor: "var(--primary-orange)" }}
              >
                <Check className="h-3.5 w-3.5" />
                Save Recipe
              </button>
            </div>

            <div className="grid grid-cols-1 gap-4 p-4 md:grid-cols-3">
              <SmallStat
                label="Ideal Food Cost"
                value={formatINR(draftCost.totalCost)}
              />
              <SmallStat
                label="Food Cost %"
                value={`${draftFc}%`}
                tone={
                  draftFc <= 30
                    ? "emerald"
                    : draftFc <= 35
                      ? "amber"
                      : "red"
                }
              />
              <SmallStat
                label="Profit Margin"
                value={`${draftMargin}%`}
                tone={
                  draftMargin >= 65
                    ? "emerald"
                    : draftMargin >= 50
                      ? "amber"
                      : "red"
                }
              />
            </div>

            <div className="space-y-2 border-t border-gray-100 p-4">
              <div className="text-[11px] font-bold uppercase tracking-wider text-gray-500">
                Ingredients
              </div>
              {draft.length === 0 && (
                <div className="rounded-lg border border-dashed border-gray-200 bg-gray-50 px-3 py-4 text-center text-xs text-gray-400">
                  No ingredients linked yet â€” click "Add Ingredient" below.
                </div>
              )}
              {draft.map((line, idx) => {
                const item = inventory.find((i) => i.id === line.inventoryId);
                const cost = item ? item.unitPrice * line.qty : 0;
                return (
                  <div
                    key={idx}
                    className="grid grid-cols-[1fr_120px_28px_100px_36px] items-center gap-2 rounded-lg border border-gray-200 bg-gray-50/50 px-2 py-1.5"
                  >
                    <select
                      value={line.inventoryId}
                      onChange={(e) =>
                        updateLine(idx, { inventoryId: e.target.value })
                      }
                      className="h-9 w-full rounded-md border border-gray-200 bg-white px-2 text-sm focus:border-orange-300 focus:outline-none focus:ring-2 focus:ring-orange-100"
                    >
                      {inventory.map((i) => (
                        <option key={i.id} value={i.id}>
                          {i.name} ({formatINR(i.unitPrice)}/{i.unit})
                        </option>
                      ))}
                    </select>
                    <input
                      type="number"
                      step="0.01"
                      value={line.qty}
                      onChange={(e) =>
                        updateLine(idx, {
                          qty: Math.max(0, Number(e.target.value) || 0),
                        })
                      }
                      className="h-9 w-full rounded-md border border-gray-200 px-2 text-right text-sm font-bold tabular-nums focus:border-orange-300 focus:outline-none focus:ring-2 focus:ring-orange-100"
                    />
                    <span className="text-center text-xs font-bold text-gray-500">
                      {item?.unit ?? ""}
                    </span>
                    <span className="text-right text-sm font-extrabold tabular-nums text-gray-900">
                      {formatINR(Math.round(cost * 100) / 100)}
                    </span>
                    <button
                      type="button"
                      onClick={() => removeLine(idx)}
                      className="rounded-md p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-600"
                      aria-label="Remove"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                );
              })}
              <button
                type="button"
                onClick={addLine}
                className="inline-flex items-center gap-1.5 rounded-lg border border-dashed border-gray-300 bg-white px-3 py-1.5 text-xs font-bold uppercase tracking-wide text-gray-600 hover:border-orange-300 hover:bg-orange-50 hover:text-orange-700"
              >
                <Plus className="h-3.5 w-3.5" />
                Add Ingredient
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function SmallStat({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "emerald" | "amber" | "red";
}) {
  const accent =
    tone === "emerald"
      ? "text-emerald-600"
      : tone === "amber"
        ? "text-amber-600"
        : tone === "red"
          ? "text-red-600"
          : "text-gray-900";
  return (
    <div className="rounded-xl border border-gray-200 bg-gray-50/60 p-3">
      <div className="text-[11px] font-bold uppercase tracking-wider text-gray-500">
        {label}
      </div>
      <div className={`mt-0.5 text-xl font-extrabold ${accent}`}>{value}</div>
    </div>
  );
}

/* ============================================================
   PROCUREMENT
   ============================================================ */

function ProcurementView({
  pos,
  inventory,
  onCreate,
  onSend,
  onCheckIn,
}: {
  pos: PurchaseOrder[];
  inventory: InventoryItem[];
  onCreate: (po: PurchaseOrder) => void;
  onSend: (id: string) => void;
  onCheckIn: (id: string, qtys: Record<string, number>) => void;
}) {
  const [creating, setCreating] = useState(false);
  const [checkingIn, setCheckingIn] = useState<PurchaseOrder | null>(null);
  const [filter, setFilter] = useState<"All" | POStatus>("All");

  const filtered = pos
    .filter((p) => filter === "All" || p.status === filter)
    .sort((a, b) => b.createdAt - a.createdAt);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1 rounded-lg bg-gray-100 p-1">
          {(["All", "Draft", "Sent", "Partially Received", "Received"] as const).map(
            (f) => {
              const active = filter === f;
              return (
                <button
                  key={f}
                  type="button"
                  onClick={() => setFilter(f)}
                  className={`relative rounded-md px-3 py-1.5 text-xs font-bold uppercase tracking-wide transition ${
                    active ? "text-white" : "text-gray-600 hover:text-gray-900"
                  }`}
                >
                  {active && (
                    <motion.span
                      layoutId="po-status-pill"
                      className="absolute inset-0 rounded-md shadow-sm"
                      style={{ backgroundColor: "var(--primary-orange)" }}
                      transition={{ type: "spring", stiffness: 400, damping: 32 }}
                    />
                  )}
                  <span className="relative z-10">{f}</span>
                </button>
              );
            },
          )}
        </div>
        <button
          type="button"
          onClick={() => setCreating(true)}
          className="ml-auto inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-bold uppercase tracking-wide text-white shadow-sm transition hover:brightness-110"
          style={{ backgroundColor: "var(--primary-orange)" }}
        >
          <Plus className="h-3.5 w-3.5" />
          Create PO
        </button>
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-gray-300 bg-white p-12 text-center text-sm text-gray-400">
          No purchase orders match that filter.
        </div>
      ) : (
        <ul className="space-y-3">
          {filtered.map((p) => (
            <POCard
              key={p.id}
              po={p}
              inventory={inventory}
              onSend={() => onSend(p.id)}
              onCheckIn={() => setCheckingIn(p)}
            />
          ))}
        </ul>
      )}

      <AnimatePresence>
        {creating && (
          <CreatePOModal
            inventory={inventory}
            existingIds={pos.map((p) => p.id)}
            onClose={() => setCreating(false)}
            onCreate={(po) => {
              onCreate(po);
              setCreating(false);
            }}
          />
        )}
        {checkingIn && (
          <CheckInModal
            po={checkingIn}
            inventory={inventory}
            onClose={() => setCheckingIn(null)}
            onConfirm={(qtys) => {
              onCheckIn(checkingIn.id, qtys);
              setCheckingIn(null);
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

function POCard({
  po,
  inventory,
  onSend,
  onCheckIn,
}: {
  po: PurchaseOrder;
  inventory: InventoryItem[];
  onSend: () => void;
  onCheckIn: () => void;
}) {
  const total = po.lines.reduce((s, l) => s + l.qty * l.unitPrice, 0);
  const lineLabel = (l: POLine) =>
    inventory.find((i) => i.id === l.inventoryId)?.name ?? "Unknown";
  const lineUnit = (l: POLine) =>
    inventory.find((i) => i.id === l.inventoryId)?.unit ?? "";
  return (
    <li className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-gray-100 p-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="font-mono text-base font-extrabold text-gray-900">
              {po.id}
            </span>
            <span
              className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ring-1 ${STATUS_TONE[po.status]}`}
            >
              {po.status}
            </span>
          </div>
          <div className="mt-1 text-sm text-gray-700">
            <strong>{po.supplierName}</strong>
          </div>
          <div className="text-[11px] text-gray-500">
            Created {formatDate(po.createdAt)}
            {po.expectedAt && ` Â· Expected ${formatDate(po.expectedAt)}`}
            {po.receivedAt && ` Â· Received ${formatDate(po.receivedAt)}`}
          </div>
          {po.notes && (
            <div className="mt-1 inline-flex items-center gap-1 rounded-md bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-700">
              <AlertTriangle className="h-3 w-3" /> {po.notes}
            </div>
          )}
        </div>
        <div className="text-right">
          <div className="text-[11px] font-bold uppercase tracking-wider text-gray-500">
            PO Value
          </div>
          <div className="text-xl font-extrabold tabular-nums text-gray-900">
            {formatINR(total)}
          </div>
          <div className="mt-2 flex items-center justify-end gap-2">
            {po.status === "Draft" && (
              <button
                type="button"
                onClick={onSend}
                className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-bold uppercase tracking-wide text-white hover:bg-blue-700"
              >
                <Send className="h-3.5 w-3.5" />
                Send
              </button>
            )}
            {(po.status === "Sent" || po.status === "Partially Received") && (
              <button
                type="button"
                onClick={onCheckIn}
                className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-bold uppercase tracking-wide text-white hover:bg-emerald-700"
              >
                <PackageCheck className="h-3.5 w-3.5" />
                Check-In
              </button>
            )}
          </div>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50 text-left text-[11px] font-bold uppercase tracking-wider text-gray-500">
              <th className="px-4 py-2">Item</th>
              <th className="px-4 py-2 text-right">Ordered</th>
              <th className="px-4 py-2 text-right">Received</th>
              <th className="px-4 py-2 text-right">Unit Price</th>
              <th className="px-4 py-2 text-right">Line Total</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {po.lines.map((l) => {
              const isPartial = l.receivedQty > 0 && l.receivedQty < l.qty;
              const isFull = l.receivedQty >= l.qty && l.qty > 0;
              return (
                <tr key={l.inventoryId}>
                  <td className="px-4 py-2 font-semibold text-gray-800">
                    {lineLabel(l)}
                  </td>
                  <td className="px-4 py-2 text-right tabular-nums text-gray-700">
                    {l.qty} {lineUnit(l)}
                  </td>
                  <td className="px-4 py-2 text-right">
                    <span
                      className={`tabular-nums font-semibold ${
                        isFull
                          ? "text-emerald-600"
                          : isPartial
                            ? "text-amber-600"
                            : "text-gray-400"
                      }`}
                    >
                      {l.receivedQty} {lineUnit(l)}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-right tabular-nums text-gray-700">
                    {formatINR(l.unitPrice)}
                  </td>
                  <td className="px-4 py-2 text-right font-bold tabular-nums text-gray-900">
                    {formatINR(l.qty * l.unitPrice)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </li>
  );
}

function CreatePOModal({
  inventory,
  existingIds,
  onClose,
  onCreate,
}: {
  inventory: InventoryItem[];
  existingIds: string[];
  onClose: () => void;
  onCreate: (po: PurchaseOrder) => void;
}) {
  const lowItems = inventory.filter((i) => statusOf(i) !== "In Stock");
  const suppliers = Array.from(new Set(inventory.map((i) => i.supplierName)));
  const [supplier, setSupplier] = useState(suppliers[0] ?? "");
  const [chosen, setChosen] = useState<Set<string>>(
    new Set(lowItems.slice(0, 3).map((i) => i.id)),
  );
  const [qtys, setQtys] = useState<Record<string, number>>(() => {
    const map: Record<string, number> = {};
    lowItems.forEach((i) => {
      map[i.id] = Math.max(1, Math.ceil(i.minLevel - i.stock + 5));
    });
    return map;
  });

  useEffect(() => {
    const original = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = original;
    };
  }, []);

  const supplierItems = inventory.filter((i) => i.supplierName === supplier);
  const filteredLow = supplierItems.filter((i) => statusOf(i) !== "In Stock");
  const otherItems = supplierItems.filter((i) => statusOf(i) === "In Stock");

  const toggleItem = (id: string) => {
    setChosen((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  };

  const total = Array.from(chosen).reduce((s, id) => {
    const item = inventory.find((i) => i.id === id);
    if (!item) return s;
    return s + (qtys[id] ?? 1) * item.unitPrice;
  }, 0);

  const submit = () => {
    if (chosen.size === 0) return;
    const lines: POLine[] = Array.from(chosen).map((id) => {
      const item = inventory.find((i) => i.id === id)!;
      return {
        inventoryId: id,
        qty: qtys[id] ?? 1,
        unitPrice: item.unitPrice,
        receivedQty: 0,
      };
    });
    let nextNum = 2042;
    while (existingIds.includes(`PO-${nextNum}`)) nextNum++;
    onCreate({
      id: `PO-${nextNum}`,
      supplierName: supplier,
      status: "Draft",
      createdAt: Date.now(),
      lines,
    });
  };

  return (
    <>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[60] bg-gray-900/50 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.96, y: 8 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.96, y: 8 }}
          transition={{ type: "spring", stiffness: 320, damping: 30 }}
          className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-xl bg-white shadow-2xl"
        >
          <header className="flex items-start justify-between border-b border-gray-200 px-5 py-4">
            <div>
              <div className="text-[11px] font-bold uppercase tracking-wider text-orange-600">
                Create Purchase Order
              </div>
              <h3 className="mt-0.5 text-lg font-extrabold text-gray-900">
                Restock from Supplier
              </h3>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded-md p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
              aria-label="Close"
            >
              <X className="h-5 w-5" />
            </button>
          </header>
          <div className="flex-1 space-y-3 overflow-y-auto px-5 py-4">
            <div>
              <label className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-gray-500">
                Supplier
              </label>
              <select
                value={supplier}
                onChange={(e) => setSupplier(e.target.value)}
                className="h-10 w-full rounded-lg border border-gray-200 bg-white px-3 text-sm font-medium text-gray-700 focus:border-orange-300 focus:outline-none focus:ring-2 focus:ring-orange-100"
              >
                {suppliers.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>

            {filteredLow.length > 0 && (
              <Section title="Low / Out-of-Stock from this supplier">
                <ul className="space-y-1.5">
                  {filteredLow.map((i) => (
                    <ItemRow
                      key={i.id}
                      item={i}
                      checked={chosen.has(i.id)}
                      qty={qtys[i.id] ?? 1}
                      lowFlag
                      onToggle={() => toggleItem(i.id)}
                      onQty={(q) =>
                        setQtys((m) => ({ ...m, [i.id]: q }))
                      }
                    />
                  ))}
                </ul>
              </Section>
            )}

            {otherItems.length > 0 && (
              <Section title="Other items from this supplier">
                <ul className="max-h-48 space-y-1.5 overflow-y-auto">
                  {otherItems.map((i) => (
                    <ItemRow
                      key={i.id}
                      item={i}
                      checked={chosen.has(i.id)}
                      qty={qtys[i.id] ?? 1}
                      onToggle={() => toggleItem(i.id)}
                      onQty={(q) =>
                        setQtys((m) => ({ ...m, [i.id]: q }))
                      }
                    />
                  ))}
                </ul>
              </Section>
            )}
          </div>
          <footer className="flex items-center justify-between gap-2 border-t border-gray-200 bg-gray-50 px-5 py-3">
            <div className="text-sm text-gray-600">
              <span className="font-semibold">{chosen.size}</span> items Â·
              <span className="ml-2 font-extrabold tabular-nums text-gray-900">
                {formatINR(total)}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-100"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={submit}
                disabled={chosen.size === 0}
                className="inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-bold uppercase tracking-wide text-white shadow-sm transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40"
                style={{ backgroundColor: "var(--primary-orange)" }}
              >
                <Check className="h-4 w-4" />
                Save as Draft
              </button>
            </div>
          </footer>
        </motion.div>
      </div>
    </>
  );
}

function ItemRow({
  item,
  checked,
  qty,
  lowFlag,
  onToggle,
  onQty,
}: {
  item: InventoryItem;
  checked: boolean;
  qty: number;
  lowFlag?: boolean;
  onToggle: () => void;
  onQty: (q: number) => void;
}) {
  return (
    <li
      className={`flex items-center gap-3 rounded-lg px-2 py-1.5 ring-1 ${
        checked
          ? "bg-orange-50 ring-orange-200"
          : "bg-white ring-gray-200"
      }`}
    >
      <button
        type="button"
        onClick={onToggle}
        aria-label={`Toggle ${item.name}`}
        className="rounded p-0.5"
      >
        {checked ? (
          <CheckSquare className="h-4 w-4 text-orange-600" />
        ) : (
          <Square className="h-4 w-4 text-gray-400" />
        )}
      </button>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate text-sm font-semibold text-gray-900">
            {item.name}
          </span>
          {lowFlag && (
            <span className="rounded-full bg-red-100 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-red-700">
              {item.stock <= 0 ? "Out" : "Low"}
            </span>
          )}
        </div>
        <div className="text-[11px] text-gray-500">
          Stock {item.stock} {item.unit} Â· Min {item.minLevel} Â·{" "}
          {formatINR(item.unitPrice)}/{item.unit}
        </div>
      </div>
      <div className="flex items-center gap-1">
        <input
          type="number"
          min={0}
          value={qty}
          onChange={(e) => onQty(Math.max(0, Number(e.target.value) || 0))}
          className="h-8 w-16 rounded-md border border-gray-200 px-2 text-right text-sm font-bold tabular-nums focus:border-orange-300 focus:outline-none focus:ring-2 focus:ring-orange-100"
        />
        <span className="text-[11px] font-bold text-gray-500">{item.unit}</span>
      </div>
    </li>
  );
}

/* ============================================================
   WASTAGE
   ============================================================ */

function WastageView({
  wastage,
  inventory,
  onAdd,
}: {
  wastage: WastageEntry[];
  inventory: InventoryItem[];
  onAdd: (w: WastageEntry) => void;
}) {
  const [adding, setAdding] = useState(false);

  const totalValue = wastage.reduce((s, w) => s + wastageValue(w), 0);
  const reasonsBreakdown = useMemo(() => {
    const map = new Map<WastageReason, number>();
    for (const w of wastage) {
      map.set(w.reason, (map.get(w.reason) ?? 0) + wastageValue(w));
    }
    return Array.from(map.entries()).sort((a, b) => b[1] - a[1]);
  }, [wastage]);

  // Trend: last 8 weeks
  const trend = useMemo(() => {
    const W = 7 * 24 * 60 * 60 * 1000;
    const buckets: { label: string; value: number }[] = [];
    for (let i = 7; i >= 0; i--) {
      const start = Date.now() - i * W;
      const end = start + W;
      const v = wastage
        .filter((w) => w.at >= start && w.at < end)
        .reduce((s, w) => s + wastageValue(w), 0);
      const d = new Date(start);
      buckets.push({
        label: `${d.getDate()}/${d.getMonth() + 1}`,
        value: Math.round(v),
      });
    }
    return buckets;
  }, [wastage]);
  const maxTrend = Math.max(1, ...trend.map((b) => b.value));

  const itemName = (id: string) =>
    inventory.find((i) => i.id === id)?.name ?? "Unknown";
  const itemUnit = (id: string) =>
    inventory.find((i) => i.id === id)?.unit ?? "";

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
          <div className="text-[11px] font-bold uppercase tracking-wider text-gray-500">
            Total Wastage Value
          </div>
          <div className="mt-1 text-2xl font-extrabold text-red-600">
            {formatINR(totalValue)}
          </div>
          <div className="text-[11px] text-gray-400">
            Across {wastage.length} entries
          </div>
        </div>
        <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
          <div className="text-[11px] font-bold uppercase tracking-wider text-gray-500">
            Top Reason
          </div>
          {reasonsBreakdown[0] ? (
            <>
              <div className="mt-1 text-xl font-extrabold text-gray-900">
                {reasonsBreakdown[0][0]}
              </div>
              <div className="text-[11px] text-gray-400">
                {formatINR(Math.round(reasonsBreakdown[0][1]))} lost
              </div>
            </>
          ) : (
            <div className="mt-1 text-sm text-gray-400">â€”</div>
          )}
        </div>
        <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
          <div className="text-[11px] font-bold uppercase tracking-wider text-gray-500">
            Reasons Breakdown
          </div>
          <ul className="mt-1 space-y-0.5 text-[11px]">
            {reasonsBreakdown.slice(0, 4).map(([r, v]) => (
              <li
                key={r}
                className="flex items-center justify-between gap-2"
              >
                <span
                  className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ring-1 ${REASON_TONE[r]}`}
                >
                  {r}
                </span>
                <span className="font-semibold tabular-nums text-gray-700">
                  {formatINR(Math.round(v))}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Trend chart */}
      <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
          <div className="flex items-center gap-1.5">
            <BarChart3 className="h-4 w-4 text-gray-400" />
            <h3 className="text-sm font-bold text-gray-900">
              Wastage Trend (last 8 weeks)
            </h3>
          </div>
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-bold uppercase tracking-wide text-white shadow-sm transition hover:brightness-110"
            style={{ backgroundColor: "var(--primary-orange)" }}
          >
            <Plus className="h-3.5 w-3.5" />
            Log Wastage
          </button>
        </div>
        <div className="grid grid-cols-8 items-end gap-2 p-4 pb-2 h-44">
          {trend.map((b) => (
            <div
              key={b.label}
              className="flex h-full flex-col items-center justify-end gap-1"
            >
              <div className="text-[10px] font-bold tabular-nums text-gray-700">
                {b.value > 0 ? formatINR(b.value) : ""}
              </div>
              <div
                className="w-full rounded-t bg-red-400/80"
                style={{
                  height: `${(b.value / maxTrend) * 100}%`,
                  minHeight: b.value > 0 ? 4 : 0,
                }}
              />
              <div className="text-[10px] text-gray-500">{b.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Log table */}
      <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
        <div className="border-b border-gray-100 px-4 py-3">
          <h3 className="text-sm font-bold text-gray-900">Wastage Log</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50 text-left text-[11px] font-bold uppercase tracking-wider text-gray-500">
                <th className="px-4 py-2">Date</th>
                <th className="px-4 py-2">Item</th>
                <th className="px-4 py-2 text-right">Qty</th>
                <th className="px-4 py-2">Reason</th>
                <th className="px-4 py-2">Recorded By</th>
                <th className="px-4 py-2 text-right">Loss</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {wastage.map((w) => (
                <tr key={w.id} className="hover:bg-red-50/30">
                  <td className="px-4 py-2 text-gray-700">
                    {formatDate(w.at)}
                  </td>
                  <td className="px-4 py-2 font-semibold text-gray-900">
                    {itemName(w.inventoryId)}
                  </td>
                  <td className="px-4 py-2 text-right tabular-nums text-gray-700">
                    {w.qty} {itemUnit(w.inventoryId)}
                  </td>
                  <td className="px-4 py-2">
                    <span
                      className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ring-1 ${REASON_TONE[w.reason]}`}
                    >
                      {w.reason}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-gray-700">{w.recordedBy}</td>
                  <td className="px-4 py-2 text-right font-bold tabular-nums text-red-600">
                    âˆ’ {formatINR(wastageValue(w))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <AnimatePresence>
        {adding && (
          <WastageModal
            inventory={inventory}
            onClose={() => setAdding(false)}
            onAdd={(w) => {
              onAdd(w);
              setAdding(false);
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

function WastageModal({
  inventory,
  onClose,
  onAdd,
}: {
  inventory: InventoryItem[];
  onClose: () => void;
  onAdd: (w: WastageEntry) => void;
}) {
  const [inventoryId, setInventoryId] = useState(inventory[0]?.id ?? "");
  const [qty, setQty] = useState(1);
  const [reason, setReason] = useState<WastageReason>("Spoilage");
  const [recordedBy, setRecordedBy] = useState("Chef Ravi");
  const [note, setNote] = useState("");

  useEffect(() => {
    const original = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = original;
    };
  }, []);

  const item = inventory.find((i) => i.id === inventoryId);
  const loss = item ? Math.round(item.unitPrice * qty * 100) / 100 : 0;

  const submit = () => {
    if (!inventoryId || qty <= 0) return;
    onAdd({
      id: `ws-${Date.now().toString(36)}`,
      inventoryId,
      qty,
      reason,
      recordedBy,
      at: Date.now(),
      note: note.trim() || undefined,
    });
  };

  return (
    <>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[60] bg-gray-900/50 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.96, y: 8 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.96, y: 8 }}
          className="w-full max-w-md overflow-hidden rounded-xl bg-white shadow-2xl"
        >
          <header className="flex items-start justify-between border-b border-gray-200 px-5 py-4">
            <div>
              <div className="text-[11px] font-bold uppercase tracking-wider text-red-600">
                Log Wastage
              </div>
              <h3 className="mt-0.5 text-lg font-extrabold text-gray-900">
                Record kitchen loss
              </h3>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded-md p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
              aria-label="Close"
            >
              <X className="h-5 w-5" />
            </button>
          </header>
          <div className="space-y-3 px-5 py-4">
            <div>
              <Label>Item</Label>
              <select
                value={inventoryId}
                onChange={(e) => setInventoryId(e.target.value)}
                className="h-10 w-full rounded-lg border border-gray-200 bg-white px-3 text-sm font-medium focus:border-red-300 focus:outline-none focus:ring-2 focus:ring-red-100"
              >
                {inventory.map((i) => (
                  <option key={i.id} value={i.id}>
                    {i.name} ({formatINR(i.unitPrice)}/{i.unit})
                  </option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Quantity ({item?.unit ?? ""})</Label>
                <input
                  type="number"
                  step="0.01"
                  value={qty}
                  onChange={(e) =>
                    setQty(Math.max(0, Number(e.target.value) || 0))
                  }
                  className="h-10 w-full rounded-lg border border-gray-200 px-3 text-base font-bold tabular-nums focus:border-red-300 focus:outline-none focus:ring-2 focus:ring-red-100"
                />
              </div>
              <div>
                <Label>Estimated Loss</Label>
                <div className="flex h-10 items-center rounded-lg border border-red-200 bg-red-50 px-3 text-base font-extrabold tabular-nums text-red-600">
                  <IndianRupee className="mr-1 h-4 w-4" />
                  {formatINR(loss)}
                </div>
              </div>
            </div>
            <div>
              <Label>Reason</Label>
              <div className="flex flex-wrap gap-1.5">
                {WASTAGE_REASONS.map((r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setReason(r)}
                    className={`rounded-full px-2.5 py-1 text-[11px] font-bold ring-1 transition ${
                      reason === r
                        ? REASON_TONE[r]
                        : "bg-white text-gray-500 ring-gray-200 hover:bg-gray-50"
                    }`}
                  >
                    {r}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <Label>Recorded By</Label>
              <input
                value={recordedBy}
                onChange={(e) => setRecordedBy(e.target.value)}
                className="h-10 w-full rounded-lg border border-gray-200 px-3 text-sm focus:border-red-300 focus:outline-none focus:ring-2 focus:ring-red-100"
              />
            </div>
            <div>
              <Label>Note (optional)</Label>
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={2}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-red-300 focus:outline-none focus:ring-2 focus:ring-red-100"
              />
            </div>
          </div>
          <footer className="flex items-center gap-2 border-t border-gray-200 bg-gray-50 px-5 py-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-100"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={submit}
              disabled={qty <= 0}
              className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-red-600 px-4 py-2 text-sm font-bold uppercase tracking-wide text-white shadow-sm hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Check className="h-4 w-4" />
              Log Wastage
            </button>
          </footer>
        </motion.div>
      </div>
    </>
  );
}

/* ============================================================
   PREP LIST
   ============================================================ */

function PrepView({
  prep,
  onToggle,
  onAdd,
}: {
  prep: PrepTask[];
  onToggle: (id: string) => void;
  onAdd: (t: PrepTask) => void;
}) {
  const [label, setLabel] = useState("");
  const [qty, setQty] = useState("");
  const [station, setStation] = useState<PrepTask["station"]>("Hot");
  const [assignee, setAssignee] = useState("");

  const stations: PrepTask["station"][] = ["Hot", "Cold", "Bar", "Bakery"];
  const grouped = useMemo(() => {
    const map = new Map<PrepTask["station"], PrepTask[]>();
    stations.forEach((s) => map.set(s, []));
    prep.forEach((p) => map.get(p.station)?.push(p));
    return map;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prep]);

  const done = prep.filter((p) => p.done).length;
  const pct = prep.length > 0 ? Math.round((done / prep.length) * 100) : 0;

  const submit = () => {
    if (!label.trim() || !qty.trim()) return;
    onAdd({
      id: `pt-${Date.now().toString(36)}`,
      label: label.trim(),
      qty: qty.trim(),
      station,
      done: false,
      assignee: assignee.trim() || undefined,
    });
    setLabel("");
    setQty("");
    setAssignee("");
  };

  return (
    <div className="space-y-4">
      {/* Progress card */}
      <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-[11px] font-bold uppercase tracking-wider text-gray-500">
              Shift Readiness
            </div>
            <div className="mt-0.5 text-2xl font-extrabold text-gray-900">
              {done}/{prep.length}{" "}
              <span className="text-base text-gray-400">tasks complete</span>
            </div>
          </div>
          <div className="text-right">
            <div className="text-3xl font-extrabold text-[color:var(--primary-orange)]">
              {pct}%
            </div>
            <div className="text-[11px] text-gray-400">ready</div>
          </div>
        </div>
        <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-gray-100">
          <motion.div
            className="h-full rounded-full"
            style={{ backgroundColor: "var(--primary-orange)" }}
            animate={{ width: `${pct}%` }}
            transition={{ type: "spring", stiffness: 200, damping: 30 }}
          />
        </div>
      </div>

      {/* Quick add */}
      <div className="rounded-2xl border border-gray-200 bg-white p-3 shadow-sm">
        <div className="grid grid-cols-1 gap-2 md:grid-cols-[1fr_120px_120px_140px_auto]">
          <input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="Task â€” e.g. Chop Onions"
            className="h-10 rounded-lg border border-gray-200 px-3 text-sm focus:border-orange-300 focus:outline-none focus:ring-2 focus:ring-orange-100"
          />
          <input
            value={qty}
            onChange={(e) => setQty(e.target.value)}
            placeholder="Qty (e.g. 5 KG)"
            className="h-10 rounded-lg border border-gray-200 px-3 text-sm focus:border-orange-300 focus:outline-none focus:ring-2 focus:ring-orange-100"
          />
          <select
            value={station}
            onChange={(e) => setStation(e.target.value as PrepTask["station"])}
            className="h-10 rounded-lg border border-gray-200 bg-white px-3 text-sm font-medium focus:border-orange-300 focus:outline-none focus:ring-2 focus:ring-orange-100"
          >
            {stations.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
          <input
            value={assignee}
            onChange={(e) => setAssignee(e.target.value)}
            placeholder="Assign to (optional)"
            className="h-10 rounded-lg border border-gray-200 px-3 text-sm focus:border-orange-300 focus:outline-none focus:ring-2 focus:ring-orange-100"
          />
          <button
            type="button"
            onClick={submit}
            disabled={!label.trim() || !qty.trim()}
            className="inline-flex items-center justify-center gap-1.5 rounded-lg px-4 py-2 text-xs font-bold uppercase tracking-wide text-white shadow-sm transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40"
            style={{ backgroundColor: "var(--primary-orange)" }}
          >
            <Plus className="h-3.5 w-3.5" />
            Add Task
          </button>
        </div>
      </div>

      {/* Grouped tasks */}
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
        {stations.map((s) => {
          const list = grouped.get(s) ?? [];
          const sDone = list.filter((p) => p.done).length;
          return (
            <div
              key={s}
              className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm"
            >
              <div className="flex items-center justify-between border-b border-gray-100 px-3 py-2">
                <div className="flex items-center gap-1.5">
                  <Flame
                    className={`h-4 w-4 ${
                      s === "Hot"
                        ? "text-red-500"
                        : s === "Cold"
                          ? "text-blue-500"
                          : s === "Bar"
                            ? "text-purple-500"
                            : "text-amber-500"
                    }`}
                  />
                  <span className="text-sm font-bold text-gray-900">{s}</span>
                </div>
                <span className="text-[11px] font-bold tabular-nums text-gray-500">
                  {sDone}/{list.length}
                </span>
              </div>
              <ul className="divide-y divide-gray-100">
                {list.length === 0 ? (
                  <li className="px-3 py-6 text-center text-xs text-gray-400">
                    No tasks
                  </li>
                ) : (
                  list.map((p) => (
                    <li key={p.id}>
                      <button
                        type="button"
                        onClick={() => onToggle(p.id)}
                        className={`flex w-full items-start gap-2 px-3 py-2.5 text-left transition ${
                          p.done ? "bg-emerald-50/40" : "hover:bg-gray-50"
                        }`}
                      >
                        {p.done ? (
                          <CheckSquare className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                        ) : (
                          <Square className="mt-0.5 h-4 w-4 shrink-0 text-gray-400" />
                        )}
                        <div className="min-w-0 flex-1">
                          <div
                            className={`text-sm font-semibold ${
                              p.done
                                ? "text-gray-400 line-through"
                                : "text-gray-900"
                            }`}
                          >
                            {p.label}
                          </div>
                          <div className="text-[11px] text-gray-500">
                            {p.qty}
                            {p.assignee && ` Â· ${p.assignee}`}
                          </div>
                        </div>
                      </button>
                    </li>
                  ))
                )}
              </ul>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ---------- Misc helpers ---------- */

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <div className="mb-1.5 text-[11px] font-bold uppercase tracking-wider text-gray-500">
        {title}
      </div>
      {children}
    </section>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <label className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-gray-500">
      {children}
    </label>
  );
}

/* ============================================================
   CHECK-IN MODAL â€” per-line partial delivery inputs
   ============================================================ */

function CheckInModal({
  po,
  inventory,
  onClose,
  onConfirm,
}: {
  po: PurchaseOrder;
  inventory: InventoryItem[];
  onClose: () => void;
  onConfirm: (qtys: Record<string, number>) => void;
}) {
  const pendingLines = po.lines.filter((l) => l.qty - l.receivedQty > 0);
  const [qtys, setQtys] = useState<Record<string, number>>(() => {
    const init: Record<string, number> = {};
    for (const l of pendingLines) {
      init[l.inventoryId] = l.qty - l.receivedQty;
    }
    return init;
  });

  const lineLabel = (l: POLine) =>
    inventory.find((i) => i.id === l.inventoryId)?.name ?? "Unknown";
  const lineUnit = (l: POLine) =>
    inventory.find((i) => i.id === l.inventoryId)?.unit ?? "";

  const receiveTotal = pendingLines.reduce(
    (s, l) => s + (qtys[l.inventoryId] ?? 0) * l.unitPrice,
    0,
  );

  const handleSetQty = (inventoryId: string, maxRemaining: number, raw: string) => {
    const v = Math.max(0, Math.min(maxRemaining, Number(raw) || 0));
    setQtys((prev) => ({ ...prev, [inventoryId]: v }));
  };

  return (
    <>
      <motion.div
        key="checkin-backdrop"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-40 bg-black/30 backdrop-blur-sm"
        onClick={onClose}
      />
      <motion.div
        key="checkin-modal"
        initial={{ opacity: 0, scale: 0.95, y: 16 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 16 }}
        transition={{ type: "spring", stiffness: 420, damping: 30 }}
        className="fixed inset-x-4 top-1/2 z-50 mx-auto max-w-lg -translate-y-1/2 overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-2xl"
      >
        <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
          <div>
            <div className="flex items-center gap-2">
              <PackageCheck className="h-4 w-4 text-emerald-600" />
              <span className="font-bold text-gray-900">
                Check-In Delivery Â· {po.id}
              </span>
            </div>
            <p className="mt-0.5 text-xs text-gray-500">
              Enter actual qty received per line. Leave at zero to skip.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="max-h-[60vh] overflow-y-auto p-5">
          {pendingLines.length === 0 ? (
            <p className="text-sm text-gray-500">All lines are fully received.</p>
          ) : (
            <div className="space-y-4">
              {pendingLines.map((l) => {
                const remaining = l.qty - l.receivedQty;
                return (
                  <div key={l.inventoryId}>
                    <div className="mb-1.5 flex items-baseline justify-between">
                      <span className="font-semibold text-gray-800">
                        {lineLabel(l)}
                      </span>
                      <span className="text-[11px] text-gray-500">
                        Ordered {l.qty} Â· received {l.receivedQty} Â· pending{" "}
                        {remaining} {lineUnit(l)}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        min={0}
                        max={remaining}
                        step="0.5"
                        value={qtys[l.inventoryId] ?? ""}
                        onChange={(e) =>
                          handleSetQty(l.inventoryId, remaining, e.target.value)
                        }
                        className="h-9 w-28 rounded-lg border border-gray-200 px-2.5 text-right text-sm font-semibold tabular-nums focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-100"
                      />
                      <span className="text-sm text-gray-500">
                        {lineUnit(l)} @ {formatINR(l.unitPrice)} ={" "}
                        <strong>
                          {formatINR((qtys[l.inventoryId] ?? 0) * l.unitPrice)}
                        </strong>
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="flex items-center justify-between border-t border-gray-100 px-5 py-4">
          <div className="text-sm font-bold text-gray-700">
            Total receiving:{" "}
            <span className="text-emerald-600">{formatINR(receiveTotal)}</span>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-gray-200 px-4 py-2 text-xs font-bold uppercase tracking-wide text-gray-600 hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => onConfirm(qtys)}
              disabled={receiveTotal === 0}
              className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2 text-xs font-bold uppercase tracking-wide text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <PackageCheck className="h-3.5 w-3.5" />
              Confirm Receipt
            </button>
          </div>
        </div>
      </motion.div>
    </>
  );
}

/* Re-export to avoid unused-import hint */
export const __unused = { Pencil };
