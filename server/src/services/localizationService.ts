// server/src/services/localizationService.ts
import { eq } from 'drizzle-orm';
import { db } from '@/db/index.js';
import { poles } from '@/db/schema/poles.schema.js';
import { poleStates } from '@/db/schema/polesStates.schema.js';
import { findFrontiers, type PoleNode, type FrontierEdge } from './localization.js';
import { reconcileIncidentsForDt } from './incidentService.js';
import logger from '@/utils/logger.js';

/**
 * Pure read + compute, no side effects. Safe to call repeatedly (e.g. from
 * a debounce timer's recheck) without triggering another reconciliation
 * pass -- that's what recomputeFrontiersForDt below is for.
 */
export async function getCurrentFrontiers(dtId: string): Promise<FrontierEdge[]> {
  const rows = await db
    .select({
      id: poles.id,
      parentPoleId: poles.parentPoleId,
      deviceId: poles.deviceId,
      topologyConfidence: poles.topologyConfidence,
      currentState: poleStates.currentState,
      expectedNextHeartbeatAt: poleStates.expectedNextHeartbeatAt,
    })
    .from(poles)
    .leftJoin(poleStates, eq(poles.id, poleStates.poleId))
    .where(eq(poles.dtId, dtId));

  const now = Date.now();

  const nodes: PoleNode[] = rows.map((r) => {
    let state = r.currentState ?? 'unknown';
    // A pole read as 'live' whose heartbeat deadline has already passed is
    // not CONFIRMED live anymore -- it's just stale data waiting for the
    // separate heartbeat worker's next sweep (every 45s) to catch up. Treat
    // it as 'unknown' here so a real fault below it isn't masked by that
    // lag. This does not, and cannot, make detection instant for a child
    // whose heartbeat window hasn't expired yet -- that's bounded by the
    // 15-min heartbeat interval unless the device's own power_lost attempt
    // succeeds (see DECISIONS.md).
    if (
      state === 'live' &&
      r.expectedNextHeartbeatAt &&
      r.expectedNextHeartbeatAt.getTime() < now
    ) {
      state = 'unknown';
    }
    return {
      id: r.id,
      parentId: r.parentPoleId,
      state,
      hasDevice: r.deviceId !== null,
    };
  });

  const confidence = rows[0]?.topologyConfidence ?? 'known';
  return findFrontiers(nodes, confidence);
}

/** Called after every telemetry-driven state change for a DT. */
export async function recomputeFrontiersForDt(dtId: string) {
  const frontiers = await getCurrentFrontiers(dtId);

  if (frontiers.length > 0) {
    logger.info(`DT ${dtId}: ${frontiers.length} frontier edge(s) found`);
  }

  await reconcileIncidentsForDt(dtId, frontiers);
  return frontiers;
}