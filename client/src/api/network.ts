import { apiFetch } from './client';
import { DtSummary, PoleSummary } from '../types/api';

export async function listDts(): Promise<DtSummary[]> {
  return apiFetch<DtSummary[]>('/network/dts');
}

export async function listPolesForDt(dtId: string): Promise<PoleSummary[]> {
  return apiFetch<PoleSummary[]>(`/network/dts/${encodeURIComponent(dtId)}/poles`);
}
