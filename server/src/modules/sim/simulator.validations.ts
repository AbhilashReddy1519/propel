import { z } from 'zod';

export const injectFaultSchema = z.object({
  type: z.enum(['span', 'dt', 'feeder']),
  dtId: z.string().min(1),
  targetId: z.string().optional(),
  severity: z.enum(['low', 'medium', 'high']).optional(),
});

export const injectNoiseSchema = z.object({
  dtId: z.string().min(1),
  noiseType: z.enum(['single_sensor_failure', 'scheduled_outage']).optional(),
});

export const repairIncidentSchema = z.object({
  actor: z.string().min(1),
  note: z.string().optional(),
});

export type InjectFaultPayload = z.infer<typeof injectFaultSchema>;
export type InjectNoisePayload = z.infer<typeof injectNoiseSchema>;
export type RepairIncidentPayload = z.infer<typeof repairIncidentSchema>;
