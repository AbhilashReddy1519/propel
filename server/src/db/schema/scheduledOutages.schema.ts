import { pgTable, text, timestamp } from "drizzle-orm/pg-core";

export const scheduledOutages = pgTable('scheduled_outages', {
  id: text('id').primaryKey(),
  scope: text('scope').notNull(), // "feeder" | "dt"
  targetId: text('target_id').notNull(),
  start: timestamp('start').notNull(),
  end: timestamp('end').notNull(),
  reason: text('reason'),
});

