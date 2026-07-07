import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Users,
  TrendingUp,
  Coins,
  Megaphone,
  Search,
  Crown,
  Phone,
  Mail,
  X,
  Plus,
  Check,
  Sparkles,
  Send,
  Calendar,
  Tag,
  Pencil,
  Trash2,
  ArrowRight,
  Award,
  Settings,
  Ticket,
  AlertTriangle,
  Star,
  Truck,
  Package,
  Boxes,
  MessageSquare,
} from "lucide-react";
import { useCRM } from "@/context/CRMContext";
import { deriveVendors, type VendorProfile } from "@/lib/procurement";
import { SEED_INVENTORY } from "@/lib/inventoryData";
import {
  AUDIENCES,
  SEED_CAMPAIGNS,
  SEED_COUPONS,
  SEED_RULES,
  SEED_TEMPLATES,
  TIER_RING,
  TIER_TONE,
  formatINR,
  relativeDays,
  tagTone,
  tierOf,
  type Campaign,
  type CampaignChannel,
  type Coupon,
  type CouponKind,
  type Customer,
  type LoyaltyRules,
  type LoyaltyTier,
  type MessageTemplate,
  type TierConfig,
} from "@/lib/crmData";
import { useCollectionState } from "@/lib/collectionState";

type TabId = "dashboard" | "customers" | "campaigns" | "coupons" | "settings";

const TABS: { id: TabId; label: string; icon: typeof Users }[] = [
  { id: "dashboard", label: "Dashboard", icon: TrendingUp },
  { id: "customers", label: "Directory", icon: Users },
  { id: "campaigns", label: "Campaigns", icon: Megaphone },
  { id: "coupons", label: "Coupons", icon: Ticket },
  { id: "settings", label: "Loyalty Rules", icon: Settings },
];

interface Toast {
  id: number;
  text: string;
  tone: "success" | "info" | "warn";
}

const CHANNEL_TONE: Record<CampaignChannel, string> = {
  SMS: "bg-blue-50 text-blue-700 ring-blue-200",
  Email: "bg-orange-50 text-orange-700 ring-orange-200",
  WhatsApp: "bg-green-50 text-green-700 ring-green-200",
  Push: "bg-purple-50 text-purple-700 ring-purple-200",
};

