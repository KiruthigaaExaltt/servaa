import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import collectionsRouter from "./collections";
import reportsRouter from "./reports";
import operationsRouter from "./operations";
import workflowsRouter from "./workflows";
import { resolveOutlet } from "../middlewares/tenant";
import { requireSession } from "../middlewares/authz";

const router: IRouter = Router();

router.use(healthRouter);
router.use(resolveOutlet);
router.use(authRouter);
router.use(requireSession);
router.use(collectionsRouter);
router.use(reportsRouter);
router.use(operationsRouter);
router.use(workflowsRouter);

export default router;
