import { useState } from "react";
import {
  Banknote,
  CreditCard,
  Smartphone,
  Wallet,
  Printer,
  Star,
  Loader2,
} from "lucide-react";
import type { PaymentMethod } from "@/context/FOHContext";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export interface SettleFeedback {
  rating: number;
  comment: string;
}

const CASH_QUICK = [100, 200, 500, 2000];

export function SettleModal({
  open,
  total,
  title = "Settle Bill",
  subtitle = "Choose a payment method to close the order.",
  isSubmitting = false,
  onClose,
  onPaid,
}: {
  open: boolean;
  total: number;
  title?: string;
  subtitle?: string;
  isSubmitting?: boolean;
  onClose: () => void;
  onPaid: (
    method: PaymentMethod,
    tendered: number,
    change: number,
    feedback: SettleFeedback,
  ) => void;
}) {
  const [method, setMethod] = useState<PaymentMethod>("Cash");
  const [tendered, setTendered] = useState<number>(0);
  const [rating, setRating] = useState<number>(0);
  const [hoverRating, setHoverRating] = useState<number>(0);
  const [comment, setComment] = useState<string>("");

  const change = Math.max(0, tendered - total);
  const canPay = !isSubmitting && (method !== "Cash" || (tendered >= total && total > 0));

  const reset = () => {
    setTendered(0);
    setMethod("Cash");
    setRating(0);
    setHoverRating(0);
    setComment("");
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o && !isSubmitting) {
          onClose();
          reset();
        }
      }}
    >
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{subtitle}</DialogDescription>
        </DialogHeader>

        <div className="rounded-lg bg-gray-50 p-4 text-center">
          <div className="text-xs uppercase tracking-wide text-gray-500">Total Amount</div>
          <div className="text-3xl font-extrabold text-gray-900 tabular-nums">
            ₹{total.toLocaleString("en-IN")}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          {(
            [
              { id: "Cash", icon: Banknote },
              { id: "Card", icon: CreditCard },
              { id: "UPI", icon: Smartphone },
              { id: "Wallet", icon: Wallet },
            ] as { id: PaymentMethod; icon: typeof Banknote }[]
          ).map((m) => {
            const Icon = m.icon;
            const active = m.id === method;
            return (
              <button
                key={m.id}
                type="button"
                disabled={isSubmitting}
                onClick={() => setMethod(m.id)}
                className={`flex items-center justify-center gap-2 rounded-lg border-2 px-4 py-3 text-sm font-semibold transition disabled:opacity-50 ${
                  active ? "border-transparent text-white shadow" : "border-gray-200 bg-white text-gray-700 hover:border-orange-300"
                }`}
                style={active ? { backgroundColor: "var(--primary-orange)" } : undefined}
              >
                <Icon className="h-4 w-4" />
                {m.id}
              </button>
            );
          })}
        </div>

        {method === "Cash" && (
          <div className="space-y-2">
            <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">Cash Tendered</div>
            <input
              type="number"
              min={0}
              disabled={isSubmitting}
              value={tendered || ""}
              onChange={(e) => setTendered(Number(e.target.value) || 0)}
              placeholder="0"
              className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-lg font-semibold tabular-nums focus:border-orange-400 focus:outline-none focus:ring-2 focus:ring-orange-200 disabled:opacity-50"
            />
            <div className="grid grid-cols-4 gap-2">
              {CASH_QUICK.map((amt) => (
                <button
                  key={amt}
                  type="button"
                  disabled={isSubmitting}
                  onClick={() => setTendered((t) => t + amt)}
                  className="rounded-md border border-gray-200 bg-white py-2 text-sm font-semibold text-gray-700 hover:border-orange-300 hover:bg-orange-50 disabled:opacity-50"
                >
                  +₹{amt}
                </button>
              ))}
            </div>
            <div className="flex items-center justify-between rounded-md bg-emerald-50 px-3 py-2 text-sm">
              <span className="font-medium text-emerald-800">Change to Return</span>
              <span className="text-lg font-bold text-emerald-700 tabular-nums">
                ₹{change.toLocaleString("en-IN")}
              </span>
            </div>
          </div>
        )}

        <div className="rounded-lg border border-gray-200 bg-white p-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">
              Guest Satisfaction
            </span>
            <span className="text-[10px] font-medium text-gray-400">optional</span>
          </div>
          <div className="mt-2 flex items-center gap-1.5">
            {[1, 2, 3, 4, 5].map((n) => {
              const filled = (hoverRating || rating) >= n;
              return (
                <button
                  key={n}
                  type="button"
                  disabled={isSubmitting}
                  onClick={() => setRating((r) => (r === n ? 0 : n))}
                  onMouseEnter={() => setHoverRating(n)}
                  onMouseLeave={() => setHoverRating(0)}
                  className="rounded p-0.5 transition"
                  aria-label={`${n} star${n > 1 ? "s" : ""}`}
                >
                  <Star
                    className={`h-6 w-6 transition ${
                      filled ? "fill-amber-400 text-amber-400" : "text-gray-300"
                    }`}
                  />
                </button>
              );
            })}
            {rating > 0 && (
              <span className="ml-1 text-sm font-bold text-gray-700">{rating}/5</span>
            )}
          </div>
          <input
            type="text"
            value={comment}
            disabled={isSubmitting}
            onChange={(e) => setComment(e.target.value)}
            placeholder="Quick comment (e.g. loved the steak, service slow)"
            className="mt-2 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:border-orange-400 focus:outline-none focus:ring-2 focus:ring-orange-200 disabled:opacity-50"
          />
          <p className="mt-1 text-[10px] text-gray-400">
            Saved to the guest's CRM profile when a phone number is on the order.
          </p>
        </div>

        <DialogFooter>
          <button
            type="button"
            onClick={() => {
              if (!canPay) return;
              onPaid(method, tendered, change, { rating, comment: comment.trim() });
              reset();
            }}
            disabled={!canPay}
            className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-600 px-5 py-3 text-sm font-bold uppercase tracking-wide text-white shadow transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Processing…
              </>
            ) : (
              <>
                <Printer className="h-4 w-4" />
                Confirm &amp; Print
              </>
            )}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
