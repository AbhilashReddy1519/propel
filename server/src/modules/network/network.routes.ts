import { Router } from 'express';
import { getDts, getPolesForDt } from './network.controller.js';

const router = Router();
router.get('/dts', getDts);
router.get('/dts/:dtId/poles', getPolesForDt);

export default router;
