import { integer, pgEnum, pgTable, text, timestamp } from 'drizzle-orm/pg-core';
import { poles } from './poles.schema.js';

export const poleLiveStateEnum = pgEnum('pole_live_state', ['live', 'dark', 'unknown']);

// Current derived liveness state per pole -- what the localization engine
// actually reads. Written only by the ingestion worker.
export const poleStates = pgTable('pole_states', {
  poleId: text('pole_id')
    .primaryKey()
    .notNull()
    .references(() => poles.id),
  currentState: poleLiveStateEnum('current_state').notNull().default('unknown'),
  lastSeenAt: timestamp('last_seen_at'),
  lastSeq: integer('last_seq'),
  expectedNextHeartbeatAt: timestamp('expected_next_heartbeat_at'),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export type PoleStates = typeof poleStates.$inferSelect;
export type PoleState = typeof poleStates.$inferInsert;
