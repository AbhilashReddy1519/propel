import { Request, Response, NextFunction } from 'express';
import { BadRequestError } from '@/exceptions/http.exception.js';
import {
  injectFaultSchema,
  injectNoiseSchema,
  repairIncidentSchema,
} from './simulator.validations.js';
import { injectFault, injectNoise, repairIncident } from './simulator.service.js';

export async function postInjectFault(req: Request, res: Response, next: NextFunction) {
  try {
    const parsed = injectFaultSchema.safeParse(req.body);
    if (!parsed.success)
      throw new BadRequestError(parsed.error.issues.map((i) => i.message).join(', '));
    const result = await injectFault(parsed.data);
    res.json({ success: true, ...result });
  } catch (err) {
    next(err);
  }
}

export async function postInjectNoise(req: Request, res: Response, next: NextFunction) {
  try {
    const parsed = injectNoiseSchema.safeParse(req.body);
    if (!parsed.success)
      throw new BadRequestError(parsed.error.issues.map((i) => i.message).join(', '));
    const result = await injectNoise(parsed.data);
    res.json({ success: true, ...result });
  } catch (err) {
    next(err);
  }
}

export async function postRepairIncident(req: Request, res: Response, next: NextFunction) {
  try {
    const parsed = repairIncidentSchema.safeParse(req.body);
    if (!parsed.success)
      throw new BadRequestError(parsed.error.issues.map((i) => i.message).join(', '));
    const incidentId = Array.isArray(req.params.incidentId)
      ? req.params.incidentId[0]
      : req.params.incidentId;
    if (!incidentId) throw new BadRequestError('incidentId is required');
    const result = await repairIncident(incidentId, parsed.data);
    res.json({ success: true, ...result });
  } catch (err) {
    next(err);
  }
}
