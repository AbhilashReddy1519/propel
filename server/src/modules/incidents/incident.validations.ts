import { z } from 'zod';

export const transitionSchema = z.object({
  status: z.enum(['acknowledged', 'crew_assigned', 'resolved', 'closed']),
  actor: z.string().min(1),
  note: z.string().optional(),
});
export type TransitionPayload = z.infer<typeof transitionSchema>;

// Note is mandatory here (unlike transitionSchema) -- this bypasses
// telemetry confirmation, so the audit trail requirement is stricter.
export const forceCloseSchema = z.object({
  actor: z.string().min(1),
  note: z.string().min(1, 'A note is required to force-close an incident.'),
});
export type ForceClosePayload = z.infer<typeof forceCloseSchema>;
