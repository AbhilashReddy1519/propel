import { randomUUID } from 'crypto';
import { eq } from 'drizzle-orm';
import { db } from '@/db/index.js';
import { incidents } from '@/db/schema/incidents.schema.js';
import { poles } from '@/db/schema/poles.schema.js';
import { poleStates } from '@/db/schema/polesStates.schema.js';
import { scheduledOutages } from '@/db/schema/scheduledOutages.schema.js';
import { transformers } from '@/db/schema/transformers.schema.js';
import { ingestTelemetry } from '@/services/telemetryIngestService.js';
import { BadRequestError, NotFoundError } from '@/exceptions/http.exception.js';
import type {
  InjectFaultPayload,
  InjectNoisePayload,
  RepairIncidentPayload,
} from './simulator.validations.js';

const SILENT_FAULT_RATE = 0.3;
const SCHEDULED_OUTAGE_DURATION_MS = 30 * 60 * 1000;
const HEARTBEAT_SILENCE_EXPIRY_MS = 90_000;

interface PoleRecord {
  id: string;
  dtId: string;
  parentPoleId: string | null;
  deviceId: string | null;
}

function indexTree(poles: PoleRecord[]) {
  const children = new Map<string, string[]>();
  for (const pole of poles) {
    if (pole.parentPoleId) {
      children.set(pole.parentPoleId, [...(children.get(pole.parentPoleId) ?? []), pole.id]);
    }
  }
  return children;
}

function collectSubtree(poleId: string, childrenOf: Map<string, string[]>) {
  const out = new Set<string>();
  const stack = [poleId];

  while (stack.length) {
    const current = stack.pop()!;
    if (out.has(current)) continue;
    out.add(current);
    stack.push(...(childrenOf.get(current) ?? []));
  }

  return [...out];
}

function chooseRandom<T>(items: T[]): T {
  if (items.length === 0) {
    throw new Error('Cannot choose a random item from an empty array');
  }
  return items[Math.floor(Math.random() * items.length)]!;
}

function randomBatteryMv() {
  return 3200 + Math.floor(Math.random() * 1200);
}

function randomRssi() {
  return -90 + Math.floor(Math.random() * 40);
}

async function getDtPoles(dtId: string): Promise<PoleRecord[]> {
  const rows = await db.select().from(poles).where(eq(poles.dtId, dtId));
  if (!rows.length) throw new NotFoundError(`DT not found: ${dtId}`);
  return rows;
}

async function getFeederIdForDt(dtId: string): Promise<string> {
  const [dt] = await db
    .select({ feederId: transformers.feederId })
    .from(transformers)
    .where(eq(transformers.id, dtId))
    .limit(1);
  if (!dt) throw new NotFoundError(`DT not found: ${dtId}`);
  return dt.feederId;
}

async function getPolesForFeeder(feederId: string): Promise<PoleRecord[]> {
  return await db
    .select({
      id: poles.id,
      dtId: poles.dtId,
      parentPoleId: poles.parentPoleId,
      deviceId: poles.deviceId,
    })
    .from(poles)
    .innerJoin(transformers, eq(poles.dtId, transformers.id))
    .where(eq(transformers.feederId, feederId));
}

async function getIncidentById(incidentId: string) {
  const [incident] = await db.select().from(incidents).where(eq(incidents.id, incidentId)).limit(1);
  if (!incident) throw new NotFoundError(`Incident not found: ${incidentId}`);
  return incident;
}

function devicePolesFromIds(poles: PoleRecord[], ids: string[]) {
  const set = new Set(ids);
  return poles.filter((pole) => set.has(pole.id) && pole.deviceId);
}

async function executeTelemetryBatch(payloads: Array<Record<string, unknown>>) {
  for (const payload of payloads) {
    await ingestTelemetry(payload as any);
  }
}

function buildPowerLostPayload(deviceId: string, seq: number, now: Date) {
  return {
    deviceId,
    event: 'power_lost' as const,
    energized: false,
    ts: now.toISOString(),
    seq,
    batteryMv: randomBatteryMv(),
    rssi: randomRssi(),
  };
}

function buildHeartbeatPayload(deviceId: string, seq: number, now: Date) {
  return {
    deviceId,
    event: 'heartbeat' as const,
    energized: true,
    ts: now.toISOString(),
    seq,
    batteryMv: randomBatteryMv(),
    rssi: randomRssi(),
  };
}

function buildBootPayload(deviceId: string, seq: number, now: Date) {
  return {
    deviceId,
    event: 'boot' as const,
    ts: now.toISOString(),
    seq,
    batteryMv: randomBatteryMv(),
    rssi: randomRssi(),
  };
}

function buildPowerRestoredPayload(deviceId: string, seq: number, now: Date) {
  return {
    deviceId,
    event: 'power_restored' as const,
    energized: true,
    ts: now.toISOString(),
    seq,
    batteryMv: randomBatteryMv(),
    rssi: randomRssi(),
  };
}

async function expireHeartbeatWindow(poleId: string) {
  await db
    .update(poleStates)
    .set({ expectedNextHeartbeatAt: new Date(Date.now() - HEARTBEAT_SILENCE_EXPIRY_MS) })
    .where(eq(poleStates.poleId, poleId));
}

async function createScheduledOutage(scope: string, targetId: string, reason: string) {
  await db.insert(scheduledOutages).values({
    id: randomUUID(),
    scope,
    targetId,
    start: new Date(Date.now() - 60_000),
    end: new Date(Date.now() + SCHEDULED_OUTAGE_DURATION_MS),
    reason,
  });
}

