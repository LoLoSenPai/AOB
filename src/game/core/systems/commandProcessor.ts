import { PLAYER_ID, type PlayerId, type ResourceType } from "../../data/constants";
import {
  ageConfigs,
  applyCost,
  buildingConfigs,
  canAfford,
  costForBuilding,
  hasReachedAge,
  labelForBuilding,
  resourceConfigs,
  unitConfigs,
} from "../../data/definitions";
import type { GameCommand } from "../commands/types";
import type { EntityId, GameEntity } from "../entities/types";
import { createBuilding } from "../state/entityFactory";
import { addMessage } from "../state/createInitialState";
import type { GameState, TileCoord, Vec2 } from "../state/types";
import { clampToMap, findNearestFreeAdjacentTile, isRectBuildable, tileCenter } from "./mapQueries";
import { findPath } from "./pathfinding";

export function applyCommand(state: GameState, command: GameCommand): void {
  switch (command.type) {
    case "selectUnits":
      applySelection(state, command.playerId, command.entityIds);
      break;
    case "moveUnits":
      applyMove(state, command.playerId, command.unitIds, command.target);
      break;
    case "gatherResource":
      applyGather(state, command.playerId, command.unitIds, command.resourceId);
      break;
    case "attackTarget":
      applyAttack(state, command.playerId, command.unitIds, command.targetId);
      break;
    case "buildStructure":
      applyBuildStructure(state, command.playerId, command.buildingType, command.tile, command.builderIds);
      break;
    case "buildWallLine":
      applyBuildWallLine(state, command.playerId, command.start, command.end, command.builderIds);
      break;
    case "trainUnit":
      applyTrainUnit(state, command.playerId, command.buildingId, command.unitType);
      break;
    case "advanceAge":
      applyAdvanceAge(state, command.playerId, command.targetAge);
      break;
    case "reseedFarm":
      applyReseedFarm(state, command.playerId, command.farmId);
      break;
    case "queueResearch":
    case "cancelPlacement":
      break;
  }
}

function applySelection(state: GameState, playerId: PlayerId, entityIds: EntityId[]): void {
  const selectedIds = entityIds.filter((id) => {
    const entity = state.entities[id];
    return Boolean(entity && (entity.ownerId === playerId || entity.kind === "resource"));
  });
  state.selection = {
    playerId,
    selectedIds,
  };
}

function applyMove(state: GameState, playerId: PlayerId, unitIds: EntityId[], target: Vec2): void {
  const movableUnits = unitIds
    .map((id) => state.entities[id])
    .filter((entity): entity is GameEntity => Boolean(entity?.mobile && entity.ownerId === playerId));
  const clampedTarget = clampToMap(state.map, target);
  const formation = formationOffsets(movableUnits.length);

  movableUnits.forEach((entity, index) => {
    if (!entity.mobile) {
      return;
    }
    const offset = formation[index] ?? { x: 0, y: 0 };
    const destination = {
      x: clampedTarget.x + offset.x,
      y: clampedTarget.y + offset.y,
    };
    entity.mobile.target = destination;
    entity.mobile.path = findPath(state, entity.position, destination);
    entity.visualState = "walking";
    if (entity.worker) {
      delete entity.worker.task;
    }
    if (entity.combat) {
      delete entity.combat.targetId;
    }
  });
}

function applyGather(state: GameState, playerId: PlayerId, unitIds: EntityId[], resourceId: EntityId): void {
  const target = state.entities[resourceId];
  if (!isGatherableTarget(target)) {
    return;
  }

  for (const id of unitIds) {
    const unit = state.entities[id];
    if (!unit?.worker || !unit.mobile || unit.ownerId !== playerId) {
      continue;
    }
    unit.worker.task = {
      kind: "gather",
      resourceId,
      phase: "toResource",
      cooldownTicks: 0,
    };
    unit.mobile.target = target.position;
    unit.mobile.path = findPath(state, unit.position, target.position);
    unit.visualState = "walking";
  }
}

function applyAttack(state: GameState, playerId: PlayerId, unitIds: EntityId[], targetId: EntityId): void {
  const target = state.entities[targetId];
  if (!target?.health || target.ownerId === playerId) {
    return;
  }

  for (const id of unitIds) {
    const unit = state.entities[id];
    if (!unit?.combat || unit.ownerId !== playerId) {
      continue;
    }
    unit.combat.targetId = targetId;
    if (unit.mobile) {
      unit.mobile.target = target.position;
      unit.mobile.path = findPath(state, unit.position, target.position);
    }
    if (unit.worker) {
      delete unit.worker.task;
    }
  }
}

