import { Router, type IRouter } from "express";
import { HealthCheckResponse } from "@workspace/api-zod";
import { mongoose } from "@workspace/db";

const router: IRouter = Router();

router.get("/healthz", (_req, res) => {
  const connected = mongoose.connection.readyState === 1;
  const data = HealthCheckResponse.parse({ status: connected ? "ok" : "degraded" });
  res.status(connected ? 200 : 503).json({ ...data, database: connected ? "connected" : "disconnected" });
});

export default router;
