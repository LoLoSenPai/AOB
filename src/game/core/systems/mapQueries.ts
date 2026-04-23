import { TILE_SIZE } from "../../data/constants";
import type { PlayerId, ResourceType } from "../../data/constants";
import type { EntityId, Footprint, GameEntity } from "../entities/types";
import type { GameState, MapState, TileCoord, Vec2 } from "../state/types";
import { getTile, isInsideMap } from "../state/types";

export function tileCenter(tile: TileCoord): Vec2 {
  return {
    x: tile.x * TILE_SIZE + TILE_SIZE / 2,
    y: tile.y * TILE_SIZE + TILE_SIZE / 2,
  };
}

export function worldToTile(position: Vec2): TileCoord {
  return {
    x: Math.floor(position.x / TILE_SIZE),
    y: Math.floor(position.y / TILE_SIZE),
  };
}

export function distance(a: Vec2, b: Vec2): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

export function isTerrainWalkable(map: MapState, tile: TileCoord): boolean {
  const tileType = getTile(map, tile.x, tile.y);
  return isInsideMap(map, tile.x, tile.y) && tileType !== "water" && tileType !== "deepWater";
}

export function footprintTiles(tile: TileCoord, footprint: Footprint): TileCoord[] {
  const tiles: TileCoord[] = [];
  for (let y = 0; y < footprint.h; y += 1) {
    for (let x = 0; x < footprint.w; x += 1) {
      tiles.push({ x: tile.x + x, y: tile.y + y });
    }
  }
  return tiles;
}

export function entityFootprint(entity: GameEntity): { tile: TileCoord; footprint: Footprint } | undefined {
  if (entity.building && entity.tile) {
    return {
      tile: entity.tile,
      footprint: entity.building.footprint,
    };
  }

  if (entity.resourceNode && entity.tile) {
    return {
      tile: entity.tile,
      footprint: { w: 1, h: 1 },
    };
  }

  return undefined;
}

export function isTileOccupiedByStructure(state: GameState, tile: TileCoord, ignoreId?: EntityId): boolean {
  return Object.values(state.entities).some((entity) => {
    if (entity.id === ignoreId) {
      return false;
    }
    const footprint = entityFootprint(entity);
    if (!footprint) {
      return false;
    }
    return footprintTiles(footprint.tile, footprint.footprint).some((occupied) => occupied.x === tile.x && occupied.y === tile.y);
  });
}

export function isTileWalkableForUnit(state: GameState, tile: TileCoord, ignoreId?: EntityId): boolean {
  return isTerrainWalkable(state.map, tile) && !isTileOccupiedByStructure(state, tile, ignoreId);
}

export function isRectBuildable(state: GameState, tile: TileCoord, footprint: Footprint): boolean {
  return footprintTiles(tile, footprint).every((candidate) => {
    const terrain = getTile(state.map, candidate.x, candidate.y);
    return isInsideMap(state.map, candidate.x, candidate.y) && terrain !== "water" && terrain !== "deepWater" && !isTileOccupiedByStructure(state, candidate);
  });
}

export function findNearestStorage(state: GameState, from: Vec2, resourceType: ResourceType, ownerId: PlayerId): GameEntity | undefined {
  let best: GameEntity | undefined;
  let bestDistance = Number.POSITIVE_INFINITY;

  for (const entity of Object.values(state.entities)) {
    if (entity.ownerId !== ownerId || !entity.storage || !entity.building?.completed) {
      continue;
    }
    if (!entity.storage.accepts.includes(resourceType)) {
      continue;
    }

    const candidateDistance = distance(from, entity.position);
    if (candidateDistance < bestDistance) {
      best = entity;
      bestDistance = candidateDistance;
    }
  }

  return best;
}

export function findFreeAdjacentTiles(state: GameState, around: GameEntity, from = around.position): TileCoord[] {
  const origin = around.tile ?? worldToTile(around.position);
  const footprint = around.building?.footprint ?? { w: 1, h: 1 };
  const candidates: TileCoord[] = [];

  for (let y = origin.y - 1; y <= origin.y + footprint.h; y += 1) {
    for (let x = origin.x - 1; x <= origin.x + footprint.w; x += 1) {
      const isEdge = x < origin.x || y < origin.y || x >= origin.x + footprint.w || y >= origin.y + footprint.h;
      if (isEdge) {
        candidates.push({ x, y });
      }
    }
  }

  return candidates
    .filter((tile) => isTileWalkableForUnit(state, tile))
    .sort((a, b) => distance(tileCenter(a), from) - distance(tileCenter(b), from));
}

export function findNearestFreeAdjacentTile(state: GameState, around: GameEntity, from = around.position): TileCoord | undefined {
  return findFreeAdjacentTiles(state, around, from)[0];
}

export function clampToMap(map: MapState, position: Vec2): Vec2 {
  return {
    x: Math.max(0, Math.min(map.width * TILE_SIZE - 1, position.x)),
    y: Math.max(0, Math.min(map.height * TILE_SIZE - 1, position.y)),
  };
}