function applyBuildStructure(
  state: GameState,
  playerId: PlayerId,
  buildingType: keyof typeof buildingConfigs,
  tile: { x: number; y: number },
  builderIds: EntityId[],
): void {
  const player = state.players[playerId];
  const config = buildingConfigs[buildingType];
  if (!config || !player || !hasReachedAge(player.age, config.unlockedAge)) {
    addMessage(state, "This structure is not unlocked yet.");
    return;
  }
  const cost = costForBuilding(buildingType, player.age);
  if (!canAfford(player.resources, cost)) {
    addMessage(state, "Not enough resources.");
    return;
  }
  if (!isRectBuildable(state, tile, config.footprint)) {
    addMessage(state, "Cannot build there.");
    return;
  }

  player.resources = applyCost(player.resources, cost, -1);
  const completed = config.buildTicks <= 1;
  const building = createBuilding(state, buildingType, playerId, tile, completed);
  state.entities[building.id] = building;

  for (const id of builderIds) {
    const builder = state.entities[id];
    if (!builder?.worker || !builder.mobile || builder.ownerId !== playerId) {
      continue;
    }
    builder.worker.task = {
      kind: "build",
      buildingId: building.id,
    };
    builder.mobile.target = building.position;
    builder.mobile.path = findPath(state, builder.position, building.position);
    builder.visualState = "walking";
  }

  addMessage(state, `${labelForBuilding(buildingType, player.age)} placed.`);
}

function applyBuildWallLine(state: GameState, playerId: PlayerId, start: TileCoord, end: TileCoord, builderIds: EntityId[]): void {
  const player = state.players[playerId];
  const config = buildingConfigs.wall;
  const tiles = wallLineTiles(start, end);
  if (!player || !hasReachedAge(player.age, config.unlockedAge)) {
    addMessage(state, "Walls are not unlocked yet.");
    return;
  }
  if (tiles.length === 0) {
    return;
  }
  if (!tiles.every((tile) => isRectBuildable(state, tile, config.footprint))) {
    addMessage(state, "Cannot build wall there.");
    return;
  }

  const totalCost = multiplyCost(costForBuilding("wall", player.age), tiles.length);
  if (!canAfford(player.resources, totalCost)) {
    addMessage(state, "Not enough resources.");
    return;
  }

  player.resources = applyCost(player.resources, totalCost, -1);
  const wallIds: EntityId[] = [];
  for (const tile of tiles) {
    const wall = createBuilding(state, "wall", playerId, tile, false);
    state.entities[wall.id] = wall;
    wallIds.push(wall.id);
  }

  builderIds.forEach((id, index) => {
    const builder = state.entities[id];
    const wallId = wallIds[index % wallIds.length];
    const wall = wallId ? state.entities[wallId] : undefined;
    if (!builder?.worker || !builder.mobile || !wall || builder.ownerId !== playerId) {
      return;
    }
    builder.worker.task = {
      kind: "build",
      buildingId: wall.id,
    };
    builder.mobile.target = wall.position;
    builder.mobile.path = findPath(state, builder.position, wall.position);
    builder.visualState = "walking";
  });

  addMessage(state, `${tiles.length} ${labelForBuilding("wall", player.age).toLowerCase()} segment${tiles.length > 1 ? "s" : ""} placed.`);
}

function applyTrainUnit(state: GameState, playerId: PlayerId, buildingId: EntityId, unitType: keyof typeof unitConfigs): void {
  const player = state.players[playerId];
  const building = state.entities[buildingId];
  const unitConfig = unitConfigs[unitType];
  if (!player || !building?.producer || !building.building?.completed || building.ownerId !== playerId) {
    return;
  }
  const buildingConfig = buildingConfigs[building.building.type];
  if (!buildingConfig.producer?.includes(unitType) || !hasReachedAge(player.age, unitConfig.unlockedAge)) {
    addMessage(state, "Unit is not available here.");
    return;
  }
  if (building.producer.queue.length >= 5) {
    addMessage(state, "Production queue is full.");
    return;
  }
  if (player.population + unitConfig.population > player.populationCap) {
    addMessage(state, "Population cap reached. Build houses.");
    return;
  }
  if (!canAfford(player.resources, unitConfig.cost)) {
    addMessage(state, "Not enough resources.");
    return;
  }

  player.resources = applyCost(player.resources, unitConfig.cost, -1);
  building.producer.queue.push({
    id: `q_${state.tick}_${building.producer.queue.length}`,
    unitType,
    remainingTicks: unitConfig.trainTicks,
    totalTicks: unitConfig.trainTicks,
  });
  addMessage(state, `${unitConfig.label} queued.`);
}

