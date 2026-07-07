const API_BASE = import.meta.env.VITE_API_BASE ?? "/api";
const OUTLET_SLUG = import.meta.env.VITE_OUTLET_SLUG ?? "servaa-main";
async function post(path: string, body: unknown): Promise<boolean> {
  try {
    const response = await fetch(`${API_BASE}${path}`, { method: "POST", credentials: "include", headers: { "content-type": "application/json", "x-outlet-slug": OUTLET_SLUG }, body: JSON.stringify(body) });
    return response.ok;
  } catch { return false; }
}
export const verifyAdminPin = (pin: string) => post("/auth/pin", { role: "Admin", pin });
export const changeAdminPin = (currentPin: string, newPin: string) => post("/auth/pin/change", { currentPin, newPin });
