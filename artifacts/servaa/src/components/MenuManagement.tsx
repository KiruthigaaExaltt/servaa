import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Plus,
  Pencil,
  Trash2,
  X,
  Check,
  Search,
  GripVertical,
  Image as ImageIcon,
  Upload,
  CheckSquare,
  Square,
  Percent,
  IndianRupee,
  Download,
  Printer,
  FileText,
  ChevronDown,
  Tag,
  ChefHat,
  Leaf,
  Drumstick,
  Wheat,
  Sprout,
  AlertTriangle,
  Clock,
  Truck,
  UtensilsCrossed,
  Layers,
  Sparkles,
} from "lucide-react";
import {
  DIETARY_TAGS,
  ORDER_SOURCES,
  SEED_COMBOS,
  SEED_MENU_CATEGORIES,
  SEED_MENU_ITEMS,
  STATION_OPTIONS,
  TAX_CATEGORIES,
  computeEffectivePrice,
  emptyDynamicPricing,
  formatINR,
  getThumbUrl,
  type ComboMeal,
  type ComboSlot,
  type DietaryTag,
  type DynamicPricing,
  type MenuCategoryAdmin,
  type MenuItemAdmin,
  type OrderSource,
  type PriceAdjustType,
  type SourcePricingRule,
  type TaxCategoryId,
  type TimePricingRule,
} from "@/lib/menuAdmin";
import { useCollectionState } from "@/lib/collectionState";
import type { StationId } from "@/types";
import { stationForCategory } from "@/lib/categories";
import type { MenuItemAddon, MenuItemSize } from "@/lib/menu";

const DIETARY_ICON: Record<DietaryTag, typeof Leaf> = {
  Veg: Leaf,
  "Non-Veg": Drumstick,
  Vegan: Sprout,
  "Gluten-Free": Wheat,
};

const DIETARY_TONE: Record<DietaryTag, string> = {
  Veg: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  "Non-Veg": "bg-red-50 text-red-700 ring-red-200",
  Vegan: "bg-lime-50 text-lime-700 ring-lime-200",
  "Gluten-Free": "bg-amber-50 text-amber-700 ring-amber-200",
};

const STATION_TONE: Record<StationId, string> = {
  Hot: "bg-red-50 text-red-700 ring-red-200",
  Cold: "bg-blue-50 text-blue-700 ring-blue-200",
  Bar: "bg-purple-50 text-purple-700 ring-purple-200",
};

interface Toast {
  id: number;
  text: string;
  tone: "success" | "info" | "warn";
}

