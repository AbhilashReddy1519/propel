/**
 * Geometric topology inference for DTs with no recorded wiring order.
 *
 * Approach: Prim's-style minimum spanning tree rooted at the transformer,
 * with a tie-breaking preference for attaching to whichever candidate parent
 * currently has fewer children -- this biases the result toward a trunk-plus-
 * branches shape (like a real LT line) rather than a bushy hub, which is what
 * a plain nearest-neighbor MST can produce if poles cluster densely.
 *
 * Output must always be tagged topologyConfidence = "inferred" downstream --
 * this is a plausible guess from geometry, not verified wiring.
 */

export interface RawPole {
  id: string;
  lat: number;
  lon: number;
}

export interface InferredEdge {
  poleId: string;
  parentPoleId: string; // the DT's synthetic id for root-level poles
}

function haversineMeters(a: { lat: number; lon: number }, b: { lat: number; lon: number }): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lon - a.lon);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/**
 * dtId/dtLat/dtLon: the root. poles: every pole under this DT (no dtId field
 * needed here, caller already filtered to one DT).
 */
export function inferTopology(
  dtId: string,
  dtLat: number,
  dtLon: number,
  poles: RawPole[],
): InferredEdge[] {
  if (poles.length === 0) return [];

  type ConnectedNode = { id: string; lat: number; lon: number; childCount: number };

  const rootNode: ConnectedNode = { id: dtId, lat: dtLat, lon: dtLon, childCount: 0 };
  const connected: ConnectedNode[] = [rootNode];
  const connectedById = new Map<string, ConnectedNode>([[dtId, rootNode]]);
  const remaining = new Map<string, RawPole>(poles.map((p) => [p.id, p]));
  const edges: InferredEdge[] = [];

  while (remaining.size > 0) {
    let best: {
      poleId: string;
      parentId: string;
      distance: number;
      parentChildCount: number;
    } | null = null;

    for (const pole of remaining.values()) {
      for (const node of connected) {
        const distance = haversineMeters(pole, node);
        const candidate = {
          poleId: pole.id,
          parentId: node.id,
          distance,
          parentChildCount: node.childCount,
        };

        if (!best) {
          best = candidate;
          continue;
        }

        // Prefer strictly shorter distance. On a near-tie (within 5m,
        // roughly GPS accuracy noise), prefer the parent with fewer existing
        // children -- this is the "extend a chain, don't build a hub" bias.
        const isCloser = candidate.distance < best.distance - 5;
        const isNearTieButLessCrowded =
          Math.abs(candidate.distance - best.distance) <= 5 &&
          candidate.parentChildCount < best.parentChildCount;

        if (isCloser || isNearTieButLessCrowded) {
          best = candidate;
        }
      }
    }

    if (!best) break; // shouldn't happen, but avoid an infinite loop defensively

    edges.push({ poleId: best.poleId, parentPoleId: best.parentId });
    const parentNode = connectedById.get(best.parentId)!;
    parentNode.childCount += 1;

    const newPole = remaining.get(best.poleId)!;
    const newNode: ConnectedNode = {
      id: newPole.id,
      lat: newPole.lat,
      lon: newPole.lon,
      childCount: 0,
    };
    connected.push(newNode);
    connectedById.set(newNode.id, newNode);
    remaining.delete(best.poleId);
  }

  return edges;
}
