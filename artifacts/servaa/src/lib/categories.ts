import type { StationId } from "@/types";
import {
  Salad,
  Pizza,
  IceCream,
  CupSoda,
  type LucideIcon,
} from "lucide-react";

/**
 * Universal Category Database — the single source of truth for menu categories
 * across the whole app. FOH Ordering, Menu Management, and KDS Routing all read
 * from this one array; there are no component-isolated category lists.
 *
 * Each category also declares the KDS station new items route to by default, so
 * the kitchen routing taxonomy stays in lockstep with the ordering/menu taxonomy.
 */
export type CategoryId = "appetizers" | "mains" | "desserts" | "beverages";

export interface UniversalCategory {
  id: CategoryId;
  label: string;
  icon: LucideIcon;
  /** Default KDS station items in this category route to. */
  defaultStation: StationId;
}

export const UNIVERSAL_CATEGORIES: UniversalCategory[] = [
  { id: "appetizers", label: "Appetizers", icon: Salad, defaultStation: "Hot" },
  { id: "mains", label: "Mains", icon: Pizza, defaultStation: "Hot" },
  { id: "desserts", label: "Desserts", icon: IceCream, defaultStation: "Cold" },
  { id: "beverages", label: "Beverages", icon: CupSoda, defaultStation: "Bar" },
];

export const CATEGORY_BY_ID: Record<CategoryId, UniversalCategory> =
  UNIVERSAL_CATEGORIES.reduce(
    (acc, c) => {
      acc[c.id] = c;
      return acc;
    },
    {} as Record<CategoryId, UniversalCategory>,
  );

/** Resolve the default KDS routing station for a category id. */
export function stationForCategory(id: string): StationId {
  return CATEGORY_BY_ID[id as CategoryId]?.defaultStation ?? "Hot";
}