export function MenuManagement() {
  const [categories, setCategories] = useCollectionState<MenuCategoryAdmin[]>("menu_categories", SEED_MENU_CATEGORIES);
  const [items, setItems] = useCollectionState<MenuItemAdmin[]>("menu_items", SEED_MENU_ITEMS);
  const [combos, setCombos] = useCollectionState<ComboMeal[]>("menu_combos", SEED_COMBOS);
  const [view, setView] = useState<"items" | "combos">("items");
  const [editingCombo, setEditingCombo] = useState<ComboMeal | null>(null);
  const [creatingCombo, setCreatingCombo] = useState(false);
  const [query, setQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState<string>("All");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [editing, setEditing] = useState<MenuItemAdmin | null>(null);
  const [creating, setCreating] = useState(false);
  const [renamingCategoryId, setRenamingCategoryId] = useState<string | null>(
    null,
  );
  const [bulkOpen, setBulkOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [bulkPriceModal, setBulkPriceModal] = useState(false);
  const [toasts, setToasts] = useState<Toast[]>([]);

  const dragId = useRef<string | null>(null);

  const pushToast = (text: string, tone: Toast["tone"] = "success") => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, text, tone }]);
    window.setTimeout(
      () => setToasts((t) => t.filter((x) => x.id !== id)),
      2800,
    );
  };

  const sortedCategories = useMemo(
    () => [...categories].sort((a, b) => a.sortOrder - b.sortOrder),
    [categories],
  );

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items
      .filter((it) => {
        if (activeCategory !== "All" && it.category !== activeCategory)
          return false;
        if (
          q &&
          !it.name.toLowerCase().includes(q) &&
          !it.description.toLowerCase().includes(q)
        )
          return false;
        return true;
      })
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [items, query, activeCategory]);

  const allVisibleSelected =
    visible.length > 0 && visible.every((i) => selected.has(i.id));

  const stats = useMemo(() => {
    const total = items.length;
    const available = items.filter((i) => i.isAvailable).length;
    const veg = items.filter((i) => i.isVeg).length;
    return { total, available, soldOut: total - available, veg };
  }, [items]);

  const getCategoryLabel = (id: string) =>
    categories.find((c) => c.id === id)?.label ?? id;

  /* ---------- Category CRUD ---------- */

  const addCategory = () => {
    const id = `cat-${Date.now().toString(36)}`;
    const sortOrder =
      Math.max(0, ...categories.map((c) => c.sortOrder)) + 1;
    setCategories((arr) => [
      ...arr,
      { id, label: `New Category ${arr.length + 1}`, sortOrder },
    ]);
    setRenamingCategoryId(id);
    pushToast("Category added");
  };

  const renameCategory = (id: string, label: string) => {
    setCategories((arr) =>
      arr.map((c) => (c.id === id ? { ...c, label } : c)),
    );
  };

  const deleteCategory = (id: string) => {
    const inUse = items.some((i) => i.category === id);
    const c = categories.find((x) => x.id === id);
    if (!c) return;
    if (inUse) {
      pushToast(`Move items out of "${c.label}" first`, "warn");
      return;
    }
    setCategories((arr) => arr.filter((c) => c.id !== id));
    if (activeCategory === id) setActiveCategory("All");
    pushToast(`Category "${c.label}" deleted`);
  };

  const handleDragStart = (id: string) => {
    dragId.current = id;
  };
  const handleDragOver = (e: React.DragEvent, overId: string) => {
    e.preventDefault();
    const from = dragId.current;
    if (!from || from === overId) return;
    setCategories((arr) => {
      const sorted = [...arr].sort((a, b) => a.sortOrder - b.sortOrder);
      const fromIdx = sorted.findIndex((c) => c.id === from);
      const toIdx = sorted.findIndex((c) => c.id === overId);
      if (fromIdx < 0 || toIdx < 0) return arr;
      const [moved] = sorted.splice(fromIdx, 1);
      sorted.splice(toIdx, 0, moved);
      return sorted.map((c, i) => ({ ...c, sortOrder: i }));
    });
  };
  const handleDragEnd = () => {
    dragId.current = null;
  };

  /* ---------- Item CRUD ---------- */

  const saveItem = (it: MenuItemAdmin, isNew: boolean) => {
    if (isNew) {
      setItems((arr) => [...arr, it]);
      pushToast(`"${it.name}" added to menu`);
    } else {
      setItems((arr) => arr.map((x) => (x.id === it.id ? it : x)));
      pushToast(`"${it.name}" updated`);
    }
    setEditing(null);
    setCreating(false);
  };

  const deleteItem = (id: string) => {
    const it = items.find((i) => i.id === id);
    setItems((arr) => arr.filter((i) => i.id !== id));
    setSelected((s) => {
      const n = new Set(s);
      n.delete(id);
      return n;
    });
    // Keep combos referentially intact: strip the item from every slot and
    // auto-disable any combo left with an empty slot so invalid bundles can't sell.
    setCombos((arr) =>
      arr.map((combo) => {
        if (!combo.slots.some((s) => s.itemIds.includes(id))) return combo;
        const slots = combo.slots.map((s) => ({
          ...s,
          itemIds: s.itemIds.filter((iid) => iid !== id),
        }));
        const hasEmptySlot = slots.some((s) => s.itemIds.length === 0);
        return {
          ...combo,
          slots,
          isAvailable: hasEmptySlot ? false : combo.isAvailable,
        };
      }),
    );
    setEditing(null);
    if (it) pushToast(`"${it.name}" removed`);
  };

  const toggleAvailable = (id: string) => {
    setItems((arr) =>
      arr.map((i) =>
        i.id === id ? { ...i, isAvailable: !i.isAvailable } : i,
      ),
    );
    const it = items.find((i) => i.id === id);
    if (it) {
      pushToast(
        `${it.name} â†’ ${!it.isAvailable ? "Available" : "Sold Out"}`,
        !it.isAvailable ? "success" : "info",
      );
    }
  };

  /* ---------- Combo CRUD ---------- */

  const saveCombo = (c: ComboMeal, isNew: boolean) => {
    if (isNew) {
      setCombos((arr) => [...arr, c]);
      pushToast(`Combo "${c.name}" created`);
    } else {
      setCombos((arr) => arr.map((x) => (x.id === c.id ? c : x)));
      pushToast(`Combo "${c.name}" updated`);
    }
    setEditingCombo(null);
    setCreatingCombo(false);
  };

  const deleteCombo = (id: string) => {
    const c = combos.find((x) => x.id === id);
    setCombos((arr) => arr.filter((x) => x.id !== id));
    setEditingCombo(null);
    if (c) pushToast(`Combo "${c.name}" removed`);
  };

  const toggleComboAvailable = (id: string) => {
    setCombos((arr) =>
      arr.map((c) => (c.id === id ? { ...c, isAvailable: !c.isAvailable } : c)),
    );
  };

  /* ---------- Selection ---------- */
  const toggleSelect = (id: string) => {
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  };
  const toggleSelectAllVisible = () => {
    if (allVisibleSelected) setSelected(new Set());
    else setSelected(new Set(visible.map((i) => i.id)));
  };

  /* ---------- Bulk Pricing ---------- */
  const applyBulkPrice = (mode: "percent" | "amount", value: number) => {
    if (!Number.isFinite(value) || value === 0) return;
    const ids = Array.from(selected);
    setItems((arr) =>
      arr.map((it) => {
        if (!selected.has(it.id)) return it;
        const next =
          mode === "percent"
            ? Math.max(0, Math.round(it.basePrice * (1 + value / 100)))
            : Math.max(0, it.basePrice + value);
        return { ...it, basePrice: next };
      }),
    );
    pushToast(
      `Repriced ${ids.length} item${ids.length === 1 ? "" : "s"} (${
        mode === "percent" ? `${value > 0 ? "+" : ""}${value}%` : `${value > 0 ? "+" : ""}${formatINR(value)}`
      })`,
    );
    setBulkPriceModal(false);
    setBulkOpen(false);
  };

  /* ---------- Export ---------- */
  const exportCSV = () => {
    const header = [
      "ID",
      "Name",
      "Category",
      "Station",
      "Base Price",
      "Tax",
      "Veg",
      "Dietary",
      "Available",
      "Variants",
      "Add-ons",
    ];
    const rows = visible.map((it) => [
      it.id,
      it.name,
      getCategoryLabel(it.category),
      it.station,
      it.basePrice.toFixed(2),
      TAX_CATEGORIES.find((t) => t.id === it.taxCategory)?.label ?? "",
      it.isVeg ? "Veg" : "Non-Veg",
      it.dietaryTags.join("|"),
      it.isAvailable ? "Yes" : "No",
      it.variants.map((v) => `${v.label}(+${v.priceDelta})`).join("|"),
      it.addons.map((a) => `${a.label}(+${a.price})`).join("|"),
    ]);
    const csv = [header, ...rows]
      .map((r) =>
        r
          .map((c) => {
            const s = String(c);
            return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
          })
          .join(","),
      )
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `servaa-menu-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    pushToast(`Exported ${visible.length} items to CSV`, "info");
    setExportOpen(false);
  };

  const exportPDF = () => {
    window.print();
    pushToast("Print dialog opened â€” save as PDF", "info");
    setExportOpen(false);
  };

  return (
    <div className="space-y-4">
      {/* KPI */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Total Items" value={stats.total.toString()} />
        <Stat
          label="Available"
          value={stats.available.toString()}
          accent="emerald"
        />
        <Stat
          label="Sold Out"
          value={stats.soldOut.toString()}
          accent={stats.soldOut > 0 ? "red" : "slate"}
        />
        <Stat label="Veg" value={stats.veg.toString()} accent="emerald" />
      </div>

      {/* View toggle: Ã -la-carte items vs combo meals */}
      <div className="flex items-center gap-1 rounded-xl border border-gray-200 bg-white p-1 shadow-sm sm:w-fit">
        <button
          type="button"
          onClick={() => setView("items")}
          className={`inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg px-4 py-2 text-xs font-bold uppercase tracking-wide transition sm:flex-none ${
            view === "items"
              ? "bg-gray-900 text-white shadow"
              : "text-gray-500 hover:bg-gray-100"
          }`}
        >
          <UtensilsCrossed className="h-3.5 w-3.5" />
          Ã€ la carte
          <span
            className={`ml-1 rounded-full px-1.5 py-0.5 text-[10px] ${
              view === "items"
                ? "bg-white/20 text-white"
                : "bg-gray-100 text-gray-500"
            }`}
          >
            {items.length}
          </span>
        </button>
        <button
          type="button"
          onClick={() => setView("combos")}
          className={`inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg px-4 py-2 text-xs font-bold uppercase tracking-wide transition sm:flex-none ${
            view === "combos"
              ? "bg-gray-900 text-white shadow"
              : "text-gray-500 hover:bg-gray-100"
          }`}
        >
          <Layers className="h-3.5 w-3.5" />
          Combo Meals
          <span
            className={`ml-1 rounded-full px-1.5 py-0.5 text-[10px] ${
              view === "combos"
                ? "bg-white/20 text-white"
                : "bg-gray-100 text-gray-500"
            }`}
          >
            {combos.length}
          </span>
        </button>
      </div>

      {view === "combos" && (
        <ComboBoard
          combos={combos}
          items={items}
          getCategoryLabel={getCategoryLabel}
          onCreate={() => setCreatingCombo(true)}
          onEdit={(c) => setEditingCombo(c)}
          onToggleAvailable={toggleComboAvailable}
        />
      )}

      {view === "items" && (
        <>
      {/* Category strip */}
      <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
        <div className="mb-3 flex items-center justify-between">
          <div>
            <div className="text-[11px] font-bold uppercase tracking-wider text-gray-500">
              Categories
            </div>
            <p className="text-xs text-gray-400">
              Drag to reorder how they appear on the FOH ordering screen.
            </p>
          </div>
          <button
            type="button"
            onClick={addCategory}
            className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-bold uppercase tracking-wide text-white shadow-sm transition hover:brightness-110"
            style={{ backgroundColor: "var(--primary-orange)" }}
          >
            <Plus className="h-3.5 w-3.5" />
            Add Category
          </button>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setActiveCategory("All")}
            className={`rounded-full px-3 py-1.5 text-xs font-bold uppercase tracking-wide transition ${
              activeCategory === "All"
                ? "bg-gray-900 text-white"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
          >
            All ({items.length})
          </button>
          {sortedCategories.map((c) => {
            const count = items.filter((i) => i.category === c.id).length;
            const isActive = activeCategory === c.id;
            const isRenaming = renamingCategoryId === c.id;
            return (
              <div
                key={c.id}
                draggable={!isRenaming}
                onDragStart={() => handleDragStart(c.id)}
                onDragOver={(e) => handleDragOver(e, c.id)}
                onDragEnd={handleDragEnd}
                onClick={() => !isRenaming && setActiveCategory(c.id)}
                className={`group flex cursor-grab items-center gap-1.5 rounded-full px-2.5 py-1.5 ring-1 transition active:cursor-grabbing ${
                  isActive
                    ? "bg-orange-50 text-orange-700 ring-orange-300"
                    : "bg-gray-50 text-gray-700 ring-gray-200 hover:bg-orange-50/60 hover:ring-orange-200"
                }`}
              >
                <GripVertical className="h-3 w-3 text-gray-300 group-hover:text-gray-500" />
                {isRenaming ? (
                  <input
                    autoFocus
                    defaultValue={c.label}
                    onClick={(e) => e.stopPropagation()}
                    onBlur={(e) => {
                      renameCategory(c.id, e.target.value.trim() || c.label);
                      setRenamingCategoryId(null);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter")
                        (e.target as HTMLInputElement).blur();
                      if (e.key === "Escape") setRenamingCategoryId(null);
                    }}
                    className="w-32 rounded border-0 bg-white/70 px-1 py-0 text-sm font-semibold text-gray-900 focus:outline-none focus:ring-2 focus:ring-orange-200"
                  />
                ) : (
                  <span className="text-sm font-semibold">{c.label}</span>
                )}
                <span className="text-[11px] font-bold text-gray-400">
                  {count}
                </span>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setRenamingCategoryId(c.id);
                  }}
                  className="rounded p-0.5 text-gray-400 opacity-0 transition group-hover:opacity-100 hover:bg-white hover:text-gray-700"
                  aria-label={`Rename ${c.label}`}
                >
                  <Pencil className="h-3 w-3" />
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    deleteCategory(c.id);
                  }}
                  className="rounded p-0.5 text-gray-400 opacity-0 transition group-hover:opacity-100 hover:bg-white hover:text-red-600"
                  aria-label={`Delete ${c.label}`}
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* Toolbar */}
      <div className="rounded-2xl border border-gray-200 bg-white p-3 shadow-sm">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative min-w-[260px] flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search dishesâ€¦"
              className="w-full rounded-lg border border-gray-200 bg-white py-2 pl-9 pr-3 text-sm placeholder:text-gray-400 focus:border-orange-300 focus:outline-none focus:ring-2 focus:ring-orange-100"
            />
          </div>
          <button
            type="button"
            onClick={toggleSelectAllVisible}
            className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-700 hover:border-orange-300 hover:bg-orange-50"
          >
            {allVisibleSelected ? (
              <CheckSquare className="h-4 w-4 text-orange-600" />
            ) : (
              <Square className="h-4 w-4" />
            )}
            Select all visible
          </button>
          <div className="relative">
            <button
              type="button"
              onClick={() => setExportOpen((o) => !o)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-bold uppercase tracking-wide text-gray-700 hover:border-orange-300 hover:bg-orange-50"
            >
              <Download className="h-3.5 w-3.5" />
              Export Menu
              <ChevronDown className="h-3 w-3" />
            </button>
            {exportOpen && (
              <div className="absolute right-0 top-full z-10 mt-1 w-44 overflow-hidden rounded-lg border border-gray-200 bg-white shadow-lg">
                <button
                  type="button"
                  onClick={exportCSV}
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs font-semibold text-gray-700 hover:bg-orange-50"
                >
                  <FileText className="h-3.5 w-3.5" />
                  Export as CSV
                </button>
                <button
                  type="button"
                  onClick={exportPDF}
                  className="flex w-full items-center gap-2 border-t border-gray-100 px-3 py-2 text-left text-xs font-semibold text-gray-700 hover:bg-orange-50"
                >
                  <Printer className="h-3.5 w-3.5" />
                  Print / PDF
                </button>
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={() => setCreating(true)}
            className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-bold uppercase tracking-wide text-white shadow-sm transition hover:brightness-110"
            style={{ backgroundColor: "var(--primary-orange)" }}
          >
            <Plus className="h-3.5 w-3.5" />
            Add Item
          </button>
        </div>
      </div>

      {/* Item grid */}
      {visible.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-gray-300 bg-white p-12 text-center text-sm text-gray-400">
          No menu items match those filters.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {visible.map((it) => (
            <ItemCard
              key={it.id}
              item={it}
              categoryLabel={getCategoryLabel(it.category)}
              selected={selected.has(it.id)}
              onSelect={() => toggleSelect(it.id)}
              onEdit={() => setEditing(it)}
              onToggleAvailable={() => toggleAvailable(it.id)}
            />
          ))}
        </div>
      )}
        </>
      )}

      {/* Bulk action bar */}
      <AnimatePresence>
        {selected.size > 0 && (
          <motion.div
            initial={{ y: 80, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 80, opacity: 0 }}
            transition={{ type: "spring", stiffness: 320, damping: 28 }}
            className="fixed bottom-6 left-1/2 z-40 flex -translate-x-1/2 items-center gap-2 rounded-full border border-gray-200 bg-white px-3 py-2 shadow-2xl"
          >
            <span className="rounded-full bg-orange-100 px-3 py-1 text-xs font-bold text-orange-700">
              {selected.size} selected
            </span>
            <button
              type="button"
              onClick={() => setBulkPriceModal(true)}
              className="inline-flex items-center gap-1.5 rounded-full border border-gray-200 bg-white px-3 py-1.5 text-xs font-bold uppercase tracking-wide text-gray-700 hover:border-orange-300 hover:bg-orange-50"
            >
              <Percent className="h-3.5 w-3.5" />
              Bulk Update Prices
            </button>
            <button
              type="button"
              onClick={() => {
                const ids = Array.from(selected);
                setItems((arr) =>
                  arr.map((i) =>
                    selected.has(i.id) ? { ...i, isAvailable: true } : i,
                  ),
                );
                pushToast(`${ids.length} items marked Available`);
              }}
              className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-white px-3 py-1.5 text-xs font-bold uppercase tracking-wide text-emerald-700 hover:bg-emerald-50"
            >
              <Check className="h-3.5 w-3.5" />
              Mark Available
            </button>
            <button
              type="button"
              onClick={() => {
                const ids = Array.from(selected);
                setItems((arr) =>
                  arr.map((i) =>
                    selected.has(i.id) ? { ...i, isAvailable: false } : i,
                  ),
                );
                pushToast(`${ids.length} items marked Sold Out`, "warn");
              }}
              className="inline-flex items-center gap-1.5 rounded-full border border-red-200 bg-white px-3 py-1.5 text-xs font-bold uppercase tracking-wide text-red-700 hover:bg-red-50"
            >
              <X className="h-3.5 w-3.5" />
              Mark Sold Out
            </button>
            <button
              type="button"
              onClick={() => setSelected(new Set())}
              className="ml-1 rounded-full p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
              aria-label="Clear selection"
            >
              <X className="h-4 w-4" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Modals */}
      <AnimatePresence>
        {(editing || creating) && (
          <ItemModal
            key={editing?.id ?? "new"}
            existing={editing}
            categories={sortedCategories}
            onClose={() => {
              setEditing(null);
              setCreating(false);
            }}
            onSave={saveItem}
            onDelete={editing ? () => deleteItem(editing.id) : undefined}
          />
        )}
        {bulkPriceModal && (
          <BulkPriceModal
            count={selected.size}
            onClose={() => setBulkPriceModal(false)}
            onApply={applyBulkPrice}
          />
        )}
        {(editingCombo || creatingCombo) && (
          <ComboBuilderModal
            key={editingCombo?.id ?? "new-combo"}
            existing={editingCombo}
            items={items}
            categories={sortedCategories}
            onClose={() => {
              setEditingCombo(null);
              setCreatingCombo(false);
            }}
            onSave={saveCombo}
            onDelete={
              editingCombo ? () => deleteCombo(editingCombo.id) : undefined
            }
          />
        )}
      </AnimatePresence>

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

      {bulkOpen && null}
    </div>
  );
}

