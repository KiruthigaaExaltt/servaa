export type DeliverySource = "Direct" | "Zomato" | "Swiggy";

export type DeliveryStatus =
  | "Incoming"
  | "Preparing"
  | "Ready"
  | "Out"
  | "Delivered";

export interface DeliveryLine {
  name: string;
  qty: number;
  price: number;
}

export interface DeliveryOrder {
  id: string;
  source: DeliverySource;
  externalRef?: string;
  customerName: string;
  customerPhone: string;
  address: string;
  items: DeliveryLine[];
  total: number;
  receivedAt: number;
  readyAt?: number;
  pickedAt?: number;
  deliveredAt?: number;
  status: DeliveryStatus;
  riderId?: string;
  notes?: string;
}

export type RiderStatus = "Idle" | "Busy" | "Off-duty";

export interface Rider {
  id: string;
  name: string;
  phone: string;
  vehicle: string;
  status: RiderStatus;
  todayDeliveries: number;
  rating: number;
}

const D = 60 * 1000;
const now = Date.now();

export const SEED_RIDERS: Rider[] = [
  {
    id: "r-01",
    name: "Arjun Mehta",
    phone: "+91 90000 11122",
    vehicle: "Honda Activa · MH-01-AB-1234",
    status: "Idle",
    todayDeliveries: 7,
    rating: 4.8,
  },
  {
    id: "r-02",
    name: "Priya Singh",
    phone: "+91 90000 22233",
    vehicle: "TVS Jupiter · MH-01-CD-5566",
    status: "Busy",
    todayDeliveries: 9,
    rating: 4.9,
  },
  {
    id: "r-03",
    name: "Rahul Pawar",
    phone: "+91 90000 33344",
    vehicle: "Bajaj Pulsar · MH-01-EF-7788",
    status: "Idle",
    todayDeliveries: 5,
    rating: 4.6,
  },
  {
    id: "r-04",
    name: "Sara Khan",
    phone: "+91 90000 44455",
    vehicle: "Suzuki Access · MH-01-GH-9900",
    status: "Idle",
    todayDeliveries: 4,
    rating: 4.7,
  },
  {
    id: "r-05",
    name: "Vikram Iyer",
    phone: "+91 90000 55566",
    vehicle: "Hero Splendor · MH-01-IJ-1122",
    status: "Off-duty",
    todayDeliveries: 0,
    rating: 4.5,
  },
];

