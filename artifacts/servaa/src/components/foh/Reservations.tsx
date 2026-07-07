import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  Phone,
  Users,
  Clock,
  Star,
  Plus,
  MessageSquare,
  Trash2,
  Calendar,
  CheckCircle2,
  X,
  TrendingUp,
  Hash,
  Banknote,
  CreditCard,
  Smartphone,
  ArrowUpRight,
  Link2,
  Copy,
  Check,
} from "lucide-react";
import { useFOH } from "@/context/FOHContext";
import { useCRM } from "@/context/CRMContext";
import { useToast } from "@/hooks/use-toast";
import { QRCanvas } from "@/components/foh/QRCanvas";
import { tierOf, SEED_TIERS } from "@/lib/crmData";
import type { Reservation, TipPaymentMethod, WaitlistEntry } from "@/lib/fohData";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface ReservationsProps {
  onOpenOrdering: () => void;
  onOpenFloorMap?: () => void;
}

type ListMode = "reservations" | "waitlist";

const STATUS_BADGE: Record<
  Reservation["status"],
  { className: string; label: string }
> = {
  Confirmed: {
    className: "border-transparent text-white",
    label: "Confirmed",
  },
  Pending: {
    className: "border-gray-300 bg-white text-gray-600",
    label: "Pending",
  },
  Seated: {
    className: "border-transparent bg-amber-800 text-white",
    label: "Seated",
  },
};

const PAYMENT_ICON: Record<TipPaymentMethod, typeof Banknote> = {
  Cash: Banknote,
  Card: CreditCard,
  UPI: Smartphone,
};

