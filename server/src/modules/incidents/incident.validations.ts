import { z } from 'zod';

export const transitionSchema = z.object({
  status: z.enum(['acknowledged', 'crew_assigned', 'resolved', 'closed']),
  actor: z.string().min(1),
  note: z.string().optional(),
});
export type TransitionPayload = z.infer<typeof transitionSchema>;
