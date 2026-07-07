import type { NextFunction, Request, Response } from "express";
import { Outlet } from "@workspace/db";
declare global { namespace Express { interface Request { outletId?: string } } }
export async function resolveOutlet(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const slug = String(req.header("x-outlet-slug") || process.env.DEFAULT_OUTLET_SLUG || "servaa-main");
    const outlet = await Outlet.findOne({ slug }).select("_id").lean() as { _id: unknown } | null;
    if (!outlet) { res.status(404).json({ error: { code: "OUTLET_NOT_FOUND", message: `Unknown outlet: ${slug}` } }); return; }
    req.outletId = String(outlet._id);
    next();
  } catch (error) { next(error); }
}
