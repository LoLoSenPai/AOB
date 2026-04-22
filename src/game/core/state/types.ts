import type { AgeId, PlayerId, ResourceType } from "../../data/constants";
import type { GameEntity, EntityId } from "../entities/types";

export type Vec2 = {
  x: number;
  y: number;
};

export type TileCoord = {
  x: number;
  y: number;
};

export type ResourceStock = Record<ResourceType, number>;

export type TileType = "grass" | "grassDark" | "path" | "dirt" | "water" | "deepWater" | "stoneGround" | "crystalGround";

export type MapState = {
  width: number;
  height: number;
  tileSize: number;
  tiles: TileType[];
};

export type AgeProgress = {
  targetAge: AgeId;
  remainingTicks: number;
  totalTicks: number;
};

export type PlayerState = {
  id: PlayerId;
  label: string;
  resources: ResourceStock;
  population: number;
  populationCap: number;
  age: AgeId;
  ageProgress?: AgeProgress;
};

export type SelectionState = {
  playerId: PlayerId;
  selectedIds: EntityId[];
};

export type GameMessage = {
  id: number;
  tick: number;
  text: string;
};

export type GameState = {
  tick: number;
  nextEntityNumber: number;
  nextMessageNumber: number;
  rngSeed: number;
  map: MapState;
  players: Record<PlayerId, PlayerState>;
  entities: Record<EntityId, GameEntity>;
  selection: SelectionState;
  messages: GameMessage[];
};

export function getTileIndex(map: MapState, x: number, y: number): number {
  return y * map.width + x;
}

export function isInsideMap(map: MapState, x: number, y: number): boolean {
  return x >= 0 && y >= 0 && x < map.width && y < map.height;
}

export function getTile(map: MapState, x: number, y: number): TileType {
  if (!isInsideMap(map, x, y)) {
    return "deepWater";
  }
  return map.tiles[getTileIndex(map, x, y)] ?? "deepWater";
}
