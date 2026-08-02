/**
 * Synthetic network generator.
 *
 * Produces a network shaped like the real thing (see 02-data-and-systems.md):
 *   - radial trunk lines with 1-5 branches per DT
 *   - ~9% of poles missing a device
 *   - ~3% of poles missing a pincode
 *   - ~60% of DTs missing recorded topology
 *
 * Important: for the "missing topology" 60%, we don't fabricate a separate
 * fake inferred tree -- we discard the true parent links and re-run the SAME
 * inferTopology() the production system uses. This means testing against
 * seeded data is a real test of the inference algorithm, not a mock of it.
 */

import { inferTopology, type RawPole } from './topologyInference.js';

const EARTH_RADIUS = 6371000;

function metersToLatLonOffset(lat: number, dx: number, dy: number) {
  const dLat = (dy / EARTH_RADIUS) * (180 / Math.PI);
  const dLon = (dx / (EARTH_RADIUS * Math.cos((lat * Math.PI) / 180))) * (180 / Math.PI);
  return { dLat, dLon };
}

function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}
function choice<T>(arr: T[]): T {
  return arr[randInt(0, arr.length - 1)]!;
}

const PIN_POOL = ['560078', '560079', '560084', '560091', '560102'];

export interface GenPole {
  id: string;
  dtId: string;
  lat: number;
  lon: number;
  seqOnLine: number | null; // null when topology is unknown
  topologyConfidence: 'known' | 'inferred';
  effectiveParentPoleId: string | null; // the id actually used for tree walks
  hasDevice: boolean;
  deviceId: string | null;
  pincode: string | null;
}

export interface GenTransformer {
  id: string;
  feederId: string;
  lat: number;
  lon: number;
  capacityKva: number;
  householdsServed: number;
}

export interface GenSubStation {
  id: string;
  name: string;
}

export interface GenFeeder {
  id: string;
  subStationId: string;
  name: string;
}

export interface GeneratedNetwork {
  subStations: GenSubStation[];
  feeders: GenFeeder[];
  transformers: GenTransformer[];
  poles: GenPole[];
}

/**
 * Builds one DT's ground-truth pole tree: a trunk moving away from the DT at
 * a random bearing, with a few branches forking off it. Returns poles with
 * their TRUE parent id -- callers decide whether to keep or discard this.
 */
function buildDtGroundTruth(
  dtId: string,
  dtLat: number,
  dtLon: number,
  poleCount: number,
  idGen: () => string,
): { id: string; lat: number; lon: number; trueParentId: string; seq: number }[] {
  const spacingMeters = randInt(25, 45);
  const trunkBearing = Math.random() * 2 * Math.PI;
  const trunkLength = Math.max(4, Math.floor((poleCount * randInt(40, 60)) / 100));

  const out: { id: string; lat: number; lon: number; trueParentId: string; seq: number }[] = [];
  const trunkPoles: { id: string; lat: number; lon: number }[] = [];

  let prevId = dtId;
  let cumLat = dtLat;
  let cumLon = dtLon;

  for (let i = 1; i <= trunkLength; i++) {
    const dx = Math.cos(trunkBearing) * spacingMeters;
    const dy = Math.sin(trunkBearing) * spacingMeters;
    const { dLat, dLon } = metersToLatLonOffset(cumLat, dx, dy);
    cumLat += dLat;
    cumLon += dLon;
    const id = idGen();
    out.push({ id, lat: cumLat, lon: cumLon, trueParentId: prevId, seq: i });
    trunkPoles.push({ id, lat: cumLat, lon: cumLon });
    prevId = id;
  }

  let remaining = poleCount - trunkLength;
  const branchCount = Math.min(5, Math.max(remaining > 0 ? 1 : 0, Math.floor(remaining / 8)));

  for (let b = 0; b < branchCount && remaining > 0; b++) {
    const fork = choice(trunkPoles);
    const branchBearing = trunkBearing + (Math.random() - 0.5) * Math.PI;
    const branchLength = Math.min(
      remaining,
      randInt(3, Math.max(4, Math.floor(remaining / (branchCount - b)))),
    );

    let bPrev = fork.id;
    let bLat = fork.lat;
    let bLon = fork.lon;

    for (let j = 1; j <= branchLength; j++) {
      const dx = Math.cos(branchBearing) * spacingMeters;
      const dy = Math.sin(branchBearing) * spacingMeters;
      const { dLat, dLon } = metersToLatLonOffset(bLat, dx, dy);
      bLat += dLat;
      bLon += dLon;
      const id = idGen();
      out.push({ id, lat: bLat, lon: bLon, trueParentId: bPrev, seq: 1000 * (b + 1) + j });
      bPrev = id;
    }
    remaining -= branchLength;
  }

  return out;
}

