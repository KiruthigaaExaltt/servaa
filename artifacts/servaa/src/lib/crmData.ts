export type LoyaltyTier = "Bronze" | "Silver" | "Gold" | "Platinum";

export interface FeedbackEntry {
  id: string;
  rating: number; // 1-5 stars
  visitDate: string; // YYYY-MM-DD
  comment: string;
  at: number;
}

export interface Customer {
  id: string;
  name: string;
  phone: string;
  email?: string;
  joinedAt: string;
  visits: number;
  lifetimeSpend: number;
  points: number;
  lastVisitAt: number;
  birthday?: string; // MM-DD
  tags: string[];
  preferences?: string;
  feedback?: FeedbackEntry[];
}

export interface TierConfig {
  id: LoyaltyTier;
  minSpend: number;
  perks: string;
  earnMultiplier: number;
}

export interface LoyaltyRules {
  pointsPerRupee: number; // points earned per ₹1 spent
  rupeePerPoint: number; // ₹ value of 1 point on redemption
  signupBonus: number;
  birthdayBonus: number;
  tiers: TierConfig[];
}

export type CampaignChannel = "SMS" | "Email" | "WhatsApp" | "Push";
export type CampaignStatus = "Draft" | "Scheduled" | "Sent";

export interface Campaign {
  id: string;
  name: string;
  channel: CampaignChannel;
  template: string;
  audience: string;
  reach: number;
  status: CampaignStatus;
  sentAt?: number;
  scheduledAt?: number;
  spend: number;
  revenue: number;
  redemptions: number;
}

export type CouponKind = "Percent" | "Flat" | "FreeItem";

export interface Coupon {
  id: string;
  code: string;
  kind: CouponKind;
  value: number; // % off or ₹ off; for FreeItem, 0
  description: string;
  minSpend: number;
  expiresAt: number;
  active: boolean;
  issued: number;
  redeemed: number;
}

export interface MessageTemplate {
  id: string;
  name: string;
  subject: string;
  body: string;
  emoji: string;
}

const D = 24 * 60 * 60 * 1000;
const now = Date.now();

export const SEED_TIERS: TierConfig[] = [
  { id: "Bronze", minSpend: 0, perks: "1× points · welcome drink", earnMultiplier: 1 },
  { id: "Silver", minSpend: 5000, perks: "1.25× points · birthday treat", earnMultiplier: 1.25 },
  { id: "Gold", minSpend: 20000, perks: "1.5× points · priority seating", earnMultiplier: 1.5 },
  { id: "Platinum", minSpend: 50000, perks: "2× points · chef's table access", earnMultiplier: 2 },
];

export const SEED_RULES: LoyaltyRules = {
  pointsPerRupee: 0.01, // 1 point per ₹100
  rupeePerPoint: 1,
  signupBonus: 100,
  birthdayBonus: 250,
  tiers: SEED_TIERS,
};

export function tierOf(spend: number, tiers: TierConfig[]): LoyaltyTier {
  return [...tiers]
    .sort((a, b) => b.minSpend - a.minSpend)
    .find((t) => spend >= t.minSpend)?.id ?? "Bronze";
}

export const TIER_TONE: Record<LoyaltyTier, string> = {
  Bronze: "bg-gradient-to-r from-amber-700 to-amber-500 text-white",
  Silver: "bg-gradient-to-r from-gray-400 to-gray-300 text-gray-900",
  Gold: "bg-gradient-to-r from-yellow-400 to-amber-500 text-amber-900",
  Platinum: "bg-gradient-to-r from-slate-700 to-slate-500 text-white",
};

export const TIER_RING: Record<LoyaltyTier, string> = {
  Bronze: "ring-amber-300",
  Silver: "ring-gray-300",
  Gold: "ring-yellow-300",
  Platinum: "ring-slate-400",
};

