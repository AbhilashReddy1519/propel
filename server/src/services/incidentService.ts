// server/src/services/incidentService.ts
import { randomUUID } from 'crypto';
import { and, eq, inArray } from 'drizzle-orm';
import { db } from '@/db/index.js';
import { incidents } from '@/db/schema/incidents.schema.js';
import { incidentEvents } from '@/db/schema/incidentEvents.schema.js';
import { poles } from '@/db/schema/poles.schema.js';
import { transformers } from '@/db/schema/transformers.schema.js';
import { scheduledOutages } from '@/db/schema/scheduledOutages.schema.js';
import type { FrontierEdge } from './localization.js';
import { getCurrentFrontiers } from './localizationService.js';
import logger from '@/utils/logger.js';

const DEBOUNCE_MS = 45_000; // spec's stated 30-60s window, midpoint
const OPEN_STATUSES = ['detected', 'acknowledged', 'crew_assigned', 'resolved'] as const;

// edgeKey -> timer handle. The timer itself IS the debounce clock: it
// fires exactly once, DEBOUNCE_MS after first sighting, and re-derives the
// frontier list fresh at fire time rather than trusting a snapshot from
// when it started. This is self-driving -- it does NOT depend on
// recomputeFrontiersForDt happening to be called again by some unrelated
// telemetry event within the window. (An earlier version of this file did
// depend on that, which meant a fault in an otherwise-quiet DT could sit
// in "pending" forever and never actually get ticketed -- confirmed by
// simulation, not just suspected.)
const pendingTimers = new Map<string, NodeJS.Timeout>();

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
  // Re-check for an existing open incident right before writing -- closes
  // a narrow race where two debounce timers for the same edge could both
  // reach here (shouldn't happen given the pendingTimers.has() guard below,
  // but cheap insurance against a duplicate row on a self-referencing edge).
  const already = await findOpenIncident(dtId, frontier.childPoleId);
  if (already) return;

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

function scheduleDebouncedCreate(dtId: string, frontier: FrontierEdge) {
  const key = edgeKey(dtId, frontier.childPoleId);
  if (pendingTimers.has(key)) return; // already debouncing this exact edge

  const timer = setTimeout(async () => {
    pendingTimers.delete(key);
    try {
      const stillOpen = await findOpenIncident(dtId, frontier.childPoleId);
      if (stillOpen) return;

      // Re-derive freshly -- don't trust the frontier object captured
      // DEBOUNCE_MS ago. If it flickered and resolved itself in the
      // meantime, it correctly never gets ticketed.
      const fresh = await getCurrentFrontiers(dtId);
      const stillPresent = fresh.find((f) => f.childPoleId === frontier.childPoleId);
      if (stillPresent) {
        await createIncident(dtId, stillPresent);
      }
    } catch (err) {
      logger.error(`Debounced incident check failed for ${key}: ${err}`);
    }
  }, DEBOUNCE_MS);

  pendingTimers.set(key, timer);
}

function cancelPending(dtId: string, childPoleId: string) {
  const key = edgeKey(dtId, childPoleId);
  const timer = pendingTimers.get(key);
  if (timer) {
    clearTimeout(timer);
    pendingTimers.delete(key);
  }
}

/**
 * Any open incident whose frontier edge no longer appears in the current
 * frontier list has had its poles come back live -- telemetry proved the
 * fix, not a button click.
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
  const currentChildIds = new Set(frontiers.map((f) => f.childPoleId));

  // Cancel debounce timers for edges that vanished before firing -- a
  // flicker, not a real fault, shouldn't leave a stale timer running.
  for (const key of [...pendingTimers.keys()]) {
    const [keyDt, keyChild] = key.split(':');
    if (keyDt === dtId && !currentChildIds.has(keyChild!)) cancelPending(dtId, keyChild!);
  }

  for (const frontier of frontiers) {
    const existingIncident = await findOpenIncident(dtId, frontier.childPoleId);
    if (existingIncident) continue; // already ticketed, nothing to do
    scheduleDebouncedCreate(dtId, frontier);
  }

  await verifyRecoveredIncidents(dtId, currentChildIds);
}
