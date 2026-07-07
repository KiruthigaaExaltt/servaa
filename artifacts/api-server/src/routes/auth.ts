import { Router } from "express";
import { User } from "@workspace/db";
import { hashPin, readSession, signSession, verifyPin } from "../lib/security";
const router = Router();
const attempts = new Map<string, { count: number; lockedUntil: number }>();
router.post("/auth/pin", async (req, res, next): Promise<void> => {
  try {
    const attemptKey = `${req.ip}:${req.outletId}`;
    const attempt = attempts.get(attemptKey) ?? { count: 0, lockedUntil: 0 };
    if (attempt.lockedUntil > Date.now()) { res.status(429).json({ error: { code: "PIN_LOCKED", message: "Too many failed attempts. Try again later." } }); return; }
    const users = await User.find({ outletId: req.outletId, role: String(req.body?.role || "Admin"), active: true }).select("+pinHash name role");
    const user = users.find((candidate) => verifyPin(String(req.body?.pin || ""), candidate.pinHash));
    if (!user) {
      attempt.count += 1;
      if (attempt.count >= 5) { attempt.count = 0; attempt.lockedUntil = Date.now() + 60_000; }
      attempts.set(attemptKey, attempt);
      res.status(401).json({ error: { code: "INVALID_PIN", message: "Invalid role or PIN" } }); return;
    }
    attempts.delete(attemptKey);
    const token = signSession({ userId: String(user._id), outletId: String(req.outletId), role: user.role });
    res.cookie("servaa_session", token, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", maxAge: 43_200_000 });
    res.json({ user: { id: String(user._id), name: user.name, role: user.role } });
  } catch (error) { next(error); }
});
router.get("/auth/session", (req, res): void => {
  const session = readSession(req.cookies?.servaa_session);
  if (!session || session.outletId !== req.outletId) { res.status(401).json({ error: { code: "UNAUTHENTICATED", message: "No active session" } }); return; }
  res.json({ user: { id: session.userId, role: session.role } });
});
router.post("/auth/logout", (_req, res) => { res.clearCookie("servaa_session"); res.status(204).end(); });
router.post("/auth/pin/change", async (req, res, next): Promise<void> => {
  try {
    const currentPin = String(req.body?.currentPin || "");
    const newPin = String(req.body?.newPin || "");
    if (!/^\d{4,12}$/.test(newPin)) { res.status(400).json({ error: { code: "INVALID_PIN_FORMAT", message: "PIN must contain 4 to 12 digits" } }); return; }
    const users = await User.find({ outletId: req.outletId, role: "Admin", active: true }).select("+pinHash");
    const user = users.find((candidate) => verifyPin(currentPin, candidate.pinHash));
    if (!user) { res.status(401).json({ error: { code: "INVALID_PIN", message: "Current PIN is incorrect" } }); return; }
    user.pinHash = hashPin(newPin);
    await user.save();
    res.status(204).end();
  } catch (error) { next(error); }
});
export default router;
