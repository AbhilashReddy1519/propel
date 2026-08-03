import { Router } from 'express';
import { listIncidents, getIncident, postTransition } from './incident.controller.js';

const router = Router();
router.get('/', listIncidents);
router.get('/:id', getIncident);
router.post('/:id/transition', postTransition);

export default router;