export const SEED_CUSTOMERS: Customer[] = [
  {
    id: "C-1001",
    name: "Aisha Verma",
    phone: "+91 98200 11122",
    email: "aisha.v@example.com",
    joinedAt: "2023-01-12",
    visits: 28,
    lifetimeSpend: 64200,
    points: 642,
    lastVisitAt: now - 2 * D,
    birthday: "08-14",
    tags: ["VIP", "High Spender"],
    preferences: "Loves butter chicken & jain options",
    feedback: [
      {
        id: "fb-1001a",
        rating: 5,
        visitDate: new Date(now - 2 * D).toISOString().slice(0, 10),
        comment: "Butter chicken was spot on, and the server was lovely.",
        at: now - 2 * D,
      },
      {
        id: "fb-1001b",
        rating: 4,
        visitDate: new Date(now - 20 * D).toISOString().slice(0, 10),
        comment: "Food was great but the table took a while to be ready.",
        at: now - 20 * D,
      },
    ],
  },
  {
    id: "C-1002",
    name: "Rohan Pillai",
    phone: "+91 99300 22233",
    email: "rohan.p@example.com",
    joinedAt: "2023-04-02",
    visits: 14,
    lifetimeSpend: 28400,
    points: 284,
    lastVisitAt: now - 5 * D,
    birthday: "11-22",
    tags: ["Foodie"],
  },
  {
    id: "C-1003",
    name: "Meera Joshi",
    phone: "+91 99700 44455",
    email: "meera.j@example.com",
    joinedAt: "2022-07-19",
    visits: 41,
    lifetimeSpend: 92800,
    points: 928,
    lastVisitAt: now - 1 * D,
    birthday: "03-08",
    tags: ["VIP", "High Spender", "Vegan"],
    preferences: "Strictly vegan · no dairy",
    feedback: [
      {
        id: "fb-1003a",
        rating: 5,
        visitDate: new Date(now - 1 * D).toISOString().slice(0, 10),
        comment: "Loved the vegan thali — chef accommodated everything.",
        at: now - 1 * D,
      },
    ],
  },
  {
    id: "C-1004",
    name: "Sanjay Rao",
    phone: "+91 99820 55566",
    joinedAt: "2024-02-04",
    visits: 6,
    lifetimeSpend: 9800,
    points: 98,
    lastVisitAt: now - 12 * D,
    tags: ["Couples"],
  },
  {
    id: "C-1005",
    name: "Neha Kapoor",
    phone: "+91 99880 66677",
    email: "neha.k@example.com",
    joinedAt: "2023-09-30",
    visits: 19,
    lifetimeSpend: 36500,
    points: 365,
    lastVisitAt: now - 8 * D,
    birthday: "06-19",
    tags: ["Wine Club", "Allergy: Peanuts"],
    preferences: "Severe peanut allergy — confirm every dish",
  },
  {
    id: "C-1006",
    name: "Arjun Bhatia",
    phone: "+91 98700 77788",
    email: "arjun.b@example.com",
    joinedAt: "2022-03-10",
    visits: 52,
    lifetimeSpend: 124800,
    points: 1248,
    lastVisitAt: now - 4 * D,
    birthday: "01-25",
    tags: ["VIP", "High Spender", "Whisky Club"],
    preferences: "Always Suite 12 if available",
  },
  {
    id: "C-1007",
    name: "Diya Shah",
    phone: "+91 98330 88899",
    joinedAt: "2024-04-15",
    visits: 3,
    lifetimeSpend: 4200,
    points: 42,
    lastVisitAt: now - 18 * D,
    tags: ["New"],
  },
  {
    id: "C-1008",
    name: "Karan Malhotra",
    phone: "+91 98112 33445",
    email: "karan.m@example.com",
    joinedAt: "2022-11-08",
    visits: 22,
    lifetimeSpend: 47600,
    points: 476,
    lastVisitAt: now - 38 * D,
    tags: ["Lapsed", "Whisky Club"],
  },
  {
    id: "C-1009",
    name: "Ishita Gupta",
    phone: "+91 98765 99001",
    email: "ishita.g@example.com",
    joinedAt: "2023-06-20",
    visits: 11,
    lifetimeSpend: 21300,
    points: 213,
    lastVisitAt: now - 22 * D,
    birthday: "09-03",
    tags: ["Brunch Lover", "Vegan"],
  },
  {
    id: "C-1010",
    name: "Vikram Iyer",
    phone: "+91 98321 11567",
    joinedAt: "2024-05-01",
    visits: 1,
    lifetimeSpend: 1800,
    points: 18,
    lastVisitAt: now - 45 * D,
    tags: ["New", "Lapsed"],
  },
];

