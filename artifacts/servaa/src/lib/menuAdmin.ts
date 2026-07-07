import {
  MENU_CATEGORIES,
  MENU_ITEMS,
  type MenuItemAddon,
  type MenuItemSize,
} from "./menu";
import type { StationId } from "@/types";

export type TaxCategoryId = "gst-0" | "gst-5" | "gst-12" | "gst-18" | "gst-28";

export interface TaxCategory {
  id: TaxCategoryId;
  label: string;
  rate: number; // percent
}

export const TAX_CATEGORIES: TaxCategory[] = [
  { id: "gst-0", label: "GST 0%", rate: 0 },
  { id: "gst-5", label: "GST 5%", rate: 5 },
  { id: "gst-12", label: "GST 12%", rate: 12 },
  { id: "gst-18", label: "GST 18%", rate: 18 },
  { id: "gst-28", label: "GST 28%", rate: 28 },
];

export type DietaryTag = "Veg" | "Non-Veg" | "Vegan" | "Gluten-Free";

export const DIETARY_TAGS: DietaryTag[] = [
  "Veg",
  "Non-Veg",
  "Vegan",
  "Gluten-Free",
];

export const STATION_OPTIONS: StationId[] = ["Hot", "Cold", "Bar"];

/* ---------- Dynamic pricing ---------- */

export type OrderSource = "Dine-In" | "Takeaway" | "Zomato" | "Swiggy";

export const ORDER_SOURCES: OrderSource[] = [
  "Dine-In",
  "Takeaway",
  "Zomato",
  "Swiggy",
];

export type PriceAdjustType = "discount" | "markup";

export interface TimePricingRule {
  id: string;
  label: string;
  startTime: string; // "HH:MM" 24h
  endTime: string; // "HH:MM" 24h
  adjustType: PriceAdjustType;
  percent: number;
  enabled: boolean;
}

export interface SourcePricingRule {
  id: string;
  source: OrderSource;
  adjustType: PriceAdjustType;
  percent: number;
  enabled: boolean;
}

export interface DynamicPricing {
  timeRules: TimePricingRule[];
  sourceRules: SourcePricingRule[];
}

export function emptyDynamicPricing(): DynamicPricing {
  return { timeRules: [], sourceRules: [] };
}

function timeInRange(now: string, start: string, end: string): boolean {
  if (start === end) return false;
  // Same-day window
  if (start < end) return now >= start && now < end;
  // Window wraps past midnight (e.g. 22:00 → 02:00)
  return now >= start || now < end;
}

export interface EffectivePrice {
  price: number;
  applied: string[];
}

/**
 * Resolve the live selling price for an item given its dynamic-pricing rules,
 * the order source/channel, and the current time. Rules stack multiplicatively
 * (time rule first, then source markup) which mirrors how aggregator markups
 * apply on top of a happy-hour base.
 */
export function computeEffectivePrice(
  basePrice: number,
  pricing: DynamicPricing | undefined,
  source: OrderSource,
  at: Date = new Date(),
): EffectivePrice {
  let price = basePrice;
  const applied: string[] = [];
  if (!pricing) return { price, applied };

  const hhmm = `${String(at.getHours()).padStart(2, "0")}:${String(
    at.getMinutes(),
  ).padStart(2, "0")}`;

  for (const r of pricing.timeRules) {
    if (!r.enabled || r.percent <= 0) continue;
    if (timeInRange(hhmm, r.startTime, r.endTime)) {
      const factor =
        r.adjustType === "discount" ? 1 - r.percent / 100 : 1 + r.percent / 100;
      price *= factor;
      applied.push(
        `${r.label || "Time rule"} ${r.adjustType === "discount" ? "−" : "+"}${r.percent}%`,
      );
    }
  }

  for (const r of pricing.sourceRules) {
    if (!r.enabled || r.percent <= 0) continue;
    if (r.source === source) {
      const factor =
        r.adjustType === "discount" ? 1 - r.percent / 100 : 1 + r.percent / 100;
      price *= factor;
      applied.push(
        `${r.source} ${r.adjustType === "discount" ? "−" : "+"}${r.percent}%`,
      );
    }
  }

  return { price: Math.max(0, Math.round(price)), applied };
}

export interface MenuCategoryAdmin {
  id: string;
  label: string;
  sortOrder: number;
}

