// server/src/workers/ingestionWorker.ts
import { eq, isNull, sql } from 'drizzle-orm';
import { db } from '@/db/index.js';
import { telemetryRaw } from '@/db/schema/telemetryRaw.schema.js';
import { poles } from '@/db/schema/poles.schema.js';
import { poleStates } from '@/db/schema/polesStates.schema.js';
import { recomputeFrontiersForDt } from '@/services/localizationService.js';
import logger from '@/utils/logger.js';

const HEARTBEAT_INTERVAL_MS = 15 * 60 * 1000; // 15 min
const HEARTBEAT_JITTER_MS = 45 * 1000; // spec's stated ±45s jitter
const BATCH_SIZE = 200;

function deriveState(event: string, energized: boolean | null): 'live' | 'dark' {
  if (event === 'power_lost') return 'dark';
  if (energized === false) return 'dark';
  // heartbeat / power_restored / boot all imply the device currently has
  // power -- if it didn't, it couldn't have sent anything.
  return 'live';
}

async function processOneRow(row: typeof telemetryRaw.$inferSelect) {
  if (!row.poleId) return; // shouldn't happen -- resolved at ingest time

  const [pole] = await db
    .select({ dtId: poles.dtId })
    .from(poles)
    .where(eq(poles.id, row.poleId))
    .limit(1);
  if (!pole) return;

  const [existing] = await db
    .select({ lastSeq: poleStates.lastSeq })
    .from(poleStates)
    .where(eq(poleStates.poleId, row.poleId))
    .limit(1);

  // Dedupe/ordering rule: ignore anything at or below the last-seen seq,
  // UNLESS this is a boot event -- a boot means the device restarted and
  // its seq counter reset to a low number, so it must always win.
  const isStale = row.event !== 'boot' && existing?.lastSeq != null && row.seq <= existing.lastSeq;

  if (isStale) {
    logger.info(`Dropped stale/duplicate telemetry: device=${row.deviceId} seq=${row.seq}`);
    return;
  }

  const newState = deriveState(row.event, row.energized);
  // expectedNextHeartbeatAt is computed off the SERVER's receive time, not
  // the device's ts -- this sidesteps the ±90s clock-skew problem entirely
  // rather than trying to correct for it.
  const expectedNextHeartbeatAt = new Date(
    Date.now() + HEARTBEAT_INTERVAL_MS + HEARTBEAT_JITTER_MS,
  );

  await db
    .insert(poleStates)
    .values({
      poleId: row.poleId,
      currentState: newState,
      lastSeenAt: row.receivedAt,
      lastSeq: row.seq,
      expectedNextHeartbeatAt,
    })
    .onConflictDoUpdate({
      target: poleStates.poleId,
      set: {
        currentState: newState,
        lastSeenAt: row.receivedAt,
        lastSeq: row.seq,
        expectedNextHeartbeatAt,
        updatedAt: sql`now()`,
      },
    });

  await recomputeFrontiersForDt(pole.dtId);
}

export async function drainTelemetryQueue() {
  const rows = await db
    .select()
    .from(telemetryRaw)
    .where(isNull(telemetryRaw.processedAt))
    .orderBy(telemetryRaw.id)
    .limit(BATCH_SIZE);

  for (const row of rows) {
    try {
      await processOneRow(row);
    } catch (err) {
      logger.error(`Failed to process telemetry row ${row.id}: ${err}`);
      // Don't rethrow -- one bad row shouldn't block the whole batch.
      // It'll show up unprocessed forever, which is a visible signal to
      // investigate rather than a silent data-loss bug.
      continue;
    }
    await db
      .update(telemetryRaw)
      .set({ processedAt: new Date() })
      .where(eq(telemetryRaw.id, row.id));
  }
}

export function startIngestionWorker() {
  setInterval(() => {
    drainTelemetryQueue().catch((err) => logger.error(`Ingestion worker error: ${err}`));
  }, 1500);
  logger.info('Ingestion worker started (1.5s poll interval)');
}
