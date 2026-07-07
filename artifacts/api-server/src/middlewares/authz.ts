import type { NextFunction, Request, Response } from "express";
import { readSession } from "../lib/security";

declare global { namespace Express { interface Request { userId?: string; userRole?: string } } }

export function requireSession(req: Request, res: Response, next: NextFunction): void {
  try {
    const session = readSession(req.cookies?.servaa_session);
    if (!session || session.outletId !== req.outletId) {
      res.status(401).json({ error: { code: "UNAUTHENTICATED", message: "Authentication is required" } });
      return;
    }
    req.userId = session.userId;
    req.userRole = session.role;
    next();
  } catch (error) { next(error); }
}

export function requireRoles(...roles: string[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.userRole || !roles.includes(req.userRole)) {
      res.status(403).json({ error: { code: "FORBIDDEN", message: "Your role cannot perform this action" } });
      return;
    }
    next();
  };
}