function applyAdvanceAge(state: GameState, playerId: PlayerId, explicitTarget?: keyof typeof ageConfigs): void {
  const player = state.players[playerId];
  if (!player || player.ageProgress) {
    return;
  }
  const currentAge = ageConfigs[player.age];
  const targetAge = explicitTarget ?? currentAge.nextAge;
  if (!targetAge) {
    addMessage(state, "Final age reached.");
    return;
  }
  const targetConfig = ageConfigs[targetAge];
  if (!canAfford(player.resources, currentAge.advanceCost)) {
    addMessage(state, "Not enough resources to advance age.");
    return;
  }
  player.resources = applyCost(player.resources, currentAge.advanceCost, -1);
  player.ageProgress = {
    targetAge,
    remainingTicks: currentAge.advanceTicks,
    totalTicks: currentAge.advanceTicks,
  };
  addMessage(state, `Advancing to ${targetConfig.label}.`);
}

function applyReseedFarm(state: GameState, playerId: PlayerId, farmId: EntityId): void {
  const player = state.players[playerId];
  const farm = state.entities[farmId];
  if (!player || !farm?.farm || !farm.building?.completed || farm.ownerId !== playerId) {
    return;
  }
  if (!farm.farm.depleted && farm.farm.food > 0) {
    addMessage(state, "Farm is not depleted.");
    return;
  }
  if (!canAfford(player.resources, farm.farm.reseedCost)) {
    addMessage(state, "Not enough wood to reseed farm.");
    return;
  }
  player.resources = applyCost(player.resources, farm.farm.reseedCost, -1);
  farm.farm.food = farm.farm.maxFood;
  farm.farm.depleted = false;
  addMessage(state, "Farm reseeded.");
}

function wallLineTiles(start: TileCoord, end: TileCoord): TileCoord[] {
  const horizontal = Math.abs(end.x - start.x) >= Math.abs(end.y - start.y);
  const fixed = horizontal ? start.y : start.x;
  const from = horizontal ? Math.min(start.x, end.x) : Math.min(start.y, end.y);
  const to = horizontal ? Math.max(start.x, end.x) : Math.max(start.y, end.y);
  const tiles: TileCoord[] = [];
  for (let value = from; value <= to; value += 1) {
    tiles.push(horizontal ? { x: value, y: fixed } : { x: fixed, y: value });
  }
  return tiles;
}

function multiplyCost(cost: Partial<Record<ResourceType, number>>, multiplier: number): Partial<Record<ResourceType, number>> {
  return {
    food: cost.food ? cost.food * multiplier : undefined,
    wood: cost.wood ? cost.wood * multiplier : undefined,
    stone: cost.stone ? cost.stone * multiplier : undefined,
    gold: cost.gold ? cost.gold * multiplier : undefined,
  };
}

function isGatherableTarget(entity: GameEntity | undefined): entity is GameEntity {
  if (!entity) {
    return false;
  }
  if (entity.resourceNode) {
    return entity.resourceNode.amount > 0;
  }
  return Boolean(entity.farm && entity.building?.completed && !entity.farm.depleted && entity.farm.food > 0);
}

function formationOffsets(count: number): Vec2[] {
  if (count <= 1) {
    return [{ x: 0, y: 0 }];
  }
  const offsets: Vec2[] = [];
  const spacing = 16;
  const columns = Math.ceil(Math.sqrt(count));
  for (let i = 0; i < count; i += 1) {
    const col = i % columns;
    const row = Math.floor(i / columns);
    offsets.push({
      x: (col - (columns - 1) / 2) * spacing,
      y: (row - (columns - 1) / 2) * spacing,
    });
  }
  return offsets;
}

export function orderUnitsToEntity(state: GameState, playerId: PlayerId, unitIds: EntityId[], target: GameEntity): void {
  if (target.resourceNode || target.farm) {
    applyGather(state, playerId, unitIds, target.id);
    return;
  }
  if (target.ownerId && target.ownerId !== playerId) {
    applyAttack(state, playerId, unitIds, target.id);
    return;
  }

  const adjacent = findNearestFreeAdjacentTile(state, target);
  applyMove(state, playerId, unitIds, adjacent ? tileCenter(adjacent) : target.position);
}

export function selectedPlayerUnits(state: GameState): EntityId[] {
  return state.selection.selectedIds.filter((id) => {
    const entity = state.entities[id];
    return entity?.kind === "unit" && entity.ownerId === PLAYER_ID;
  });
}

export function resourceStockLabel(type: ResourceType): string {
  return resourceConfigs[type === "food" ? "berries" : type === "wood" ? "tree" : type].label;
}
