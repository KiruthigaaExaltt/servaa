import { useState } from "react";
import { Clock, LogIn, LogOut, Users } from "lucide-react";
import { useClock } from "@/context/ClockContext";
import { useRole } from "@/context/RoleContext";

const STAFF_LIST = [
  { id: "S01", name: "Arun Kumar", role: "Server" },
  { id: "S02", name: "Priya Nair", role: "Server" },
  { id: "S03", name: "Rahul Sharma", role: "Server" },
  { id: "C01", name: "Deepa Menon", role: "Cashier" },
  { id: "K01", name: "Mohammed Riyaz", role: "Kitchen" },
  { id: "K02", name: "Sujith Nambiar", role: "Kitchen" },
  { id: "M01", name: "Sunita Pillai", role: "Manager" },
];

function formatElapsed(ms: number): string {
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  return `${h}h ${m}m`;
}

export function StaffClock() {
  const { activeShifts, events, clockIn, clockOut, isClockedIn } = useClock();
  const { can } = useRole();
  const [tab, setTab] = useState<"clock" | "log">("clock");

  if (!can("manage_crew")) {
    return (
      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm text-center text-sm text-gray-400">
        You need Manager or Admin access to manage staff clock-in.
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
      <div className="flex items-center gap-3 border-b border-gray-100 px-5 py-4">
        <Users className="h-5 w-5 text-gray-500" />
        <h2 className="font-semibold text-gray-900">Staff Clock-in / Clock-out</h2>
        <div className="ml-auto flex items-center gap-1 rounded-lg border border-gray-200 bg-gray-50 p-0.5">
          {(["clock", "log"] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className={`rounded-md px-3 py-1 text-xs font-semibold capitalize transition ${
                tab === t ? "bg-white text-gray-900 shadow-sm" : "text-gray-500"
              }`}
            >
              {t === "clock" ? "Roster" : "Log"}
            </button>
          ))}
        </div>
      </div>

      <div className="p-5">
        {tab === "clock" ? (
          <div className="space-y-2">
            {STAFF_LIST.map((staff) => {
              const clocked = isClockedIn(staff.id);
              const shift = activeShifts.find((s) => s.staffId === staff.id);
              const elapsed = shift ? Date.now() - shift.clockedInAt : 0;

              return (
                <div
                  key={staff.id}
                  className="flex items-center justify-between rounded-lg border border-gray-100 px-3 py-2.5"
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`h-2 w-2 rounded-full ${
                        clocked ? "bg-emerald-500" : "bg-gray-300"
                      }`}
                    />
                    <div>
                      <div className="text-sm font-semibold text-gray-900">
                        {staff.name}
                      </div>
                      <div className="text-xs text-gray-500">{staff.role}</div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    {clocked && shift && (
                      <div className="flex items-center gap-1 text-xs text-emerald-700">
                        <Clock className="h-3.5 w-3.5" />
                        <span className="tabular-nums">
                          {formatElapsed(elapsed)}
                        </span>
                      </div>
                    )}
                    {clocked ? (
                      <button
                        type="button"
                        onClick={() => clockOut(staff.id)}
                        className="flex items-center gap-1 rounded-md bg-red-50 px-2.5 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-100"
                      >
                        <LogOut className="h-3.5 w-3.5" />
                        Clock Out
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => clockIn(staff.id, staff.name, staff.role)}
                        className="flex items-center gap-1 rounded-md bg-emerald-50 px-2.5 py-1.5 text-xs font-semibold text-emerald-700 hover:bg-emerald-100"
                      >
                        <LogIn className="h-3.5 w-3.5" />
                        Clock In
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="max-h-96 overflow-y-auto">
            {events.length === 0 ? (
              <p className="py-4 text-center text-sm text-gray-400">No clock events yet.</p>
            ) : (
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-gray-50 text-[10px] font-bold uppercase tracking-wide text-gray-400">
                  <tr>
                    <th className="py-2 pl-2 text-left">Time</th>
                    <th className="py-2 text-left">Staff</th>
                    <th className="py-2 text-left">Role</th>
                    <th className="py-2 pr-2 text-left">Event</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {[...events]
                    .sort((a, b) => b.at - a.at)
                    .map((ev) => (
                      <tr key={ev.id} className="hover:bg-gray-50">
                        <td className="whitespace-nowrap py-2 pl-2 font-mono text-gray-500">
                          {new Date(ev.at).toLocaleString("en-IN", {
                            day: "2-digit",
                            month: "short",
                            hour: "2-digit",
                            minute: "2-digit",
                            hour12: false,
                          })}
                        </td>
                        <td className="py-2 font-medium text-gray-900">
                          {ev.staffName}
                        </td>
                        <td className="py-2 text-gray-500">{ev.role}</td>
                        <td className="py-2 pr-2">
                          <span
                            className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${
                              ev.type === "clock_in"
                                ? "bg-emerald-100 text-emerald-700"
                                : "bg-red-100 text-red-700"
                            }`}
                          >
                            {ev.type === "clock_in" ? "In" : "Out"}
                          </span>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
