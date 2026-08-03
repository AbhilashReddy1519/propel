import { apiFetch } from './client';
import {
  InjectFaultRequest,
  InjectFaultResponse,
  InjectNoiseRequest,
  InjectNoiseResponse,
  RepairRequest,
  RepairResponse,
} from '../types/api';

export async function injectFault(payload: InjectFaultRequest): Promise<InjectFaultResponse> {
  return apiFetch<InjectFaultResponse>('/sim/inject-fault', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function injectNoise(payload: InjectNoiseRequest): Promise<InjectNoiseResponse> {
  return apiFetch<InjectNoiseResponse>('/sim/inject-noise', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function repairIncident(incidentId: string, payload: RepairRequest): Promise<RepairResponse> {
  return apiFetch<RepairResponse>(`/sim/repair/${encodeURIComponent(incidentId)}`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}
