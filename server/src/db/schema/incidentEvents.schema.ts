import { pgTable, text, timestamp } from 'drizzle-orm/pg-core';
import { incidents } from './incidents.schema.js';

export const incidentEvents = pgTable('incident_events', {
  id: text('id').primaryKey(),
  incidentId: text('incident_id')
    .notNull()
    .references(() => incidents.id),
  eventType: text('event_type').notNull(),
  actor: text('actor'),
  note: text('note'),
  ts: timestamp('ts').defaultNow().notNull(),
});