export interface MenuItemAdmin {
  id: string;
  name: string;
  description: string;
  category: string; // category id
  station: StationId;
  basePrice: number;
  isVeg: boolean;
  imageSeed: string;
  isAvailable: boolean;
  taxCategory: TaxCategoryId;
  discountEligible: boolean;
  dietaryTags: DietaryTag[];
  variants: MenuItemSize[];
  addons: MenuItemAddon[];
  dynamicPricing: DynamicPricing;
}

/* ---------- Combo meals ---------- */

export interface ComboSlot {
  id: string;
  label: string; // "Main", "Side", "Beverage"
  itemIds: string[]; // eligible à-la-carte items the guest can pick from
}

export interface ComboMeal {
  id: string;
  name: string;
  description: string;
  imageSeed: string;
  comboPrice: number;
  slots: ComboSlot[];
  isAvailable: boolean;
  taxCategory: TaxCategoryId;
  isVeg: boolean;
}

export const SEED_MENU_CATEGORIES: MenuCategoryAdmin[] = MENU_CATEGORIES.map(
  (c, i) => ({
    id: c.id,
    label: c.label,
    sortOrder: i,
  }),
);

function seedDynamicPricing(category: string): DynamicPricing {
  // Aggregator channels carry a standard +10% markup across the board.
  const sourceRules: SourcePricingRule[] = [
    {
      id: "src-zomato-seed",
      source: "Zomato",
      adjustType: "markup",
      percent: 10,
      enabled: true,
    },
    {
      id: "src-swiggy-seed",
      source: "Swiggy",
      adjustType: "markup",
      percent: 10,
      enabled: true,
    },
  ];
  // Beverages run a 4–7 PM happy hour.
  const timeRules: TimePricingRule[] =
    category === "beverages"
      ? [
          {
            id: "time-happyhour-seed",
            label: "Happy Hour",
            startTime: "16:00",
            endTime: "19:00",
            adjustType: "discount",
            percent: 20,
            enabled: true,
          },
        ]
      : [];
  return { timeRules, sourceRules };
}

export const SEED_MENU_ITEMS: MenuItemAdmin[] = MENU_ITEMS.map((m, i) => ({
  id: m.id,
  name: m.name,
  description: m.description ?? "",
  category: m.category,
  station: m.station,
  basePrice: m.price,
  isVeg: m.isVeg,
  imageSeed: m.imageSeed,
  isAvailable: i % 11 !== 7, // mark a couple as sold out
  taxCategory:
    m.category === "beverages"
      ? "gst-18"
      : m.category === "desserts"
        ? "gst-12"
        : "gst-5",
  discountEligible: m.price >= 200,
  dietaryTags: m.isVeg ? ["Veg"] : ["Non-Veg"],
  variants: m.sizes ?? [],
  addons: m.addons ?? [],
  dynamicPricing: seedDynamicPricing(m.category),
}));

export const SEED_COMBOS: ComboMeal[] = [
  {
    id: "combo-pizza-feast",
    name: "Pizza Feast Combo",
    description: "Margherita pizza, garlic naan & a chilled drink.",
    imageSeed: "combopizza",
    comboPrice: 549,
    isAvailable: true,
    taxCategory: "gst-5",
    isVeg: true,
    slots: [
      { id: "slot-main-1", label: "Main", itemIds: ["m-main-2", "m-main-5"] },
      { id: "slot-side-1", label: "Side", itemIds: ["m-main-6", "m-app-1"] },
      {
        id: "slot-bev-1",
        label: "Beverage",
        itemIds: ["m-bev-3", "m-bev-1", "m-bev-2"],
      },
    ],
  },
  {
    id: "combo-veg-delight",
    name: "Veg Delight Thali Combo",
    description: "Veg biryani, paneer tikka starter & fresh lime soda.",
    imageSeed: "comboveg",
    comboPrice: 699,
    isAvailable: true,
    taxCategory: "gst-5",
    isVeg: true,
    slots: [
      { id: "slot-main-2", label: "Main", itemIds: ["m-main-3"] },
      { id: "slot-side-2", label: "Starter", itemIds: ["m-app-1", "m-app-4"] },
      {
        id: "slot-bev-2",
        label: "Beverage",
        itemIds: ["m-bev-2", "m-bev-5"],
      },
    ],
  },
];

export function getThumbUrl(seed: string): string {
  return `https://picsum.photos/seed/servaa-${seed}/160/120`;
}

export function formatINR(n: number): string {
  return `₹${n.toLocaleString("en-IN", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })}`;
}