/* ---------- Stat ---------- */

function Stat({
  label,
  value,
  accent = "slate",
}: {
  label: string;
  value: string;
  accent?: "slate" | "emerald" | "red" | "orange";
}) {
  const tone =
    accent === "emerald"
      ? "text-emerald-600"
      : accent === "red"
        ? "text-red-600"
        : accent === "orange"
          ? "text-[color:var(--primary-orange)]"
          : "text-gray-900";
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
      <div className="text-[11px] font-bold uppercase tracking-wider text-gray-500">
        {label}
      </div>
      <div className={`mt-0.5 text-2xl font-extrabold ${tone}`}>{value}</div>
    </div>
  );
}

/* ---------- Item Card ---------- */

function ItemCard({
  item,
  categoryLabel,
  selected,
  onSelect,
  onEdit,
  onToggleAvailable,
}: {
  item: MenuItemAdmin;
  categoryLabel: string;
  selected: boolean;
  onSelect: () => void;
  onEdit: () => void;
  onToggleAvailable: () => void;
}) {
  return (
    <div
      className={`group relative overflow-hidden rounded-2xl border bg-white shadow-sm transition ${
        selected
          ? "border-orange-300 ring-2 ring-orange-200"
          : "border-gray-200 hover:border-orange-200"
      } ${!item.isAvailable ? "opacity-70" : ""}`}
    >
      <div className="relative h-32 w-full overflow-hidden bg-gray-100">
        <img
          src={getThumbUrl(item.imageSeed)}
          alt={item.name}
          className="h-full w-full object-cover"
          loading="lazy"
        />
        {/* Veg/non-veg dot */}
        <div className="absolute left-2 top-2 flex h-5 w-5 items-center justify-center rounded-sm border-2 border-white bg-white shadow">
          <span
            className={`block h-2.5 w-2.5 rounded-full ${
              item.isVeg ? "bg-emerald-500" : "bg-red-600"
            }`}
          />
        </div>
        {/* Select checkbox */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onSelect();
          }}
          className="absolute right-2 top-2 rounded-md bg-white/90 p-1 shadow"
          aria-label="Select"
        >
          {selected ? (
            <CheckSquare className="h-4 w-4 text-orange-600" />
          ) : (
            <Square className="h-4 w-4 text-gray-500" />
          )}
        </button>
        {!item.isAvailable && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/30 backdrop-blur-[1px]">
            <span className="rounded-full bg-red-600 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-white shadow">
              Sold Out
            </span>
          </div>
        )}
      </div>
      <div className="p-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <h3 className="truncate text-sm font-bold text-gray-900">
              {item.name}
            </h3>
            <p className="line-clamp-2 min-h-[2lh] text-[11px] text-gray-500">
              {item.description || "No description"}
            </p>
          </div>
          <div className="text-right">
            <div className="text-base font-extrabold tabular-nums text-gray-900">
              {formatINR(item.basePrice)}
            </div>
          </div>
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-1">
          <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-semibold text-gray-600">
            <Tag className="h-3 w-3" />
            {categoryLabel}
          </span>
          <span
            className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ring-1 ${STATION_TONE[item.station]}`}
          >
            <ChefHat className="h-3 w-3" />
            {item.station}
          </span>
          {item.variants.length > 0 && (
            <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-semibold text-blue-700 ring-1 ring-blue-200">
              {item.variants.length} variants
            </span>
          )}
          {item.addons.length > 0 && (
            <span className="rounded-full bg-purple-50 px-2 py-0.5 text-[10px] font-semibold text-purple-700 ring-1 ring-purple-200">
              {item.addons.length} add-ons
            </span>
          )}
        </div>
        <div className="mt-3 flex items-center justify-between">
          <button
            type="button"
            onClick={onToggleAvailable}
            aria-pressed={item.isAvailable}
            className="group/toggle inline-flex items-center gap-1.5"
          >
            <span
              className={`relative h-5 w-9 rounded-full transition ${
                item.isAvailable ? "bg-emerald-500" : "bg-gray-300"
              }`}
            >
              <span
                className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition ${
                  item.isAvailable ? "left-[18px]" : "left-0.5"
                }`}
              />
            </span>
            <span
              className={`text-[11px] font-bold uppercase tracking-wide ${
                item.isAvailable ? "text-emerald-700" : "text-gray-400"
              }`}
            >
              {item.isAvailable ? "Available" : "Sold Out"}
            </span>
          </button>
          <button
            type="button"
            onClick={onEdit}
            className="inline-flex items-center gap-1 rounded-md border border-gray-200 px-2 py-1 text-[11px] font-semibold text-gray-600 hover:border-orange-300 hover:bg-orange-50 hover:text-orange-700"
          >
            <Pencil className="h-3 w-3" />
            Edit
          </button>
        </div>
      </div>
    </div>
  );
}

/* ---------- Item Modal ---------- */

