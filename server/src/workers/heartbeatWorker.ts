// server/src/workers/heartbeatWorker.ts
import { and, eq, lt, ne } from 'drizzle-orm';
import { db } from '@/db/index.js';
import { poles } from '@/db/schema/poles.schema.js';
import { poleStates } from '@/db/schema/polesStates.schema.js';
import { recomputeFrontiersForDt } from '@/services/localizationService.js';
import logger from '@/utils/logger.js';

export async function checkHeartbeatTimeouts() {
  const now = new Date();

  // Poles whose next-expected-heartbeat deadline has already passed, and
  // that aren't ALREADY marked dark (no point re-marking / re-triggering).
  const overdue = await db
    .select({ poleId: poleStates.poleId, dtId: poles.dtId })
    .from(poleStates)
    .innerJoin(poles, eq(poles.id, poleStates.poleId))
    .where(and(lt(poleStates.expectedNextHeartbeatAt, now), ne(poleStates.currentState, 'dark')));

  if (overdue.length === 0) return;

  const affectedDts = new Set<string>();
  for (const row of overdue) {
    await db
      .update(poleStates)
      .set({ currentState: 'dark', updatedAt: now })
      .where(eq(poleStates.poleId, row.poleId));
    affectedDts.add(row.dtId);
  }

  logger.info(
    `Heartbeat timeout: marked ${overdue.length} pole(s) dark across ${affectedDts.size} DT(s)`,
  );

  // One re-walk per affected DT, not one per pole -- if 40 poles under the
  // same DT all timed out together, that's one tree walk, not 40.
  for (const dtId of affectedDts) {
    await recomputeFrontiersForDt(dtId);
  }
}

export function startHeartbeatWorker() {
  setInterval(() => {
    checkHeartbeatTimeouts().catch((err) => logger.error(`Heartbeat worker error: ${err}`));
  }, 45000); // 45s -- inside the 30-60s range from the plan
  logger.info('Heartbeat timeout worker started (45s poll interval)');
}