export async function injectFault(payload: InjectFaultPayload) {
  const dtPoles = await getDtPoles(payload.dtId);
  const childrenOf = indexTree(dtPoles);

  let affectedPoleIds: string[];
  let description: string;

  if (payload.type === 'span') {
    if (!payload.targetId) throw new BadRequestError('targetId is required for span faults');
    const target = dtPoles.find((pole) => pole.id === payload.targetId);
    if (!target) throw new NotFoundError(`Target pole not found in DT: ${payload.targetId}`);
    affectedPoleIds = collectSubtree(payload.targetId, childrenOf);
    description = `Span fault at pole ${payload.targetId}`;
  } else if (payload.type === 'dt') {
    affectedPoleIds = dtPoles.map((pole) => pole.id);
    description = `Full DT fault for ${payload.dtId}`;
  } else {
    const feederId = await getFeederIdForDt(payload.dtId);
    const feederPoles = await getPolesForFeeder(feederId);
    affectedPoleIds = feederPoles.map((pole) => pole.id);
    description = `Feeder fault for feeder ${feederId}`;
  }

  const devicePoles = devicePolesFromIds(dtPoles, affectedPoleIds);
  if (!devicePoles.length)
    throw new BadRequestError('No device-equipped poles found for the requested fault');

  const now = new Date();
  const baseSeq = Math.floor(Date.now() / 1000);
  const telemetryPayloads: Array<Record<string, unknown>> = [];
  const droppedCount = [] as string[];

  let seqOffset = 0;
  for (const pole of devicePoles) {
    const seq = baseSeq + ++seqOffset;
    if (Math.random() < SILENT_FAULT_RATE) {
      droppedCount.push(pole.id);
      continue;
    }
    telemetryPayloads.push(buildPowerLostPayload(pole.deviceId!, seq, now));
  }

  await executeTelemetryBatch(telemetryPayloads);

  return {
    description,
    injected: telemetryPayloads.length,
    silentDeviceCount: droppedCount.length,
    silentDeviceIds: droppedCount,
    affectedDeviceCount: devicePoles.length,
    type: payload.type,
  };
}

export async function injectNoise(payload: InjectNoisePayload) {
  const dtPoles = await getDtPoles(payload.dtId);
  const devicePoles = dtPoles.filter((pole) => pole.deviceId);
  if (!devicePoles.length)
    throw new NotFoundError(`No device-equipped poles found for DT ${payload.dtId}`);

  if (payload.noiseType === 'scheduled_outage') {
    const feederId = await getFeederIdForDt(payload.dtId);
    await createScheduledOutage('dt', payload.dtId, 'Simulator scheduled outage');
    await createScheduledOutage('feeder', feederId, 'Simulator scheduled outage');
    return {
      type: 'scheduled_outage',
      dtId: payload.dtId,
      feederId,
      message: 'Scheduled outage windows created for DT and feeder',
    };
  }

  const chosen = chooseRandom(devicePoles);
  const now = new Date();
  const telemetryPayload = buildHeartbeatPayload(
    chosen.deviceId!,
    Math.floor(Date.now() / 1000),
    now,
  );
  await ingestTelemetry(telemetryPayload);
  await expireHeartbeatWindow(chosen.id);

  return {
    type: 'single_sensor_failure',
    dtId: payload.dtId,
    poleId: chosen.id,
    deviceId: chosen.deviceId,
    message: 'Selected device will stop heartbeating and become a silent failure shortly',
  };
}

export async function repairIncident(incidentId: string, payload: RepairIncidentPayload) {
  const incident = await getIncidentById(incidentId);

  const dtPoles = await getDtPoles(incident.dtId);
  const childrenOf = indexTree(dtPoles);

  const affectedPoleIds = incident.frontierChildPoleId
    ? collectSubtree(incident.frontierChildPoleId, childrenOf)
    : dtPoles.map((pole) => pole.id);

  const devicePoles = devicePolesFromIds(dtPoles, affectedPoleIds);

  // Not an error -- this is a legitimate incident (the "no-device boundary"
  // / range-confidence case, expected for ~9% of poles by spec). There is
  // no device anywhere in this subtree to send restoration telemetry from,
  // so telemetry-based repair is structurally impossible here, not just
  // untried. Say so plainly and point at the administrative override
  // instead of failing the request.
  if (!devicePoles.length) {
    return {
      incidentId,
      repairedDeviceCount: 0,
      repairedPoleIds: [],
      unrepairable: true,
      reason:
        "No pole in this incident's affected subtree has a telemetry device -- " +
        'this is a "range" confidence incident and cannot be confirmed via telemetry. ' +
        'Use the administrative force-close action instead (POST /incidents/:id/force-close).',
      actor: payload.actor,
      note: payload.note ?? null,
    };
  }

  const now = new Date();
  const baseSeq = Math.floor(Date.now() / 1000);
  const telemetryPayloads: Array<Record<string, unknown>> = [];

  let seqOffset = 0;
  for (const pole of devicePoles) {
    const bootSeq = baseSeq + ++seqOffset;
    telemetryPayloads.push(buildBootPayload(pole.deviceId!, bootSeq, now));
    const restoreSeq = baseSeq + ++seqOffset;
    telemetryPayloads.push(buildPowerRestoredPayload(pole.deviceId!, restoreSeq, now));
  }

  await executeTelemetryBatch(telemetryPayloads);

  return {
    incidentId,
    repairedDeviceCount: devicePoles.length,
    repairedPoleIds: devicePoles.map((pole) => pole.id),
    actor: payload.actor,
    note: payload.note ?? null,
  };
}