function ItemModal({
  existing,
  categories,
  onClose,
  onSave,
  onDelete,
}: {
  existing: MenuItemAdmin | null;
  categories: MenuCategoryAdmin[];
  onClose: () => void;
  onSave: (it: MenuItemAdmin, isNew: boolean) => void;
  onDelete?: () => void;
}) {
  const isNew = !existing;
  const [name, setName] = useState(existing?.name ?? "");
  const [description, setDescription] = useState(existing?.description ?? "");
  const [category, setCategory] = useState(
    existing?.category ?? categories[0]?.id ?? "",
  );
  const [station, setStation] = useState<StationId>(
    existing?.station ?? stationForCategory(existing?.category ?? categories[0]?.id ?? ""),
  );
  const [basePrice, setBasePrice] = useState(existing?.basePrice ?? 0);
  const [isVeg, setIsVeg] = useState(existing?.isVeg ?? true);
  const [imageSeed, setImageSeed] = useState(
    existing?.imageSeed ?? `new-${Date.now().toString(36)}`,
  );
  const [taxCategory, setTaxCategory] = useState<TaxCategoryId>(
    existing?.taxCategory ?? "gst-5",
  );
  const [discountEligible, setDiscountEligible] = useState(
    existing?.discountEligible ?? true,
  );
  const [dietaryTags, setDietaryTags] = useState<DietaryTag[]>(
    existing?.dietaryTags ?? [isVeg ? "Veg" : "Non-Veg"],
  );
  const [variants, setVariants] = useState<MenuItemSize[]>(
    existing?.variants ?? [],
  );
  const [addons, setAddons] = useState<MenuItemAddon[]>(existing?.addons ?? []);
  const [dynamicPricing, setDynamicPricing] = useState<DynamicPricing>(
    existing?.dynamicPricing ?? emptyDynamicPricing(),
  );

  useEffect(() => {
    const original = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = original;
    };
  }, []);

  const toggleTag = (t: DietaryTag) =>
    setDietaryTags((arr) =>
      arr.includes(t) ? arr.filter((x) => x !== t) : [...arr, t],
    );

  const canSave = name.trim().length > 0 && basePrice >= 0 && category;

  const submit = () => {
    if (!canSave) return;
    const next: MenuItemAdmin = {
      id: existing?.id ?? `m-${Date.now().toString(36)}`,
      name: name.trim(),
      description: description.trim(),
      category,
      station,
      basePrice,
      isVeg,
      imageSeed,
      isAvailable: existing?.isAvailable ?? true,
      taxCategory,
      discountEligible,
      dietaryTags,
      variants,
      addons,
      dynamicPricing,
    };
    onSave(next, isNew);
  };

  const handleImagePick = () => {
    setImageSeed(`upload-${Date.now().toString(36)}`);
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
          className="flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-xl bg-white shadow-2xl"
        >
          <header className="flex items-start justify-between border-b border-gray-200 px-5 py-4">
            <div>
              <div className="text-[11px] font-bold uppercase tracking-wider text-orange-600">
                {isNew ? "Add New Item" : "Edit Item"}
              </div>
              <h3 className="mt-0.5 text-lg font-extrabold text-gray-900">
                {isNew ? "Configure a new dish" : (existing?.name ?? "")}
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

          <div className="flex-1 space-y-6 overflow-y-auto px-5 py-5">
            {/* General */}
            <Section title="General Info">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-[160px_1fr]">
                {/* Image */}
                <div>
                  <Label>Image</Label>
                  <div className="relative h-32 w-40 overflow-hidden rounded-lg border border-dashed border-gray-300 bg-gray-50">
                    {imageSeed ? (
                      <img
                        src={getThumbUrl(imageSeed)}
                        alt="preview"
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-gray-400">
                        <ImageIcon className="h-6 w-6" />
                      </div>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={handleImagePick}
                    className="mt-2 inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-[11px] font-bold uppercase tracking-wide text-gray-700 hover:border-orange-300 hover:bg-orange-50"
                  >
                    <Upload className="h-3 w-3" />
                    Upload Image
                  </button>
                </div>
                <div className="space-y-3">
                  <div>
                    <Label>Name</Label>
                    <input
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="e.g. Paneer Tikka"
                      className="h-10 w-full rounded-lg border border-gray-200 px-3 text-sm font-semibold focus:border-orange-300 focus:outline-none focus:ring-2 focus:ring-orange-100"
                    />
                  </div>
                  <div>
                    <Label>Description</Label>
                    <textarea
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      rows={2}
                      placeholder="Short description for FOH and printed menus"
                      className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-orange-300 focus:outline-none focus:ring-2 focus:ring-orange-100"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label>Category</Label>
                      <select
                        value={category}
                        onChange={(e) => setCategory(e.target.value)}
                        className="h-10 w-full rounded-lg border border-gray-200 bg-white px-3 text-sm font-medium focus:border-orange-300 focus:outline-none focus:ring-2 focus:ring-orange-100"
                      >
                        {categories.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.label}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <Label>Veg / Non-Veg</Label>
                      <div className="flex h-10 items-center gap-1 rounded-lg border border-gray-200 bg-gray-50 p-1">
                        {[
                          { val: true, label: "Veg", color: "emerald" },
                          { val: false, label: "Non-Veg", color: "red" },
                        ].map((opt) => (
                          <button
                            key={opt.label}
                            type="button"
                            onClick={() => setIsVeg(opt.val)}
                            className={`flex h-full flex-1 items-center justify-center gap-1.5 rounded-md text-xs font-bold ${
                              isVeg === opt.val
                                ? opt.val
                                  ? "bg-emerald-500 text-white"
                                  : "bg-red-600 text-white"
                                : "text-gray-500 hover:bg-white"
                            }`}
                          >
                            <span
                              className={`block h-2.5 w-2.5 rounded-full border-2 ${
                                isVeg === opt.val
                                  ? "border-white"
                                  : opt.val
                                    ? "border-emerald-500 bg-emerald-500"
                                    : "border-red-600 bg-red-600"
                              } ${isVeg === opt.val ? "bg-white" : ""}`}
                            />
                            {opt.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </Section>

            {/* Pricing & Taxes */}
            <Section title="Pricing & Taxes">
              <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                <div>
                  <Label>Base Price (â‚¹)</Label>
                  <div className="relative">
                    <IndianRupee className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                    <input
                      type="number"
                      min={0}
                      value={basePrice}
                      onChange={(e) =>
                        setBasePrice(Math.max(0, Number(e.target.value) || 0))
                      }
                      className="h-10 w-full rounded-lg border border-gray-200 pl-9 pr-3 text-sm font-bold tabular-nums focus:border-orange-300 focus:outline-none focus:ring-2 focus:ring-orange-100"
                    />
                  </div>
                </div>
                <div>
                  <Label>Tax Category</Label>
                  <select
                    value={taxCategory}
                    onChange={(e) =>
                      setTaxCategory(e.target.value as TaxCategoryId)
                    }
                    className="h-10 w-full rounded-lg border border-gray-200 bg-white px-3 text-sm font-medium focus:border-orange-300 focus:outline-none focus:ring-2 focus:ring-orange-100"
                  >
                    {TAX_CATEGORIES.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <Label>Discount Eligible</Label>
                  <button
                    type="button"
                    onClick={() => setDiscountEligible((v) => !v)}
                    className={`flex h-10 w-full items-center justify-between rounded-lg border px-3 text-sm font-semibold ${
                      discountEligible
                        ? "border-emerald-300 bg-emerald-50 text-emerald-700"
                        : "border-gray-200 bg-gray-50 text-gray-500"
                    }`}
                  >
                    {discountEligible ? "Eligible" : "Not eligible"}
                    <span
                      className={`relative h-5 w-9 rounded-full ${
                        discountEligible ? "bg-emerald-500" : "bg-gray-300"
                      }`}
                    >
                      <span
                        className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition ${
                          discountEligible ? "left-[18px]" : "left-0.5"
                        }`}
                      />
                    </span>
                  </button>
                </div>
              </div>
            </Section>

            {/* Dietary */}
            <Section title="Dietary Info">
              <div className="flex flex-wrap gap-2">
                {DIETARY_TAGS.map((t) => {
                  const Icon = DIETARY_ICON[t];
                  const active = dietaryTags.includes(t);
                  return (
                    <button
                      key={t}
                      type="button"
                      onClick={() => toggleTag(t)}
                      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold ring-1 transition ${
                        active
                          ? DIETARY_TONE[t]
                          : "bg-white text-gray-500 ring-gray-200 hover:bg-gray-50"
                      }`}
                    >
                      <Icon className="h-3.5 w-3.5" />
                      {t}
                    </button>
                  );
                })}
              </div>
            </Section>

            {/* Kitchen Mapping */}
            <Section title="Kitchen Mapping">
              <Label>KDS Station</Label>
              <div className="flex flex-wrap gap-2">
                {STATION_OPTIONS.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setStation(s)}
                    className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-bold uppercase tracking-wide ring-1 transition ${
                      station === s
                        ? STATION_TONE[s]
                        : "bg-white text-gray-500 ring-gray-200 hover:bg-gray-50"
                    }`}
                  >
                    <ChefHat className="h-3.5 w-3.5" />
                    {s}
                  </button>
                ))}
              </div>
              <p className="mt-1 text-[11px] text-gray-400">
                KOTs will route to this station's screen.
              </p>
            </Section>

            {/* Variants */}
            <Section title="Variants">
              <ModifierEditor
                rows={variants}
                placeholder="e.g. Large, Small, Half Plate"
                priceLabel="Î” Price"
                onChange={setVariants as (rows: ModifierRow[]) => void}
                priceKey="priceDelta"
              />
            </Section>

            {/* Add-ons */}
            <Section title="Add-ons">
              <ModifierEditor
                rows={addons}
                placeholder="e.g. Extra Cheese, No Onion"
                priceLabel="Price"
                onChange={setAddons as (rows: ModifierRow[]) => void}
                priceKey="price"
              />
            </Section>

            {/* Dynamic Pricing */}
            <Section title="Dynamic Pricing Rules">
              <DynamicPricingEditor
                basePrice={basePrice}
                pricing={dynamicPricing}
                onChange={setDynamicPricing}
              />
            </Section>
          </div>

          <footer className="flex items-center gap-2 border-t border-gray-200 bg-gray-50 px-5 py-3">
            {!isNew && onDelete && (
              <button
                type="button"
                onClick={onDelete}
                className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 bg-white px-3 py-2 text-xs font-bold uppercase tracking-wide text-red-600 hover:bg-red-50"
              >
                <Trash2 className="h-3.5 w-3.5" />
                Delete
              </button>
            )}
            <div className="ml-auto flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-100"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={!canSave}
                onClick={submit}
                className="inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-bold uppercase tracking-wide text-white shadow-sm transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40"
                style={{ backgroundColor: "var(--primary-orange)" }}
              >
                <Check className="h-4 w-4" />
                {isNew ? "Add Item" : "Save Changes"}
              </button>
            </div>
          </footer>
        </motion.div>
      </div>
    </>
  );
}

/* ---------- Modifier Editor ---------- */

type ModifierRow = MenuItemSize | MenuItemAddon;

function ModifierEditor({
  rows,
  placeholder,
  priceLabel,
  priceKey,
  onChange,
}: {
  rows: ModifierRow[];
  placeholder: string;
  priceLabel: string;
  priceKey: "priceDelta" | "price";
  onChange: (rows: ModifierRow[]) => void;
}) {
  const update = (idx: number, patch: Partial<ModifierRow>) => {
    onChange(rows.map((r, i) => (i === idx ? { ...r, ...patch } : r)));
  };
  const remove = (idx: number) => onChange(rows.filter((_, i) => i !== idx));
  const add = () =>
    onChange([
      ...rows,
      {
        id: `mod-${Date.now().toString(36)}`,
        label: "",
        ...(priceKey === "priceDelta"
          ? { priceDelta: 0 }
          : { price: 0 }),
      } as ModifierRow,
    ]);

  return (
    <div className="space-y-2">
      {rows.length === 0 && (
        <div className="rounded-lg border border-dashed border-gray-200 bg-gray-50 px-3 py-4 text-center text-xs text-gray-400">
          None â€” click "Add" below to create one.
        </div>
      )}
      {rows.map((r, idx) => {
        const price =
          priceKey === "priceDelta"
            ? (r as MenuItemSize).priceDelta
            : (r as MenuItemAddon).price;
        return (
          <div
            key={r.id ?? idx}
            className="grid grid-cols-[1fr_120px_36px] items-center gap-2"
          >
            <input
              value={r.label}
              onChange={(e) => update(idx, { label: e.target.value })}
              placeholder={placeholder}
              className="h-9 w-full rounded-lg border border-gray-200 px-3 text-sm focus:border-orange-300 focus:outline-none focus:ring-2 focus:ring-orange-100"
            />
            <div className="relative">
              <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-[11px] font-bold text-gray-400">
                {priceLabel === "Î” Price" ? "+â‚¹" : "â‚¹"}
              </span>
              <input
                type="number"
                value={price}
                onChange={(e) => {
                  const val = Number(e.target.value) || 0;
                  update(
                    idx,
                    priceKey === "priceDelta"
                      ? { priceDelta: val }
                      : { price: val },
                  );
                }}
                className="h-9 w-full rounded-lg border border-gray-200 pl-8 pr-2 text-right text-sm font-bold tabular-nums focus:border-orange-300 focus:outline-none focus:ring-2 focus:ring-orange-100"
              />
            </div>
            <button
              type="button"
              onClick={() => remove(idx)}
              className="rounded-lg p-2 text-gray-400 hover:bg-red-50 hover:text-red-600"
              aria-label="Remove"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        );
      })}
      <button
        type="button"
        onClick={add}
        className="inline-flex items-center gap-1.5 rounded-lg border border-dashed border-gray-300 bg-white px-3 py-1.5 text-xs font-bold uppercase tracking-wide text-gray-600 hover:border-orange-300 hover:bg-orange-50 hover:text-orange-700"
      >
        <Plus className="h-3.5 w-3.5" />
        Add
      </button>
    </div>
  );
}

/* ---------- Bulk Price Modal ---------- */

function BulkPriceModal({
  count,
  onClose,
  onApply,
}: {
  count: number;
  onClose: () => void;
  onApply: (mode: "percent" | "amount", value: number) => void;
}) {
  const [mode, setMode] = useState<"percent" | "amount">("percent");
  const [value, setValue] = useState<number>(10);

  return (
    <>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[70] bg-gray-900/50 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.96, y: 8 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.96, y: 8 }}
          className="w-full max-w-md overflow-hidden rounded-xl bg-white shadow-2xl"
        >
          <header className="flex items-start justify-between border-b border-gray-200 px-5 py-4">
            <div>
              <div className="text-[11px] font-bold uppercase tracking-wider text-orange-600">
                Bulk Update Prices
              </div>
              <h3 className="mt-0.5 text-lg font-extrabold text-gray-900">
                {count} item{count === 1 ? "" : "s"} selected
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
            <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              Use a negative value to reduce prices. Result is rounded to the
              nearest rupee.
            </div>
            <div className="flex h-10 items-center gap-1 rounded-lg border border-gray-200 bg-gray-50 p-1">
              <button
                type="button"
                onClick={() => setMode("percent")}
                className={`flex h-full flex-1 items-center justify-center gap-1.5 rounded-md text-xs font-bold ${
                  mode === "percent"
                    ? "bg-white text-gray-900 shadow"
                    : "text-gray-500"
                }`}
              >
                <Percent className="h-3.5 w-3.5" />
                Percentage
              </button>
              <button
                type="button"
                onClick={() => setMode("amount")}
                className={`flex h-full flex-1 items-center justify-center gap-1.5 rounded-md text-xs font-bold ${
                  mode === "amount"
                    ? "bg-white text-gray-900 shadow"
                    : "text-gray-500"
                }`}
              >
                <IndianRupee className="h-3.5 w-3.5" />
                Fixed Amount
              </button>
            </div>
            <div>
              <Label>
                {mode === "percent" ? "Change by (%)" : "Change by (â‚¹)"}
              </Label>
              <div className="relative">
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm font-bold text-gray-400">
                  {mode === "percent" ? "%" : "â‚¹"}
                </span>
                <input
                  type="number"
                  value={value}
                  onChange={(e) => setValue(Number(e.target.value) || 0)}
                  className="h-12 w-full rounded-lg border border-gray-200 pl-9 pr-3 text-2xl font-extrabold tabular-nums focus:border-orange-300 focus:outline-none focus:ring-2 focus:ring-orange-100"
                />
              </div>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {(mode === "percent"
                  ? [-20, -10, -5, 5, 10, 20]
                  : [-50, -20, -10, 10, 20, 50]
                ).map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setValue(p)}
                    className="rounded-full border border-gray-200 bg-white px-2.5 py-0.5 text-[11px] font-semibold text-gray-600 hover:border-orange-300 hover:bg-orange-50 hover:text-orange-700"
                  >
                    {p > 0 ? "+" : ""}
                    {p}
                    {mode === "percent" ? "%" : "â‚¹"}
                  </button>
                ))}
              </div>
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
              onClick={() => onApply(mode, value)}
              className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg px-4 py-2 text-sm font-bold uppercase tracking-wide text-white shadow-sm hover:brightness-110"
              style={{ backgroundColor: "var(--primary-orange)" }}
            >
              <Check className="h-4 w-4" />
              Apply to {count}
            </button>
          </footer>
        </motion.div>
      </div>
    </>
  );
}

/* ---------- Dynamic Pricing Editor ---------- */

const ADJUST_OPTIONS: { val: PriceAdjustType; label: string }[] = [
  { val: "discount", label: "Discount" },
  { val: "markup", label: "Markup" },
];

const SOURCE_ICON: Record<OrderSource, typeof Truck> = {
  "Dine-In": UtensilsCrossed,
  Takeaway: ChefHat,
  Zomato: Truck,
  Swiggy: Truck,
};

function DynamicPricingEditor({
  basePrice,
  pricing,
  onChange,
}: {
  basePrice: number;
  pricing: DynamicPricing;
  onChange: (p: DynamicPricing) => void;
}) {
  const now = new Date();
  const nowLabel = now.toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
  });

  const addTimeRule = () =>
    onChange({
      ...pricing,
      timeRules: [
        ...pricing.timeRules,
        {
          id: `time-${Date.now().toString(36)}`,
          label: "Happy Hour",
          startTime: "16:00",
          endTime: "19:00",
          adjustType: "discount",
          percent: 20,
          enabled: true,
        },
      ],
    });
  const updateTimeRule = (id: string, patch: Partial<TimePricingRule>) =>
    onChange({
      ...pricing,
      timeRules: pricing.timeRules.map((r) =>
        r.id === id ? { ...r, ...patch } : r,
      ),
    });
  const removeTimeRule = (id: string) =>
    onChange({
      ...pricing,
      timeRules: pricing.timeRules.filter((r) => r.id !== id),
    });

  const addSourceRule = () => {
    const used = new Set(pricing.sourceRules.map((r) => r.source));
    const next = ORDER_SOURCES.find((s) => !used.has(s)) ?? "Zomato";
    onChange({
      ...pricing,
      sourceRules: [
        ...pricing.sourceRules,
        {
          id: `src-${Date.now().toString(36)}`,
          source: next,
          adjustType: "markup",
          percent: 10,
          enabled: true,
        },
      ],
    });
  };
  const updateSourceRule = (id: string, patch: Partial<SourcePricingRule>) =>
    onChange({
      ...pricing,
      sourceRules: pricing.sourceRules.map((r) =>
        r.id === id ? { ...r, ...patch } : r,
      ),
    });
  const removeSourceRule = (id: string) =>
    onChange({
      ...pricing,
      sourceRules: pricing.sourceRules.filter((r) => r.id !== id),
    });

  return (
    <div className="space-y-4">
      <p className="-mt-1 text-[11px] text-gray-400">
        Automatically adjust this item's selling price by time of day or order
        channel. Rules stack on top of the base price.
      </p>

      {/* Time-based rules */}
      <div className="rounded-xl border border-gray-200 bg-gray-50/60 p-3">
        <div className="mb-2 flex items-center justify-between">
          <div className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-gray-600">
            <Clock className="h-3.5 w-3.5 text-orange-500" />
            Time-based Rules
          </div>
          <button
            type="button"
            onClick={addTimeRule}
            className="inline-flex items-center gap-1 rounded-lg border border-dashed border-gray-300 bg-white px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-gray-600 hover:border-orange-300 hover:bg-orange-50 hover:text-orange-700"
          >
            <Plus className="h-3 w-3" />
            Add
          </button>
        </div>
        {pricing.timeRules.length === 0 ? (
          <div className="rounded-lg border border-dashed border-gray-200 bg-white px-3 py-3 text-center text-[11px] text-gray-400">
            No time rules. e.g. 20% off cocktails 4â€“7 PM.
          </div>
        ) : (
          <div className="space-y-2">
            {pricing.timeRules.map((r) => (
              <div
                key={r.id}
                className="rounded-lg border border-gray-200 bg-white p-2.5"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <input
                    value={r.label}
                    onChange={(e) =>
                      updateTimeRule(r.id, { label: e.target.value })
                    }
                    placeholder="Rule name"
                    className="h-8 min-w-[120px] flex-1 rounded-md border border-gray-200 px-2 text-xs font-semibold focus:border-orange-300 focus:outline-none focus:ring-2 focus:ring-orange-100"
                  />
                  <button
                    type="button"
                    onClick={() => updateTimeRule(r.id, { enabled: !r.enabled })}
                    className={`inline-flex h-8 items-center gap-1 rounded-md px-2 text-[11px] font-bold uppercase ${
                      r.enabled
                        ? "bg-emerald-100 text-emerald-700"
                        : "bg-gray-100 text-gray-400"
                    }`}
                  >
                    {r.enabled ? "On" : "Off"}
                  </button>
                  <button
                    type="button"
                    onClick={() => removeTimeRule(r.id)}
                    className="rounded-md p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-600"
                    aria-label="Remove rule"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
                <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
                  <label className="flex flex-col gap-0.5">
                    <span className="text-[10px] font-bold uppercase tracking-wide text-gray-400">
                      From
                    </span>
                    <input
                      type="time"
                      value={r.startTime}
                      onChange={(e) =>
                        updateTimeRule(r.id, { startTime: e.target.value })
                      }
                      className="h-8 rounded-md border border-gray-200 px-2 text-xs focus:border-orange-300 focus:outline-none focus:ring-2 focus:ring-orange-100"
                    />
                  </label>
                  <label className="flex flex-col gap-0.5">
                    <span className="text-[10px] font-bold uppercase tracking-wide text-gray-400">
                      To
                    </span>
                    <input
                      type="time"
                      value={r.endTime}
                      onChange={(e) =>
                        updateTimeRule(r.id, { endTime: e.target.value })
                      }
                      className="h-8 rounded-md border border-gray-200 px-2 text-xs focus:border-orange-300 focus:outline-none focus:ring-2 focus:ring-orange-100"
                    />
                  </label>
                  <label className="flex flex-col gap-0.5">
                    <span className="text-[10px] font-bold uppercase tracking-wide text-gray-400">
                      Type
                    </span>
                    <select
                      value={r.adjustType}
                      onChange={(e) =>
                        updateTimeRule(r.id, {
                          adjustType: e.target.value as PriceAdjustType,
                        })
                      }
                      className="h-8 rounded-md border border-gray-200 bg-white px-2 text-xs font-medium focus:border-orange-300 focus:outline-none focus:ring-2 focus:ring-orange-100"
                    >
                      {ADJUST_OPTIONS.map((o) => (
                        <option key={o.val} value={o.val}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="flex flex-col gap-0.5">
                    <span className="text-[10px] font-bold uppercase tracking-wide text-gray-400">
                      Percent
                    </span>
                    <div className="relative">
                      <input
                        type="number"
                        min={0}
                        max={100}
                        value={r.percent}
                        onChange={(e) =>
                          updateTimeRule(r.id, {
                            percent: Math.max(
                              0,
                              Math.min(100, Number(e.target.value) || 0),
                            ),
                          })
                        }
                        className="h-8 w-full rounded-md border border-gray-200 pl-2 pr-6 text-right text-xs font-bold tabular-nums focus:border-orange-300 focus:outline-none focus:ring-2 focus:ring-orange-100"
                      />
                      <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-[11px] font-bold text-gray-400">
                        %
                      </span>
                    </div>
                  </label>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Source-based rules */}
      <div className="rounded-xl border border-gray-200 bg-gray-50/60 p-3">
        <div className="mb-2 flex items-center justify-between">
          <div className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-gray-600">
            <Truck className="h-3.5 w-3.5 text-orange-500" />
            Source / Channel Rules
          </div>
          <button
            type="button"
            onClick={addSourceRule}
            className="inline-flex items-center gap-1 rounded-lg border border-dashed border-gray-300 bg-white px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-gray-600 hover:border-orange-300 hover:bg-orange-50 hover:text-orange-700"
          >
            <Plus className="h-3 w-3" />
            Add
          </button>
        </div>
        {pricing.sourceRules.length === 0 ? (
          <div className="rounded-lg border border-dashed border-gray-200 bg-white px-3 py-3 text-center text-[11px] text-gray-400">
            No channel rules. e.g. +10% markup for Zomato / Swiggy.
          </div>
        ) : (
          <div className="space-y-2">
            {pricing.sourceRules.map((r) => (
              <div
                key={r.id}
                className="grid grid-cols-2 items-center gap-2 rounded-lg border border-gray-200 bg-white p-2.5 sm:grid-cols-[1fr_auto_auto_auto]"
              >
                <select
                  value={r.source}
                  onChange={(e) =>
                    updateSourceRule(r.id, {
                      source: e.target.value as OrderSource,
                    })
                  }
                  className="h-8 rounded-md border border-gray-200 bg-white px-2 text-xs font-semibold focus:border-orange-300 focus:outline-none focus:ring-2 focus:ring-orange-100"
                >
                  {ORDER_SOURCES.filter(
                    (s) =>
                      s === r.source ||
                      !pricing.sourceRules.some((o) => o.source === s),
                  ).map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
                <select
                  value={r.adjustType}
                  onChange={(e) =>
                    updateSourceRule(r.id, {
                      adjustType: e.target.value as PriceAdjustType,
                    })
                  }
                  className="h-8 rounded-md border border-gray-200 bg-white px-2 text-xs font-medium focus:border-orange-300 focus:outline-none focus:ring-2 focus:ring-orange-100"
                >
                  {ADJUST_OPTIONS.map((o) => (
                    <option key={o.val} value={o.val}>
                      {o.label}
                    </option>
                  ))}
                </select>
                <div className="relative w-20">
                  <input
                    type="number"
                    min={0}
                    max={100}
                    value={r.percent}
                    onChange={(e) =>
                      updateSourceRule(r.id, {
                        percent: Math.max(
                          0,
                          Math.min(100, Number(e.target.value) || 0),
                        ),
                      })
                    }
                    className="h-8 w-full rounded-md border border-gray-200 pl-2 pr-6 text-right text-xs font-bold tabular-nums focus:border-orange-300 focus:outline-none focus:ring-2 focus:ring-orange-100"
                  />
                  <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-[11px] font-bold text-gray-400">
                    %
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() =>
                      updateSourceRule(r.id, { enabled: !r.enabled })
                    }
                    className={`inline-flex h-8 items-center gap-1 rounded-md px-2 text-[11px] font-bold uppercase ${
                      r.enabled
                        ? "bg-emerald-100 text-emerald-700"
                        : "bg-gray-100 text-gray-400"
                    }`}
                  >
                    {r.enabled ? "On" : "Off"}
                  </button>
                  <button
                    type="button"
                    onClick={() => removeSourceRule(r.id)}
                    className="rounded-md p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-600"
                    aria-label="Remove rule"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Live preview */}
      <div className="rounded-xl border border-orange-200 bg-orange-50/50 p-3">
        <div className="mb-2 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-orange-700">
          <Sparkles className="h-3.5 w-3.5" />
          Live Price Preview
          <span className="ml-auto rounded-full bg-white px-2 py-0.5 text-[10px] font-bold text-gray-500">
            as of {nowLabel}
          </span>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {ORDER_SOURCES.map((s) => {
            const Icon = SOURCE_ICON[s];
            const { price } = computeEffectivePrice(basePrice, pricing, s, now);
            const delta = price - basePrice;
            return (
              <div
                key={s}
                className="rounded-lg border border-gray-200 bg-white px-2.5 py-2"
              >
                <div className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide text-gray-500">
                  <Icon className="h-3 w-3" />
                  {s}
                </div>
                <div className="mt-0.5 text-sm font-extrabold tabular-nums text-gray-900">
                  {formatINR(price)}
                </div>
                {delta !== 0 && (
                  <div
                    className={`text-[10px] font-bold tabular-nums ${
                      delta < 0 ? "text-emerald-600" : "text-red-600"
                    }`}
                  >
                    {delta < 0 ? "âˆ’" : "+"}
                    {formatINR(Math.abs(delta))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/* ---------- Combo Board + Card ---------- */

function comboAlaCarteFrom(
  combo: ComboMeal,
  itemsById: Map<string, MenuItemAdmin>,
): number {
  return combo.slots.reduce((sum, slot) => {
    const prices = slot.itemIds
      .map((id) => itemsById.get(id)?.basePrice)
      .filter((p): p is number => typeof p === "number");
    return sum + (prices.length ? Math.min(...prices) : 0);
  }, 0);
}

function ComboBoard({
  combos,
  items,
  getCategoryLabel,
  onCreate,
  onEdit,
  onToggleAvailable,
}: {
  combos: ComboMeal[];
  items: MenuItemAdmin[];
  getCategoryLabel: (id: string) => string;
  onCreate: () => void;
  onEdit: (c: ComboMeal) => void;
  onToggleAvailable: (id: string) => void;
}) {
  const itemsById = useMemo(
    () => new Map(items.map((i) => [i.id, i])),
    [items],
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
        <div>
          <div className="text-[11px] font-bold uppercase tracking-wider text-gray-500">
            Combo Meals
          </div>
          <p className="text-xs text-gray-400">
            Bundle existing dishes into slots and sell them at one unified price.
          </p>
        </div>
        <button
          type="button"
          onClick={onCreate}
          className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-bold uppercase tracking-wide text-white shadow-sm transition hover:brightness-110"
          style={{ backgroundColor: "var(--primary-orange)" }}
        >
          <Plus className="h-3.5 w-3.5" />
          Create Combo
        </button>
      </div>

      {combos.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-gray-300 bg-white p-12 text-center">
          <Layers className="mx-auto h-8 w-8 text-gray-300" />
          <p className="mt-2 text-sm font-semibold text-gray-500">
            No combos yet
          </p>
          <p className="text-xs text-gray-400">
            Click "Create Combo" to build your first bundle.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          {combos.map((c) => (
            <ComboCard
              key={c.id}
              combo={c}
              itemsById={itemsById}
              getCategoryLabel={getCategoryLabel}
              onEdit={() => onEdit(c)}
              onToggleAvailable={() => onToggleAvailable(c.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function ComboCard({
  combo,
  itemsById,
  getCategoryLabel,
  onEdit,
  onToggleAvailable,
}: {
  combo: ComboMeal;
  itemsById: Map<string, MenuItemAdmin>;
  getCategoryLabel: (id: string) => string;
  onEdit: () => void;
  onToggleAvailable: () => void;
}) {
  const alaCarte = comboAlaCarteFrom(combo, itemsById);
  const savings = alaCarte - combo.comboPrice;

  return (
    <div
      className={`group relative overflow-hidden rounded-2xl border bg-white shadow-sm transition hover:border-orange-200 ${
        combo.isAvailable ? "border-gray-200" : "border-gray-200 opacity-70"
      }`}
    >
      <div className="relative h-28 w-full overflow-hidden bg-gray-100">
        <img
          src={getThumbUrl(combo.imageSeed)}
          alt={combo.name}
          className="h-full w-full object-cover"
          loading="lazy"
        />
        <div className="absolute left-2 top-2 inline-flex items-center gap-1 rounded-full bg-gray-900/80 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
          <Layers className="h-3 w-3" />
          Combo
        </div>
        {savings > 0 && (
          <div className="absolute right-2 top-2 rounded-full bg-emerald-600 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white shadow">
            Save {formatINR(savings)}
          </div>
        )}
        {!combo.isAvailable && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/30 backdrop-blur-[1px]">
            <span className="rounded-full bg-red-600 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-white shadow">
              Disabled
            </span>
          </div>
        )}
      </div>
      <div className="p-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <h3 className="truncate text-sm font-bold text-gray-900">
              {combo.name}
            </h3>
            <p className="line-clamp-1 text-[11px] text-gray-500">
              {combo.description || "No description"}
            </p>
          </div>
          <div className="text-right">
            <div className="text-base font-extrabold tabular-nums text-gray-900">
              {formatINR(combo.comboPrice)}
            </div>
            {alaCarte > 0 && (
              <div className="text-[10px] font-semibold tabular-nums text-gray-400 line-through">
                {formatINR(alaCarte)}
              </div>
            )}
          </div>
        </div>

        <div className="mt-2 space-y-1">
          {combo.slots.map((slot) => {
            const names = slot.itemIds
              .map((id) => itemsById.get(id)?.name)
              .filter(Boolean);
            return (
              <div key={slot.id} className="flex items-start gap-1.5 text-[11px]">
                <span className="mt-0.5 shrink-0 rounded bg-orange-100 px-1.5 py-0.5 font-bold uppercase tracking-wide text-orange-700">
                  {slot.label}
                </span>
                <span className="text-gray-600">
                  {names.length ? names.join(" Â· ") : "â€”"}
                </span>
              </div>
            );
          })}
        </div>

        <div className="mt-3 flex items-center justify-between">
          <button
            type="button"
            onClick={onToggleAvailable}
            aria-pressed={combo.isAvailable}
            className="inline-flex items-center gap-1.5"
          >
            <span
              className={`relative h-5 w-9 rounded-full transition ${
                combo.isAvailable ? "bg-emerald-500" : "bg-gray-300"
              }`}
            >
              <span
                className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition ${
                  combo.isAvailable ? "left-[18px]" : "left-0.5"
                }`}
              />
            </span>
            <span
              className={`text-[11px] font-bold uppercase tracking-wide ${
                combo.isAvailable ? "text-emerald-700" : "text-gray-400"
              }`}
            >
              {combo.isAvailable ? "Active" : "Disabled"}
            </span>
          </button>
          <button
            type="button"
            onClick={onEdit}
            className="inline-flex items-center gap-1 rounded-md border border-gray-200 px-2 py-1 text-[11px] font-semibold text-gray-600 hover:border-orange-300 hover:bg-orange-50 hover:text-orange-700"
          >
            <Pencil className="h-3 w-3" />
            Edit
          </button>
        </div>
      </div>
    </div>
  );
}

