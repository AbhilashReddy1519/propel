import { pgTable, text } from "drizzle-orm/pg-core";

export const subStations = pgTable("sub_stations", {
  id: text("id").primaryKey().notNull(),
  name: text("name").notNull(),
});

export type SubStations = typeof subStations.$inferSelect;
export type Substation = typeof subStations.$inferInsert;