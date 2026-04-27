import { ENEMY_ID, PLAYER_ID, TILE_SIZE, type PlayerId } from "../../data/constants";
import { FARM_CONFIG, buildingConfigs, maxHealthForBuilding, resourceConfigs, unitConfigs } from "../../data/definitions";
import type {
  BuildingType,
  EntityId,
  GameEntity,
  ResourceNodeType,
  UnitType,
} from "../entities/types";
import type { GameState, TileCoord, Vec2 } from "./types";

export function allocateEntityId(state: GameState, prefix: string): EntityId {
  const id = `${prefix}_${state.nextEntityNumber}`;
  state.nextEntityNumber += 1;
  return id;
}

export function worldFromTile(tile: TileCoord, footprint = { w: 1, h: 1 }): Vec2 {
  return {
    x: (tile.x + footprint.w / 2) * TILE_SIZE,
    y: (tile.y + footprint.h / 2) * TILE_SIZE,
  };
}

export function createUnit(
  state: GameState,
  type: UnitType,
  ownerId: PlayerId,
  position: Vec2,
  id = allocateEntityId(state, type),
): GameEntity {
  const config = unitConfigs[type];
  const entity: GameEntity = {
    id,
    kind: "unit",
    label: config.label,
    ownerId,
    position: { ...position },
    radius: 7,
    visualState: "idle",
    unit: { type },
    health: {
      current: config.maxHealth,
      max: config.maxHealth,
    },
    mobile: {
      speed: config.speed,
      path: [],
    },
  };

  if (config.canGather) {
    entity.worker = {
      carryCapacity: config.carryCapacity ?? 10,
      gatherTicks: config.gatherTicks ?? 20,
      buildPower: config.buildPower ?? 1,
    };
  }

  if (config.combat) {
    entity.combat = {
      damage: config.combat.damage,
      range: config.combat.range,
      cooldownTicks: config.combat.cooldownTicks,
      cooldownRemaining: 0,
      aggroRange: config.combat.aggroRange,
    };
  }

  if (ownerId === ENEMY_ID) {
    entity.ai = {
      behavior: "guard",
      anchor: { ...position },
      leashRange: 150,
    };
  }

  if (ownerId === PLAYER_ID && config.population > 0) {
    state.players[PLAYER_ID].population += config.population;
  }

  return entity;
}

export function createBuilding(
  state: GameState,
  type: BuildingType,
  ownerId: PlayerId,
  tile: TileCoord,
  completed: boolean,
  id = allocateEntityId(state, type),
): GameEntity {
  const config = buildingConfigs[type];
  const maxHealth = maxHealthForBuilding(type, state.players[ownerId]?.age ?? config.unlockedAge);
  const buildProgress = completed ? config.buildTicks : 0;
  const entity: GameEntity = {
    id,
    kind: "building",
    label: config.label,
    ownerId,
    tile: { ...tile },
    position: worldFromTile(tile, config.footprint),
    radius: Math.max(config.footprint.w, config.footprint.h) * TILE_SIZE * 0.5,
    visualState: "idle",
    health: {
      current: completed ? maxHealth : 1,
      max: maxHealth,
    },
    building: {
      type,
      completed,
      buildProgress,
      buildTimeTicks: config.buildTicks,
      footprint: { ...config.footprint },
    },
  };

  if (config.storage) {
    entity.storage = {
      accepts: [...config.storage],
    };
  }

  if (config.producer) {
    entity.producer = {
      queue: [],
    };
  }

  if (type === "farm") {
    entity.farm = {
      resourceType: "food",
      food: FARM_CONFIG.maxFood,
      maxFood: FARM_CONFIG.maxFood,
      gatherAmount: FARM_CONFIG.gatherAmount,
      reseedCost: { ...FARM_CONFIG.reseedCost },
      depleted: false,
    };
  }

  if (completed && ownerId === PLAYER_ID && config.providesPopulation) {
    state.players[PLAYER_ID].populationCap += config.providesPopulation;
  }

  return entity;
}

export function createResourceNode(
  state: GameState,
  type: ResourceNodeType,
  tile: TileCoord,
  id = allocateEntityId(state, type),
): GameEntity {
  const config = resourceConfigs[type];
  return {
    id,
    kind: "resource",
    label: config.label,
    tile: { ...tile },
    position: worldFromTile(tile),
    radius: config.radius,
    visualState: "idle",
    resourceNode: {
      type,
      resourceType: config.resourceType,
      amount: config.amount,
      maxAmount: config.amount,
      gatherAmount: config.gatherAmount,
    },
  };
}