/* ---------- Combo Builder Modal ---------- */

function ComboBuilderModal({
  existing,
  items,
  categories,
  onClose,
  onSave,
  onDelete,
}: {
  existing: ComboMeal | null;
  items: MenuItemAdmin[];
  categories: MenuCategoryAdmin[];
  onClose: () => void;
  onSave: (c: ComboMeal, isNew: boolean) => void;
  onDelete?: () => void;
}) {
  const isNew = !existing;
  const itemsById = useMemo(
    () => new Map(items.map((i) => [i.id, i])),
    [items],
  );
  const getCategoryLabel = (id: string) =>
    categories.find((c) => c.id === id)?.label ?? id;

  const [name, setName] = useState(existing?.name ?? "");
  const [description, setDescription] = useState(existing?.description ?? "");
  const [imageSeed, setImageSeed] = useState(
    existing?.imageSeed ?? `combo-${Date.now().toString(36)}`,
  );
  const [comboPrice, setComboPrice] = useState(existing?.comboPrice ?? 0);
  const [taxCategory, setTaxCategory] = useState<TaxCategoryId>(
    existing?.taxCategory ?? "gst-5",
  );
  const [isVeg, setIsVeg] = useState(existing?.isVeg ?? true);
  const [slots, setSlots] = useState<ComboSlot[]>(
    existing?.slots ?? [
      { id: `slot-${Date.now().toString(36)}`, label: "Main", itemIds: [] },
    ],
  );

  useEffect(() => {
    const original = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = original;
    };
  }, []);

  const addSlot = () =>
    setSlots((arr) => [
      ...arr,
      {
        id: `slot-${Date.now().toString(36)}`,
        label: "New Slot",
        itemIds: [],
      },
    ]);
  const updateSlot = (id: string, patch: Partial<ComboSlot>) =>
    setSlots((arr) => arr.map((s) => (s.id === id ? { ...s, ...patch } : s)));
  const removeSlot = (id: string) =>
    setSlots((arr) => arr.filter((s) => s.id !== id));
  const addItemToSlot = (slotId: string, itemId: string) => {
    if (!itemId) return;
    setSlots((arr) =>
      arr.map((s) =>
        s.id === slotId && !s.itemIds.includes(itemId)
          ? { ...s, itemIds: [...s.itemIds, itemId] }
          : s,
      ),
    );
  };
  const removeItemFromSlot = (slotId: string, itemId: string) =>
    setSlots((arr) =>
      arr.map((s) =>
        s.id === slotId
          ? { ...s, itemIds: s.itemIds.filter((id) => id !== itemId) }
          : s,
      ),
    );

  const alaCarte = comboAlaCarteFrom({ slots } as ComboMeal, itemsById);
  const savings = alaCarte - comboPrice;
  // A slot only counts as filled if it links at least one item that still exists.
  const everySlotFilled =
    slots.length > 0 &&
    slots.every((s) => s.itemIds.some((id) => itemsById.has(id)));
  const canSave =
    name.trim().length > 0 && comboPrice > 0 && everySlotFilled;

  const submit = () => {
    if (!canSave) return;
    const next: ComboMeal = {
      id: existing?.id ?? `combo-${Date.now().toString(36)}`,
      name: name.trim(),
      description: description.trim(),
      imageSeed,
      comboPrice,
      slots,
      isAvailable: existing?.isAvailable ?? true,
      taxCategory,
      isVeg,
    };
    onSave(next, isNew);
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
          className="flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-xl bg-white shadow-2xl"
        >
          <header className="flex items-start justify-between border-b border-gray-200 px-5 py-4">
            <div>
              <div className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-orange-600">
                <Layers className="h-3.5 w-3.5" />
                {isNew ? "Create Combo Meal" : "Edit Combo Meal"}
              </div>
              <h3 className="mt-0.5 text-lg font-extrabold text-gray-900">
                {isNew ? "Bundle dishes into a combo" : (existing?.name ?? "")}
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

          <div className="flex-1 space-y-6 overflow-y-auto px-5 py-5">
            {/* General */}
            <Section title="Combo Details">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-[160px_1fr]">
                <div>
                  <Label>Image</Label>
                  <div className="relative h-32 w-40 overflow-hidden rounded-lg border border-dashed border-gray-300 bg-gray-50">
                    <img
                      src={getThumbUrl(imageSeed)}
                      alt="combo preview"
                      className="h-full w-full object-cover"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      setImageSeed(`combo-${Date.now().toString(36)}`)
                    }
                    className="mt-2 inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-[11px] font-bold uppercase tracking-wide text-gray-700 hover:border-orange-300 hover:bg-orange-50"
                  >
                    <Upload className="h-3 w-3" />
                    Change Image
                  </button>
                </div>
                <div className="space-y-3">
                  <div>
                    <Label>Combo Name</Label>
                    <input
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="e.g. Burger + Fries + Drink Combo"
                      className="h-10 w-full rounded-lg border border-gray-200 px-3 text-sm font-semibold focus:border-orange-300 focus:outline-none focus:ring-2 focus:ring-orange-100"
                    />
                  </div>
                  <div>
                    <Label>Description</Label>
                    <textarea
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      rows={2}
                      placeholder="Short description shown on FOH and menus"
                      className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-orange-300 focus:outline-none focus:ring-2 focus:ring-orange-100"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label>Tax Category</Label>
                      <select
                        value={taxCategory}
                        onChange={(e) =>
                          setTaxCategory(e.target.value as TaxCategoryId)
                        }
                        className="h-10 w-full rounded-lg border border-gray-200 bg-white px-3 text-sm font-medium focus:border-orange-300 focus:outline-none focus:ring-2 focus:ring-orange-100"
                      >
                        {TAX_CATEGORIES.map((t) => (
                          <option key={t.id} value={t.id}>
                            {t.label}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <Label>Veg / Non-Veg</Label>
                      <div className="flex h-10 items-center gap-1 rounded-lg border border-gray-200 bg-gray-50 p-1">
                        {[
                          { val: true, label: "Veg" },
                          { val: false, label: "Non-Veg" },
                        ].map((opt) => (
                          <button
                            key={opt.label}
                            type="button"
                            onClick={() => setIsVeg(opt.val)}
                            className={`flex h-full flex-1 items-center justify-center gap-1.5 rounded-md text-xs font-bold ${
                              isVeg === opt.val
                                ? opt.val
                                  ? "bg-emerald-500 text-white"
                                  : "bg-red-600 text-white"
                                : "text-gray-500 hover:bg-white"
                            }`}
                          >
                            {opt.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </Section>

            {/* Slots */}
            <Section title="Combo Slots">
              <p className="-mt-1 mb-2 text-[11px] text-gray-400">
                Each slot is one course of the combo. Link the Ã -la-carte items a
                guest can choose from for that slot.
              </p>
              <div className="space-y-3">
                {slots.map((slot) => {
                  const available = items.filter(
                    (i) => !slot.itemIds.includes(i.id),
                  );
                  return (
                    <div
                      key={slot.id}
                      className="rounded-xl border border-gray-200 bg-gray-50/60 p-3"
                    >
                      <div className="flex items-center gap-2">
                        <input
                          value={slot.label}
                          onChange={(e) =>
                            updateSlot(slot.id, { label: e.target.value })
                          }
                          placeholder="Slot name (e.g. Main, Side, Beverage)"
                          className="h-9 flex-1 rounded-lg border border-gray-200 px-3 text-sm font-bold focus:border-orange-300 focus:outline-none focus:ring-2 focus:ring-orange-100"
                        />
                        <button
                          type="button"
                          onClick={() => removeSlot(slot.id)}
                          disabled={slots.length <= 1}
                          className="rounded-lg p-2 text-gray-400 hover:bg-red-50 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-30"
                          aria-label="Remove slot"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>

                      {/* Selected items */}
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {slot.itemIds.length === 0 && (
                          <span className="text-[11px] text-gray-400">
                            No items linked yet â€” add one below.
                          </span>
                        )}
                        {slot.itemIds.map((id) => {
                          const it = itemsById.get(id);
                          if (!it) return null;
                          return (
                            <span
                              key={id}
                              className="inline-flex items-center gap-1 rounded-full bg-white px-2 py-1 text-[11px] font-semibold text-gray-700 ring-1 ring-gray-200"
                            >
                              <span
                                className={`h-2 w-2 rounded-full ${
                                  it.isVeg ? "bg-emerald-500" : "bg-red-600"
                                }`}
                              />
                              {it.name}
                              <span className="tabular-nums text-gray-400">
                                {formatINR(it.basePrice)}
                              </span>
                              <button
                                type="button"
                                onClick={() => removeItemFromSlot(slot.id, id)}
                                className="rounded-full p-0.5 text-gray-400 hover:bg-red-50 hover:text-red-600"
                                aria-label={`Remove ${it.name}`}
                              >
                                <X className="h-3 w-3" />
                              </button>
                            </span>
                          );
                        })}
                      </div>

                      {/* Add item */}
                      <select
                        value=""
                        onChange={(e) => {
                          addItemToSlot(slot.id, e.target.value);
                          e.target.value = "";
                        }}
                        className="mt-2 h-9 w-full rounded-lg border border-gray-200 bg-white px-3 text-xs font-medium text-gray-600 focus:border-orange-300 focus:outline-none focus:ring-2 focus:ring-orange-100"
                      >
                        <option value="">+ Add an item to this slotâ€¦</option>
                        {available.map((i) => (
                          <option key={i.id} value={i.id}>
                            {i.name} â€” {getCategoryLabel(i.category)} Â·{" "}
                            {formatINR(i.basePrice)}
                          </option>
                        ))}
                      </select>
                    </div>
                  );
                })}
                <button
                  type="button"
                  onClick={addSlot}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-dashed border-gray-300 bg-white px-3 py-1.5 text-xs font-bold uppercase tracking-wide text-gray-600 hover:border-orange-300 hover:bg-orange-50 hover:text-orange-700"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Add Slot
                </button>
              </div>
            </Section>

            {/* Pricing */}
            <Section title="Combo Pricing">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-[200px_1fr]">
                <div>
                  <Label>Unified Combo Price (â‚¹)</Label>
                  <div className="relative">
                    <IndianRupee className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                    <input
                      type="number"
                      min={0}
                      value={comboPrice}
                      onChange={(e) =>
                        setComboPrice(Math.max(0, Number(e.target.value) || 0))
                      }
                      className="h-12 w-full rounded-lg border border-gray-200 pl-9 pr-3 text-xl font-extrabold tabular-nums focus:border-orange-300 focus:outline-none focus:ring-2 focus:ring-orange-100"
                    />
                  </div>
                </div>
                <div className="flex flex-col justify-center rounded-lg border border-gray-200 bg-gray-50 px-4 py-3">
                  <div className="flex items-center justify-between text-xs text-gray-500">
                    <span>Ã€-la-carte (from)</span>
                    <span className="font-bold tabular-nums text-gray-700">
                      {formatINR(alaCarte)}
                    </span>
                  </div>
                  <div className="mt-1 flex items-center justify-between text-xs text-gray-500">
                    <span>Combo price</span>
                    <span className="font-bold tabular-nums text-gray-700">
                      {formatINR(comboPrice)}
                    </span>
                  </div>
                  <div className="mt-1.5 flex items-center justify-between border-t border-gray-200 pt-1.5 text-sm">
                    <span className="font-bold text-gray-700">
                      Guest saves
                    </span>
                    <span
                      className={`font-extrabold tabular-nums ${
                        savings > 0
                          ? "text-emerald-600"
                          : savings < 0
                            ? "text-red-600"
                            : "text-gray-500"
                      }`}
                    >
                      {savings >= 0 ? "" : "âˆ’"}
                      {formatINR(Math.abs(savings))}
                    </span>
                  </div>
                </div>
              </div>
            </Section>
          </div>

          <footer className="flex items-center gap-2 border-t border-gray-200 bg-gray-50 px-5 py-3">
            {!isNew && onDelete && (
              <button
                type="button"
                onClick={onDelete}
                className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 bg-white px-3 py-2 text-xs font-bold uppercase tracking-wide text-red-600 hover:bg-red-50"
              >
                <Trash2 className="h-3.5 w-3.5" />
                Delete
              </button>
            )}
            <div className="ml-auto flex items-center gap-2">
              {!canSave && (
                <span className="text-[11px] font-medium text-gray-400">
                  {name.trim().length === 0
                    ? "Name required"
                    : !everySlotFilled
                      ? "Every slot needs an item"
                      : "Set a combo price"}
                </span>
              )}
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-100"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={!canSave}
                onClick={submit}
                className="inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-bold uppercase tracking-wide text-white shadow-sm transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40"
                style={{ backgroundColor: "var(--primary-orange)" }}
              >
                <Check className="h-4 w-4" />
                {isNew ? "Create Combo" : "Save Combo"}
              </button>
            </div>
          </footer>
        </motion.div>
      </div>
    </>
  );
}

/* ---------- Helpers ---------- */

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <div className="mb-2 text-[11px] font-bold uppercase tracking-wider text-gray-500">
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