export function CRMLoyalty() {
  const [tab, setTab] = useState<TabId>("dashboard");
  const { customers } = useCRM();
  const [campaigns, setCampaigns] = useCollectionState<Campaign[]>("crm_campaigns", SEED_CAMPAIGNS);
  const [coupons, setCoupons] = useCollectionState<Coupon[]>("crm_coupons", SEED_COUPONS);
  const [rules, setRules] = useCollectionState<LoyaltyRules>("crm_loyalty_rules", SEED_RULES);
  const [templates] = useCollectionState<MessageTemplate[]>("crm_message_templates", SEED_TEMPLATES);
  const [toasts, setToasts] = useState<Toast[]>([]);

  const pushToast = (text: string, tone: Toast["tone"] = "success") => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, text, tone }]);
    window.setTimeout(
      () => setToasts((t) => t.filter((x) => x.id !== id)),
      2800,
    );
  };

  const kpis = useMemo(() => {
    const total = customers.length;
    const repeat = customers.filter((c) => c.visits > 1).length;
    const retention = total > 0 ? Math.round((repeat / total) * 1000) / 10 : 0;
    const pointsValue = customers.reduce(
      (s, c) => s + c.points * rules.rupeePerPoint,
      0,
    );
    const sentCampaigns = campaigns.filter((c) => c.status === "Sent");
    const lastCampaign = [...sentCampaigns].sort(
      (a, b) => (b.sentAt ?? 0) - (a.sentAt ?? 0),
    )[0];
    const roi = lastCampaign
      ? lastCampaign.spend > 0
        ? Math.round((lastCampaign.revenue / lastCampaign.spend) * 10) / 10
        : 0
      : 0;
    return {
      total,
      retention,
      pointsValue,
      lastCampaign,
      roi,
    };
  }, [customers, campaigns, rules]);

  return (
    <div className="space-y-4">
      {/* KPI strip */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard
          icon={Users}
          label="Total Members"
          value={kpis.total.toString()}
          accent="text-gray-900"
          sub={`${customers.filter((c) => c.visits > 1).length} repeat guests`}
        />
        <KpiCard
          icon={TrendingUp}
          label="Retention Rate"
          value={`${kpis.retention}%`}
          accent={
            kpis.retention >= 60
              ? "text-emerald-600"
              : kpis.retention >= 40
                ? "text-amber-600"
                : "text-red-600"
          }
          sub="Visited more than once"
        />
        <KpiCard
          icon={Coins}
          label="Points Outstanding"
          value={formatINR(kpis.pointsValue)}
          accent="text-[color:var(--primary-orange)]"
          sub={`${customers.reduce((s, c) => s + c.points, 0).toLocaleString("en-IN")} points held`}
        />
        <KpiCard
          icon={Megaphone}
          label="Last Campaign ROI"
          value={`${kpis.roi}Ã—`}
          accent={kpis.roi >= 5 ? "text-emerald-600" : "text-gray-900"}
          sub={
            kpis.lastCampaign
              ? `${kpis.lastCampaign.name} Â· ${formatINR(kpis.lastCampaign.revenue)}`
              : "No campaigns sent"
          }
        />
      </div>

      {/* Tabs */}
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
                isActive ? "text-white" : "text-gray-600 hover:text-gray-900"
              }`}
            >
              {isActive && (
                <motion.span
                  layoutId="crm-tab-pill"
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
          customers={customers}
          rules={rules}
          campaigns={campaigns}
          onJump={setTab}
        />
      )}
      {tab === "customers" && (
        <DirectoryView customers={customers} rules={rules} />
      )}
      {tab === "campaigns" && (
        <CampaignsView
          campaigns={campaigns}
          customers={customers}
          rules={rules}
          templates={templates}
          onCreate={(c) => {
            setCampaigns((arr) => [c, ...arr]);
            pushToast(
              `Campaign "${c.name}" ${c.status === "Sent" ? "sent to" : "scheduled for"} ${c.reach} members`,
            );
          }}
        />
      )}
      {tab === "coupons" && (
        <CouponsView
          coupons={coupons}
          onToggle={(id) => {
            setCoupons((arr) =>
              arr.map((c) =>
                c.id === id ? { ...c, active: !c.active } : c,
              ),
            );
            pushToast("Coupon updated", "info");
          }}
          onCreate={(c) => {
            setCoupons((arr) => [c, ...arr]);
            pushToast(`Coupon ${c.code} created`);
          }}
        />
      )}
      {tab === "settings" && (
        <SettingsView
          rules={rules}
          onSave={(r) => {
            setRules(r);
            pushToast("Loyalty rules saved");
          }}
        />
      )}

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

/* ---------- KPI ---------- */
function KpiCard({
  icon: Icon,
  label,
  value,
  sub,
  accent = "text-gray-900",
}: {
  icon: typeof Users;
  label: string;
  value: string;
  sub?: string;
  accent?: string;
}) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between text-[11px] font-bold uppercase tracking-wider text-gray-500">
        <span>{label}</span>
        <Icon className="h-4 w-4 text-gray-300" />
      </div>
      <div className={`mt-1 truncate text-2xl font-extrabold ${accent}`}>
        {value}
      </div>
      {sub && (
        <div className="truncate text-[11px] text-gray-400">{sub}</div>
      )}
    </div>
  );
}

/* ============================================================
   DASHBOARD
   ============================================================ */
function DashboardView({
  customers,
  rules,
  campaigns,
  onJump,
}: {
  customers: Customer[];
  rules: LoyaltyRules;
  campaigns: Campaign[];
  onJump: (t: TabId) => void;
}) {
  const tierBreakdown = useMemo(() => {
    const map = new Map<LoyaltyTier, number>();
    customers.forEach((c) => {
      const t = tierOf(c.lifetimeSpend, rules.tiers);
      map.set(t, (map.get(t) ?? 0) + 1);
    });
    return rules.tiers.map((t) => ({
      tier: t.id,
      count: map.get(t.id) ?? 0,
      perks: t.perks,
    }));
  }, [customers, rules]);

  const topSpenders = useMemo(
    () =>
      [...customers]
        .sort((a, b) => b.lifetimeSpend - a.lifetimeSpend)
        .slice(0, 5),
    [customers],
  );

  const recent = useMemo(
    () =>
      [...campaigns]
        .filter((c) => c.status === "Sent")
        .sort((a, b) => (b.sentAt ?? 0) - (a.sentAt ?? 0))
        .slice(0, 4),
    [campaigns],
  );

  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
      {/* Tier mix */}
      <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
          <div className="flex items-center gap-1.5">
            <Crown className="h-4 w-4 text-gray-400" />
            <h3 className="text-sm font-bold text-gray-900">Tier Mix</h3>
          </div>
          <button
            type="button"
            onClick={() => onJump("settings")}
            className="inline-flex items-center gap-1 text-[11px] font-bold uppercase tracking-wide text-orange-600 hover:underline"
          >
            Configure <ArrowRight className="h-3 w-3" />
          </button>
        </div>
        <ul className="divide-y divide-gray-100">
          {tierBreakdown.map((t) => {
            const pct = customers.length > 0 ? (t.count / customers.length) * 100 : 0;
            return (
              <li key={t.tier} className="px-4 py-3">
                <div className="flex items-center justify-between">
                  <span
                    className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${TIER_TONE[t.tier]}`}
                  >
                    {t.tier}
                  </span>
                  <span className="text-sm font-extrabold tabular-nums text-gray-900">
                    {t.count}
                  </span>
                </div>
                <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-gray-100">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-orange-300 to-orange-500"
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <div className="mt-1 text-[11px] text-gray-500">{t.perks}</div>
              </li>
            );
          })}
        </ul>
      </div>

      {/* Top spenders */}
      <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm xl:col-span-1">
        <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
          <div className="flex items-center gap-1.5">
            <Award className="h-4 w-4 text-gray-400" />
            <h3 className="text-sm font-bold text-gray-900">Top Spenders</h3>
          </div>
          <button
            type="button"
            onClick={() => onJump("customers")}
            className="inline-flex items-center gap-1 text-[11px] font-bold uppercase tracking-wide text-orange-600 hover:underline"
          >
            All Customers <ArrowRight className="h-3 w-3" />
          </button>
        </div>
        <ul className="divide-y divide-gray-100">
          {topSpenders.map((c, i) => {
            const t = tierOf(c.lifetimeSpend, rules.tiers);
            return (
              <li
                key={c.id}
                className="grid grid-cols-[24px_1fr_auto] items-center gap-2 px-4 py-2.5"
              >
                <span className="text-sm font-extrabold text-gray-300 tabular-nums">
                  #{i + 1}
                </span>
                <div className="min-w-0">
                  <div className="truncate text-sm font-bold text-gray-900">
                    {c.name}
                  </div>
                  <div className="text-[11px] text-gray-500">
                    {c.visits} visits Â· last {relativeDays(c.lastVisitAt)}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-extrabold tabular-nums text-gray-900">
                    {formatINR(c.lifetimeSpend)}
                  </div>
                  <span
                    className={`inline-block rounded-full px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide ${TIER_TONE[t]}`}
                  >
                    {t}
                  </span>
                </div>
              </li>
            );
          })}
        </ul>
      </div>

      {/* Recent campaigns */}
      <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm xl:col-span-1">
        <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
          <div className="flex items-center gap-1.5">
            <Megaphone className="h-4 w-4 text-gray-400" />
            <h3 className="text-sm font-bold text-gray-900">
              Recent Campaigns
            </h3>
          </div>
          <button
            type="button"
            onClick={() => onJump("campaigns")}
            className="inline-flex items-center gap-1 text-[11px] font-bold uppercase tracking-wide text-orange-600 hover:underline"
          >
            All <ArrowRight className="h-3 w-3" />
          </button>
        </div>
        <ul className="divide-y divide-gray-100">
          {recent.map((c) => {
            const roi = c.spend > 0 ? c.revenue / c.spend : 0;
            return (
              <li key={c.id} className="px-4 py-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-bold text-gray-900">
                      {c.name}
                    </div>
                    <div className="mt-0.5 flex items-center gap-1.5 text-[11px] text-gray-500">
                      <span
                        className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ring-1 ${CHANNEL_TONE[c.channel]}`}
                      >
                        {c.channel}
                      </span>
                      <span>{c.audience}</span>
                    </div>
                  </div>
                  <div className="text-right">
                    <div
                      className={`text-sm font-extrabold tabular-nums ${
                        roi >= 5 ? "text-emerald-600" : "text-gray-900"
                      }`}
                    >
                      {Math.round(roi * 10) / 10}Ã— ROI
                    </div>
                    <div className="text-[11px] text-gray-500">
                      {c.redemptions} redeemed
                    </div>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}

/* ============================================================
   DIRECTORY â€” unified external-relationship contact classes
   ============================================================ */
type ContactClass = "guests" | "suppliers";

function DirectoryView({
  customers,
  rules,
}: {
  customers: Customer[];
  rules: LoyaltyRules;
}) {
  const [contactClass, setContactClass] = useState<ContactClass>("guests");
  // Suppliers/Vendors are derived from the shared inventory catalog so the
  // directory mirrors the items, categories, and stock each supplier provides.
  const suppliers = useMemo(() => deriveVendors(SEED_INVENTORY), []);

  const segments = [
    { id: "guests" as const, label: "Guests", icon: Users, count: customers.length },
    {
      id: "suppliers" as const,
      label: "Suppliers / Vendors",
      icon: Truck,
      count: suppliers.length,
    },
  ];

  return (
    <div className="space-y-3">
      {/* Contact-class segmented control */}
      <div className="flex w-fit items-center gap-1 rounded-xl border border-gray-200 bg-white p-1 shadow-sm">
        {segments.map((seg) => {
          const Icon = seg.icon;
          const isActive = contactClass === seg.id;
          return (
            <button
              key={seg.id}
              type="button"
              onClick={() => setContactClass(seg.id)}
              className={`relative inline-flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-xs font-bold uppercase tracking-wide transition ${
                isActive ? "text-white" : "text-gray-600 hover:text-gray-900"
              }`}
            >
              {isActive && (
                <motion.span
                  layoutId="crm-directory-pill"
                  className="absolute inset-0 rounded-lg shadow-sm"
                  style={{ backgroundColor: "var(--primary-orange)" }}
                  transition={{ type: "spring", stiffness: 400, damping: 32 }}
                />
              )}
              <Icon className="relative z-10 h-3.5 w-3.5" />
              <span className="relative z-10">{seg.label}</span>
              <span
                className={`relative z-10 rounded-full px-1.5 text-[10px] tabular-nums ${
                  isActive ? "bg-white/25 text-white" : "bg-gray-100 text-gray-600"
                }`}
              >
                {seg.count}
              </span>
            </button>
          );
        })}
      </div>

      {contactClass === "guests" ? (
        <CustomersView customers={customers} rules={rules} />
      ) : (
        <SuppliersView suppliers={suppliers} />
      )}
    </div>
  );
}

function SuppliersView({ suppliers }: { suppliers: VendorProfile[] }) {
  const [query, setQuery] = useState("");
  const [active, setActive] = useState<VendorProfile | null>(null);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return suppliers
      .filter(
        (v) =>
          !q ||
          v.name.toLowerCase().includes(q) ||
          v.contact.includes(q) ||
          v.primaryCategory.toLowerCase().includes(q) ||
          v.categories.some((c) => c.toLowerCase().includes(q)),
      )
      .sort((a, b) => b.payables - a.payables);
  }, [suppliers, query]);

  const totals = useMemo(() => {
    const payables = suppliers.reduce((s, v) => s + v.payables, 0);
    const lowStock = suppliers.reduce((s, v) => s + v.lowStockCount, 0);
    return { payables, lowStock };
  }, [suppliers]);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-gray-200 bg-white p-3 shadow-sm">
        <div className="relative min-w-[260px] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by supplier, phone, categoryâ€¦"
            className="w-full rounded-lg border border-gray-200 bg-white py-2 pl-9 pr-3 text-sm placeholder:text-gray-400 focus:border-orange-300 focus:outline-none focus:ring-2 focus:ring-orange-100"
          />
        </div>
        <div className="flex items-center gap-2 text-[11px] font-bold text-gray-600">
          <span className="inline-flex items-center gap-1 rounded-lg bg-amber-50 px-2.5 py-1.5 text-amber-700 ring-1 ring-amber-200">
            <AlertTriangle className="h-3.5 w-3.5" />
            {totals.lowStock} low-stock lines
          </span>
          <span className="inline-flex items-center gap-1 rounded-lg bg-rose-50 px-2.5 py-1.5 text-rose-700 ring-1 ring-rose-200">
            <Coins className="h-3.5 w-3.5" />
            {formatINR(totals.payables)} payable
          </span>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50 text-left text-[11px] font-bold uppercase tracking-wider text-gray-500">
                <th className="px-4 py-2">Supplier</th>
                <th className="px-4 py-2">Primary Category</th>
                <th className="px-4 py-2 text-right">Items Supplied</th>
                <th className="px-4 py-2 text-right">Low Stock</th>
                <th className="px-4 py-2 text-right">Outstanding Payable</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {visible.length === 0 ? (
                <tr>
                  <td
                    colSpan={5}
                    className="px-4 py-8 text-center text-sm text-gray-400"
                  >
                    No suppliers match.
                  </td>
                </tr>
              ) : (
                visible.map((v) => (
                  <tr
                    key={v.id}
                    onClick={() => setActive(v)}
                    className="cursor-pointer hover:bg-orange-50/30"
                  >
                    <td className="px-4 py-2">
                      <div className="flex items-center gap-2">
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-gray-700 to-gray-900 text-white ring-2 ring-gray-300">
                          <Truck className="h-4 w-4" />
                        </div>
                        <div className="min-w-0">
                          <div className="truncate text-sm font-bold text-gray-900">
                            {v.name}
                          </div>
                          <div className="text-[11px] text-gray-500">
                            {v.contact}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-2">
                      <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-gray-700">
                        <Package className="h-3 w-3" />
                        {v.primaryCategory}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-right tabular-nums text-gray-700">
                      {v.itemCount}
                    </td>
                    <td className="px-4 py-2 text-right">
                      {v.lowStockCount > 0 ? (
                        <span className="font-bold tabular-nums text-amber-600">
                          {v.lowStockCount}
                        </span>
                      ) : (
                        <span className="tabular-nums text-gray-400">0</span>
                      )}
                    </td>
                    <td className="px-4 py-2 text-right font-bold tabular-nums text-gray-900">
                      {v.payables > 0 ? formatINR(v.payables) : "â€”"}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <AnimatePresence>
        {active && (
          <SupplierDrawer supplier={active} onClose={() => setActive(null)} />
        )}
      </AnimatePresence>
    </div>
  );
}

function SupplierDrawer({
  supplier,
  onClose,
}: {
  supplier: VendorProfile;
  onClose: () => void;
}) {
  useEffect(() => {
    const o = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = o;
    };
  }, []);

  return (
    <>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[55] bg-gray-900/40"
        onClick={onClose}
      />
      <motion.div
        initial={{ x: "100%" }}
        animate={{ x: 0 }}
        exit={{ x: "100%" }}
        transition={{ type: "spring", stiffness: 300, damping: 32 }}
        className="fixed right-0 top-0 z-[55] flex h-full w-full max-w-md flex-col overflow-hidden bg-white shadow-2xl"
      >
        <header className="border-b border-gray-200 p-5">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-gray-700 to-gray-900 text-white ring-4 ring-gray-300">
                <Truck className="h-6 w-6" />
              </div>
              <div>
                <div className="text-base font-extrabold text-gray-900">
                  {supplier.name}
                </div>
                <div className="text-[11px] text-gray-500">
                  {supplier.contact}
                </div>
                <span className="mt-1 inline-flex items-center gap-1 rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-gray-700">
                  <Package className="h-3 w-3" />
                  {supplier.primaryCategory}
                </span>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded-md p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
              aria-label="Close"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </header>
        <div className="flex-1 space-y-4 overflow-y-auto p-5">
          <div className="grid grid-cols-2 gap-2">
            <a
              href={`tel:${supplier.contact}`}
              className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-bold text-gray-700 hover:border-emerald-300 hover:bg-emerald-50 hover:text-emerald-700"
            >
              <Phone className="h-3.5 w-3.5" />
              Call
            </a>
            <a
              href={`sms:${supplier.contact}`}
              className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-bold text-gray-700 hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700"
            >
              <MessageSquare className="h-3.5 w-3.5" />
              SMS
            </a>
          </div>

          <div className="grid grid-cols-3 gap-2">
            <Stat
              label="Items"
              value={`${supplier.itemCount}`}
              accent="text-gray-900"
            />
            <Stat
              label="Low Stock"
              value={`${supplier.lowStockCount}`}
              accent={
                supplier.lowStockCount > 0 ? "text-amber-600" : "text-gray-900"
              }
            />
            <Stat
              label="Payable"
              value={formatINR(supplier.payables)}
              accent="text-[color:var(--primary-orange)]"
            />
          </div>

          <div>
            <div className="mb-2 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-gray-500">
              <Boxes className="h-3.5 w-3.5" />
              Supply Categories
            </div>
            <div className="flex flex-wrap gap-1.5">
              {supplier.categories.map((c) => (
                <span
                  key={c}
                  className="rounded-full bg-gray-100 px-2.5 py-1 text-[11px] font-bold text-gray-700"
                >
                  {c}
                </span>
              ))}
            </div>
          </div>

          <div className="rounded-xl border border-gray-200 bg-gray-50 p-3 text-[11px] leading-relaxed text-gray-500">
            Supplier profiles are derived from the shared Inventory catalog â€” the
            categories, item counts, and stock levels above reflect what this
            supplier provides.
          </div>
        </div>
      </motion.div>
    </>
  );
}

function CustomersView({
  customers,
  rules,
}: {
  customers: Customer[];
  rules: LoyaltyRules;
}) {
  const [query, setQuery] = useState("");
  const [tierFilter, setTierFilter] = useState<LoyaltyTier | "All">("All");
  const [active, setActive] = useState<Customer | null>(null);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return customers
      .filter((c) =>
        tierFilter === "All"
          ? true
          : tierOf(c.lifetimeSpend, rules.tiers) === tierFilter,
      )
      .filter(
        (c) =>
          !q ||
          c.name.toLowerCase().includes(q) ||
          c.phone.includes(q) ||
          c.email?.toLowerCase().includes(q) ||
          c.tags.some((t) => t.toLowerCase().includes(q)),
      )
      .sort((a, b) => b.lifetimeSpend - a.lifetimeSpend);
  }, [customers, query, tierFilter, rules]);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-gray-200 bg-white p-3 shadow-sm">
        <div className="relative min-w-[260px] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by name, phone, email, tagâ€¦"
            className="w-full rounded-lg border border-gray-200 bg-white py-2 pl-9 pr-3 text-sm placeholder:text-gray-400 focus:border-orange-300 focus:outline-none focus:ring-2 focus:ring-orange-100"
          />
        </div>
        <div className="flex items-center gap-1 rounded-lg bg-gray-100 p-1">
          {(["All", "Bronze", "Silver", "Gold", "Platinum"] as const).map(
            (t) => {
              const isActive = tierFilter === t;
              return (
                <button
                  key={t}
                  type="button"
                  onClick={() => setTierFilter(t)}
                  className={`relative rounded-md px-3 py-1.5 text-xs font-bold uppercase tracking-wide transition ${
                    isActive ? "text-white" : "text-gray-600 hover:text-gray-900"
                  }`}
                >
                  {isActive && (
                    <motion.span
                      layoutId="tier-filter-pill"
                      className="absolute inset-0 rounded-md shadow-sm"
                      style={{ backgroundColor: "var(--primary-orange)" }}
                      transition={{
                        type: "spring",
                        stiffness: 400,
                        damping: 32,
                      }}
                    />
                  )}
                  <span className="relative z-10">{t}</span>
                </button>
              );
            },
          )}
        </div>
        <button
          type="button"
          className="ml-auto inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-bold uppercase tracking-wide text-white shadow-sm transition hover:brightness-110"
          style={{ backgroundColor: "var(--primary-orange)" }}
        >
          <Plus className="h-3.5 w-3.5" />
          Add Customer
        </button>
      </div>

      <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50 text-left text-[11px] font-bold uppercase tracking-wider text-gray-500">
                <th className="px-4 py-2">Customer</th>
                <th className="px-4 py-2">Tier</th>
                <th className="px-4 py-2 text-right">Points</th>
                <th className="px-4 py-2 text-right">Visits</th>
                <th className="px-4 py-2 text-right">Lifetime Spend</th>
                <th className="px-4 py-2">Last Visit</th>
                <th className="px-4 py-2">Tags</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {visible.length === 0 ? (
                <tr>
                  <td
                    colSpan={7}
                    className="px-4 py-8 text-center text-sm text-gray-400"
                  >
                    No customers match.
                  </td>
                </tr>
              ) : (
                visible.map((c) => {
                  const t = tierOf(c.lifetimeSpend, rules.tiers);
                  return (
                    <tr
                      key={c.id}
                      onClick={() => setActive(c)}
                      className="cursor-pointer hover:bg-orange-50/30"
                    >
                      <td className="px-4 py-2">
                        <div className="flex items-center gap-2">
                          <div
                            className={`flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-orange-300 to-orange-500 text-[11px] font-extrabold text-white ring-2 ${TIER_RING[t]}`}
                          >
                            {c.name
                              .split(" ")
                              .map((p) => p[0])
                              .join("")
                              .slice(0, 2)
                              .toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <div className="truncate text-sm font-bold text-gray-900">
                              {c.name}
                            </div>
                            <div className="text-[11px] text-gray-500">
                              {c.phone}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-2">
                        <span
                          className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${TIER_TONE[t]}`}
                        >
                          <Crown className="h-3 w-3" />
                          {t}
                        </span>
                      </td>
                      <td className="px-4 py-2 text-right">
                        <span className="font-extrabold tabular-nums text-[color:var(--primary-orange)]">
                          {c.points.toLocaleString("en-IN")}
                        </span>
                      </td>
                      <td className="px-4 py-2 text-right tabular-nums text-gray-700">
                        {c.visits}
                      </td>
                      <td className="px-4 py-2 text-right font-bold tabular-nums text-gray-900">
                        {formatINR(c.lifetimeSpend)}
                      </td>
                      <td className="px-4 py-2 text-gray-700">
                        {relativeDays(c.lastVisitAt)}
                      </td>
                      <td className="px-4 py-2">
                        <div className="flex flex-wrap gap-1">
                          {c.tags.slice(0, 3).map((tg) => (
                            <span
                              key={tg}
                              className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ring-1 ${tagTone(tg)}`}
                            >
                              {tg}
                            </span>
                          ))}
                          {c.tags.length > 3 && (
                            <span className="text-[10px] text-gray-400">
                              +{c.tags.length - 3}
                            </span>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      <AnimatePresence>
        {active && (
          <CustomerDrawer
            customer={active}
            rules={rules}
            onClose={() => setActive(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

function CustomerDrawer({
  customer,
  rules,
  onClose,
}: {
  customer: Customer;
  rules: LoyaltyRules;
  onClose: () => void;
}) {
  useEffect(() => {
    const o = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = o;
    };
  }, []);
  const { customers, addFeedback } = useCRM();
  // Re-resolve from the live store so feedback added here (or at FOH
  // settlement) renders immediately without reopening the drawer.
  const live = customers.find((x) => x.id === customer.id) ?? customer;
  const fb = live.feedback ?? [];
  const avgRating = fb.length
    ? fb.reduce((s, f) => s + f.rating, 0) / fb.length
    : 0;
  const [fbRating, setFbRating] = useState(0);
  const [fbComment, setFbComment] = useState("");
  const [fbDate, setFbDate] = useState(() =>
    new Date().toISOString().slice(0, 10),
  );
  const t = tierOf(customer.lifetimeSpend, rules.tiers);
  const sortedTiers = [...rules.tiers].sort((a, b) => a.minSpend - b.minSpend);
  const currentIdx = sortedTiers.findIndex((x) => x.id === t);
  const next = sortedTiers[currentIdx + 1];
  const toNext = next ? next.minSpend - customer.lifetimeSpend : 0;
  const progress = next
    ? Math.min(
        100,
        Math.round(
          ((customer.lifetimeSpend - sortedTiers[currentIdx].minSpend) /
            (next.minSpend - sortedTiers[currentIdx].minSpend)) *
            100,
        ),
      )
    : 100;

  return (
    <>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[55] bg-gray-900/40"
        onClick={onClose}
      />
      <motion.div
        initial={{ x: "100%" }}
        animate={{ x: 0 }}
        exit={{ x: "100%" }}
        transition={{ type: "spring", stiffness: 300, damping: 32 }}
        className="fixed right-0 top-0 z-[55] flex h-full w-full max-w-md flex-col overflow-hidden bg-white shadow-2xl"
      >
        <header className="border-b border-gray-200 p-5">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div
                className={`flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-orange-300 to-orange-500 text-lg font-extrabold text-white ring-4 ${TIER_RING[t]}`}
              >
                {customer.name
                  .split(" ")
                  .map((p) => p[0])
                  .join("")
                  .slice(0, 2)
                  .toUpperCase()}
              </div>
              <div>
                <div className="text-base font-extrabold text-gray-900">
                  {customer.name}
                </div>
                <div className="text-[11px] text-gray-500">
                  {customer.phone}
                </div>
                <span
                  className={`mt-1 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${TIER_TONE[t]}`}
                >
                  <Crown className="h-3 w-3" />
                  {t} Member
                </span>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded-md p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
              aria-label="Close"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </header>
        <div className="flex-1 space-y-4 overflow-y-auto p-5">
          <div className="grid grid-cols-2 gap-2">
            <a
              href={`tel:${customer.phone}`}
              className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-bold text-gray-700 hover:border-emerald-300 hover:bg-emerald-50 hover:text-emerald-700"
            >
              <Phone className="h-3.5 w-3.5" />
              Call
            </a>
            {customer.email && (
              <a
                href={`mailto:${customer.email}`}
                className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-bold text-gray-700 hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700"
              >
                <Mail className="h-3.5 w-3.5" />
                Email
              </a>
            )}
          </div>

          <div className="grid grid-cols-3 gap-2">
            <Stat label="Points" value={customer.points.toLocaleString("en-IN")} accent="text-[color:var(--primary-orange)]" />
            <Stat label="Visits" value={`${customer.visits}`} />
            <Stat label="Spend" value={formatINR(customer.lifetimeSpend)} />
          </div>

          {next && (
            <div className="rounded-xl border border-gray-200 bg-gradient-to-br from-orange-50 to-amber-50 p-3">
              <div className="flex items-center justify-between text-[11px] font-bold uppercase tracking-wider text-orange-700">
                <span>Next Tier</span>
                <span>
                  {formatINR(toNext)} away from{" "}
                  <span
                    className={`rounded-full px-1.5 py-0.5 text-[10px] ${TIER_TONE[next.id]}`}
                  >
                    {next.id}
                  </span>
                </span>
              </div>
              <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-white/60">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-orange-400 to-amber-500"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          )}

          <div>
            <div className="text-[11px] font-bold uppercase tracking-wider text-gray-500">
              Visit History
            </div>
            <div className="mt-1 rounded-xl border border-gray-200 p-3 text-sm text-gray-700">
              <div className="flex items-center justify-between">
                <span>Last visit</span>
                <span className="font-bold">
                  {relativeDays(customer.lastVisitAt)}
                </span>
              </div>
              <div className="mt-1 flex items-center justify-between">
                <span>Member since</span>
                <span className="font-bold">
                  {new Date(customer.joinedAt).toLocaleDateString("en-IN", {
                    month: "short",
                    year: "numeric",
                  })}
                </span>
              </div>
              <div className="mt-1 flex items-center justify-between">
                <span>Avg ticket</span>
                <span className="font-bold">
                  {formatINR(
                    Math.round(customer.lifetimeSpend / customer.visits),
                  )}
                </span>
              </div>
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between">
              <div className="text-[11px] font-bold uppercase tracking-wider text-gray-500">
                Guest Feedback Log
              </div>
              {avgRating > 0 && (
                <span className="flex items-center gap-1 text-[11px] font-bold text-amber-600">
                  <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                  {avgRating.toFixed(1)} avg Â· {fb.length}
                </span>
              )}
            </div>
            <div className="mt-1 space-y-2">
              {fb.length === 0 ? (
                <p className="rounded-xl border border-dashed border-gray-200 p-3 text-sm text-gray-400">
                  No feedback recorded yet.
                </p>
              ) : (
                fb.map((f) => (
                  <div
                    key={f.id}
                    className="rounded-xl border border-gray-200 p-3"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-0.5">
                        {[1, 2, 3, 4, 5].map((n) => (
                          <Star
                            key={n}
                            className={`h-3.5 w-3.5 ${
                              n <= f.rating
                                ? "fill-amber-400 text-amber-400"
                                : "text-gray-300"
                            }`}
                          />
                        ))}
                      </div>
                      <span className="text-[11px] font-medium text-gray-500">
                        {new Date(f.visitDate).toLocaleDateString("en-IN", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        })}
                      </span>
                    </div>
                    {f.comment && (
                      <p className="mt-1 text-sm text-gray-700">{f.comment}</p>
                    )}
                  </div>
                ))
              )}
            </div>

            <div className="mt-2 rounded-xl border border-gray-200 bg-gray-50/60 p-3">
              <div className="flex items-center gap-1.5">
                {[1, 2, 3, 4, 5].map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setFbRating((r) => (r === n ? 0 : n))}
                    className="p-0.5"
                    aria-label={`${n} star${n > 1 ? "s" : ""}`}
                  >
                    <Star
                      className={`h-5 w-5 transition ${
                        n <= fbRating
                          ? "fill-amber-400 text-amber-400"
                          : "text-gray-300"
                      }`}
                    />
                  </button>
                ))}
              </div>
              <input
                type="date"
                value={fbDate}
                onChange={(e) => setFbDate(e.target.value)}
                className="mt-2 w-full rounded-md border border-gray-300 bg-white px-2 py-1.5 text-sm focus:border-orange-400 focus:outline-none focus:ring-2 focus:ring-orange-200"
              />
              <textarea
                value={fbComment}
                onChange={(e) => setFbComment(e.target.value)}
                rows={2}
                placeholder="What did the guest say?"
                className="mt-2 w-full resize-none rounded-md border border-gray-300 bg-white px-2 py-1.5 text-sm focus:border-orange-400 focus:outline-none focus:ring-2 focus:ring-orange-200"
              />
              <button
                type="button"
                disabled={fbRating === 0}
                onClick={() => {
                  addFeedback(live.phone, {
                    rating: fbRating,
                    visitDate: fbDate,
                    comment: fbComment.trim(),
                  });
                  setFbRating(0);
                  setFbComment("");
                }}
                className="mt-2 inline-flex w-full items-center justify-center gap-1.5 rounded-md px-3 py-2 text-sm font-bold text-white shadow-sm transition disabled:cursor-not-allowed disabled:opacity-50"
                style={{ backgroundColor: "var(--primary-orange)" }}
              >
                <Plus className="h-4 w-4" />
                Add Feedback
              </button>
            </div>
          </div>

          {customer.preferences && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-3">
              <div className="flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider text-amber-700">
                <AlertTriangle className="h-3 w-3" />
                Preferences & Notes
              </div>
              <p className="mt-1 text-sm text-amber-900">
                {customer.preferences}
              </p>
            </div>
          )}

          <div>
            <div className="text-[11px] font-bold uppercase tracking-wider text-gray-500">
              Tags
            </div>
            <div className="mt-1 flex flex-wrap gap-1">
              {customer.tags.map((tg) => (
                <span
                  key={tg}
                  className={`rounded-full px-2 py-0.5 text-[11px] font-bold ring-1 ${tagTone(tg)}`}
                >
                  {tg}
                </span>
              ))}
              {customer.birthday && (
                <span className="rounded-full bg-pink-50 px-2 py-0.5 text-[11px] font-bold text-pink-700 ring-1 ring-pink-200">
                  ðŸŽ‚ {customer.birthday}
                </span>
              )}
            </div>
          </div>
        </div>
      </motion.div>
    </>
  );
}

function Stat({
  label,
  value,
  accent = "text-gray-900",
}: {
  label: string;
  value: string;
  accent?: string;
}) {
  return (
    <div className="rounded-lg border border-gray-200 bg-gray-50/60 p-2 text-center">
      <div className="text-[10px] font-bold uppercase tracking-wider text-gray-500">
        {label}
      </div>
      <div className={`mt-0.5 text-sm font-extrabold ${accent}`}>{value}</div>
    </div>
  );
}

/* ============================================================
   CAMPAIGNS
   ============================================================ */
function CampaignsView({
  campaigns,
  customers,
  rules,
  templates,
  onCreate,
}: {
  campaigns: Campaign[];
  customers: Customer[];
  rules: LoyaltyRules;
  templates: MessageTemplate[];
  onCreate: (c: Campaign) => void;
}) {
  const [creating, setCreating] = useState(false);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-end">
        <button
          type="button"
          onClick={() => setCreating(true)}
          className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-bold uppercase tracking-wide text-white shadow-sm transition hover:brightness-110"
          style={{ backgroundColor: "var(--primary-orange)" }}
        >
          <Plus className="h-3.5 w-3.5" />
          New Campaign
        </button>
      </div>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
        {campaigns.map((c) => {
          const roi = c.spend > 0 ? c.revenue / c.spend : 0;
          const redemptionPct =
            c.reach > 0 ? Math.round((c.redemptions / c.reach) * 1000) / 10 : 0;
          return (
            <div
              key={c.id}
              className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm"
            >
              <div className="flex items-start justify-between gap-2 border-b border-gray-100 p-4">
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span
                      className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold uppercase ring-1 ${CHANNEL_TONE[c.channel]}`}
                    >
                      {c.channel}
                    </span>
                    <span
                      className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide ring-1 ${
                        c.status === "Sent"
                          ? "bg-emerald-50 text-emerald-700 ring-emerald-200"
                          : c.status === "Scheduled"
                            ? "bg-blue-50 text-blue-700 ring-blue-200"
                            : "bg-gray-100 text-gray-600 ring-gray-200"
                      }`}
                    >
                      {c.status}
                    </span>
                  </div>
                  <div className="mt-1 truncate text-sm font-extrabold text-gray-900">
                    {c.name}
                  </div>
                  <div className="text-[11px] text-gray-500">
                    {c.audience} Â· {c.reach.toLocaleString("en-IN")} reached
                  </div>
                </div>
                <div className="text-right">
                  <div
                    className={`text-base font-extrabold tabular-nums ${
                      roi >= 5 ? "text-emerald-600" : "text-gray-900"
                    }`}
                  >
                    {roi > 0 ? `${Math.round(roi * 10) / 10}Ã—` : "â€”"}
                  </div>
                  <div className="text-[10px] uppercase tracking-wider text-gray-400">
                    ROI
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2 px-4 py-3 text-center">
                <Stat label="Spend" value={formatINR(c.spend)} />
                <Stat label="Revenue" value={formatINR(c.revenue)} />
                <Stat
                  label="Redemption"
                  value={`${redemptionPct}%`}
                  accent={
                    redemptionPct >= 10
                      ? "text-emerald-600"
                      : "text-gray-900"
                  }
                />
              </div>
              <div className="border-t border-gray-100 bg-gray-50 px-4 py-2 text-[11px] text-gray-500">
                {c.status === "Sent" && c.sentAt
                  ? `Sent ${relativeDays(c.sentAt)}`
                  : c.status === "Scheduled" && c.scheduledAt
                    ? `Scheduled for ${new Date(c.scheduledAt).toLocaleDateString("en-IN", { day: "2-digit", month: "short" })}`
                    : "Draft"}
                {" Â· "}
                <span className="text-gray-700">{c.template}</span>
              </div>
            </div>
          );
        })}
      </div>

      <AnimatePresence>
        {creating && (
          <CampaignModal
            customers={customers}
            rules={rules}
            templates={templates}
            existingIds={campaigns.map((c) => c.id)}
            onClose={() => setCreating(false)}
            onCreate={(c) => {
              onCreate(c);
              setCreating(false);
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

function CampaignModal({
  customers,
  rules,
  templates,
  existingIds,
  onClose,
  onCreate,
}: {
  customers: Customer[];
  rules: LoyaltyRules;
  templates: MessageTemplate[];
  existingIds: string[];
  onClose: () => void;
  onCreate: (c: Campaign) => void;
}) {
  useEffect(() => {
    const o = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = o;
    };
  }, []);
  const [name, setName] = useState("");
  const [channel, setChannel] = useState<CampaignChannel>("WhatsApp");
  const [audience, setAudience] = useState(AUDIENCES[0].id);
  const [template, setTemplate] = useState(templates[0]?.id ?? "");
  const [schedule, setSchedule] = useState<"now" | "later">("now");

  const audienceObj = AUDIENCES.find((a) => a.id === audience)!;
  const reach = audienceObj.describe(customers, rules).length;
  const tpl = templates.find((t) => t.id === template) ?? templates[0];

  const submit = () => {
    let nextNum = 2032;
    while (existingIds.includes(`CMP-${nextNum}`)) nextNum++;
    const spend = Math.round(reach * (channel === "Email" ? 1.2 : channel === "SMS" ? 1.8 : channel === "WhatsApp" ? 4 : 0.5));
    const redemptions = schedule === "now" ? Math.round(reach * 0.08) : 0;
    if (!tpl) return;
    onCreate({
      id: `CMP-${nextNum}`,
      name: name.trim() || tpl.name,
      channel,
      template: tpl.name,
      audience: audienceObj.label,
      reach,
      status: schedule === "now" ? "Sent" : "Scheduled",
      sentAt: schedule === "now" ? Date.now() : undefined,
      scheduledAt:
        schedule === "later" ? Date.now() + 24 * 60 * 60 * 1000 : undefined,
      spend,
      revenue: schedule === "now" ? Math.round(redemptions * 750) : 0,
      redemptions,
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
          className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-xl bg-white shadow-2xl"
        >
          <header className="flex items-start justify-between border-b border-gray-200 px-5 py-4">
            <div>
              <div className="text-[11px] font-bold uppercase tracking-wider text-orange-600">
                New Campaign
              </div>
              <h3 className="mt-0.5 text-lg font-extrabold text-gray-900">
                Create marketing blast
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
          <div className="flex-1 space-y-4 overflow-y-auto p-5">
            <div>
              <Label>Campaign Name</Label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={tpl.name}
                className="h-10 w-full rounded-lg border border-gray-200 px-3 text-sm focus:border-orange-300 focus:outline-none focus:ring-2 focus:ring-orange-100"
              />
            </div>

            <div>
              <Label>Channel</Label>
              <div className="flex flex-wrap gap-1.5">
                {(["WhatsApp", "SMS", "Email", "Push"] as CampaignChannel[]).map(
                  (ch) => (
                    <button
                      key={ch}
                      type="button"
                      onClick={() => setChannel(ch)}
                      className={`rounded-full px-3 py-1 text-[11px] font-bold ring-1 transition ${
                        channel === ch
                          ? CHANNEL_TONE[ch]
                          : "bg-white text-gray-500 ring-gray-200 hover:bg-gray-50"
                      }`}
                    >
                      {ch}
                    </button>
                  ),
                )}
              </div>
            </div>

            <div>
              <Label>Audience</Label>
              <select
                value={audience}
                onChange={(e) => setAudience(e.target.value)}
                className="h-10 w-full rounded-lg border border-gray-200 bg-white px-3 text-sm font-medium focus:border-orange-300 focus:outline-none focus:ring-2 focus:ring-orange-100"
              >
                {AUDIENCES.map((a) => {
                  const n = a.describe(customers, rules).length;
                  return (
                    <option key={a.id} value={a.id}>
                      {a.label} Â· {n} member{n === 1 ? "" : "s"}
                    </option>
                  );
                })}
              </select>
              <div className="mt-1 inline-flex items-center gap-1 rounded-md bg-orange-50 px-2 py-0.5 text-[11px] font-bold text-orange-700 ring-1 ring-orange-200">
                <Users className="h-3 w-3" />
                {reach} recipient{reach === 1 ? "" : "s"}
              </div>
            </div>

            <div>
              <Label>Template</Label>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {templates.map((t) => {
                  const isActive = template === t.id;
                  return (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => setTemplate(t.id)}
                      className={`rounded-lg border p-3 text-left transition ${
                        isActive
                          ? "border-orange-300 bg-orange-50"
                          : "border-gray-200 bg-white hover:border-orange-200"
                      }`}
                    >
                      <div className="flex items-center gap-1.5 text-sm font-bold text-gray-900">
                        <span>{t.emoji}</span>
                        {t.name}
                      </div>
                      <div className="mt-0.5 line-clamp-2 text-[11px] text-gray-500">
                        {t.body}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <Label>Preview</Label>
              <div className="rounded-xl border border-gray-200 bg-gradient-to-br from-gray-50 to-white p-3">
                <div className="text-[11px] font-bold uppercase tracking-wider text-gray-500">
                  {tpl.subject}
                </div>
                <div className="mt-1 whitespace-pre-line text-sm text-gray-800">
                  {tpl.body
                    .replace("{{name}}", "Aisha")
                    .replace("{{code}}", "AISHA21")}
                </div>
              </div>
            </div>

            <div>
              <Label>Schedule</Label>
              <div className="flex gap-1.5">
                {(["now", "later"] as const).map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setSchedule(s)}
                    className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-bold ring-1 transition ${
                      schedule === s
                        ? "bg-orange-50 text-orange-700 ring-orange-300"
                        : "bg-white text-gray-500 ring-gray-200 hover:bg-gray-50"
                    }`}
                  >
                    {s === "now" ? (
                      <Send className="h-3 w-3" />
                    ) : (
                      <Calendar className="h-3 w-3" />
                    )}
                    {s === "now" ? "Send now" : "Schedule for tomorrow"}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <footer className="flex items-center justify-between gap-2 border-t border-gray-200 bg-gray-50 px-5 py-3">
            <div className="text-[11px] text-gray-500">
              Estimated cost ~ â‚¹{(reach * (channel === "Email" ? 1.2 : channel === "SMS" ? 1.8 : channel === "WhatsApp" ? 4 : 0.5)).toFixed(0)}
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
                disabled={reach === 0}
                className="inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-bold uppercase tracking-wide text-white shadow-sm hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40"
                style={{ backgroundColor: "var(--primary-orange)" }}
              >
                {schedule === "now" ? (
                  <Send className="h-4 w-4" />
                ) : (
                  <Calendar className="h-4 w-4" />
                )}
                {schedule === "now" ? "Send Now" : "Schedule"}
              </button>
            </div>
          </footer>
        </motion.div>
      </div>
    </>
  );
}

/* ============================================================
   COUPONS
   ============================================================ */
function CouponsView({
  coupons,
  onToggle,
  onCreate,
}: {
  coupons: Coupon[];
  onToggle: (id: string) => void;
  onCreate: (c: Coupon) => void;
}) {
  const [creating, setCreating] = useState(false);
  const totalIssued = coupons.reduce((s, c) => s + c.issued, 0);
  const totalRedeemed = coupons.reduce((s, c) => s + c.redeemed, 0);
  const overallRedemption =
    totalIssued > 0
      ? Math.round((totalRedeemed / totalIssued) * 1000) / 10
      : 0;

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard
          icon={Ticket}
          label="Active Coupons"
          value={coupons.filter((c) => c.active).length.toString()}
          accent="text-gray-900"
        />
        <KpiCard
          icon={Send}
          label="Total Issued"
          value={totalIssued.toLocaleString("en-IN")}
          accent="text-gray-900"
        />
        <KpiCard
          icon={Check}
          label="Total Redeemed"
          value={totalRedeemed.toLocaleString("en-IN")}
          accent="text-emerald-600"
        />
        <KpiCard
          icon={TrendingUp}
          label="Redemption Rate"
          value={`${overallRedemption}%`}
          accent={
            overallRedemption >= 25
              ? "text-emerald-600"
              : overallRedemption >= 15
                ? "text-amber-600"
                : "text-red-600"
          }
        />
      </div>

      <div className="flex items-center justify-end">
        <button
          type="button"
          onClick={() => setCreating(true)}
          className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-bold uppercase tracking-wide text-white shadow-sm transition hover:brightness-110"
          style={{ backgroundColor: "var(--primary-orange)" }}
        >
          <Plus className="h-3.5 w-3.5" />
          New Coupon
        </button>
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
        {coupons.map((c) => {
          const pct = c.issued > 0 ? (c.redeemed / c.issued) * 100 : 0;
          const expired = c.expiresAt < Date.now();
          return (
            <div
              key={c.id}
              className={`overflow-hidden rounded-2xl border bg-white shadow-sm ${
                c.active && !expired
                  ? "border-gray-200"
                  : "border-gray-200 opacity-70"
              }`}
            >
              <div className="flex items-start justify-between gap-2 border-b border-dashed border-gray-200 bg-gradient-to-br from-orange-50 to-amber-50 p-3">
                <div>
                  <div className="font-mono text-base font-extrabold tracking-wider text-orange-700">
                    {c.code}
                  </div>
                  <div className="text-[11px] text-gray-600">
                    {c.description}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-lg font-extrabold text-orange-700">
                    {c.kind === "Percent"
                      ? `${c.value}%`
                      : c.kind === "Flat"
                        ? formatINR(c.value)
                        : "FREE"}
                  </div>
                  <div className="text-[10px] uppercase tracking-wider text-gray-500">
                    {c.kind === "Percent"
                      ? "off"
                      : c.kind === "Flat"
                        ? "off"
                        : "item"}
                  </div>
                </div>
              </div>
              <div className="space-y-2 p-3">
                <div className="flex items-center justify-between text-[11px] text-gray-500">
                  <span>
                    Min spend{" "}
                    <strong className="text-gray-800">
                      {c.minSpend > 0 ? formatINR(c.minSpend) : "â€”"}
                    </strong>
                  </span>
                  <span
                    className={
                      expired ? "font-bold text-red-600" : "text-gray-700"
                    }
                  >
                    {expired
                      ? "Expired"
                      : `Exp ${new Date(c.expiresAt).toLocaleDateString("en-IN", { day: "2-digit", month: "short" })}`}
                  </span>
                </div>
                <div>
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-gray-500">Redemption</span>
                    <span className="font-bold text-gray-900">
                      {c.redeemed} / {c.issued} Â·{" "}
                      <span
                        className={
                          pct >= 25
                            ? "text-emerald-600"
                            : pct >= 10
                              ? "text-amber-600"
                              : "text-red-600"
                        }
                      >
                        {Math.round(pct * 10) / 10}%
                      </span>
                    </span>
                  </div>
                  <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-gray-100">
                    <div
                      className={`h-full rounded-full ${
                        pct >= 25
                          ? "bg-emerald-500"
                          : pct >= 10
                            ? "bg-amber-500"
                            : "bg-red-400"
                      }`}
                      style={{ width: `${Math.min(100, pct)}%` }}
                    />
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => onToggle(c.id)}
                  className={`mt-1 inline-flex w-full items-center justify-center gap-1.5 rounded-md px-2 py-1.5 text-[11px] font-bold uppercase tracking-wide transition ${
                    c.active
                      ? "border border-gray-200 bg-white text-gray-700 hover:border-red-300 hover:bg-red-50 hover:text-red-700"
                      : "bg-emerald-600 text-white hover:bg-emerald-700"
                  }`}
                >
                  {c.active ? "Pause" : "Activate"}
                </button>
              </div>
            </div>
          );
        })}
      </div>

      <AnimatePresence>
        {creating && (
          <CouponModal
            existingCodes={coupons.map((c) => c.code)}
            onClose={() => setCreating(false)}
            onCreate={(c) => {
              onCreate(c);
              setCreating(false);
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

function CouponModal({
  existingCodes,
  onClose,
  onCreate,
}: {
  existingCodes: string[];
  onClose: () => void;
  onCreate: (c: Coupon) => void;
}) {
  useEffect(() => {
    const o = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = o;
    };
  }, []);
  const [code, setCode] = useState("");
  const [kind, setKind] = useState<CouponKind>("Flat");
  const [value, setValue] = useState(100);
  const [description, setDescription] = useState("");
  const [minSpend, setMinSpend] = useState(0);
  const [days, setDays] = useState(14);

  const codeUpper = code.trim().toUpperCase();
  const codeError =
    !codeUpper.length
      ? "Code is required"
      : existingCodes.includes(codeUpper)
        ? "Code already exists"
        : null;

  const submit = () => {
    if (codeError) return;
    onCreate({
      id: `cp-${Date.now().toString(36)}`,
      code: codeUpper,
      kind,
      value: kind === "FreeItem" ? 0 : value,
      description: description.trim() || `Custom ${kind.toLowerCase()} discount`,
      minSpend,
      expiresAt: Date.now() + days * 24 * 60 * 60 * 1000,
      active: true,
      issued: 0,
      redeemed: 0,
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
              <div className="text-[11px] font-bold uppercase tracking-wider text-orange-600">
                New Coupon
              </div>
              <h3 className="mt-0.5 text-lg font-extrabold text-gray-900">
                Create discount code
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
          <div className="space-y-3 p-5">
            <div>
              <Label>Code</Label>
              <input
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="SUMMER-30"
                className={`h-10 w-full rounded-lg border px-3 font-mono text-sm font-bold uppercase tracking-wider focus:outline-none focus:ring-2 ${
                  codeError && code.length > 0
                    ? "border-red-300 focus:border-red-300 focus:ring-red-100"
                    : "border-gray-200 focus:border-orange-300 focus:ring-orange-100"
                }`}
              />
              {codeError && code.length > 0 && (
                <div className="mt-1 text-[11px] font-semibold text-red-600">
                  {codeError}
                </div>
              )}
            </div>
            <div>
              <Label>Type</Label>
              <div className="flex gap-1.5">
                {(["Percent", "Flat", "FreeItem"] as CouponKind[]).map((k) => (
                  <button
                    key={k}
                    type="button"
                    onClick={() => setKind(k)}
                    className={`flex-1 rounded-lg border px-3 py-2 text-[11px] font-bold transition ${
                      kind === k
                        ? "border-orange-300 bg-orange-50 text-orange-700"
                        : "border-gray-200 bg-white text-gray-600 hover:bg-gray-50"
                    }`}
                  >
                    {k === "FreeItem" ? "Free Item" : k}
                  </button>
                ))}
              </div>
            </div>
            {kind !== "FreeItem" && (
              <div>
                <Label>Value ({kind === "Percent" ? "%" : "â‚¹"})</Label>
                <input
                  type="number"
                  value={value}
                  min={0}
                  onChange={(e) =>
                    setValue(Math.max(0, Number(e.target.value) || 0))
                  }
                  className="h-10 w-full rounded-lg border border-gray-200 px-3 text-sm font-bold tabular-nums focus:border-orange-300 focus:outline-none focus:ring-2 focus:ring-orange-100"
                />
              </div>
            )}
            <div>
              <Label>Description</Label>
              <input
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="What does this coupon do?"
                className="h-10 w-full rounded-lg border border-gray-200 px-3 text-sm focus:border-orange-300 focus:outline-none focus:ring-2 focus:ring-orange-100"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Min Spend (â‚¹)</Label>
                <input
                  type="number"
                  value={minSpend}
                  min={0}
                  onChange={(e) =>
                    setMinSpend(Math.max(0, Number(e.target.value) || 0))
                  }
                  className="h-10 w-full rounded-lg border border-gray-200 px-3 text-sm font-bold tabular-nums focus:border-orange-300 focus:outline-none focus:ring-2 focus:ring-orange-100"
                />
              </div>
              <div>
                <Label>Valid for (days)</Label>
                <input
                  type="number"
                  value={days}
                  min={1}
                  onChange={(e) =>
                    setDays(Math.max(1, Number(e.target.value) || 1))
                  }
                  className="h-10 w-full rounded-lg border border-gray-200 px-3 text-sm font-bold tabular-nums focus:border-orange-300 focus:outline-none focus:ring-2 focus:ring-orange-100"
                />
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
              onClick={submit}
              disabled={!!codeError}
              className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg px-4 py-2 text-sm font-bold uppercase tracking-wide text-white shadow-sm hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40"
              style={{ backgroundColor: "var(--primary-orange)" }}
            >
              <Check className="h-4 w-4" />
              Create
            </button>
          </footer>
        </motion.div>
      </div>
    </>
  );
}

/* ============================================================
   SETTINGS / RULES
   ============================================================ */
function SettingsView({
  rules,
  onSave,
}: {
  rules: LoyaltyRules;
  onSave: (r: LoyaltyRules) => void;
}) {
  const [draft, setDraft] = useState<LoyaltyRules>(rules);

  useEffect(() => setDraft(rules), [rules]);

  const updateTier = (id: LoyaltyTier, patch: Partial<TierConfig>) => {
    setDraft((r) => ({
      ...r,
      tiers: r.tiers.map((t) => (t.id === id ? { ...t, ...patch } : t)),
    }));
  };

  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
      <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
        <div className="border-b border-gray-100 p-4">
          <div className="flex items-center gap-1.5">
            <Sparkles className="h-4 w-4 text-gray-400" />
            <h3 className="text-sm font-bold text-gray-900">Earning Rules</h3>
          </div>
          <p className="mt-1 text-[11px] text-gray-500">
            Define how guests earn and redeem loyalty points.
          </p>
        </div>
        <div className="space-y-3 p-4">
          <RuleRow
            label="Earn rate"
            help="Points awarded for every â‚¹1 spent"
            value={draft.pointsPerRupee}
            step={0.001}
            onChange={(v) =>
              setDraft((r) => ({ ...r, pointsPerRupee: Math.max(0, v) }))
            }
            suffix="pts / â‚¹"
          />
          <div className="rounded-md bg-orange-50 px-3 py-1.5 text-[11px] text-orange-800 ring-1 ring-orange-200">
            That's <strong>1 point per â‚¹{Math.round(1 / Math.max(0.0001, draft.pointsPerRupee))}</strong> spent.
          </div>
          <RuleRow
            label="Redemption rate"
            help="â‚¹ value of 1 loyalty point"
            value={draft.rupeePerPoint}
            step={0.5}
            onChange={(v) =>
              setDraft((r) => ({ ...r, rupeePerPoint: Math.max(0, v) }))
            }
            suffix="â‚¹ / pt"
          />
          <RuleRow
            label="Sign-up bonus"
            help="Points awarded on enrollment"
            value={draft.signupBonus}
            onChange={(v) =>
              setDraft((r) => ({ ...r, signupBonus: Math.max(0, Math.round(v)) }))
            }
            suffix="pts"
          />
          <RuleRow
            label="Birthday bonus"
            help="Bonus points on guest's birthday"
            value={draft.birthdayBonus}
            onChange={(v) =>
              setDraft((r) => ({
                ...r,
                birthdayBonus: Math.max(0, Math.round(v)),
              }))
            }
            suffix="pts"
          />
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
        <div className="border-b border-gray-100 p-4">
          <div className="flex items-center gap-1.5">
            <Crown className="h-4 w-4 text-gray-400" />
            <h3 className="text-sm font-bold text-gray-900">
              Tier Configuration
            </h3>
          </div>
          <p className="mt-1 text-[11px] text-gray-500">
            Set spend thresholds and perks for each tier.
          </p>
        </div>
        <ul className="divide-y divide-gray-100">
          {[...draft.tiers]
            .sort((a, b) => a.minSpend - b.minSpend)
            .map((t) => (
              <li key={t.id} className="space-y-2 p-4">
                <div className="flex items-center justify-between">
                  <span
                    className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide ${TIER_TONE[t.id]}`}
                  >
                    <Crown className="h-3 w-3" />
                    {t.id}
                  </span>
                  <span className="text-[11px] text-gray-500">
                    {t.earnMultiplier}Ã— earn rate
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label>Lifetime spend â‰¥</Label>
                    <input
                      type="number"
                      value={t.minSpend}
                      min={0}
                      onChange={(e) =>
                        updateTier(t.id, {
                          minSpend: Math.max(0, Number(e.target.value) || 0),
                        })
                      }
                      className="h-9 w-full rounded-md border border-gray-200 px-2 text-right text-sm font-bold tabular-nums focus:border-orange-300 focus:outline-none focus:ring-2 focus:ring-orange-100"
                    />
                  </div>
                  <div>
                    <Label>Earn multiplier</Label>
                    <input
                      type="number"
                      step="0.05"
                      value={t.earnMultiplier}
                      min={1}
                      onChange={(e) =>
                        updateTier(t.id, {
                          earnMultiplier: Math.max(
                            1,
                            Number(e.target.value) || 1,
                          ),
                        })
                      }
                      className="h-9 w-full rounded-md border border-gray-200 px-2 text-right text-sm font-bold tabular-nums focus:border-orange-300 focus:outline-none focus:ring-2 focus:ring-orange-100"
                    />
                  </div>
                </div>
                <div>
                  <Label>Perks</Label>
                  <input
                    value={t.perks}
                    onChange={(e) => updateTier(t.id, { perks: e.target.value })}
                    className="h-9 w-full rounded-md border border-gray-200 px-2 text-sm focus:border-orange-300 focus:outline-none focus:ring-2 focus:ring-orange-100"
                  />
                </div>
              </li>
            ))}
        </ul>
      </div>

      <div className="xl:col-span-2">
        <button
          type="button"
          onClick={() => onSave(draft)}
          className="inline-flex items-center gap-1.5 rounded-lg px-4 py-2.5 text-sm font-bold uppercase tracking-wide text-white shadow-sm transition hover:brightness-110"
          style={{ backgroundColor: "var(--primary-orange)" }}
        >
          <Check className="h-4 w-4" />
          Save Loyalty Rules
        </button>
      </div>
    </div>
  );
}

function RuleRow({
  label,
  help,
  value,
  onChange,
  step = 1,
  suffix,
}: {
  label: string;
  help?: string;
  value: number;
  onChange: (v: number) => void;
  step?: number;
  suffix?: string;
}) {
  return (
    <div className="flex items-center gap-3">
      <div className="flex-1">
        <div className="text-sm font-bold text-gray-900">{label}</div>
        {help && <div className="text-[11px] text-gray-500">{help}</div>}
      </div>
      <div className="flex items-center gap-2">
        <input
          type="number"
          step={step}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          className="h-9 w-24 rounded-md border border-gray-200 px-2 text-right text-sm font-bold tabular-nums focus:border-orange-300 focus:outline-none focus:ring-2 focus:ring-orange-100"
        />
        {suffix && (
          <span className="text-[11px] font-bold text-gray-500 w-14">
            {suffix}
          </span>
        )}
      </div>
    </div>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <label className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-gray-500">
      {children}
    </label>
  );
}

export const __unused = { Pencil, Trash2, Tag };
