import { Router } from "express";
import telemetryRouter from "@modules/telemetry/telemetry.routes.js";
import incidentRouter from '@modules/incidents/incident.routes.js';

const router = Router();

router.use("/telemetry", telemetryRouter);
router.use('/incidents', incidentRouter);

export default router;