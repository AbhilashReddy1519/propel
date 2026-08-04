import {
  boolean,
  doublePrecision,
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
} from 'drizzle-orm/pg-core';
import { transformers } from './transformers.schema.js';

export const incidentStatusEnum = pgEnum('incident_status', [
  'detected',
  'acknowledged',
  'crew_assigned',
  'resolved',
  'verified',
  'closed',
]);
export const incidentConfidenceEnum = pgEnum('incident_confidence', ['high', 'inferred', 'range']);

// One row per located fault -- the output of the localization engine.
export const incidents = pgTable('incidents', {
  id: text('id').primaryKey(),
  dtId: text('dt_id')
    .notNull()
    .references(() => transformers.id),
  frontierParentPoleId: text('frontier_parent_pole_id'),
  frontierChildPoleId: text('frontier_child_pole_id'),
  status: incidentStatusEnum('status').notNull().default('detected'),
  confidence: incidentConfidenceEnum('confidence').notNull(),
  affectedPoleCount: integer('affected_pole_count').notNull(),
  lat: doublePrecision('lat').notNull(),
  lon: doublePrecision('lon').notNull(),
  pincode: text('pincode'),
  reasoning: text('reasoning').notNull(),
  briefing: text('briefing'), // human-readable one-line summary -- AI-generated or template fallback
  briefingSource: text('briefing_source').$type<'ai' | 'template'>(), // which path produced it -- surfaced in UI so nobody mistakes a fallback for a live AI call
  suppressedBySchedule: boolean('suppressed_by_schedule').notNull().default(false),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  resolvedAt: timestamp('resolved_at'),
  verifiedAt: timestamp('verified_at'),
  closedAt: timestamp('closed_at'),
});