export const SEED_TEMPLATES: MessageTemplate[] = [
  {
    id: "tpl-bday",
    name: "Birthday Discount",
    subject: "🎂 A treat from Servaa for your big day",
    body: "Happy Birthday {{name}}! Enjoy a complimentary dessert + 20% off your bill this week. Use code BDAY-{{code}}.",
    emoji: "🎂",
  },
  {
    id: "tpl-happy",
    name: "Happy Hour Alert",
    subject: "🍹 Happy Hour — 2 for 1, today only",
    body: "Hey {{name}}, 4 PM–7 PM today: every cocktail is buy-one-get-one. Walk in and tell your server.",
    emoji: "🍹",
  },
  {
    id: "tpl-menu",
    name: "New Menu Launch",
    subject: "✨ Our spring menu is live",
    body: "{{name}}, your favourites just got upgrades. Book a table this week and the chef sends a tasting plate on us.",
    emoji: "✨",
  },
  {
    id: "tpl-winback",
    name: "We Miss You",
    subject: "💌 It's been a minute — here's ₹500 off",
    body: "{{name}}, we noticed you haven't visited in a while. Use code WELCOME-BACK for ₹500 off your next bill.",
    emoji: "💌",
  },
  {
    id: "tpl-vip",
    name: "VIP Tasting Invite",
    subject: "🥂 Exclusive: Chef's tasting menu",
    body: "{{name}}, as a Gold/Platinum member you're invited to our private 7-course tasting next Friday. RSVP to claim your seat.",
    emoji: "🥂",
  },
];

export const SEED_CAMPAIGNS: Campaign[] = [
  {
    id: "CMP-2031",
    name: "Spring Menu Launch",
    channel: "Email",
    template: "New Menu Launch",
    audience: "All Members",
    reach: 1245,
    status: "Sent",
    sentAt: now - 6 * D,
    spend: 1860,
    revenue: 84500,
    redemptions: 92,
  },
  {
    id: "CMP-2030",
    name: "VIP Tasting · May",
    channel: "WhatsApp",
    template: "VIP Tasting Invite",
    audience: "Gold + Platinum",
    reach: 142,
    status: "Sent",
    sentAt: now - 14 * D,
    spend: 720,
    revenue: 168000,
    redemptions: 38,
  },
  {
    id: "CMP-2029",
    name: "Win-back · Lapsed 30d",
    channel: "SMS",
    template: "We Miss You",
    audience: "Lapsed (30+ days)",
    reach: 318,
    status: "Sent",
    sentAt: now - 3 * D,
    spend: 540,
    revenue: 22600,
    redemptions: 27,
  },
  {
    id: "CMP-2028",
    name: "Mother's Day Brunch",
    channel: "Email",
    template: "Happy Hour Alert",
    audience: "All Members",
    reach: 1245,
    status: "Scheduled",
    scheduledAt: now + 2 * D,
    spend: 0,
    revenue: 0,
    redemptions: 0,
  },
];

