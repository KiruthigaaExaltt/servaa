import type { StationId } from "@/types";
import {
  UNIVERSAL_CATEGORIES,
  type CategoryId,
  type UniversalCategory,
} from "@/lib/categories";

// Categories are sourced from the Universal Category Database (single source of
// truth). These aliases keep existing menu imports working.
export type MenuCategoryId = CategoryId;
export type MenuCategory = UniversalCategory;

export interface MenuItemSize {
  id: string;
  label: string;
  priceDelta: number;
}

export interface MenuItemAddon {
  id: string;
  label: string;
  price: number;
}

export interface MenuItem {
  id: string;
  name: string;
  price: number;
  category: MenuCategoryId;
  station: StationId;
  description?: string;
  isVeg: boolean;
  imageSeed: string;
  sizes?: MenuItemSize[];
  addons?: MenuItemAddon[];
}

export const MENU_CATEGORIES: MenuCategory[] = UNIVERSAL_CATEGORIES;

const DEFAULT_ADDONS: MenuItemAddon[] = [
  { id: "extra-cheese", label: "Extra Cheese", price: 60 },
  { id: "extra-sauce", label: "Extra Sauce", price: 30 },
  { id: "no-onion", label: "No Onion", price: 0 },
];

const SIZE_OPTIONS: MenuItemSize[] = [
  { id: "regular", label: "Regular", priceDelta: 0 },
  { id: "large", label: "Large", priceDelta: 80 },
];

const PIZZA_SIZES: MenuItemSize[] = [
  { id: "small", label: "Small (8\")", priceDelta: 0 },
  { id: "medium", label: "Medium (10\")", priceDelta: 100 },
  { id: "large", label: "Large (12\")", priceDelta: 200 },
];

export const MENU_ITEMS: MenuItem[] = [
  // Appetizers
  { id: "m-app-1", name: "Paneer Tikka", price: 320, category: "appetizers", station: "Hot", description: "Smoky cottage cheese skewers", isVeg: true, imageSeed: "paneertikka", addons: DEFAULT_ADDONS },
  { id: "m-app-2", name: "Chicken 65", price: 360, category: "appetizers", station: "Hot", description: "Spicy fried chicken bites", isVeg: false, imageSeed: "chicken65", addons: DEFAULT_ADDONS },
  { id: "m-app-3", name: "Caesar Salad", price: 280, category: "appetizers", station: "Cold", description: "Romaine, parmesan, croutons", isVeg: true, imageSeed: "caesar" },
  { id: "m-app-4", name: "Bruschetta", price: 240, category: "appetizers", station: "Cold", description: "Tomato basil on grilled bread", isVeg: true, imageSeed: "bruschetta" },
  { id: "m-app-5", name: "Crispy Calamari", price: 420, category: "appetizers", station: "Hot", isVeg: false, imageSeed: "calamari" },
  { id: "m-app-6", name: "Hummus Platter", price: 260, category: "appetizers", station: "Cold", isVeg: true, imageSeed: "hummus" },

  // Mains
  { id: "m-main-1", name: "Butter Chicken", price: 380, category: "mains", station: "Hot", description: "House signature", isVeg: false, imageSeed: "butterchicken", addons: DEFAULT_ADDONS },
  { id: "m-main-2", name: "Margherita Pizza", price: 420, category: "mains", station: "Hot", description: "Tomato, mozzarella, basil", isVeg: true, imageSeed: "margherita", sizes: PIZZA_SIZES, addons: DEFAULT_ADDONS },
  { id: "m-main-3", name: "Veg Biryani", price: 340, category: "mains", station: "Hot", isVeg: true, imageSeed: "vegbiryani" },
  { id: "m-main-4", name: "Grilled Salmon", price: 680, category: "mains", station: "Hot", description: "With lemon butter", isVeg: false, imageSeed: "salmon" },
  { id: "m-main-5", name: "Pasta Alfredo", price: 360, category: "mains", station: "Hot", isVeg: true, imageSeed: "alfredo", addons: DEFAULT_ADDONS },
  { id: "m-main-6", name: "Garlic Naan", price: 60, category: "mains", station: "Hot", isVeg: true, imageSeed: "naan" },

  // Desserts
  { id: "m-des-1", name: "Tiramisu", price: 250, category: "desserts", station: "Cold", isVeg: true, imageSeed: "tiramisu" },
  { id: "m-des-2", name: "Chocolate Lava Cake", price: 280, category: "desserts", station: "Hot", description: "Warm molten centre", isVeg: true, imageSeed: "lavacake" },
  { id: "m-des-3", name: "Gulab Jamun", price: 180, category: "desserts", station: "Hot", isVeg: true, imageSeed: "gulab" },
  { id: "m-des-4", name: "Cheesecake", price: 260, category: "desserts", station: "Cold", isVeg: true, imageSeed: "cheesecake" },

  // Beverages
  { id: "m-bev-1", name: "Mojito", price: 220, category: "beverages", station: "Bar", isVeg: true, imageSeed: "mojito", sizes: SIZE_OPTIONS },
  { id: "m-bev-2", name: "Fresh Lime Soda", price: 120, category: "beverages", station: "Bar", isVeg: true, imageSeed: "limesoda", sizes: SIZE_OPTIONS },
  { id: "m-bev-3", name: "Coke", price: 80, category: "beverages", station: "Bar", isVeg: true, imageSeed: "coke", sizes: SIZE_OPTIONS },
  { id: "m-bev-4", name: "Cold Coffee", price: 180, category: "beverages", station: "Bar", isVeg: true, imageSeed: "coldcoffee", sizes: SIZE_OPTIONS },
  { id: "m-bev-5", name: "Masala Chai", price: 60, category: "beverages", station: "Bar", isVeg: true, imageSeed: "chai" },
  { id: "m-bev-6", name: "Craft Beer", price: 320, category: "beverages", station: "Bar", isVeg: true, imageSeed: "beer" },
];

export const TABLE_OPTIONS: string[] = Array.from(
  { length: 12 },
  (_, i) => `T-${i + 1}`,
);

export function getItemImageUrl(seed: string): string {
  return `https://picsum.photos/seed/servaa-${seed}/320/200`;
}
