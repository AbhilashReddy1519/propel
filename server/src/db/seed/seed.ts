import { eq, sql } from 'drizzle-orm';
import { db } from '../index.js';
import logger from '@/utils/logger.js';
import { generateNetwork } from './networkGenerator.js';
import { subStations } from '../schema/subStations.schema.js';
import { feeders } from '../schema/feeders.schema.js';
import { transformers } from '../schema/transformers.schema.js';
import { poles } from '../schema/poles.schema.js';
import { poleStates } from '../schema/polesStates.schema.js';

const BATCH_SIZE = 1000;

async function batched<T>(rows: T[], fn: (chunk: T[]) => Promise<unknown>) {
  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    await fn(rows.slice(i, i + BATCH_SIZE));
    logger.info(`${i} batch done`);
  }
}

async function resetTables() {
  await db.execute(
    sql`
      TRUNCATE TABLE
        incident_events, incidents, telemetry_raw, pole_states,
        poles, transformers, feeders, sub_stations
      CASCADE
    `
  );
}

export async function seed(shouldExit: boolean = true) {
  await resetTables();

  logger.info('Generating synthetic network...');
  const network = generateNetwork({
    numSubStations: 4,
    numFeeders: 31,
    dtsPerFeeder: [10, 17],
    polesPerDt: [20, 166],
  });
  logger.info(
    `${network.subStations.length} substations, ${network.feeders.length} feeders, ` +
      `${network.transformers.length} transformers, ${network.poles.length} poles`,
  );

  await db.insert(subStations).values(network.subStations);

  await db
    .insert(feeders)
    .values(network.feeders.map((f) => ({ id: f.id, subStationId: f.subStationId, name: f.name })));

  await batched(network.transformers, (chunk) =>
    db.insert(transformers).values(
      chunk.map((t) => ({
        id: t.id,
        feederId: t.feederId,
        lat: t.lat,
        lon: t.lon,
        capacityKva: t.capacityKva,
        householdsServed: t.householdsServed,
      })),
    ),
  );

  logger.info("Phase 1 started");
  // PHASE 1 — insert every pole, parent left null.
  await batched(network.poles, (chunk) =>
    db.insert(poles).values(
      chunk.map((p) => ({
        id: p.id,
        dtId: p.dtId,
        lat: p.lat,
        lon: p.lon,
        pincode: p.pincode,
        deviceId: p.deviceId,
        parentPoleId: null,
        seqOnLine: p.seqOnLine,
        topologyConfidence: p.topologyConfidence,
      })),
    ),
  );

  logger.info('Phase 2 started');
  // PHASE 2 — now that every pole row exists, fill in the real parent.
  const needsParent = network.poles.filter((p) => p.effectiveParentPoleId !== p.dtId);

  await batched(needsParent, async (chunk) => {
    await Promise.all(
      chunk.map((p) =>
        db.update(poles).set({ parentPoleId: p.effectiveParentPoleId }).where(eq(poles.id, p.id)),
      ),
    );
  });

  logger.info("Every pole WITH a device starts 'unknown' until real telemetry arrives.");
  // Every pole WITH a device starts 'unknown' until real telemetry arrives.
  const withDevice = network.poles.filter((p) => p.hasDevice);
  await batched(withDevice, (chunk) =>
    db
      .insert(poleStates)
      .values(chunk.map((p) => ({ poleId: p.id, currentState: 'unknown' as const }))),
  );

  logger.info('Seed complete.');
  if (shouldExit) {
    process.exit(0);
  }
}

export async function autoSeedIfEmpty() {
  try {
    const existingDts = await db.select({ id: transformers.id }).from(transformers).limit(1);
    if (existingDts.length > 0) {
      logger.info('Database already contains network topology. Skipping auto-seed.');
      return;
    }
    logger.info('Database is empty. Running initial synthetic network seed...');
    await seed(false);
  } catch (err) {
    logger.info('Auto-seed check/execution notice:', err instanceof Error ? err.message : err);
  }
}

// Standalone execution check
if (process.argv[1] && (process.argv[1].endsWith('seed.ts') || process.argv[1].endsWith('seed.js'))) {
  seed(true).catch((err) => {
    console.error('Seed failed:', err);
    process.exit(1);
  });
}
