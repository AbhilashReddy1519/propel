import { pgTable, text } from 'drizzle-orm/pg-core';
import { subStations } from './substations.schema.js';

export const feeders = pgTable('feeders', {
  id: text('id').primaryKey().notNull(),
  subStationId: text('sub_station_id')
    .notNull()
    .references(() => subStations.id),
  name: text('name').notNull(),
});

export type Feeders = typeof feeders.$inferSelect;
export type Feeder = typeof feeders.$inferInsert;