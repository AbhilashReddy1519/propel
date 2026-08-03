import { Request, Response, NextFunction } from 'express';
import { BadRequestError } from '@/exceptions/http.exception.js';
import { getScheduledOutages } from './scheduledOutages.service.js';

function parseDate(value: unknown, name: string) {
  if (typeof value !== 'string')
    throw new BadRequestError(`${name} is required and must be an ISO date string`);
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) throw new BadRequestError(`${name} is not a valid ISO date`);
  return parsed;
}

export async function getOutages(req: Request, res: Response, next: NextFunction) {
  try {
    const from = req.query.from
      ? parseDate(req.query.from, 'from')
      : new Date(Date.now() - 24 * 60 * 60 * 1000);
    const to = req.query.to ? parseDate(req.query.to, 'to') : new Date();
    const outages = await getScheduledOutages(from, to);
    res.json({ success: true, outages });
  } catch (err) {
    next(err);
  }
}
