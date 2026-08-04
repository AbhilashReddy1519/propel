import { randomUUID } from 'crypto';
import { eq } from 'drizzle-orm';
import { db } from '@/db/index.js';
import { incidents } from '@/db/schema/incidents.schema.js';
import { incidentEvents } from '@/db/schema/incidentEvents.schema.js';
import { ConflictError, NotFoundError } from '@/exceptions/http.exception.js';
import type { TransitionPayload } from '@/modules/incidents/incident.validations.js';

// 'verified' is deliberately absent from every list here -- that transition
// is telemetry-only (see incidentService.verifyRecoveredIncidents).
//
// 'resolved' has NO manual next step. This is intentional, not an
// oversight: 'resolved' represents the crew's honest, unconfirmed report
// ("I believe I fixed it") and must be reachable regardless of what
// telemetry currently says -- that's the whole point of having a separate
// pending state. Only telemetry confirming restoration can advance a
// ticket past 'resolved' to 'verified'; a manual resolved->closed path
// would let an operator close a ticket that was never actually confirmed
// fixed, which is exactly what "never closed by a button alone" rules out.
const ALLOWED_NEXT: Record<string, string[]> = {
  detected: ['acknowledged'],
  acknowledged: ['crew_assigned'],
  crew_assigned: ['resolved'],
  resolved: [],
  verified: ['closed'],
};

export async function transitionIncident(incidentId: string, payload: TransitionPayload) {
  const [incident] = await db.select().from(incidents).where(eq(incidents.id, incidentId)).limit(1);
  if (!incident) throw new NotFoundError('Incident not found');

  const legalTargets = ALLOWED_NEXT[incident.status] ?? [];
  if (!legalTargets.includes(payload.status)) {
    throw new ConflictError(
      `Cannot move incident from '${incident.status}' to '${payload.status}'.`,
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
