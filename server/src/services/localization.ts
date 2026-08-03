/**
 * Localization engine.
 *
 * Core idea (see ARCHITECTURE.md for the full write-up):
 *   - The network under one transformer is a tree (poles = nodes, spans = edges).
 *   - A real line fault shows up as a "frontier": a live pole whose child is dark.
 *   - A dark pole with a LIVE descendant is impossible as a real fault -- it means
 *     that pole's own sensor is lying, not that the line is broken there.
 *   - Multiple simultaneous faults fall out for free: walk every leaf up to the
 *     first live ancestor, collect all frontier edges, then DEDUPE BY EDGE
 *     (not by leaf) so that two branches dying from the same upstream break
 *     collapse into one incident instead of two.
 */

export type LiveState = "live" | "dark" | "unknown";

export interface PoleNode {
  id: string;
  parentId: string | null;
  state: LiveState;
  hasDevice: boolean;
}

export interface FrontierEdge {
  parentPoleId: string | null; // null => fault is at the DT itself (root)
  childPoleId: string;
  affectedPoleIds: string[]; // full dark subtree below this edge
  confidenceHint: "high" | "inferred" | "range";
  reasoning: string;
}

/**
 * Build a simple id -> node lookup and id -> children[] index once per run.
 * Cheap: DTs have at most ~240 poles, so this is O(n) and instant.
 */
function indexTree(poles: PoleNode[]) {
  const byId = new Map<string, PoleNode>();
  const childrenOf = new Map<string, string[]>();

  for (const p of poles) {
    byId.set(p.id, p);
    if (!childrenOf.has(p.id)) childrenOf.set(p.id, []);
  }
  for (const p of poles) {
    if (p.parentId) {
      if (!childrenOf.has(p.parentId)) childrenOf.set(p.parentId, []);
      childrenOf.get(p.parentId)!.push(p.id);
    }
  }
  return { byId, childrenOf };
}

/**
 * Returns true if `poleId` has at least one descendant currently LIVE.
 * This is the "impossible fault" check: a dark pole with a live descendant
 * means the dark reading is a bad sensor, not a real break.
 */
function hasLiveDescendant(
  poleId: string,
  childrenOf: Map<string, string[]>,
  byId: Map<string, PoleNode>
): boolean {
  const stack = [...(childrenOf.get(poleId) ?? [])];
  while (stack.length) {
    const cur = stack.pop()!;
    const node = byId.get(cur);
    if (node?.state === "live") return true;
    stack.push(...(childrenOf.get(cur) ?? []));
  }
  return false;
}

/** Collects every pole in the dark subtree rooted at `poleId` (inclusive). */
function collectDarkSubtree(
  poleId: string,
  childrenOf: Map<string, string[]>,
  byId: Map<string, PoleNode>
): string[] {
  const out: string[] = [];
  const stack = [poleId];
  while (stack.length) {
    const cur = stack.pop()!;
    const node = byId.get(cur);
    if (!node) continue;
    if (node.state === "dark" || node.state === "unknown") {
      out.push(cur);
      stack.push(...(childrenOf.get(cur) ?? []));
    }
  }
  return out;
}

/**
 * Main entry point: given every pole under one DT (with current state and
 * parent pointers -- either known or geometrically inferred), return the
 * distinct frontier edges. One frontier edge = one incident.
 *
 * topologyConfidence should be "known" or "inferred" for the whole DT (all
 * poles under an inferred-topology DT are inferred together).
 */
export function findFrontiers(
  poles: PoleNode[],
  topologyConfidence: "known" | "inferred"
): FrontierEdge[] {
  const { byId, childrenOf } = indexTree(poles);
  const seenEdges = new Set<string>(); // dedupe key: `${parentId}->${childId}`
  const frontiers: FrontierEdge[] = [];

  // Leaves = poles with no children.
  const leaves = poles.filter((p) => (childrenOf.get(p.id) ?? []).length === 0);

  for (const leaf of leaves) {
    let cur: PoleNode | undefined = leaf;

    // Walk upward from the leaf until we find a dark node whose parent is
    // live (or root) -- that parent->cur edge is the frontier for this path.
    while (cur) {
      const isDarkish = cur.state === "dark" || cur.state === "unknown";
      if (!isDarkish) {
        // This node is live; nothing wrong on this path above here.
        break;
      }

      const parent: PoleNode | undefined = cur.parentId
        ? byId.get(cur.parentId)
        : undefined;

      const parentIsLiveOrRoot = !cur.parentId || parent?.state === "live";

      if (parentIsLiveOrRoot) {
        // Sanity check: does `cur` have a live descendant? If so this dark
        // reading is a bad sensor, not a real fault -- skip it, don't ticket it.
        if (hasLiveDescendant(cur.id, childrenOf, byId)) {
          break; // sensor-suspect; handled by a separate "suspect sensor" flag, not a frontier
        }

        const edgeKey = `${cur.parentId ?? "ROOT"}->${cur.id}`;
        if (!seenEdges.has(edgeKey)) {
          seenEdges.add(edgeKey);
          const affected = collectDarkSubtree(cur.id, childrenOf, byId);
          const noDeviceOnBoundary = !cur.hasDevice;

          frontiers.push({
            parentPoleId: cur.parentId,
            childPoleId: cur.id,
            affectedPoleIds: affected,
            confidenceHint: noDeviceOnBoundary
              ? "range"
              : topologyConfidence === "known"
              ? "high"
              : "inferred",
            reasoning: cur.parentId
              ? `Live at ${cur.parentId}, dark at ${cur.id} (${topologyConfidence} topology)`
              : `Entire DT subtree dark from root -- likely DT/fuse fault`,
          });
        }
        break; // done with this leaf's path
      }

      // Parent also dark/unknown -- keep walking upward.
      cur = parent;
    }
  }

  return frontiers;
}
