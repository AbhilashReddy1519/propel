// server/src/services/telemetryIngestService.ts
import { eq } from 'drizzle-orm';
import { db } from '@/db/index.js';
import { poles } from '@/db/schema/poles.schema.js';
import { telemetryRaw } from '@/db/schema/telemetryRaw.schema.js';
import { BadRequestError } from '@/exceptions/http.exception.js';
import type { TelemetryPayload } from '@/modules/telemetry/telemetry.validations.js';

export async function ingestTelemetry(payload: TelemetryPayload) {
  // Resolve deviceId -> poleId now, not later. Cheap (indexed unique column),
  // and it rejects garbage/unregistered devices immediately at the edge
  // instead of letting bad rows pile up in the queue.
  const [pole] = await db
    .select({ id: poles.id })
    .from(poles)
    .where(eq(poles.deviceId, payload.deviceId))
    .limit(1);

  if (!pole) {
    throw new BadRequestError(`Unknown device: ${payload.deviceId}`);
  }

  // Just insert and return -- no processing here. This is what decouples
  // "can we accept the message fast enough" from "can we process it fast
  // enough," which is the whole point of a queue table.
  await db.insert(telemetryRaw).values({
    deviceId: payload.deviceId,
    poleId: pole.id,
    event: payload.event,
    energized: payload.energized ?? null,
    deviceTs: new Date(payload.ts),
    seq: payload.seq,
    batteryMv: payload.batteryMv ?? null,
    rssi: payload.rssi ?? null,
  });
}
