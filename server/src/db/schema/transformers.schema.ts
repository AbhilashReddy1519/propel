import { doublePrecision, integer, pgTable, text } from 'drizzle-orm/pg-core';
import { feeders } from './feeders.schema.js';

export const transformers = pgTable('transformers', {
  id: text('id').primaryKey().notNull(),
  feederId: text('feeder_id')
    .notNull()
    .references(() => feeders.id),
  lat: doublePrecision('lat').notNull(),
  lon: doublePrecision('lon').notNull(),
  capacityKva: integer('capacity_kva'),
  householdsServed: integer('households_served'),
});

export type Transformers = typeof transformers.$inferSelect;
export type Transformer = typeof transformers.$inferInsert;
