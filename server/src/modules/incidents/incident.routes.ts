import { Router } from 'express';
import {
  listIncidents,
  getIncident,
  postTransition,
  postForceClose,
} from './incident.controller.js';

const router = Router();
router.get('/', listIncidents);
router.get('/:id', getIncident);
router.post('/:id/transition', postTransition);
router.post('/:id/force-close', postForceClose);

export default router;
