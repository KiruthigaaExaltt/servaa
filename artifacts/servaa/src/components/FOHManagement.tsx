import { useState } from "react";
import { motion } from "framer-motion";
import { LayoutGrid, Map, CalendarCheck, QrCode } from "lucide-react";
import { Ordering } from "./foh/Ordering";
import { FloorMap } from "./foh/FloorMap";
import { Reservations } from "./foh/Reservations";
import { QRManagement } from "./foh/QRManagement";

type FohView = "ordering" | "floor" | "reservations" | "qr";

const SUB_NAV: { id: FohView; label: string; icon: typeof LayoutGrid }[] = [
  { id: "ordering", label: "Ordering", icon: LayoutGrid },
  { id: "floor", label: "Floor Map", icon: Map },
  { id: "reservations", label: "Reservations", icon: CalendarCheck },
  { id: "qr", label: "QR Management", icon: QrCode },
];

export function FOHManagement() {
  const [view, setView] = useState<FohView>("ordering");

  return (
    <div className="space-y-4">
      <nav className="flex flex-wrap items-center gap-1 rounded-xl border border-gray-200 bg-white p-1 shadow-sm">
        {SUB_NAV.map((tab) => {
          const Icon = tab.icon;
          const isActive = tab.id === view;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setView(tab.id)}
              className={`relative inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition ${
                isActive
                  ? "text-white"
                  : "text-gray-600 hover:text-gray-900"
              }`}
            >
              {isActive && (
                <motion.span
                  layoutId="foh-subnav-pill"
                  className="absolute inset-0 rounded-lg shadow-sm"
                  style={{ backgroundColor: "var(--primary-orange)" }}
                  transition={{ type: "spring", stiffness: 400, damping: 32 }}
                />
              )}
              <span className="relative z-10 inline-flex items-center gap-2">
                <Icon className="h-4 w-4" />
                {tab.label}
              </span>
            </button>
          );
        })}
      </nav>

      {view === "ordering" && <Ordering />}
      {view === "floor" && <FloorMap onOpenOrdering={() => setView("ordering")} />}
      {view === "reservations" && (
        <Reservations
          onOpenOrdering={() => setView("ordering")}
          onOpenFloorMap={() => setView("floor")}
        />
      )}
      {view === "qr" && <QRManagement />}
    </div>
  );
}
