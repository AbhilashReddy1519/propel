import { Router } from "express";
import telemetryRouter from "@modules/telemetry/telemetry.routes.js";

const router = Router();

router.use("/telemetry", telemetryRouter);

export default router;