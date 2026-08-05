import { randomUUID } from 'crypto';
import { eq } from 'drizzle-orm';
import { db } from '@/db/index.js';
import { incidents } from '@/db/schema/incidents.schema.js';
import { incidentEvents } from '@/db/schema/incidentEvents.schema.js';
import { poles } from '@/db/schema/poles.schema.js';
import { BadRequestError, ConflictError, NotFoundError } from '@/exceptions/http.exception.js';
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
//
// The one narrow exception is forceCloseIncident() below, for incidents
// where telemetry confirmation is not just unconfirmed but structurally
// impossible (no device anywhere in the affected subtree).
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

/**
 * Administrative override for incidents that can never be telemetry-
 * confirmed: a "range" confidence incident whose ENTIRE affected subtree
 * has no device anywhere in it. Without this, such a ticket is stuck in
 * 'resolved' permanently -- verifyRecoveredIncidents has nothing to check.
 *
 * The precondition (no device in the subtree) is re-verified here against
 * the database, never trusted from the request -- a client claiming "no
 * device" is not sufficient grounds to skip telemetry confirmation on an
 * incident that actually has one.
 */
export async function forceCloseIncident(incidentId: string, payload: TransitionPayload) {
  if (!payload.note || payload.note.trim().length === 0) {
    throw new BadRequestError('A note is required to force-close an incident (audit trail).');
  }

  const [incident] = await db.select().from(incidents).where(eq(incidents.id, incidentId)).limit(1);
  if (!incident) throw new NotFoundError('Incident not found');

  if (!['detected', 'acknowledged', 'crew_assigned', 'resolved'].includes(incident.status)) {
    throw new ConflictError(`Cannot force-close an incident with status '${incident.status}'.`);
  }

  if (incident.confidence !== 'range') {
    throw new ConflictError(
      'force-close is only available for "range" confidence incidents (no-device boundary).',
    );
  }

  // Re-derive the affected subtree from the DB, don't trust the client.
  const dtPoles = await db
    .select({ id: poles.id, parentPoleId: poles.parentPoleId, deviceId: poles.deviceId })
    .from(poles)
    .where(eq(poles.dtId, incident.dtId));

  const childrenOf = new Map<string, string[]>();
  for (const p of dtPoles) {
    if (!childrenOf.has(p.id)) childrenOf.set(p.id, []);
    if (p.parentPoleId) {
      if (!childrenOf.has(p.parentPoleId)) childrenOf.set(p.parentPoleId, []);
      childrenOf.get(p.parentPoleId)!.push(p.id);
    }
  }
  const subtree = new Set<string>();
  const stack = incident.frontierChildPoleId ? [incident.frontierChildPoleId] : [];
  while (stack.length) {
    const cur = stack.pop()!;
    subtree.add(cur);
    stack.push(...(childrenOf.get(cur) ?? []));
  }
  const byId = new Map(dtPoles.map((p) => [p.id, p]));
  const hasAnyDevice = [...subtree].some((id) => byId.get(id)?.deviceId);

  if (hasAnyDevice) {
    throw new ConflictError(
      "This incident's affected subtree has at least one device-equipped pole -- " +
        'telemetry confirmation is possible, use the normal resolved/verified flow instead.',
    );
  }

  const now = new Date();
  await db
    .update(incidents)
    .set({ status: 'closed', closedAt: now })
    .where(eq(incidents.id, incidentId));
  await db.insert(incidentEvents).values({
    id: randomUUID(),
    incidentId,
    eventType: 'force_closed_no_device',
    actor: payload.actor,
    note: payload.note,
  });

  return { ...incident, status: 'closed' as const, closedAt: now };
}
