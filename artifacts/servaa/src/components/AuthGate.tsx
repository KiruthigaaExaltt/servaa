import { useEffect, useState, type ReactNode } from "react";
import { verifyAdminPin } from "@/lib/authApi";

export function AuthGate({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [authenticated, setAuthenticated] = useState(false);
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetch("/api/auth/session", { credentials: "include", headers: { "x-outlet-slug": import.meta.env.VITE_OUTLET_SLUG ?? "servaa-main" } })
      .then((response) => setAuthenticated(response.ok))
      .catch(() => setAuthenticated(false))
      .finally(() => setReady(true));
  }, []);

  if (!ready) return <div className="flex min-h-screen items-center justify-center bg-gray-50 text-sm font-semibold text-gray-500">Connecting to Servaa…</div>;
  if (authenticated) return <>{children}</>;

  const login = async () => {
    if (submitting || pin.length < 4) return;
    setSubmitting(true); setError("");
    const ok = await verifyAdminPin(pin);
    setSubmitting(false);
    if (ok) setAuthenticated(true);
    else { setError("Invalid Admin PIN"); setPin(""); }
  };

  return <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4"><div className="w-full max-w-sm rounded-3xl border border-gray-200 bg-white p-8 shadow-xl"><div className="text-center"><div className="text-3xl font-black text-gray-900">Servaa</div><p className="mt-2 text-sm text-gray-500">Enter the Admin PIN to open this outlet.</p></div><input autoFocus type="password" inputMode="numeric" value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 12))} onKeyDown={(e) => { if (e.key === "Enter") void login(); }} className="mt-6 w-full rounded-xl border border-gray-200 px-4 py-3 text-center text-xl font-black tracking-[0.5em] outline-none focus:border-orange-400 focus:ring-4 focus:ring-orange-100" aria-label="Admin PIN" />{error && <p className="mt-3 text-center text-sm font-semibold text-red-600">{error}</p>}<button type="button" onClick={() => void login()} disabled={submitting || pin.length < 4} className="mt-5 w-full rounded-xl bg-orange-500 py-3 text-sm font-black uppercase tracking-wide text-white disabled:opacity-50">{submitting ? "Signing in…" : "Open Servaa"}</button></div></div>;
}
