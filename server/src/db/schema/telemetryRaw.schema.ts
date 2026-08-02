import { bigserial, boolean, integer, pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { poles } from "./poles.schema.js";

// Append-only raw inbox. Nothing here is ever mutated, only inserted and read.
export const telemetryRaw = pgTable('telemetry_raw', {
  id: bigserial('id', { mode: 'number' }).primaryKey(),
  deviceId: text('device_id').notNull(),
  poleId: text('pole_id').references(() => poles.id),
  event: text('event').notNull(), // heartbeat | power_lost | power_restored | boot
  energized: boolean('energized'),
  deviceTs: timestamp('device_ts').notNull(),
  seq: integer('seq').notNull(),
  batteryMv: integer('battery_mv'),
  rssi: integer('rssi'),
  receivedAt: timestamp('received_at').defaultNow().notNull(),
  processedAt: timestamp('processed_at'),
});

export type TelemetryRaws = typeof telemetryRaw.$inferSelect;
export type TelemetryRaw = typeof telemetryRaw.$inferInsert;