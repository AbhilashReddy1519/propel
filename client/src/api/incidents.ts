import { apiFetch } from './client';
import { IncidentRow, TransitionRequest } from '../types/api';

export async function listIncidents(open: boolean = true): Promise<IncidentRow[]> {
  const query = open ? '?open=true' : '';
  return apiFetch<IncidentRow[]>(`/incidents${query}`);
}

export async function getIncident(id: string): Promise<IncidentRow> {
  return apiFetch<IncidentRow>(`/incidents/${id}`);
}

export async function transitionIncident(id: string, payload: TransitionRequest): Promise<IncidentRow> {
  return apiFetch<IncidentRow>(`/incidents/${id}/transition`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}
