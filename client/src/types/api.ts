export type IncidentStatus =
  | 'detected'
  | 'acknowledged'
  | 'crew_assigned'
  | 'resolved'
  | 'verified'
  | 'closed';

export type IncidentConfidence = 'high' | 'inferred' | 'range';

export interface IncidentRow {
  id: string;
  dtId: string;
  frontierParentPoleId: string | null;
  frontierChildPoleId: string | null;
  status: IncidentStatus;
  confidence: IncidentConfidence;
  affectedPoleCount: number;
  lat: number;
  lon: number;
  pincode: string | null;
  reasoning: string;
  suppressedBySchedule: boolean;
  createdAt: string;
  resolvedAt: string | null;
  verifiedAt: string | null;
  closedAt: string | null;
}

export interface TransitionRequest {
  status: 'acknowledged' | 'crew_assigned' | 'resolved' | 'closed';
  actor: string;
  note?: string;
}

export interface DtSummary {
  id: string;
  feederId: string;
  lat: number;
  lon: number;
  capacityKva: number;
  householdsServed: number;
  poleCount: number;
  topologyConfidence: 'known' | 'inferred';
}

export interface PoleSummary {
  id: string;
  lat: number;
  lon: number;
  parentPoleId: string | null;
  hasDevice: boolean;
}

export interface InjectFaultRequest {
  type: 'span' | 'dt' | 'feeder';
  dtId: string;
  targetId?: string;
}

export interface InjectFaultResponse {
  success: boolean;
  description: string;
  injected: number;
  silentDeviceCount: number;
  affectedDeviceCount: number;
  type: string;
}

export interface InjectNoiseRequest {
  dtId: string;
  noiseType?: 'single_sensor_failure' | 'scheduled_outage';
}

export interface InjectNoiseResponse {
  success: boolean;
  message: string;
  [key: string]: unknown;
}

export interface RepairRequest {
  actor: string;
  note?: string;
}

export interface RepairResponse {
  success: boolean;
  incidentId: string;
  repairedDeviceCount: number;
  repairedPoleIds: string[];
  actor: string;
  note: string | null;
}

export interface ScheduledOutage {
  id: string;
  scope: string;
  targetId: string;
  start: string;
  end: string;
  reason: string;
}

export interface ScheduledOutagesResponse {
  success: boolean;
  outages: ScheduledOutage[];
}

export interface ApiErrorResponse {
  message: string;
}
