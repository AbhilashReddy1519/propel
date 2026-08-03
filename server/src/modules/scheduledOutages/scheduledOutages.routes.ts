import { Router } from 'express';
import { getOutages } from './scheduledOutages.controller.js';

const router = Router();

router.get('/', getOutages);

export default router;
