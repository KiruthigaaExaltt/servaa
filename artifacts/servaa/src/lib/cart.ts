import type { MenuItem, MenuItemAddon, MenuItemSize } from "./menu";

export interface CartLine {
  lineId: string;
  item: MenuItem;
  quantity: number;
  size?: MenuItemSize;
  addons: MenuItemAddon[];
  specialInstructions?: string;
  // Continuous KOT loop: set once a line has been fired to the kitchen. Sent
  // lines are locked in the basket and their live status is read back from KDS
  // via `kotItemId`; unsent lines are the editable "New Additions".
  sentAt?: number;
  kotId?: string;
  kotItemId?: string;
}

export function lineUnitPrice(line: CartLine): number {
  const sizeDelta = line.size?.priceDelta ?? 0;
  const addons = line.addons.reduce((s, a) => s + a.price, 0);
  return line.item.price + sizeDelta + addons;
}

export function modifierLabels(line: CartLine): string[] {
  const out: string[] = [];
  if (line.size) out.push(line.size.label);
  for (const a of line.addons) out.push(`+ ${a.label}`);
  if (line.specialInstructions) out.push(`"${line.specialInstructions}"`);
  return out;
}