export function Reservations({ onOpenOrdering, onOpenFloorMap }: ReservationsProps) {
  const {
    reservations,
    waitlist,
    tables,
    seatReservation,
    addReservation,
    updateReservation,
    deleteReservation,
    addWaitlistEntry,
    removeWaitlistEntry,
    promoteWaitlistEntry,
    tips,
    addTip,
    deleteTip,
    selectTable,
    updateMeta,
  } = useFOH();
  const { findCustomerByPhone, addCustomer } = useCRM();
  const { toast } = useToast();

  const [mode, setMode] = useState<ListMode>("reservations");
  const [resDialogOpen, setResDialogOpen] = useState(false);
  const [tipDialogOpen, setTipDialogOpen] = useState(false);
  const [linkDialogOpen, setLinkDialogOpen] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);

  const bookingLink = `${typeof window !== "undefined" ? window.location.origin : "https://servaa.app"}/book/servaa`;

  const copyBookingLink = async () => {
    try {
      await navigator.clipboard.writeText(bookingLink);
      setLinkCopied(true);
      window.setTimeout(() => setLinkCopied(false), 2000);
      toast({
        title: "Link copied",
        description: "Customer booking link copied to clipboard.",
      });
    } catch {
      toast({
        title: "Copy failed",
        description: "Select and copy the link manually.",
        variant: "destructive",
      });
    }
  };

  const totalTips = useMemo(
    () => tips.reduce((s, t) => s + t.amount, 0),
    [tips],
  );

  const avgTipPct = useMemo(() => {
    if (tips.length === 0) return 0;
    const pcts = tips
      .filter((t) => t.orderTotal > 0)
      .map((t) => (t.amount / t.orderTotal) * 100);
    if (pcts.length === 0) return 0;
    return pcts.reduce((s, p) => s + p, 0) / pcts.length;
  }, [tips]);

  const handleSeat = (res: Reservation) => {
    const vacant = tables.filter(
      (t) => t.status === "Vacant" && t.capacity >= res.pax,
    );
    if (vacant.length === 0) {
      toast({
        title: "No tables available",
        description: `No vacant table can seat ${res.pax}. Open the Floor Map to free one up.`,
        variant: "destructive",
      });
      onOpenFloorMap?.();
      return;
    }
    const tableId = window.prompt(
      `Seat ${res.guestName} (${res.pax} pax). Pick a table:\n\nAvailable: ${vacant.map((t) => `${t.id} (cap ${t.capacity})`).join(", ")}`,
      vacant[0].id,
    );
    if (!tableId) return;
    if (!vacant.find((t) => t.id === tableId)) {
      toast({
        title: "Table not available",
        description: `${tableId} is not vacant or too small.`,
        variant: "destructive",
      });
      return;
    }
    seatReservation(res.id, tableId);
    selectTable(tableId);
    updateMeta({
      tableId,
      customerName: res.guestName,
      customerPhone: res.phone,
      pax: res.pax,
      orderType: "Dine In",
    });

    const existing = findCustomerByPhone(res.phone);
    if (existing) {
      const tier = tierOf(existing.lifetimeSpend, SEED_TIERS);
      toast({
        title: `Returning guest · ${tier}`,
        description: `${res.guestName} → Table ${tableId} · ${existing.visits} prior visits, ${existing.points.toLocaleString("en-IN")} pts.`,
      });
    } else {
      addCustomer({ name: res.guestName, phone: res.phone });
      toast({
        title: "New guest seated",
        description: `${res.guestName} → Table ${tableId}. Added to CRM.`,
      });
    }
    onOpenOrdering();
  };

  const handleConfirmPending = (res: Reservation) => {
    updateReservation(res.id, { status: "Confirmed" });
    toast({
      title: "Reservation confirmed",
      description: `${res.guestName} · ${res.pax} pax @ ${res.time}.`,
    });
  };

  const handleCall = (r: { guestName: string; phone: string }) => {
    window.location.href = `tel:${r.phone}`;
  };

  const handleMessage = (r: { guestName: string; phone: string }) => {
    window.location.href = `sms:${r.phone}`;
  };

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
      {/* LEFT: Bookings */}
      <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
        {/* Header w/ toggle */}
        <header className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 rounded-xl bg-gray-100 p-1">
            {(["reservations", "waitlist"] as ListMode[]).map((m) => {
              const isActive = m === mode;
              const count = m === "reservations" ? reservations.length : waitlist.length;
              return (
                <button
                  key={m}
                  type="button"
                  onClick={() => setMode(m)}
                  className={`relative inline-flex items-center gap-2 rounded-lg px-3.5 py-1.5 text-sm font-semibold transition ${
                    isActive ? "text-white" : "text-gray-600 hover:text-gray-900"
                  }`}
                >
                  {isActive && (
                    <motion.span
                      layoutId="reservations-toggle-pill"
                      className="absolute inset-0 rounded-lg shadow-sm"
                      style={{ backgroundColor: "var(--primary-orange)" }}
                      transition={{ type: "spring", stiffness: 400, damping: 32 }}
                    />
                  )}
                  <span className="relative z-10 capitalize">{m}</span>
                  <span
                    className={`relative z-10 rounded-full px-1.5 py-0.5 text-[10px] font-bold ${
                      isActive
                        ? "bg-white/25 text-white"
                        : "bg-white text-gray-700"
                    }`}
                  >
                    {count}
                  </span>
                </button>
              );
            })}
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setLinkDialogOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-orange-300 bg-orange-50 px-3.5 py-2 text-sm font-bold text-orange-700 transition hover:bg-orange-100"
            >
              <Link2 className="h-4 w-4" />
              Booking Link
            </button>
            <button
              type="button"
              onClick={() => setResDialogOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-sm font-bold text-white shadow-sm transition hover:brightness-110"
              style={{ backgroundColor: "var(--primary-orange)" }}
            >
              <Plus className="h-4 w-4" />
              New {mode === "reservations" ? "Reservation" : "Waitlist Entry"}
            </button>
          </div>
        </header>

        {/* List */}
        {mode === "reservations" ? (
          <ul className="space-y-2.5">
            {reservations.map((r) => (
              <ReservationCard
                key={r.id}
                res={r}
                onSeat={() => handleSeat(r)}
                onConfirm={() => handleConfirmPending(r)}
                onCall={() => handleCall(r)}
                onMessage={() => handleMessage(r)}
                onDelete={() => {
                  deleteReservation(r.id);
                  toast({
                    title: "Reservation removed",
                    description: r.guestName,
                  });
                }}
              />
            ))}
            {reservations.length === 0 && (
              <li className="rounded-xl border border-dashed border-gray-300 bg-gray-50 p-8 text-center text-sm text-gray-500">
                No reservations yet. Click <strong>+ New Reservation</strong> to
                add one.
              </li>
            )}
          </ul>
        ) : (
          <ul className="space-y-2.5">
            {waitlist.map((w) => (
              <WaitlistCard
                key={w.id}
                entry={w}
                onPromote={() => {
                  promoteWaitlistEntry(w.id);
                  toast({
                    title: "Promoted to reservation",
                    description: `${w.guestName} · ${w.pax} pax`,
                  });
                  setMode("reservations");
                }}
                onCall={() => handleCall(w)}
                onMessage={() => handleMessage(w)}
                onDelete={() => {
                  removeWaitlistEntry(w.id);
                  toast({
                    title: "Removed from waitlist",
                    description: w.guestName,
                  });
                }}
              />
            ))}
            {waitlist.length === 0 && (
              <li className="rounded-xl border border-dashed border-gray-300 bg-gray-50 p-8 text-center text-sm text-gray-500">
                Waitlist is empty.
              </li>
            )}
          </ul>
        )}
      </section>

      {/* RIGHT: Tip Management */}
      <aside className="space-y-4">
        <section className="rounded-2xl border border-gray-200 bg-white shadow-sm">
          <header className="flex items-center justify-between border-b border-gray-100 px-5 py-3">
            <h2 className="text-base font-semibold text-gray-900">
              Tip Management
            </h2>
            <button
              type="button"
              onClick={() => setTipDialogOpen(true)}
              className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-bold text-white shadow-sm transition hover:brightness-110"
              style={{ backgroundColor: "var(--primary-orange)" }}
            >
              <Plus className="h-3.5 w-3.5" />
              Add Tip
            </button>
          </header>

          {/* Stats row */}
          <div className="grid grid-cols-3 gap-2 border-b border-gray-100 px-5 py-4">
            <Stat
              label="Today's Tips"
              value={`₹${totalTips.toLocaleString("en-IN")}`}
              valueClass="text-2xl"
              valueStyle={{ color: "var(--primary-orange)" }}
            />
            <Stat
              label="Avg Tip %"
              value={`${avgTipPct.toFixed(1)}%`}
              valueClass="text-2xl text-emerald-600"
              icon={<TrendingUp className="h-3 w-3 text-emerald-500" />}
            />
            <Stat
              label="Total Entries"
              value={tips.length.toString()}
              valueClass="text-2xl text-gray-900"
              icon={<Hash className="h-3 w-3 text-gray-400" />}
            />
          </div>

          {/* Ledger */}
          <div className="px-5 py-4">
            <div className="mb-2 flex items-center justify-between">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                Tip Ledger
              </h3>
              <span className="text-[11px] text-gray-400">
                {tips.length} entries
              </span>
            </div>
            <ul className="space-y-2">
              {tips.map((t) => {
                const PIcon = PAYMENT_ICON[t.paymentMethod];
                const pct =
                  t.orderTotal > 0
                    ? ((t.amount / t.orderTotal) * 100).toFixed(1)
                    : "—";
                return (
                  <li
                    key={t.id}
                    className="group relative rounded-xl border border-gray-200 bg-white p-3 transition hover:border-orange-200 hover:shadow-sm"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <span className="truncate text-sm font-bold text-gray-900">
                            {t.staff}
                          </span>
                          <span className="rounded-full bg-emerald-50 px-1.5 py-0.5 text-[10px] font-bold text-emerald-700">
                            {pct}%
                          </span>
                        </div>
                        <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-gray-500">
                          <span className="font-medium text-gray-700">
                            {t.tableId}
                          </span>
                          <span>·</span>
                          <span className="inline-flex items-center gap-0.5">
                            <Clock className="h-3 w-3" />
                            {new Date(t.time).toLocaleTimeString([], {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </span>
                          <span>·</span>
                          <span>₹{t.orderTotal.toLocaleString("en-IN")}</span>
                          <span>·</span>
                          <span className="inline-flex items-center gap-0.5">
                            <PIcon className="h-3 w-3" />
                            {t.paymentMethod}
                          </span>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-base font-extrabold tabular-nums text-gray-900">
                          ₹{t.amount.toLocaleString("en-IN")}
                        </div>
                        <button
                          type="button"
                          onClick={() => deleteTip(t.id)}
                          className="text-[10px] text-gray-400 opacity-0 transition group-hover:opacity-100 hover:text-red-500"
                        >
                          remove
                        </button>
                      </div>
                    </div>
                  </li>
                );
              })}
              {tips.length === 0 && (
                <li className="rounded-lg border border-dashed border-gray-300 p-4 text-center text-xs text-gray-400">
                  No tips logged today.
                </li>
              )}
            </ul>
          </div>
        </section>
      </aside>

      <NewReservationDialog
        open={resDialogOpen}
        onClose={() => setResDialogOpen(false)}
        mode={mode}
        onSubmitReservation={(r) => {
          addReservation(r);
          setResDialogOpen(false);
          toast({ title: "Reservation added", description: r.guestName });
        }}
        onSubmitWaitlist={(w) => {
          addWaitlistEntry(w);
          setResDialogOpen(false);
          toast({ title: "Added to waitlist", description: w.guestName });
        }}
      />

      <NewTipDialog
        open={tipDialogOpen}
        onClose={() => setTipDialogOpen(false)}
        onSubmit={(entry) => {
          addTip(entry);
          setTipDialogOpen(false);
          toast({
            title: `Tip logged · ₹${entry.amount}`,
            description: `${entry.staff} on ${entry.tableId}`,
          });
        }}
      />

      <Dialog open={linkDialogOpen} onOpenChange={setLinkDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Link2 className="h-5 w-5" style={{ color: "var(--primary-orange)" }} />
              Customer Booking Link
            </DialogTitle>
            <DialogDescription>
              Share this link so guests can reserve a table themselves. New
              bookings flow straight into your reservations list.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <input
                readOnly
                value={bookingLink}
                onFocus={(e) => e.currentTarget.select()}
                className="w-full rounded-lg border border-gray-300 bg-gray-50 px-3 py-2 text-sm text-gray-700 focus:border-orange-400 focus:outline-none focus:ring-2 focus:ring-orange-200"
              />
              <button
                type="button"
                onClick={copyBookingLink}
                className="inline-flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-bold text-white transition hover:brightness-110"
                style={{ backgroundColor: "var(--primary-orange)" }}
              >
                {linkCopied ? (
                  <Check className="h-4 w-4" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
                {linkCopied ? "Copied" : "Copy"}
              </button>
            </div>
            <div className="flex items-center justify-center rounded-xl border border-gray-200 bg-white p-5">
              <QRCanvas value={bookingLink} size={168} />
            </div>
            <p className="text-center text-xs text-gray-500">
              Print this QR for your entrance, or paste the link into your
              Google profile, Instagram bio, or WhatsApp.
            </p>
          </div>
          <DialogFooter>
            <button
              type="button"
              onClick={() => setLinkDialogOpen(false)}
              className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
            >
              Done
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ---------- Sub-components ---------- */

function Stat({
  label,
  value,
  valueClass,
  valueStyle,
  icon,
}: {
  label: string;
  value: string;
  valueClass?: string;
  valueStyle?: React.CSSProperties;
  icon?: React.ReactNode;
}) {
  return (
    <div className="rounded-lg bg-gray-50 px-3 py-2.5">
      <div className="mb-0.5 flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-gray-500">
        {icon}
        {label}
      </div>
      <div
        className={`font-extrabold tabular-nums ${valueClass ?? "text-2xl text-gray-900"}`}
        style={valueStyle}
      >
        {value}
      </div>
    </div>
  );
}

function ReservationCard({
  res,
  onSeat,
  onConfirm,
  onCall,
  onMessage,
  onDelete,
}: {
  res: Reservation;
  onSeat: () => void;
  onConfirm: () => void;
  onCall: () => void;
  onMessage: () => void;
  onDelete: () => void;
}) {
  const isSeated = res.status === "Seated";
  const isPending = res.status === "Pending";
  const badge = STATUS_BADGE[res.status];

  return (
    <motion.li
      layout
      className={`rounded-xl border p-4 transition ${
        res.isSpecial
          ? "border-amber-300 bg-gradient-to-br from-amber-50/60 to-white shadow-sm"
          : "border-gray-200 bg-white hover:border-orange-200"
      }`}
    >
      <div className="flex flex-wrap items-start gap-4">
        <div className="min-w-0 flex-1">
          {/* Header */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="truncate text-base font-bold text-gray-900">
              {res.guestName}
            </span>
            {res.isSpecial && (
              <span className="inline-flex items-center gap-0.5 rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold uppercase text-amber-800">
                <Star className="h-3 w-3 fill-amber-500 text-amber-500" />
                Special
              </span>
            )}
            <span
              className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-bold ${badge.className}`}
              style={
                res.status === "Confirmed"
                  ? { backgroundColor: "var(--primary-orange)" }
                  : undefined
              }
            >
              {badge.label}
            </span>
            {isSeated && res.seatedTableId && (
              <span className="text-[11px] font-semibold text-emerald-700">
                → {res.seatedTableId}
              </span>
            )}
          </div>

          {/* Details grid */}
          <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-gray-600 sm:grid-cols-4">
            <span className="inline-flex items-center gap-1">
              <Phone className="h-3 w-3 text-gray-400" />
              {res.phone}
            </span>
            <span className="inline-flex items-center gap-1">
              <Calendar className="h-3 w-3 text-gray-400" />
              {res.date}
            </span>
            <span className="inline-flex items-center gap-1">
              <Users className="h-3 w-3 text-gray-400" />
              {res.pax} pax
            </span>
            <span className="inline-flex items-center gap-1">
              <Clock className="h-3 w-3 text-gray-400" />
              {res.time}
            </span>
          </div>

          {/* Note */}
          {res.note && (
            <div className="mt-2 rounded-md bg-purple-50 px-2.5 py-1.5 text-xs italic text-purple-700">
              <span className="font-semibold not-italic">Special request:</span>{" "}
              {res.note}
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex shrink-0 flex-col items-end gap-2">
          {isSeated ? (
            <span className="inline-flex items-center gap-1 rounded-lg bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-700">
              <CheckCircle2 className="h-3.5 w-3.5" />
              Seated
            </span>
          ) : isPending ? (
            <button
              type="button"
              onClick={onConfirm}
              className="inline-flex items-center gap-1 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-bold uppercase tracking-wide text-gray-800 shadow-sm transition hover:border-orange-400 hover:text-orange-600"
            >
              Confirm
            </button>
          ) : (
            <button
              type="button"
              onClick={onSeat}
              className="inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-bold uppercase tracking-wide text-white shadow-sm transition hover:brightness-110"
              style={{ backgroundColor: "var(--primary-orange)" }}
            >
              Seat Now
            </button>
          )}
          <div className="flex items-center gap-1">
            <IconBtn label="Call" onClick={onCall}>
              <Phone className="h-3.5 w-3.5" />
            </IconBtn>
            <IconBtn label="Message" onClick={onMessage}>
              <MessageSquare className="h-3.5 w-3.5" />
            </IconBtn>
            <IconBtn label="Delete" tone="danger" onClick={onDelete}>
              <Trash2 className="h-3.5 w-3.5" />
            </IconBtn>
          </div>
        </div>
      </div>
    </motion.li>
  );
}

function WaitlistCard({
  entry,
  onPromote,
  onCall,
  onMessage,
  onDelete,
}: {
  entry: WaitlistEntry;
  onPromote: () => void;
  onCall: () => void;
  onMessage: () => void;
  onDelete: () => void;
}) {
  const waitedMin = Math.max(
    0,
    Math.floor((Date.now() - entry.joinedAt) / 60_000),
  );
  return (
    <motion.li
      layout
      className="rounded-xl border border-gray-200 bg-white p-4 transition hover:border-orange-200"
    >
      <div className="flex flex-wrap items-start gap-4">
        <div className="flex h-14 w-14 shrink-0 flex-col items-center justify-center rounded-xl bg-orange-50 text-orange-700">
          <span className="text-lg font-extrabold tabular-nums">
            {entry.quotedWait}
          </span>
          <span className="text-[9px] font-bold uppercase tracking-wide">
            min wait
          </span>
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-base font-bold text-gray-900">
            {entry.guestName}
          </div>
          <div className="mt-1 grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-gray-600 sm:grid-cols-3">
            <span className="inline-flex items-center gap-1">
              <Phone className="h-3 w-3 text-gray-400" />
              {entry.phone}
            </span>
            <span className="inline-flex items-center gap-1">
              <Users className="h-3 w-3 text-gray-400" />
              {entry.pax} pax
            </span>
            <span className="inline-flex items-center gap-1">
              <Clock className="h-3 w-3 text-gray-400" />
              waited {waitedMin}m
            </span>
          </div>
          {entry.note && (
            <div className="mt-2 text-xs italic text-gray-500">{entry.note}</div>
          )}
        </div>
        <div className="flex shrink-0 flex-col items-end gap-2">
          <button
            type="button"
            onClick={onPromote}
            className="inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-bold uppercase tracking-wide text-white shadow-sm transition hover:brightness-110"
            style={{ backgroundColor: "var(--primary-orange)" }}
          >
            <ArrowUpRight className="h-3.5 w-3.5" />
            Promote
          </button>
          <div className="flex items-center gap-1">
            <IconBtn label="Call" onClick={onCall}>
              <Phone className="h-3.5 w-3.5" />
            </IconBtn>
            <IconBtn label="Message" onClick={onMessage}>
              <MessageSquare className="h-3.5 w-3.5" />
            </IconBtn>
            <IconBtn label="Delete" tone="danger" onClick={onDelete}>
              <Trash2 className="h-3.5 w-3.5" />
            </IconBtn>
          </div>
        </div>
      </div>
    </motion.li>
  );
}

function IconBtn({
  children,
  onClick,
  label,
  tone = "default",
}: {
  children: React.ReactNode;
  onClick: () => void;
  label: string;
  tone?: "default" | "danger";
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      aria-label={label}
      className={`inline-flex h-7 w-7 items-center justify-center rounded-md border transition ${
        tone === "danger"
          ? "border-gray-200 bg-white text-gray-500 hover:border-red-300 hover:bg-red-50 hover:text-red-600"
          : "border-gray-200 bg-white text-gray-600 hover:border-orange-300 hover:bg-orange-50 hover:text-orange-600"
      }`}
    >
      {children}
    </button>
  );
}

/* ---------- Dialogs ---------- */

function NewReservationDialog({
  open,
  onClose,
  mode,
  onSubmitReservation,
  onSubmitWaitlist,
}: {
  open: boolean;
  onClose: () => void;
  mode: ListMode;
  onSubmitReservation: (r: {
    guestName: string;
    phone: string;
    pax: number;
    date: string;
    time: string;
    isSpecial?: boolean;
    note?: string;
    status: Reservation["status"];
  }) => void;
  onSubmitWaitlist: (w: {
    guestName: string;
    phone: string;
    pax: number;
    quotedWait: number;
    note?: string;
  }) => void;
}) {
  const today = new Date().toISOString().slice(0, 10);
  const [guestName, setGuestName] = useState("");
  const [phone, setPhone] = useState("");
  const [pax, setPax] = useState(2);
  const [date, setDate] = useState(today);
  const [time, setTime] = useState("19:30");
  const [quotedWait, setQuotedWait] = useState(15);
  const [note, setNote] = useState("");
  const [isSpecial, setIsSpecial] = useState(false);

  const reset = () => {
    setGuestName("");
    setPhone("");
    setPax(2);
    setDate(today);
    setTime("19:30");
    setQuotedWait(15);
    setNote("");
    setIsSpecial(false);
  };

  const valid = guestName.trim().length > 0 && phone.trim().length > 0 && pax > 0;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && (onClose(), reset())}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            New {mode === "reservations" ? "Reservation" : "Waitlist Entry"}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <Field label="Guest Name">
            <input
              autoFocus
              value={guestName}
              onChange={(e) => setGuestName(e.target.value)}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-orange-400 focus:outline-none focus:ring-2 focus:ring-orange-200"
            />
          </Field>
          <Field label="Phone">
            <input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+91 …"
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-orange-400 focus:outline-none focus:ring-2 focus:ring-orange-200"
            />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Pax">
              <input
                type="number"
                min={1}
                value={pax}
                onChange={(e) => setPax(Number(e.target.value) || 1)}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-orange-400 focus:outline-none focus:ring-2 focus:ring-orange-200"
              />
            </Field>
            {mode === "reservations" ? (
              <Field label="Time">
                <input
                  type="time"
                  value={time}
                  onChange={(e) => setTime(e.target.value)}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-orange-400 focus:outline-none focus:ring-2 focus:ring-orange-200"
                />
              </Field>
            ) : (
              <Field label="Quoted Wait (min)">
                <input
                  type="number"
                  min={0}
                  value={quotedWait}
                  onChange={(e) => setQuotedWait(Number(e.target.value) || 0)}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-orange-400 focus:outline-none focus:ring-2 focus:ring-orange-200"
                />
              </Field>
            )}
          </div>
          {mode === "reservations" && (
            <>
              <Field label="Date">
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-orange-400 focus:outline-none focus:ring-2 focus:ring-orange-200"
                />
              </Field>
              <label className="inline-flex items-center gap-2 text-sm text-gray-700">
                <input
                  type="checkbox"
                  checked={isSpecial}
                  onChange={(e) => setIsSpecial(e.target.checked)}
                  className="h-4 w-4 rounded border-gray-300 text-orange-500 focus:ring-orange-300"
                />
                <Star className="h-3.5 w-3.5 text-amber-500" />
                Mark as Special guest
              </label>
            </>
          )}
          <Field label="Notes (optional)">
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={2}
              placeholder={
                mode === "reservations"
                  ? "Window seat, allergies, occasion…"
                  : "Seating preference…"
              }
              className="w-full resize-none rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-orange-400 focus:outline-none focus:ring-2 focus:ring-orange-200"
            />
          </Field>
        </div>
        <DialogFooter className="gap-2">
          <button
            type="button"
            onClick={() => {
              onClose();
              reset();
            }}
            className="inline-flex items-center gap-1 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
          >
            <X className="h-4 w-4" />
            Cancel
          </button>
          <button
            type="button"
            disabled={!valid}
            onClick={() => {
              if (mode === "reservations") {
                onSubmitReservation({
                  guestName,
                  phone,
                  pax,
                  date,
                  time,
                  isSpecial,
                  note: note.trim() || undefined,
                  status: "Confirmed",
                });
              } else {
                onSubmitWaitlist({
                  guestName,
                  phone,
                  pax,
                  quotedWait,
                  note: note.trim() || undefined,
                });
              }
              reset();
            }}
            className="inline-flex items-center gap-1 rounded-lg px-4 py-2 text-sm font-bold text-white shadow-sm disabled:cursor-not-allowed disabled:opacity-50"
            style={{ backgroundColor: "var(--primary-orange)" }}
          >
            <Plus className="h-4 w-4" />
            Add
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function NewTipDialog({
  open,
  onClose,
  onSubmit,
}: {
  open: boolean;
  onClose: () => void;
  onSubmit: (entry: {
    staff: string;
    amount: number;
    tableId: string;
    orderTotal: number;
    paymentMethod: TipPaymentMethod;
  }) => void;
}) {
  const [staff, setStaff] = useState("");
  const [amount, setAmount] = useState(0);
  const [tableId, setTableId] = useState("T-1");
  const [orderTotal, setOrderTotal] = useState(0);
  const [paymentMethod, setPaymentMethod] = useState<TipPaymentMethod>("Card");

  const reset = () => {
    setStaff("");
    setAmount(0);
    setTableId("T-1");
    setOrderTotal(0);
    setPaymentMethod("Card");
  };

  const valid = staff.trim().length > 0 && amount > 0;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && (onClose(), reset())}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Log a Tip</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Staff Name">
              <input
                autoFocus
                value={staff}
                onChange={(e) => setStaff(e.target.value)}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-orange-400 focus:outline-none focus:ring-2 focus:ring-orange-200"
              />
            </Field>
            <Field label="Table ID">
              <input
                value={tableId}
                onChange={(e) => setTableId(e.target.value.toUpperCase())}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-orange-400 focus:outline-none focus:ring-2 focus:ring-orange-200"
              />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Tip Amount (₹)">
              <input
                type="number"
                min={0}
                value={amount || ""}
                onChange={(e) => setAmount(Number(e.target.value) || 0)}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-orange-400 focus:outline-none focus:ring-2 focus:ring-orange-200"
              />
            </Field>
            <Field label="Order Total (₹)">
              <input
                type="number"
                min={0}
                value={orderTotal || ""}
                onChange={(e) => setOrderTotal(Number(e.target.value) || 0)}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-orange-400 focus:outline-none focus:ring-2 focus:ring-orange-200"
              />
            </Field>
          </div>
          <Field label="Payment Method">
            <div className="grid grid-cols-3 gap-2">
              {(["Cash", "Card", "UPI"] as TipPaymentMethod[]).map((p) => {
                const Icon = PAYMENT_ICON[p];
                const active = paymentMethod === p;
                return (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setPaymentMethod(p)}
                    className={`inline-flex items-center justify-center gap-1.5 rounded-md border px-3 py-2 text-xs font-semibold transition ${
                      active
                        ? "border-transparent text-white shadow-sm"
                        : "border-gray-300 bg-white text-gray-700 hover:border-orange-300"
                    }`}
                    style={
                      active
                        ? { backgroundColor: "var(--primary-orange)" }
                        : undefined
                    }
                  >
                    <Icon className="h-3.5 w-3.5" />
                    {p}
                  </button>
                );
              })}
            </div>
          </Field>
        </div>
        <DialogFooter className="gap-2">
          <button
            type="button"
            onClick={() => {
              onClose();
              reset();
            }}
            className="inline-flex items-center gap-1 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
          >
            <X className="h-4 w-4" />
            Cancel
          </button>
          <button
            type="button"
            disabled={!valid}
            onClick={() => {
              onSubmit({ staff, amount, tableId, orderTotal, paymentMethod });
              reset();
            }}
            className="inline-flex items-center gap-1 rounded-lg px-4 py-2 text-sm font-bold text-white shadow-sm disabled:cursor-not-allowed disabled:opacity-50"
            style={{ backgroundColor: "var(--primary-orange)" }}
          >
            <Plus className="h-4 w-4" />
            Log Tip
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-gray-500">
        {label}
      </span>
      {children}
    </label>
  );
}