export function generateNetwork(opts?: {
  numSubStations?: number;
  numFeeders?: number;
  dtsPerFeeder?: [number, number];
  polesPerDt?: [number, number];
  seed?: number;
}): GeneratedNetwork {
  const numSubStations = Math.max(1, opts?.numSubStations ?? 4);
  const numFeeders = opts?.numFeeders ?? 31;
  const [dtMin, dtMax] = opts?.dtsPerFeeder ?? [10, 17];
  const [poleMin, poleMax] = opts?.polesPerDt ?? [20, 166];

  const baseLat = 12.9678;
  const baseLon = 77.5951;

  let poleCounter = 1;
  let deviceCounter = 1;
  const nextPoleId = () => `P-${String(poleCounter++).padStart(6, '0')}`;

  const subStations: GenSubStation[] = [];
  for (let s = 0; s < numSubStations; s++) {
    subStations.push({ id: `SS-${String(s + 1).padStart(2, '0')}`, name: `Substation ${s + 1}` });
  }

  const feeders: GenFeeder[] = [];
  const transformers: GenTransformer[] = [];
  const poles: GenPole[] = [];

  for (let f = 0; f < numFeeders; f++) {
    const feederId = `F-${String(f + 1).padStart(2, '0')}`;
    // Round-robin assignment -- keeps substations roughly balanced
    // (31 feeders / 4 substations = ~7-8 each) rather than random,
    // which could leave one substation with 2 feeders and another with 15.
    const subStation = subStations[f % numSubStations];
    if (!subStation) {
      throw new Error(`No substation available for feeder ${feederId}`);
    }

    feeders.push({ id: feederId, subStationId: subStation.id, name: `Feeder ${f + 1}` });

    const dtCount = randInt(dtMin, dtMax);
    for (let d = 0; d < dtCount; d++) {
      const dtId = `D-${feederId.slice(2)}${String(d + 1).padStart(2, '0')}`;
      const off = metersToLatLonOffset(baseLat, randInt(-3000, 3000), randInt(-3000, 3000));
      const dtLat = baseLat + off.dLat;
      const dtLon = baseLon + off.dLon;

      transformers.push({
        id: dtId,
        feederId,
        lat: dtLat,
        lon: dtLon,
        capacityKva: choice([100, 160, 250, 400]),
        householdsServed: randInt(80, 450),
      });

      const poleCount = randInt(poleMin, poleMax);
      const groundTruth = buildDtGroundTruth(dtId, dtLat, dtLon, poleCount, nextPoleId);

      // ~60% of DTs never had their wiring order digitized -- this is the
      // central data gap the whole assignment is about.
      const topologyKnown = Math.random() < 0.4;

      let effectiveParentById: Map<string, string>;
      if (topologyKnown) {
        effectiveParentById = new Map(groundTruth.map((p) => [p.id, p.trueParentId]));
      } else {
        // Discard the true parent links, keep only coordinates, and infer
        // using the real production algorithm -- not a stand-in for it.
        const rawForInference: RawPole[] = groundTruth.map((p) => ({
          id: p.id,
          lat: p.lat,
          lon: p.lon,
        }));
        const inferredEdges = inferTopology(dtId, dtLat, dtLon, rawForInference);
        effectiveParentById = new Map(inferredEdges.map((e) => [e.poleId, e.parentPoleId]));
      }

      for (const p of groundTruth) {
        const hasDevice = Math.random() < 0.91;
        poles.push({
          id: p.id,
          dtId,
          lat: p.lat,
          lon: p.lon,
          seqOnLine: topologyKnown ? p.seq : null,
          topologyConfidence: topologyKnown ? 'known' : 'inferred',
          effectiveParentPoleId: effectiveParentById.get(p.id) ?? dtId,
          hasDevice,
          deviceId: hasDevice ? `KSPDB-${dtId}-${String(deviceCounter++).padStart(5, '0')}` : null,
          pincode: Math.random() < 0.97 ? choice(PIN_POOL) : null,
        });
      }
    }
  }

  return { subStations, feeders, transformers, poles };
}
