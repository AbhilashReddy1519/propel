import { and, gte, lte } from 'drizzle-orm';
import { db } from '@/db/index.js';
import { scheduledOutages } from '@/db/schema/scheduledOutages.schema.js';

export async function getScheduledOutages(from: Date, to: Date) {
  return await db
    .select()
    .from(scheduledOutages)
    .where(and(gte(scheduledOutages.start, from), lte(scheduledOutages.end, to)));
}
