import { Router } from 'express';
import telemetryRouter from '@modules/telemetry/telemetry.routes.js';
import incidentRouter from '@modules/incidents/incident.routes.js';
import simulatorRouter from '@modules/sim/simulator.routes.js';
import scheduledOutagesRouter from '@modules/scheduledOutages/scheduledOutages.routes.js';
import networkRouter from '@modules/network/network.routes.js';

const router = Router();

router.use('/telemetry', telemetryRouter);
router.use('/incidents', incidentRouter);
router.use('/sim', simulatorRouter);
router.use('/scheduled-outages', scheduledOutagesRouter);
router.use('/network', networkRouter);

export default router;
