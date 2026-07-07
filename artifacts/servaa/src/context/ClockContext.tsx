import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  type ReactNode,
} from "react";
import { useCollectionState } from "@/lib/collectionState";
import { commitClockEvent } from "@/lib/workflowsApi";

export interface ClockEvent {
  id: string;
  staffId: string;
  staffName: string;
  role: string;
  type: "clock_in" | "clock_out";
  at: number;
  note?: string;
}

export interface ActiveShift {
  staffId: string;
  staffName: string;
  role: string;
  clockedInAt: number;
}

interface ClockContextValue {
  events: ClockEvent[];
  activeShifts: ActiveShift[];
  clockIn: (staffId: string, staffName: string, role: string, note?: string) => void;
  clockOut: (staffId: string, note?: string) => void;
  isClockedIn: (staffId: string) => boolean;
}

const ClockContext = createContext<ClockContextValue | null>(null);

let clockSeq = 0;

export function ClockProvider({ children }: { children: ReactNode }) {
  const [events, setEvents] = useCollectionState<ClockEvent[]>("clock_events", []);

  const activeShifts = useMemo<ActiveShift[]>(() => {
    const map = new Map<string, ActiveShift>();
    const sorted = [...events].sort((a, b) => a.at - b.at);
    for (const ev of sorted) {
      if (ev.type === "clock_in") {
        map.set(ev.staffId, {
          staffId: ev.staffId,
          staffName: ev.staffName,
          role: ev.role,
          clockedInAt: ev.at,
        });
      } else {
        map.delete(ev.staffId);
      }
    }
    return Array.from(map.values());
  }, [events]);

  const clockIn = useCallback(
    (staffId: string, staffName: string, role: string, note?: string) => {
      clockSeq += 1;
      const event: ClockEvent = {
          id: `CLK-${Date.now()}-${clockSeq}`,
          staffId,
          staffName,
          role,
          type: "clock_in",
          at: Date.now(),
          note,
      };
      void commitClockEvent(event);
      setEvents((prev) => [...prev, event]);
    },
    [setEvents],
  );

  const clockOut = useCallback(
    (staffId: string, note?: string) => {
      const shift = activeShifts.find((s) => s.staffId === staffId);
      if (!shift) return;
      clockSeq += 1;
      const event: ClockEvent = {
          id: `CLK-${Date.now()}-${clockSeq}`,
          staffId,
          staffName: shift.staffName,
          role: shift.role,
          type: "clock_out",
          at: Date.now(),
          note,
      };
      void commitClockEvent(event);
      setEvents((prev) => [...prev, event]);
    },
    [activeShifts, setEvents],
  );

  const isClockedIn = useCallback(
    (staffId: string) => activeShifts.some((s) => s.staffId === staffId),
    [activeShifts],
  );

  const value = useMemo<ClockContextValue>(
    () => ({ events, activeShifts, clockIn, clockOut, isClockedIn }),
    [events, activeShifts, clockIn, clockOut, isClockedIn],
  );

  return (
    <ClockContext.Provider value={value}>{children}</ClockContext.Provider>
  );
}

export function useClock(): ClockContextValue {
  const ctx = useContext(ClockContext);
  if (!ctx) throw new Error("useClock must be used within ClockProvider");
  return ctx;
}
