import { Router } from 'express';
import { postInjectFault, postInjectNoise, postRepairIncident } from './simulator.controller.js';

const router = Router();

router.post('/inject-fault', postInjectFault);
router.post('/inject-noise', postInjectNoise);
router.post('/repair/:incidentId', postRepairIncident);

export default router;
