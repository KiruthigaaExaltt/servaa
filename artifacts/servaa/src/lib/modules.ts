export type ModuleId =
  | "dashboard"
  | "tables"
  | "foh"
  | "menu"
  | "kot-kds"
  | "inventory"
  | "boh"
  | "delivery"
  | "orders-billing"
  | "crew"
  | "accounts"
  | "crm-loyalty"
  | "reports"
  | "settings";

export interface ModuleDef {
  id: ModuleId;
  label: string;
}

export const MODULES: ModuleDef[] = [
  { id: "dashboard", label: "Dashboard" },
  { id: "tables", label: "Tables" },
  { id: "foh", label: "FOH Management" },
  { id: "menu", label: "Menu Management" },
  { id: "kot-kds", label: "KOT/KDS Management" },
  { id: "inventory", label: "Inventory Management" },
  { id: "boh", label: "BOH Management" },
  { id: "delivery", label: "Delivery Management" },
  { id: "orders-billing", label: "Orders & Billing" },
  { id: "crew", label: "Crew Management" },
  { id: "accounts", label: "Accounts Management" },
  { id: "crm-loyalty", label: "CRM & Loyalty" },
  { id: "reports", label: "Reports & Analytics" },
  { id: "settings", label: "Settings" },
];
