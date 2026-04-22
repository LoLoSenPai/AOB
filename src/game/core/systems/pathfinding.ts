import type { GameState, TileCoord, Vec2 } from "../state/types";
import { isInsideMap } from "../state/types";
import { isTileWalkableForUnit, tileCenter, worldToTile } from "./mapQueries";

type NodeRecord = {
  tile: TileCoord;
  g: number;
  f: number;
  cameFrom?: string;
};

function key(tile: TileCoord): string {
  return `${tile.x},${tile.y}`;
}

function heuristic(a: TileCoord, b: TileCoord): number {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
}

export function findPath(state: GameState, from: Vec2, to: Vec2): Vec2[] {
  const start = worldToTile(from);
  const goal = worldToTile(to);

  if (!isInsideMap(state.map, goal.x, goal.y)) {
    return [];
  }

  if (!isTileWalkableForUnit(state, goal)) {
    return [to];
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

    for (const neighbor of neighbors(current.tile)) {
      const neighborKey = key(neighbor);
      if (closed.has(neighborKey) || !isTileWalkableForUnit(state, neighbor)) {
        continue;
      }

      const tentativeG = current.g + 1;
      const existing = records.get(neighborKey);
      if (!existing || tentativeG < existing.g) {
        const next: NodeRecord = {
          tile: neighbor,
          g: tentativeG,
          f: tentativeG + heuristic(neighbor, goal),
          cameFrom: currentKey,
        };
        records.set(neighborKey, next);
        open.set(neighborKey, next);
      }
    }
  }

  return [to];
}

function neighbors(tile: TileCoord): TileCoord[] {
  return [
    { x: tile.x + 1, y: tile.y },
    { x: tile.x - 1, y: tile.y },
    { x: tile.x, y: tile.y + 1 },
    { x: tile.x, y: tile.y - 1 },
  ];
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
