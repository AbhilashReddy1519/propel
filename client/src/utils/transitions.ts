import { IncidentStatus } from '../types/api';

export const ALLOWED_NEXT: Record<IncidentStatus, IncidentStatus[]> = {
  detected: ['acknowledged'],
  acknowledged: ['crew_assigned'],
  crew_assigned: ['resolved'],
  resolved: [], // manual dead-end -- only telemetry advances this to 'verified'
  verified: ['closed'],
  closed: [],
};

export const TRANSITION_BUTTON_LABELS: Partial<Record<IncidentStatus, string>> = {
  acknowledged: 'Acknowledge',
  crew_assigned: 'Assign Crew',
  resolved: 'Mark Resolved',
  closed: 'Close Ticket',
};
