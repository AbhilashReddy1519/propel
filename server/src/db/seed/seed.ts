import { eq, sql } from 'drizzle-orm';
import { db } from '../index.js';
import logger from '@/utils/logger.js';
import { generateNetwork } from './networkGenerator.js';
import { subStations } from '../schema/subStations.schema.js';
import { feeders } from '../schema/feeders.schema.js';
import { transformers } from '../schema/transformers.schema.js';
import { poles } from '../schema/poles.schema.js';
import { poleStates } from '../schema/polesStates.schema.js';

const BATCH_SIZE = 500;

async function batched<T>(rows: T[], fn: (chunk: T[]) => Promise<unknown>) {
  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    await fn(rows.slice(i, i + BATCH_SIZE));
  }
}

async function resetTables() {
  await db.execute(sql`
    TRUNCATE TABLE
      incident_events, incidents, telemetry_raw, pole_states,
      poles, transformers, feeders, sub_stations
    CASCADE
  `);
}

async function seed() {
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

  // PHASE 2 — now that every pole row exists, fill in the real parent.
  // effectiveParentPoleId === dtId means "root of this DT" -> stays null
  // (matches the schema convention: null parent = parent is the DT itself).
  const needsParent = network.poles.filter((p) => p.effectiveParentPoleId !== p.dtId);

  await batched(needsParent, async (chunk) => {
    await Promise.all(
      chunk.map((p) =>
        db.update(poles).set({ parentPoleId: p.effectiveParentPoleId }).where(eq(poles.id, p.id)),
      ),
    );
  });

  // Every pole WITH a device starts 'unknown' until real telemetry arrives.
  // Poles with no device get no pole_states row at all -- localization
  // already treats a missing row as 'unknown' (see localizationService).
  const withDevice = network.poles.filter((p) => p.hasDevice);
  await batched(withDevice, (chunk) =>
    db
      .insert(poleStates)
      .values(chunk.map((p) => ({ poleId: p.id, currentState: 'unknown' as const }))),
  );

  logger.info('Seed complete.');
  process.exit(0);
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
