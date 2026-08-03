import { randomUUID } from 'crypto';
import { and, eq, inArray } from 'drizzle-orm';
import { db } from '@/db/index.js';
import { incidents } from '@/db/schema/incidents.schema.js';
import { incidentEvents } from '@/db/schema/incidentEvents.schema.js';
import { poles } from '@/db/schema/poles.schema.js';
import { transformers } from '@/db/schema/transformers.schema.js';
import { scheduledOutages } from '@/db/schema/scheduledOutages.schema.js';
import type { FrontierEdge } from './localization.js';
import logger from '@/utils/logger.js';

const DEBOUNCE_MS = 45_000; // spec's stated 30-60s window, midpoint
const OPEN_STATUSES = ['detected', 'acknowledged', 'crew_assigned', 'resolved'] as const;

// In-process debounce tracker. Single-instance deployment matches the rest
// of the stack's "no external queue" simplicity -- a server restart mid-
// debounce just costs one extra detection cycle, not correctness.
const pendingFrontiers = new Map<string, number>(); // "dtId:childPoleId" -> firstSeenAt (ms)

function edgeKey(dtId: string, childPoleId: string) {
  return `${dtId}:${childPoleId}`;
}

async function isWithinScheduledOutage(dtId: string): Promise<boolean> {
  const [dt] = await db
    .select({ feederId: transformers.feederId })
    .from(transformers)
    .where(eq(transformers.id, dtId))
    .limit(1);
  if (!dt) return false;

  const OVERRUN_GRACE_MS = 40 * 60 * 1000; // spec: shutdowns overrun by 20-40 min

  const windows = await db
    .select()
    .from(scheduledOutages)
    .where(inArray(scheduledOutages.targetId, [dtId, dt.feederId]));

  const now = Date.now();
  // Grace applies to the END only -- a shutdown that hasn't started yet
  // shouldn't suppress an unrelated fault happening early.
  return windows.some((w) => now >= w.start.getTime() && now <= w.end.getTime() + OVERRUN_GRACE_MS);
}

async function findOpenIncident(dtId: string, childPoleId: string) {
  const [existing] = await db
    .select()
    .from(incidents)
    .where(
      and(
        eq(incidents.dtId, dtId),
        eq(incidents.frontierChildPoleId, childPoleId),
        inArray(incidents.status, [...OPEN_STATUSES]),
      ),
    )
    .limit(1);
  return existing ?? null;
}

async function createIncident(dtId: string, frontier: FrontierEdge) {
  const [childPole] = await db
    .select({ lat: poles.lat, lon: poles.lon, pincode: poles.pincode })
    .from(poles)
    .where(eq(poles.id, frontier.childPoleId))
    .limit(1);

  const suppressed = await isWithinScheduledOutage(dtId);
  const id = randomUUID();

  await db.insert(incidents).values({
    id,
    dtId,
    frontierParentPoleId: frontier.parentPoleId,
    frontierChildPoleId: frontier.childPoleId,
    status: 'detected',
    confidence: frontier.confidenceHint,
    affectedPoleCount: frontier.affectedPoleIds.length,
    lat: childPole?.lat ?? 0,
    lon: childPole?.lon ?? 0,
    pincode: childPole?.pincode ?? null,
    reasoning: frontier.reasoning,
    suppressedBySchedule: suppressed,
  });

  await db.insert(incidentEvents).values({
    id: randomUUID(),
    incidentId: id,
    eventType: suppressed ? 'created_suppressed' : 'created',
    actor: 'system',
    note: suppressed
      ? 'Overlaps a scheduled outage window -- muted, not deleted (feed is wrong ~1 in 10 times, never trust it fully).'
      : frontier.reasoning,
  });

  logger.info(
    `Incident created: ${id} (dt=${dtId}, child=${frontier.childPoleId}, suppressed=${suppressed})`,
  );
}

/**
 * Any open incident whose frontier edge no longer appears in the current
 * frontier list has had its poles come back live -- telemetry proved the
 * fix, not a button click. Moves straight to 'verified' regardless of
 * where it was in the manual pipeline (detected/acknowledged/crew_assigned/
 * resolved) -- if the crew fixed it without ever clicking "resolved," the
 * system should still catch that rather than leave a stale open ticket.
 */
async function verifyRecoveredIncidents(dtId: string, currentFrontierChildIds: Set<string>) {
  const openInDt = await db
    .select()
    .from(incidents)
    .where(and(eq(incidents.dtId, dtId), inArray(incidents.status, [...OPEN_STATUSES])));

  for (const incident of openInDt) {
    if (!currentFrontierChildIds.has(incident.frontierChildPoleId ?? '')) {
      await db
        .update(incidents)
        .set({ status: 'verified', verifiedAt: new Date() })
        .where(eq(incidents.id, incident.id));

      await db.insert(incidentEvents).values({
        id: randomUUID(),
        incidentId: incident.id,
        eventType: 'auto_verified',
        actor: 'system',
        note: 'Affected pole reported live again -- telemetry-confirmed restoration.',
      });

      logger.info(`Incident auto-verified: ${incident.id}`);
    }
  }
}

/** Called after every findFrontiers() run for a DT. */
export async function reconcileIncidentsForDt(dtId: string, frontiers: FrontierEdge[]) {
  const now = Date.now();
  const currentChildIds = new Set(frontiers.map((f) => f.childPoleId));

  // Clear debounce timers for frontiers that vanished before their timer
  // elapsed -- a flicker, not a real fault, shouldn't leave stale state.
  for (const key of [...pendingFrontiers.keys()]) {
    const [keyDt, keyChild] = key.split(':');
    if (keyDt === dtId && !currentChildIds.has(keyChild!)) pendingFrontiers.delete(key);
  }

  for (const frontier of frontiers) {
    const existingIncident = await findOpenIncident(dtId, frontier.childPoleId);
    if (existingIncident) continue; // already ticketed

    const key = edgeKey(dtId, frontier.childPoleId);
    const firstSeenAt = pendingFrontiers.get(key);

    if (firstSeenAt === undefined) {
      pendingFrontiers.set(key, now); // first sighting -- start the clock, don't ticket yet
      continue;
    }
    if (now - firstSeenAt >= DEBOUNCE_MS) {
      await createIncident(dtId, frontier);
      pendingFrontiers.delete(key);
    }
  }

  await verifyRecoveredIncidents(dtId, currentChildIds);
}
