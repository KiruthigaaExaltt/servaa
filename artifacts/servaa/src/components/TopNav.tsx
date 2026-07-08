import { useCallback, useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Bell, Search, ChevronDown, Check, ChevronLeft, ChevronRight } from "lucide-react";
import { MODULES, type ModuleId } from "@/lib/modules";
import { useRole, ROLE_BADGE, type UserRole } from "@/context/RoleContext";

const ALL_ROLES: UserRole[] = ["Admin", "Manager", "Cashier", "Server", "Kitchen"];
const NAV_SCROLL_EDGE_TOLERANCE = 2;

interface TopNavProps {
  active: ModuleId;
  onChange: (id: ModuleId) => void;
}

export function TopNav({ active, onChange }: TopNavProps) {
  const { role, requestRoleChange, allowedModules } = useRole();
  const scrollerRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const [roleOpen, setRoleOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [navScrollState, setNavScrollState] = useState({
    hasOverflow: false,
    canScrollLeft: false,
    canScrollRight: false,
  });

  const visibleModules = MODULES.filter((m) => allowedModules.includes(m.id));

  const updateNavScrollState = useCallback(() => {
    const container = scrollerRef.current;
    if (!container) return;

    const hasOverflow =
      container.scrollWidth - container.clientWidth > NAV_SCROLL_EDGE_TOLERANCE;
    const canScrollLeft = container.scrollLeft > NAV_SCROLL_EDGE_TOLERANCE;
    const canScrollRight =
      container.scrollLeft + container.clientWidth <
      container.scrollWidth - NAV_SCROLL_EDGE_TOLERANCE;

    setNavScrollState((previous) => {
      if (
        previous.hasOverflow === hasOverflow &&
        previous.canScrollLeft === canScrollLeft &&
        previous.canScrollRight === canScrollRight
      ) {
        return previous;
      }

      return { hasOverflow, canScrollLeft, canScrollRight };
    });
  }, []);

  const scrollNav = useCallback((direction: -1 | 1) => {
    const container = scrollerRef.current;
    if (!container) return;

    container.scrollBy({
      left: direction * Math.max(container.clientWidth * 0.75, 180),
      behavior: "smooth",
    });
  }, []);

  useEffect(() => {
    const el = itemRefs.current[active];
    if (el && scrollerRef.current) {
      const container = scrollerRef.current;
      const elLeft = el.offsetLeft;
      const elRight = elLeft + el.offsetWidth;
      const viewLeft = container.scrollLeft;
      const viewRight = viewLeft + container.clientWidth;
      if (elLeft < viewLeft || elRight > viewRight) {
        container.scrollTo({
          left: elLeft - container.clientWidth / 2 + el.offsetWidth / 2,
          behavior: "smooth",
        });
      }
    }
  }, [active]);

  useEffect(() => {
    const container = scrollerRef.current;
    if (!container) return undefined;

    updateNavScrollState();

    container.addEventListener("scroll", updateNavScrollState, { passive: true });
    window.addEventListener("resize", updateNavScrollState);

    const resizeObserver =
      typeof ResizeObserver !== "undefined"
        ? new ResizeObserver(updateNavScrollState)
        : null;
    resizeObserver?.observe(container);

    return () => {
      container.removeEventListener("scroll", updateNavScrollState);
      window.removeEventListener("resize", updateNavScrollState);
      resizeObserver?.disconnect();
    };
  }, [updateNavScrollState, visibleModules.length]);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setRoleOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  return (
    <header className="sticky top-0 z-40 w-full border-b border-border bg-white">
      <div className="flex h-16 items-center gap-4 px-4 sm:px-6">
        {/* Logo */}
        <button
          type="button"
          onClick={() => onChange("dashboard")}
          className="shrink-0 select-none text-2xl font-extrabold tracking-tight"
          style={{ color: "var(--primary-orange)" }}
          aria-label="Servaa home"
        >
          Servaa
        </button>

        {/* Center nav */}
        <nav className="relative min-w-0 flex-1" aria-label="Primary modules">
          <div className="flex min-w-0 items-stretch gap-1">
            {navScrollState.hasOverflow && (
              navScrollState.canScrollLeft ? (
                <NavScrollButton
                  direction="left"
                  label="Scroll navigation left"
                  onClick={() => scrollNav(-1)}
                />
              ) : (
                <span className="h-12 w-8 shrink-0" aria-hidden="true" />
              )
            )}

            <div className="relative min-w-0 flex-1">
              <div
                ref={scrollerRef}
                className="no-scrollbar flex items-stretch gap-1 overflow-x-auto scroll-smooth"
                role="tablist"
                aria-label="Modules"
              >
                {visibleModules.map((m) => {
                  const isActive = m.id === active;
                  return (
                    <button
                      key={m.id}
                      ref={(el) => {
                        itemRefs.current[m.id] = el;
                      }}
                      role="tab"
                      aria-selected={isActive}
                      onClick={() => onChange(m.id)}
                      className={`relative shrink-0 whitespace-nowrap px-3 py-4 text-sm font-medium transition-colors ${
                        isActive
                          ? "text-[color:var(--primary-orange)]"
                          : "text-gray-600 hover:text-gray-900"
                      }`}
                    >
                      {m.label}
                      {isActive && (
                        <motion.span
                          layoutId="active-tab-underline"
                          className="absolute inset-x-2 bottom-0 h-[3px] rounded-t"
                          style={{ backgroundColor: "var(--primary-orange)" }}
                          transition={{ type: "spring", stiffness: 400, damping: 32 }}
                        />
                      )}
                    </button>
                  );
                })}
              </div>
              <div className="pointer-events-none absolute inset-y-0 left-0 w-6 bg-gradient-to-r from-white to-transparent" />
              <div className="pointer-events-none absolute inset-y-0 right-0 w-6 bg-gradient-to-l from-white to-transparent" />
            </div>

            {navScrollState.hasOverflow && (
              navScrollState.canScrollRight ? (
                <NavScrollButton
                  direction="right"
                  label="Scroll navigation right"
                  onClick={() => scrollNav(1)}
                />
              ) : (
                <span className="h-12 w-8 shrink-0" aria-hidden="true" />
              )
            )}
          </div>
        </nav>

        {/* Right icons */}
        <div className="flex shrink-0 items-center gap-2">
          <IconButton label="Search">
            <Search className="h-5 w-5" />
          </IconButton>
          <IconButton label="Notifications">
            <Bell className="h-5 w-5" />
            <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-red-500 ring-2 ring-white" />
          </IconButton>

          {/* Role switcher — PIN required for Cashier / Manager / Admin */}
          <div className="relative" ref={dropdownRef}>
            <button
              type="button"
              onClick={() => setRoleOpen((v) => !v)}
              className={`ml-1 flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold ring-1 transition hover:brightness-95 ${ROLE_BADGE[role]}`}
            >
              {role}
              <ChevronDown className="h-3 w-3 opacity-60" />
            </button>

            <AnimatePresence>
              {roleOpen && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.95, y: -4 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95, y: -4 }}
                  transition={{ duration: 0.12 }}
                  className="absolute right-0 top-full mt-1 w-52 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-xl"
                >
                  <div className="px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-gray-400">
                    Switch Role
                  </div>
                  {ALL_ROLES.map((r) => {
                    const needsPin = ["Admin", "Manager", "Cashier"].includes(r) && r !== role;
                    return (
                      <button
                        key={r}
                        type="button"
                        onClick={() => {
                          requestRoleChange(r);
                          setRoleOpen(false);
                        }}
                        className="flex w-full items-center justify-between px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                      >
                        <span className={`rounded-full px-2 py-0.5 text-xs font-bold ring-1 ${ROLE_BADGE[r]}`}>
                          {r}
                        </span>
                        <span className="flex items-center gap-1">
                          {r === role && <Check className="h-3.5 w-3.5 text-orange-500" />}
                          {needsPin && r !== role && (
                            <span className="text-[10px] text-gray-400">🔒 PIN</span>
                          )}
                        </span>
                      </button>
                    );
                  })}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </header>
  );
}

function NavScrollButton({
  direction,
  label,
  onClick,
}: {
  direction: "left" | "right";
  label: string;
  onClick: () => void;
}) {
  const Icon = direction === "left" ? ChevronLeft : ChevronRight;

  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className="my-auto flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-gray-500 transition hover:bg-gray-100 hover:text-gray-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-300"
    >
      <Icon className="h-4 w-4" />
    </button>
  );
}

function IconButton({
  children,
  label,
}: {
  children: React.ReactNode;
  label: string;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      className="relative flex h-9 w-9 items-center justify-center rounded-full text-gray-600 hover:bg-gray-100 hover:text-gray-900"
    >
      {children}
    </button>
  );
}
