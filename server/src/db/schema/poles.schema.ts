import { AnyPgColumn, doublePrecision, integer, pgEnum, pgTable, text } from 'drizzle-orm/pg-core';
import { transformers } from './transformers.schema.js';

export const topologyConfidenceEnum = pgEnum('topology_confidence', ['known', 'inferred']);

// The tree lives here: parentPoleId is the entire topology representation.
// Null means "parent is the DT root itself" (see seed.ts / localization.ts
// for how a null parent is treated as a root-level frontier).
export const poles = pgTable('poles', {
  id: text('id').primaryKey().notNull(),
  dtId: text('dtId')
    .notNull()
    .references(() => transformers.id),
  lat: doublePrecision('lat').notNull(),
  lon: doublePrecision('lon').notNull(),
  pincode: text('pincode'),
  deviceId: text('device_id').unique(),
  parentPoleId: text('parent_pole_ id').references((): AnyPgColumn => poles.id),
  seqOnLine: integer('seq_on_line'),
  topologyConfidence: topologyConfidenceEnum('topology_confidence').notNull().default('known'),
});

export type Poles = typeof poles.$inferSelect;
export type Pole = typeof poles.$inferInsert;