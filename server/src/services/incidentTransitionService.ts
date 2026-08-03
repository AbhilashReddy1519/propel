import { randomUUID } from 'crypto';
import { eq } from 'drizzle-orm';
import { db } from '@/db/index.js';
import { incidents } from '@/db/schema/incidents.schema.js';
import { incidentEvents } from '@/db/schema/incidentEvents.schema.js';
import { poles } from '@/db/schema/poles.schema.js';
import { poleStates } from '@/db/schema/polesStates.schema.js';
import { ConflictError, NotFoundError } from '@/exceptions/http.exception.js';
import type { TransitionPayload } from '@/modules/incidents/incident.validations.js';

// 'verified' is deliberately absent from every list here -- that transition
// is telemetry-only (see incidentService.verifyRecoveredIncidents), never
// reachable through this manual endpoint.
const ALLOWED_NEXT: Record<string, string[]> = {
  detected: ['acknowledged'],
  acknowledged: ['crew_assigned'],
  crew_assigned: ['resolved'],
  resolved: ['closed'],
  verified: ['closed'],
};

async function frontierPoleStillDark(
  dtId: string,
  frontierChildPoleId: string | null,
): Promise<boolean> {
  if (!frontierChildPoleId) return false;
  const [row] = await db
    .select({ currentState: poleStates.currentState })
    .from(poles)
    .leftJoin(poleStates, eq(poles.id, poleStates.poleId))
    .where(eq(poles.id, frontierChildPoleId))
    .limit(1);
  return row ? row.currentState !== 'live' : false;
}

export async function transitionIncident(incidentId: string, payload: TransitionPayload) {
  const [incident] = await db.select().from(incidents).where(eq(incidents.id, incidentId)).limit(1);
  if (!incident) throw new NotFoundError('Incident not found');

  const legalTargets = ALLOWED_NEXT[incident.status] ?? [];
  if (!legalTargets.includes(payload.status)) {
    throw new ConflictError(
      `Cannot move incident from '${incident.status}' to '${payload.status}'.`,
    );
  }

  // The hard rule: telemetry must confirm restoration before this ticket
  // can be marked resolved. A lineman's click alone is not enough.
  if (
    payload.status === 'resolved' &&
    (await frontierPoleStillDark(incident.dtId, incident.frontierChildPoleId))
  ) {
    throw new ConflictError(
      'Cannot mark resolved -- the affected pole is still reporting dark. Wait for telemetry to confirm restoration.',
    );
  }

  const updates: Record<string, unknown> = { status: payload.status };
  if (payload.status === 'resolved') updates.resolvedAt = new Date();
  if (payload.status === 'closed') updates.closedAt = new Date();

  await db.update(incidents).set(updates).where(eq(incidents.id, incidentId));
  await db.insert(incidentEvents).values({
    id: randomUUID(),
    incidentId,
    eventType: `manual_${payload.status}`,
    actor: payload.actor,
    note: payload.note ?? null,
  });

  return { ...incident, ...updates };
}