export const SEED_COUPONS: Coupon[] = [
  {
    id: "cp-1",
    code: "FREE-DESSERT",
    kind: "FreeItem",
    value: 0,
    description: "Free dessert with any main · dine-in",
    minSpend: 800,
    expiresAt: now + 21 * D,
    active: true,
    issued: 420,
    redeemed: 138,
  },
  {
    id: "cp-2",
    code: "FLAT-200-OFF",
    kind: "Flat",
    value: 200,
    description: "Flat ₹200 off bills above ₹1,500",
    minSpend: 1500,
    expiresAt: now + 14 * D,
    active: true,
    issued: 612,
    redeemed: 244,
  },
  {
    id: "cp-3",
    code: "WELCOME-BACK",
    kind: "Flat",
    value: 500,
    description: "₹500 off — win-back offer for lapsed guests",
    minSpend: 2000,
    expiresAt: now + 30 * D,
    active: true,
    issued: 318,
    redeemed: 27,
  },
  {
    id: "cp-4",
    code: "BDAY-20",
    kind: "Percent",
    value: 20,
    description: "20% off your bill on your birthday week",
    minSpend: 0,
    expiresAt: now + 60 * D,
    active: true,
    issued: 84,
    redeemed: 31,
  },
  {
    id: "cp-5",
    code: "HAPPY-HOUR",
    kind: "Percent",
    value: 50,
    description: "50% off cocktails · 4–7 PM weekdays",
    minSpend: 0,
    expiresAt: now - 5 * D,
    active: false,
    issued: 240,
    redeemed: 96,
  },
];

export const AUDIENCES: { id: string; label: string; describe: (cs: Customer[], rules: LoyaltyRules) => Customer[] }[] = [
  {
    id: "all",
    label: "All Members",
    describe: (cs) => cs,
  },
  {
    id: "platinum",
    label: "Platinum Members",
    describe: (cs, r) => cs.filter((c) => tierOf(c.lifetimeSpend, r.tiers) === "Platinum"),
  },
  {
    id: "gold",
    label: "Gold Members",
    describe: (cs, r) => cs.filter((c) => tierOf(c.lifetimeSpend, r.tiers) === "Gold"),
  },
  {
    id: "gold-plat",
    label: "Gold + Platinum",
    describe: (cs, r) => cs.filter((c) => ["Gold", "Platinum"].includes(tierOf(c.lifetimeSpend, r.tiers))),
  },
  {
    id: "lapsed",
    label: "Lapsed (30+ days)",
    describe: (cs) =>
      cs.filter((c) => Date.now() - c.lastVisitAt > 30 * D),
  },
  {
    id: "birthday",
    label: "Birthdays this month",
    describe: (cs) => {
      const m = new Date().getMonth() + 1;
      return cs.filter((c) => {
        if (!c.birthday) return false;
        return Number(c.birthday.split("-")[0]) === m;
      });
    },
  },
  {
    id: "vip",
    label: "Tagged VIP",
    describe: (cs) => cs.filter((c) => c.tags.includes("VIP")),
  },
];

export function formatINR(n: number): string {
  return `₹${n.toLocaleString("en-IN", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })}`;
}

export function relativeDays(ms: number): string {
  const days = Math.floor((Date.now() - ms) / D);
  if (days <= 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days}d ago`;
  if (days < 30) return `${Math.floor(days / 7)}w ago`;
  return `${Math.floor(days / 30)}mo ago`;
}

export function tagTone(tag: string): string {
  const t = tag.toLowerCase();
  if (t === "vip") return "bg-purple-50 text-purple-700 ring-purple-200";
  if (t.includes("high")) return "bg-emerald-50 text-emerald-700 ring-emerald-200";
  if (t.includes("vegan")) return "bg-green-50 text-green-700 ring-green-200";
  if (t.includes("allergy")) return "bg-red-50 text-red-700 ring-red-200";
  if (t.includes("lapsed")) return "bg-amber-50 text-amber-700 ring-amber-200";
  if (t.includes("new")) return "bg-blue-50 text-blue-700 ring-blue-200";
  return "bg-gray-100 text-gray-600 ring-gray-200";
}
