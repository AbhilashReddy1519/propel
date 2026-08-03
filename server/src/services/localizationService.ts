// server/src/services/localizationService.ts
import { eq } from 'drizzle-orm';
import { db } from '@/db/index.js';
import { poles } from '@/db/schema/poles.schema.js';
import { poleStates } from '@/db/schema/polesStates.schema.js';
import { findFrontiers, type PoleNode } from './localization.js';
import logger from '@/utils/logger.js';

export async function recomputeFrontiersForDt(dtId: string) {
  const rows = await db
    .select({
      id: poles.id,
      parentPoleId: poles.parentPoleId,
      deviceId: poles.deviceId,
      topologyConfidence: poles.topologyConfidence,
      currentState: poleStates.currentState,
    })
    .from(poles)
    .leftJoin(poleStates, eq(poles.id, poleStates.poleId))
    .where(eq(poles.dtId, dtId));

  const nodes: PoleNode[] = rows.map((r) => ({
    id: r.id,
    parentId: r.parentPoleId,
    state: r.currentState ?? 'unknown',
    hasDevice: r.deviceId !== null,
  }));

  const confidence = rows[0]?.topologyConfidence ?? 'known';
  const frontiers = findFrontiers(nodes, confidence);

  // Phase 3 wires this into the incidents table (create/update tickets).
  // For now, log it -- this is enough to prove the pipeline end-to-end.
  if (frontiers.length > 0) {
    logger.info(`DT ${dtId}: ${frontiers.length} frontier edge(s) found`);
  }
  return frontiers;
}
