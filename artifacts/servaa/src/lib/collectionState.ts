import { useEffect, useRef, useState } from "react";

const API_BASE = import.meta.env.VITE_API_BASE ?? "/api";
const OUTLET_SLUG = import.meta.env.VITE_OUTLET_SLUG ?? "servaa-main";

export async function persistCollection<T>(key: string, value: T, revision?: number): Promise<number | undefined> {
  return fetch(`${API_BASE}/collections/${encodeURIComponent(key)}`, {
    method: "PUT",
    credentials: "include",
    headers: { "content-type": "application/json", "x-outlet-slug": OUTLET_SLUG, ...(revision !== undefined ? { "if-match": String(revision) } : {}) },
    body: JSON.stringify({ value }),
  }).then(async (response) => response.status === 409 ? -1 : response.ok ? (await response.json() as { revision: number }).revision : undefined).catch(() => undefined);
}

export function initialCollection<T>(key: string, fallback: T): T {
  void key;
  return fallback;
}

export function useCollectionState<T>(
  key: string,
  initial: T,
): [T, React.Dispatch<React.SetStateAction<T>>] {
  const [value, setValue] = useState<T>(() => initialCollection(key, initial));
  const hydrated = useRef(false);
  const revision = useRef<number | undefined>(undefined);
  const saveQueue = useRef(Promise.resolve());

  useEffect(() => {
    let active = true;
    let found = false;
    fetch(`${API_BASE}/collections/${encodeURIComponent(key)}`, {
      credentials: "include",
      headers: { "x-outlet-slug": OUTLET_SLUG },
    })
      .then(async (response) => response.ok ? response.json() as Promise<{ value: T; revision: number }> : undefined)
      .then((data) => {
        if (active && data && data.value !== undefined) {
          found = true;
          revision.current = data.revision;
          setValue(data.value);
        }
      })
      .catch(() => undefined)
      .finally(() => {
        hydrated.current = true;
        if (active && !found) void persistCollection(key, initial, 0).then((next) => { if (next !== undefined) revision.current = next; });
      });
    return () => { active = false; };
  }, [key]);

  useEffect(() => {
    const refresh = (event: Event) => {
      if ((event as CustomEvent<{ resource: string }>).detail?.resource !== key) return;
      void fetch(`${API_BASE}/collections/${encodeURIComponent(key)}`, { credentials: "include", headers: { "x-outlet-slug": OUTLET_SLUG } }).then(async (response) => {
        if (!response.ok) return;
        const latest = await response.json() as { value: T; revision: number };
        if (latest.value === undefined) return;
        revision.current = latest.revision;
        setValue(latest.value);
      });
    };
    window.addEventListener("servaa:resource-changed", refresh);
    return () => window.removeEventListener("servaa:resource-changed", refresh);
  }, [key]);

  useEffect(() => {
    if (!hydrated.current) return;
    saveQueue.current = saveQueue.current.then(async () => {
      const next = await persistCollection(key, value, revision.current);
      if (next === -1) {
        const response = await fetch(`${API_BASE}/collections/${encodeURIComponent(key)}`, { credentials: "include", headers: { "x-outlet-slug": OUTLET_SLUG } });
        if (response.ok) {
          const latest = await response.json() as { value: T; revision: number };
          revision.current = latest.revision;
          setValue(latest.value);
          window.dispatchEvent(new CustomEvent("servaa:revision-conflict", { detail: { resource: key } }));
        }
      } else if (next !== undefined) revision.current = next;
    });
  }, [key, value]);

  return [value, setValue];
}
