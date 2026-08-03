import { eq, sql } from 'drizzle-orm';
import { db } from '@/db/index.js';
import { poles } from '@/db/schema/poles.schema.js';
import { transformers } from '@/db/schema/transformers.schema.js';
import { NotFoundError } from '@/exceptions/http.exception.js';

export async function listDts() {
  // One row per DT with a live pole count and its dominant topology
  // confidence -- all poles under one DT share the same confidence by
  // construction (see seed.ts), so MIN() is just a cheap way to pull one
  // value per group without a second query.
  const rows = await db
    .select({
      id: transformers.id,
      feederId: transformers.feederId,
      lat: transformers.lat,
      lon: transformers.lon,
      capacityKva: transformers.capacityKva,
      householdsServed: transformers.householdsServed,
      poleCount: sql<number>`count(${poles.id})`.mapWith(Number),
      topologyConfidence: sql<'known' | 'inferred'>`min(${poles.topologyConfidence}::text)`,
    })
    .from(transformers)
    .leftJoin(poles, eq(poles.dtId, transformers.id))
    .groupBy(transformers.id);

  return rows;
}

export async function listPolesForDt(dtId: string) {
  const [dt] = await db
    .select({ id: transformers.id })
    .from(transformers)
    .where(eq(transformers.id, dtId))
    .limit(1);
  if (!dt) throw new NotFoundError(`DT not found: ${dtId}`);

  return db
    .select({
      id: poles.id,
      lat: poles.lat,
      lon: poles.lon,
      parentPoleId: poles.parentPoleId,
      hasDevice: sql<boolean>`${poles.deviceId} is not null`,
    })
    .from(poles)
    .where(eq(poles.dtId, dtId));
}