export const SEED_DELIVERIES: DeliveryOrder[] = [
  {
    id: "DLV-3041",
    source: "Zomato",
    externalRef: "ZMT-9F2A",
    customerName: "Aisha Verma",
    customerPhone: "+91 98200 11122",
    address: "Flat 802, Sea Crest, Bandra W, Mumbai 400050",
    items: [
      { name: "Butter Chicken", qty: 1, price: 380 },
      { name: "Garlic Naan", qty: 4, price: 60 },
      { name: "Coke", qty: 2, price: 80 },
    ],
    total: 380 + 4 * 60 + 2 * 80,
    receivedAt: now - 4 * D,
    status: "Incoming",
    notes: "Ring bell twice",
  },
  {
    id: "DLV-3040",
    source: "Swiggy",
    externalRef: "SWG-A1B2",
    customerName: "Rohan Pillai",
    customerPhone: "+91 99300 22233",
    address: "C-12, Skyline Apts, Andheri E, Mumbai 400069",
    items: [
      { name: "Margherita Pizza", qty: 1, price: 420 },
      { name: "Caesar Salad", qty: 1, price: 280 },
    ],
    total: 700,
    receivedAt: now - 8 * D,
    status: "Preparing",
  },
  {
    id: "DLV-3039",
    source: "Direct",
    customerName: "Meera Joshi",
    customerPhone: "+91 99700 44455",
    address: "Bungalow 4, Pali Hill, Bandra W, Mumbai 400050",
    items: [
      { name: "Veg Biryani", qty: 2, price: 340 },
      { name: "Gulab Jamun", qty: 4, price: 180 },
    ],
    total: 2 * 340 + 4 * 180,
    receivedAt: now - 14 * D,
    status: "Preparing",
    notes: "No spice in one biryani",
  },
  {
    id: "DLV-3038",
    source: "Zomato",
    externalRef: "ZMT-7K3M",
    customerName: "Sanjay Rao",
    customerPhone: "+91 99820 55566",
    address: "B-204, Lake View, Powai, Mumbai 400076",
    items: [
      { name: "Paneer Tikka", qty: 1, price: 320 },
      { name: "Chicken 65", qty: 1, price: 360 },
      { name: "Mojito", qty: 2, price: 220 },
    ],
    total: 320 + 360 + 2 * 220,
    receivedAt: now - 22 * D,
    readyAt: now - 6 * D,
    status: "Ready",
  },
  {
    id: "DLV-3037",
    source: "Swiggy",
    externalRef: "SWG-Z9X1",
    customerName: "Neha Kapoor",
    customerPhone: "+91 99880 66677",
    address: "12-A Hill Road, Khar W, Mumbai 400052",
    items: [
      { name: "Pasta Alfredo", qty: 1, price: 360 },
      { name: "Tiramisu", qty: 1, price: 250 },
    ],
    total: 610,
    receivedAt: now - 30 * D,
    readyAt: now - 18 * D,
    pickedAt: now - 12 * D,
    status: "Out",
    riderId: "r-02",
  },
  {
    id: "DLV-3036",
    source: "Direct",
    customerName: "Arjun Bhatia",
    customerPhone: "+91 98700 77788",
    address: "Suite 501, Trident Tower, Worli, Mumbai 400018",
    items: [
      { name: "Grilled Salmon", qty: 1, price: 680 },
      { name: "Bruschetta", qty: 1, price: 240 },
    ],
    total: 920,
    receivedAt: now - 65 * D,
    readyAt: now - 50 * D,
    pickedAt: now - 42 * D,
    deliveredAt: now - 18 * D,
    status: "Delivered",
    riderId: "r-02",
  },
  {
    id: "DLV-3035",
    source: "Zomato",
    externalRef: "ZMT-4P2Q",
    customerName: "Diya Shah",
    customerPhone: "+91 98330 88899",
    address: "A-7 Hiranandani, Powai, Mumbai 400076",
    items: [
      { name: "Chocolate Lava Cake", qty: 2, price: 280 },
      { name: "Cold Coffee", qty: 2, price: 180 },
    ],
    total: 2 * 280 + 2 * 180,
    receivedAt: now - 90 * D,
    readyAt: now - 78 * D,
    pickedAt: now - 70 * D,
    deliveredAt: now - 42 * D,
    status: "Delivered",
    riderId: "r-04",
  },
];

export interface AggregatorState {
  source: DeliverySource;
  sync: boolean;
  snoozeUntil?: number;
}

export const SEED_AGGREGATORS: AggregatorState[] = [
  { source: "Direct", sync: true },
  { source: "Zomato", sync: true },
  { source: "Swiggy", sync: true },
];

export const SOURCE_TONE: Record<DeliverySource, string> = {
  Direct: "bg-orange-50 text-orange-700 ring-orange-200",
  Zomato: "bg-red-50 text-red-700 ring-red-200",
  Swiggy: "bg-amber-50 text-amber-700 ring-amber-200",
};

export const SOURCE_DOT: Record<DeliverySource, string> = {
  Direct: "bg-orange-500",
  Zomato: "bg-red-600",
  Swiggy: "bg-amber-500",
};

export const STATUS_TONE: Record<DeliveryStatus, string> = {
  Incoming: "bg-blue-50 text-blue-700 ring-blue-200",
  Preparing: "bg-amber-50 text-amber-700 ring-amber-200",
  Ready: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  Out: "bg-purple-50 text-purple-700 ring-purple-200",
  Delivered: "bg-gray-100 text-gray-600 ring-gray-200",
};

export const RIDER_TONE: Record<RiderStatus, string> = {
  Idle: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  Busy: "bg-purple-50 text-purple-700 ring-purple-200",
  "Off-duty": "bg-gray-100 text-gray-500 ring-gray-200",
};

export function formatINR(n: number): string {
  return `₹${n.toLocaleString("en-IN", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })}`;
}

export function elapsedSince(ms: number): string {
  const sec = Math.floor((Date.now() - ms) / 1000);
  if (sec < 60) return `${sec}s ago`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ${min % 60}m ago`;
  return `${Math.floor(hr / 24)}d ago`;
}
