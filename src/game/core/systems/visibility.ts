import { PLAYER_ID, TILE_SIZE, type PlayerId } from "../../data/constants";
import type { BuildingType, GameEntity, UnitType } from "../entities/types";
import type { GameState, TileCoord, VisibilityState } from "../state/types";
import { worldToTile } from "./mapQueries";

export function createVisibilityState(width: number, height: number): VisibilityState {
  return {
    exploredTiles: Array.from({ length: width * height }, () => false),
  };
}

export function revealPlayerVision(state: GameState, playerId: PlayerId = PLAYER_ID): void {
  for (const entity of Object.values(state.entities)) {
    if (entity.ownerId !== playerId) {
      continue;
    }
    const radius = visionRadiusForEntity(entity);
    if (radius <= 0) {
      continue;
    }
    revealAroundTile(state, worldToTile(entity.position), radius);
  }
}

export function isTileExplored(state: GameState, tile: TileCoord): boolean {
  if (tile.x < 0 || tile.y < 0 || tile.x >= state.map.width || tile.y >= state.map.height) {
    return false;
  }
  return Boolean(state.visibility.exploredTiles[tile.y * state.map.width + tile.x]);
}

export function isWorldPositionExplored(state: GameState, position: { x: number; y: number }): boolean {
  return isTileExplored(state, worldToTile(position));
}

export function exploredTileCount(state: GameState): number {
  return state.visibility.exploredTiles.reduce((total, explored) => total + (explored ? 1 : 0), 0);
}

export function exploredTileRatio(state: GameState): number {
  const total = state.map.width * state.map.height;
  return total > 0 ? exploredTileCount(state) / total : 0;
}

function revealAroundTile(state: GameState, center: TileCoord, radius: number): void {
  const radiusSquared = radius * radius;
  for (let y = center.y - radius; y <= center.y + radius; y += 1) {
    if (y < 0 || y >= state.map.height) {
      continue;
    }
    for (let x = center.x - radius; x <= center.x + radius; x += 1) {
      if (x < 0 || x >= state.map.width) {
        continue;
      }
      const dx = x - center.x;
      const dy = y - center.y;
      if (dx * dx + dy * dy > radiusSquared) {
        continue;
      }
      state.visibility.exploredTiles[y * state.map.width + x] = true;
    }
  }
}

function visionRadiusForEntity(entity: GameEntity): number {
  if (entity.unit) {
    return visionRadiusForUnit(entity.unit.type);
  }
  if (entity.building?.completed) {
    return visionRadiusForBuilding(entity.building.type);
  }
  return Math.max(4, Math.ceil(entity.radius / TILE_SIZE) + 2);
}

function visionRadiusForUnit(type: UnitType): number {
  switch (type) {
    case "scout":
      return 18;
    case "worker":
      return 8;
    case "archer":
    case "soldier":
      return 10;
    default:
      return 7;
  }
}

function visionRadiusForBuilding(type: BuildingType): number {
  switch (type) {
    case "townCenter":
      return 17;
    case "watchTower":
      return 19;
    case "stable":
    case "barracks":
      return 12;
    default:
      return 9;
  }
}
