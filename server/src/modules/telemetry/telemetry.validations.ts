// server/src/validations/telemetry.validation.ts
import { z } from 'zod';

export const telemetrySchema = z.object({
  deviceId: z.string().min(1),
  event: z.enum(['heartbeat', 'power_lost', 'power_restored', 'boot']),
  energized: z.boolean().optional(),
  ts: z.string().datetime(), // device's own clock -- display/staleness only, NEVER for ordering
  seq: z.number().int().nonnegative(),
  batteryMv: z.number().int().optional(),
  rssi: z.number().int().optional(),
});

export type TelemetryPayload = z.infer<typeof telemetrySchema>;