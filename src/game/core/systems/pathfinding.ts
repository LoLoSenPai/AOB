import type { GameState, TileCoord, Vec2 } from "../state/types";
import { isInsideMap } from "../state/types";
import { isTileWalkableForUnit, tileCenter, worldToTile } from "./mapQueries";

type NodeRecord = {
  tile: TileCoord;
  g: number;
  f: number;
  cameFrom?: string;
};

type NeighborStep = {
  tile: TileCoord;
  cost: number;
};

function key(tile: TileCoord): string {
  return `${tile.x},${tile.y}`;
}

function heuristic(a: TileCoord, b: TileCoord): number {
  const dx = Math.abs(a.x - b.x);
  const dy = Math.abs(a.y - b.y);
  return Math.max(dx, dy) + (Math.SQRT2 - 1) * Math.min(dx, dy);
}

export function findPath(state: GameState, from: Vec2, to: Vec2): Vec2[] {
  const start = worldToTile(from);
  const requestedGoal = worldToTile(to);
  const goal = resolveGoalTile(state, start, requestedGoal);

  if (!goal || !isInsideMap(state.map, goal.x, goal.y)) {
    return [];
  }

  const open = new Map<string, NodeRecord>();
  const closed = new Set<string>();
  const records = new Map<string, NodeRecord>();
  const startRecord: NodeRecord = {
    tile: start,
    g: 0,
    f: heuristic(start, goal),
  };

  open.set(key(start), startRecord);
  records.set(key(start), startRecord);

  let iterations = 0;
  while (open.size > 0 && iterations < 2200) {
    iterations += 1;
    let current: NodeRecord | undefined;
    let currentKey = "";
    for (const [candidateKey, record] of open) {
      if (!current || record.f < current.f) {
        current = record;
        currentKey = candidateKey;
      }
    }

    if (!current) {
      break;
    }

    if (current.tile.x === goal.x && current.tile.y === goal.y) {
      return reconstructPath(records, currentKey).map(tileCenter);
    }

    open.delete(currentKey);
    closed.add(currentKey);

    for (const neighbor of neighbors(state, current.tile)) {
      const neighborKey = key(neighbor.tile);
      if (closed.has(neighborKey) || !isTileWalkableForUnit(state, neighbor.tile)) {
        continue;
      }

      const tentativeG = current.g + neighbor.cost;
      const existing = records.get(neighborKey);
      if (!existing || tentativeG < existing.g) {
        const next: NodeRecord = {
          tile: neighbor.tile,
          g: tentativeG,
          f: tentativeG + heuristic(neighbor.tile, goal),
          cameFrom: currentKey,
        };
        records.set(neighborKey, next);
        open.set(neighborKey, next);
      }
    }
  }

  return [];
}

function neighbors(state: GameState, tile: TileCoord): NeighborStep[] {
  const offsets = [
    { x: 1, y: 0, cost: 1 },
    { x: -1, y: 0, cost: 1 },
    { x: 0, y: 1, cost: 1 },
    { x: 0, y: -1, cost: 1 },
    { x: 1, y: 1, cost: Math.SQRT2 },
    { x: 1, y: -1, cost: Math.SQRT2 },
    { x: -1, y: 1, cost: Math.SQRT2 },
    { x: -1, y: -1, cost: Math.SQRT2 },
  ] as const;

  return offsets.flatMap((offset) => {
    const next = { x: tile.x + offset.x, y: tile.y + offset.y };
    if (!isInsideMap(state.map, next.x, next.y)) {
      return [];
    }
    if (offset.x !== 0 && offset.y !== 0) {
      const sideA = { x: tile.x + offset.x, y: tile.y };
      const sideB = { x: tile.x, y: tile.y + offset.y };
      if (!isTileWalkableForUnit(state, sideA) || !isTileWalkableForUnit(state, sideB)) {
        return [];
      }
    }
    return [{ tile: next, cost: offset.cost }];
  });
}

function reconstructPath(records: Map<string, NodeRecord>, endKey: string): TileCoord[] {
  const reversed: TileCoord[] = [];
  let cursor: string | undefined = endKey;
  while (cursor) {
    const record = records.get(cursor);
    if (!record) {
      break;
    }
    reversed.push(record.tile);
    cursor = record.cameFrom;
  }
  reversed.reverse();
  return reversed.slice(1);
}

function resolveGoalTile(state: GameState, start: TileCoord, requestedGoal: TileCoord): TileCoord | undefined {
  if (!isInsideMap(state.map, requestedGoal.x, requestedGoal.y)) {
    return undefined;
  }
  if (isTileWalkableForUnit(state, requestedGoal)) {
    return requestedGoal;
  }

  let bestTile: TileCoord | undefined;
  let bestDistanceToGoal = Number.POSITIVE_INFINITY;
  let bestDistanceFromStart = Number.POSITIVE_INFINITY;

  for (let radius = 1; radius <= 12; radius += 1) {
    for (const candidate of ringTiles(requestedGoal, radius)) {
      if (!isInsideMap(state.map, candidate.x, candidate.y) || !isTileWalkableForUnit(state, candidate)) {
        continue;
      }

      const distanceToGoal = heuristic(candidate, requestedGoal);
      const distanceFromStart = heuristic(start, candidate);
      if (
        distanceToGoal < bestDistanceToGoal ||
        (distanceToGoal === bestDistanceToGoal && distanceFromStart < bestDistanceFromStart)
      ) {
        bestTile = candidate;
        bestDistanceToGoal = distanceToGoal;
        bestDistanceFromStart = distanceFromStart;
      }
    }

    if (bestTile) {
      return bestTile;
    }
  }

  return undefined;
}

function ringTiles(center: TileCoord, radius: number): TileCoord[] {
  const tiles: TileCoord[] = [];
  for (let y = center.y - radius; y <= center.y + radius; y += 1) {
    for (let x = center.x - radius; x <= center.x + radius; x += 1) {
      const onRing = x === center.x - radius || x === center.x + radius || y === center.y - radius || y === center.y + radius;
      if (onRing) {
        tiles.push({ x, y });
      }
    }
  }
  return tiles;
}
