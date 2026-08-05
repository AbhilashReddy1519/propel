import { Request, Response, NextFunction } from 'express';
import { eq, inArray } from 'drizzle-orm';
import { db } from '@/db/index.js';
import { incidents } from '@/db/schema/incidents.schema.js';
import { transitionSchema, forceCloseSchema } from './incident.validations.js';
import { transitionIncident, forceCloseIncident } from '@/services/incidentTransitionService.js';
import { BadRequestError, NotFoundError } from '@/exceptions/http.exception.js';

export async function listIncidents(req: Request, res: Response, next: NextFunction) {
  try {
    const openOnly = req.query.open === 'true';
    const rows = openOnly
      ? await db
          .select()
          .from(incidents)
          .where(
            inArray(incidents.status, ['detected', 'acknowledged', 'crew_assigned', 'resolved']),
          )
      : await db.select().from(incidents);
    res.json(rows);
  } catch (err) {
    next(err);
  }
}

export async function getIncident(req: Request, res: Response, next: NextFunction) {
  try {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    if (!id) throw new BadRequestError('Incident ID is required');
    const [row] = await db.select().from(incidents).where(eq(incidents.id, id)).limit(1);
    if (!row) throw new NotFoundError('Incident not found');
    res.json(row);
  } catch (err) {
    next(err);
  }
}

export async function postTransition(req: Request, res: Response, next: NextFunction) {
  try {
    const parsed = transitionSchema.safeParse(req.body);
    if (!parsed.success)
      throw new BadRequestError(parsed.error.issues.map((i) => i.message).join(', '));
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    if (!id) throw new BadRequestError('Incident ID is required');
    const updated = await transitionIncident(id, parsed.data);
    res.json(updated);
  } catch (err) {
    next(err);
  }
}

export async function postForceClose(req: Request, res: Response, next: NextFunction) {
  try {
    const parsed = forceCloseSchema.safeParse(req.body);
    if (!parsed.success)
      throw new BadRequestError(parsed.error.issues.map((i) => i.message).join(', '));
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    if (!id) throw new BadRequestError('Incident ID is required');
    const updated = await forceCloseIncident(id, { ...parsed.data, status: 'closed' });
    res.json(updated);
  } catch (err) {
    next(err);
  }
}
