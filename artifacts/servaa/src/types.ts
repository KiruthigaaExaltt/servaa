export type StationId = "Hot" | "Cold" | "Bar";

export type KOTItemStatus =
  | "Pending"
  | "Cooking"
  | "Ready"
  | "Served"
  | "Voided";

export type OrderSource = "Walk-In" | "Zomato" | "Swiggy";

export type OrderType = "Dine In" | "Takeaway" | "Delivery" | "Drive Thru";

export interface KOTItem {
  id: string;
  name: string;
  quantity: number;
  price: number;
  status: KOTItemStatus;
  stationId: StationId;
  modifiers: string[];
  isVoided: boolean;
  voidReason?: string;
}

export interface KOT {
  id: string;
  tableId: string;
  orderId: string;
  waiterName: string;
  timestamp: number;
  items: KOTItem[];
  orderSource: OrderSource;
  orderType?: OrderType;
  guestCount?: number;
  customerName?: string;
  customerPhone?: string;
}
