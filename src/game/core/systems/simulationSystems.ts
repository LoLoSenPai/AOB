import { ENEMY_ID, PLAYER_ID, TILE_SIZE } from "../../data/constants";
import { ageConfigs, buildingConfigs, maxHealthForBuilding, resourceConfigs, unitConfigs } from "../../data/definitions";
import type { EntityId, GameEntity } from "../entities/types";
import { completedObjectiveIdsInOrder, objectiveTitle } from "../selectors/objectives";
import { createUnit } from "../state/entityFactory";
import { addMessage } from "../state/createInitialState";
import type { GameState, TileCoord } from "../state/types";
import {
  distance,
  findFreeAdjacentTiles,
  findNearestFreeAdjacentTile,
  findNearestStorage,
  isRectBuildable,
  isTileWalkableForUnit,
  tileCenter,
  worldToTile,
} from "./mapQueries";
import { findPath } from "./pathfinding";
import { wallLineSegments } from "./wallPlacement";

export function runSimulationSystems(state: GameState): void {
  runAiSystem(state);
  runMovementSystem(state);
  runGatheringSystem(state);
  runResourceRegrowthSystem(state);
  runConstructionSystem(state);
  runProductionSystem(state);
  runCombatSystem(state);
  runProgressionSystem(state);
  runObjectiveSystem(state);
  runCleanupSystem(state);
}

function runMovementSystem(state: GameState): void {
  for (const entity of Object.values(state.entities)) {
    if (!entity.mobile) {
      continue;
    }

    if (entity.mobile.target && entity.mobile.path.length === 0) {
      const currentTile = worldToTile(entity.position);
      const targetTile = worldToTile(entity.mobile.target);
      const sameTile = currentTile.x === targetTile.x && currentTile.y === targetTile.y;
      if (!sameTile) {
        const reroute = findPath(state, entity.position, entity.mobile.target);
        if (reroute.length > 0) {
          entity.mobile.path = reroute;
        } else {
          delete entity.mobile.target;
        }
      }
    }

    const waypoint = entity.mobile.path[0] ?? entity.mobile.target;
    if (!waypoint) {
      if (entity.visualState === "walking") {
        entity.visualState = entity.worker?.carrying ? "carrying" : "idle";
      }
      continue;
    }

    const step = entity.mobile.speed / 20;
    const dx = waypoint.x - entity.position.x;
    const dy = waypoint.y - entity.position.y;
    const remaining = Math.hypot(dx, dy);
    if (remaining <= step) {
      entity.position = { ...waypoint };
      if (entity.mobile.path.length > 0) {
        entity.mobile.path.shift();
        if (entity.mobile.path.length === 0 && entity.mobile.target) {
          const currentTile = worldToTile(entity.position);
          const targetTile = worldToTile(entity.mobile.target);
          const reachedGoalTile = currentTile.x === targetTile.x && currentTile.y === targetTile.y;
          const blockedGoalTile = !isTileWalkableForUnit(state, targetTile, entity.id);
          const closeEnough = distance(entity.position, entity.mobile.target) <= step;
          if (reachedGoalTile || blockedGoalTile || closeEnough) {
            delete entity.mobile.target;
          }
        }
      } else {
        delete entity.mobile.target;
      }
    } else {
      const next = {
        x: entity.position.x + (dx / remaining) * step,
        y: entity.position.y + (dy / remaining) * step,
      };
      const tile = worldToTile(next);
      if (isTileWalkableForUnit(state, tile, entity.id)) {
        entity.position = next;
      } else if (entity.mobile.target) {
        entity.mobile.path = findPath(state, entity.position, entity.mobile.target);
      }
    }

    if (entity.mobile.target || entity.mobile.path.length > 0) {
      entity.visualState = entity.worker?.carrying ? "carrying" : "walking";
    }
  }
}

function runGatheringSystem(state: GameState): void {
  for (const worker of Object.values(state.entities)) {
    const task = worker.worker?.task;
    if (!task || task.kind !== "gather" || !worker.mobile || !worker.worker || worker.ownerId !== PLAYER_ID) {
      continue;
    }

    const target = state.entities[task.resourceId];
    const gatherable = getGatherable(target);
    if (!target || !gatherable || gatherable.amount <= 0) {
      if (target?.farm) {
        target.farm.depleted = true;
      }
      delete worker.worker.task;
      worker.visualState = "idle";
      continue;
    }

    if (task.phase === "toResource") {
      if (distance(worker.position, target.position) <= worker.radius + target.radius + 5) {
        task.phase = "gathering";
        task.cooldownTicks = worker.worker.gatherTicks;
        worker.visualState = "gathering";
        delete worker.mobile.target;
        worker.mobile.path = [];
      } else if (!worker.mobile.target && worker.mobile.path.length === 0) {
        worker.mobile.target = target.position;
        worker.mobile.path = findPath(state, worker.position, target.position);
      }
      continue;
    }

    if (task.phase === "gathering") {
      task.cooldownTicks -= 1;
      worker.visualState = "gathering";
      if (task.cooldownTicks > 0) {
        continue;
      }

      const gathered = Math.min(gatherable.amount, gatherable.gatherAmount, worker.worker.carryCapacity);
      setGatherableAmount(target, gatherable.amount - gathered);
      worker.worker.carrying = {
        type: gatherable.resourceType,
        amount: gathered,
      };

      const storage = findNearestStorage(state, worker.position, gatherable.resourceType, worker.ownerId);
      if (!storage) {
        delete worker.worker.task;
        continue;
      }
      task.phase = "toStorage";
      task.storageId = storage.id;
      worker.mobile.target = storage.position;
      worker.mobile.path = findPath(state, worker.position, storage.position);
      worker.visualState = "carrying";
      continue;
    }

    if (task.phase === "toStorage") {
      const storage = task.storageId ? state.entities[task.storageId] : undefined;
      if (!storage?.storage) {
        delete worker.worker.task;
        continue;
      }
      if (distance(worker.position, storage.position) <= worker.radius + storage.radius + 8) {
        const carried = worker.worker.carrying;
        if (carried) {
          state.players[PLAYER_ID].resources[carried.type] += carried.amount;
        }
        delete worker.worker.carrying;

        const nextGatherable = getGatherable(target);
        if (nextGatherable && nextGatherable.amount > 0) {
          task.phase = "toResource";
          delete task.storageId;
          worker.mobile.target = target.position;
          worker.mobile.path = findPath(state, worker.position, target.position);
          worker.visualState = "walking";
        } else {
          if (target.farm) {
            target.farm.depleted = true;
          }
          delete worker.worker.task;
          worker.visualState = "idle";
        }
      } else if (!worker.mobile.target && worker.mobile.path.length === 0) {
        worker.mobile.target = storage.position;
        worker.mobile.path = findPath(state, worker.position, storage.position);
      }
    }
  }
}

function getGatherable(entity: GameEntity | undefined): { resourceType: "food" | "wood" | "stone" | "gold"; amount: number; gatherAmount: number } | undefined {
  if (entity?.resourceNode) {
    return {
      resourceType: entity.resourceNode.resourceType,
      amount: entity.resourceNode.amount,
      gatherAmount: entity.resourceNode.gatherAmount,
    };
  }
  if (entity?.farm && entity.building?.completed && !entity.farm.depleted) {
    return {
      resourceType: entity.farm.resourceType,
      amount: entity.farm.food,
      gatherAmount: entity.farm.gatherAmount,
    };
  }
  return undefined;
}

function setGatherableAmount(entity: GameEntity, nextAmount: number): void {
  const amount = Math.max(0, nextAmount);
  if (entity.resourceNode) {
    entity.resourceNode.amount = amount;
    if (amount > 0) {
      delete entity.resourceNode.regrowTicksRemaining;
    }
    return;
  }
  if (entity.farm) {
    entity.farm.food = amount;
    entity.farm.depleted = amount <= 0;
  }
}

function runResourceRegrowthSystem(state: GameState): void {
  for (const entity of Object.values(state.entities)) {
    const node = entity.resourceNode;
    if (!node || node.amount > 0) {
      continue;
    }

    const regrowTicks = resourceConfigs[node.type].regrowTicks;
    if (!regrowTicks) {
      continue;
    }

    node.regrowTicksRemaining = node.regrowTicksRemaining ?? regrowTicks;
    node.regrowTicksRemaining -= 1;
    if (node.regrowTicksRemaining <= 0) {
      node.amount = node.maxAmount;
      delete node.regrowTicksRemaining;
    }
  }
}

function runConstructionSystem(state: GameState): void {
  const buildersByBuilding = new Map<EntityId, GameEntity[]>();

  for (const worker of Object.values(state.entities)) {
    const workerComponent = worker.worker;
    const task = workerComponent?.task;
    if (!workerComponent || !task || task.kind !== "build" || worker.ownerId !== PLAYER_ID) {
      continue;
    }

    const building = state.entities[task.buildingId];
    if (!building?.building || building.building.completed) {
      delete workerComponent.task;
      continue;
    }

    if (!isWorkerInConstructionRange(worker, building, task.approachTile)) {
      if (worker.mobile && (!worker.mobile.target || worker.mobile.path.length === 0)) {
        const approachTile =
          task.approachTile && isReachableConstructionTile(state, worker.position, task.approachTile)
            ? task.approachTile
            : findReachableConstructionTile(state, building, worker.position);
        if (!approachTile) {
          delete workerComponent.task;
          worker.visualState = "idle";
          continue;
        }
        if (approachTile) {
          task.approachTile = approachTile;
        }
        const target = approachTile ? tileCenter(approachTile) : building.position;
        worker.mobile.target = target;
        worker.mobile.path = pathToReachableTile(state, worker.position, approachTile) ?? [];
      }
      continue;
    }

    worker.visualState = "building";
    const list = buildersByBuilding.get(building.id) ?? [];
    list.push(worker);
    buildersByBuilding.set(building.id, list);
  }

  for (const [buildingId, builders] of buildersByBuilding) {
    const building = state.entities[buildingId];
    if (!building?.building || building.building.completed) {
      continue;
    }
    const buildPower = builders.reduce((sum, worker) => sum + (worker.worker?.buildPower ?? 0), 0);
    building.building.buildProgress += buildPower;
    const maxHealth = building.health?.max ?? 1;
    if (building.health) {
      building.health.current = Math.max(1, Math.round((building.building.buildProgress / building.building.buildTimeTicks) * maxHealth));
    }
    if (building.building.buildProgress >= building.building.buildTimeTicks) {
      completeBuilding(state, building);
      for (const worker of builders) {
        if (worker.worker?.task?.kind === "build" && worker.worker.task.buildingId === building.id) {
          if (building.building.type === "wall" && assignWorkerToNextWallConstruction(state, worker, building)) {
            continue;
          }
          delete worker.worker.task;
          if (worker.mobile) {
            delete worker.mobile.target;
            worker.mobile.path = [];
          }
          worker.visualState = "idle";
        }
      }
    }
  }
}

function isWorkerInConstructionRange(worker: GameEntity, building: GameEntity, approachTile: TileCoord | undefined): boolean {
  if (approachTile && distance(worker.position, tileCenter(approachTile)) <= TILE_SIZE * 0.55) {
    return true;
  }
  return distance(worker.position, building.position) <= worker.radius + building.radius + 6;
}

function assignWorkerToNextWallConstruction(state: GameState, worker: GameEntity, completedWall: GameEntity): boolean {
  const candidates = Object.values(state.entities)
    .filter(
      (entity) =>
        entity.id !== completedWall.id &&
        entity.ownerId === completedWall.ownerId &&
        entity.building?.type === "wall" &&
        !entity.building.completed,
    )
    .sort((a, b) => distance(worker.position, a.position) - distance(worker.position, b.position));

  for (const candidate of candidates) {
    if (assignWorkerToConstructionTarget(state, worker, candidate)) {
      return true;
    }
  }

  return false;
}

function assignWorkerToConstructionTarget(state: GameState, worker: GameEntity, building: GameEntity): boolean {
  if (!worker.worker || !worker.mobile || !building.building || building.building.completed) {
    return false;
  }

  const approachTile = findReachableConstructionTile(state, building, worker.position);
  if (!approachTile) {
    return false;
  }

  const path = pathToReachableTile(state, worker.position, approachTile);
  if (!path) {
    return false;
  }

  worker.worker.task = {
    kind: "build",
    buildingId: building.id,
    approachTile,
  };
  worker.mobile.target = tileCenter(approachTile);
  worker.mobile.path = path;
  worker.visualState = "walking";
  return true;
}

function findReachableConstructionTile(state: GameState, building: GameEntity, from: { x: number; y: number }): TileCoord | undefined {
  return findFreeAdjacentTiles(state, building, from).find((tile) => isReachableConstructionTile(state, from, tile));
}

function isReachableConstructionTile(state: GameState, from: { x: number; y: number }, tile: TileCoord): boolean {
  return pathToReachableTile(state, from, tile) !== undefined;
}

function pathToReachableTile(state: GameState, from: { x: number; y: number }, tile: TileCoord): { x: number; y: number }[] | undefined {
  const currentTile = worldToTile(from);
  if (currentTile.x === tile.x && currentTile.y === tile.y) {
    return [];
  }

  const path = findPath(state, from, tileCenter(tile));
  return path.length > 0 ? path : undefined;
}

function runProductionSystem(state: GameState): void {
  for (const building of Object.values(state.entities)) {
    if (!building.producer || !building.building?.completed || building.ownerId !== PLAYER_ID) {
      continue;
    }
    const item = building.producer.queue[0];
    if (!item) {
      continue;
    }
    item.remainingTicks -= 1;
    if (item.remainingTicks > 0) {
      continue;
    }
    const spawnTile = findNearestFreeAdjacentTile(state, building);
    if (!spawnTile) {
      item.remainingTicks = 5;
      continue;
    }
    const unit = createUnit(state, item.unitType, PLAYER_ID, tileCenter(spawnTile));
    assignProducedUnitToRally(state, building, unit);
    state.entities[unit.id] = unit;
    building.producer.queue.shift();
    addMessage(state, `${unitConfigs[item.unitType].label} trained.`);
  }
}

function assignProducedUnitToRally(state: GameState, building: GameEntity, unit: GameEntity): void {
  const rallyPoint = building.producer?.rallyPoint;
  if (!rallyPoint || !unit.mobile) {
    return;
  }
  unit.mobile.target = { ...rallyPoint };
  unit.mobile.path = findPath(state, unit.position, rallyPoint);
  if (unit.mobile.path.length > 0) {
    unit.visualState = "walking";
  }
}

function runCombatSystem(state: GameState): void {
  for (const entity of Object.values(state.entities)) {
    if (!entity.combat || !entity.health || entity.health.current <= 0) {
      continue;
    }
    if (entity.combat.cooldownRemaining > 0) {
      entity.combat.cooldownRemaining -= 1;
    }

    const target = entity.combat.targetId ? state.entities[entity.combat.targetId] : undefined;
    if (!target?.health || target.health.current <= 0 || target.ownerId === entity.ownerId) {
      delete entity.combat.targetId;
      if (entity.visualState === "attacking") {
        entity.visualState = "idle";
      }
      continue;
    }

    const targetDistance = distance(entity.position, target.position);
    if (targetDistance > entity.combat.range + target.radius) {
      if (entity.mobile) {
        entity.mobile.target = target.position;
        if (entity.mobile.path.length === 0) {
          entity.mobile.path = findPath(state, entity.position, target.position);
        }
      }
      continue;
    }

    if (entity.mobile) {
      delete entity.mobile.target;
      entity.mobile.path = [];
    }
    entity.visualState = "attacking";
    if (entity.combat.cooldownRemaining <= 0) {
      target.health.current -= entity.combat.damage;
      target.visualState = "hurt";
      entity.combat.cooldownRemaining = entity.combat.cooldownTicks;
      if (target.health.current <= 0) {
        target.visualState = "dead";
        if (target.ownerId === ENEMY_ID) {
          addMessage(state, `${target.label} destroyed.`);
        }
      }
    }
  }
}

function runAiSystem(state: GameState): void {
  const playerUnits = Object.values(state.entities).filter((entity) => entity.ownerId === PLAYER_ID && entity.health);
  for (const enemy of Object.values(state.entities)) {
    if (!enemy.ai || !enemy.combat || !enemy.health || enemy.health.current <= 0) {
      continue;
    }
    const activeTarget = enemy.combat.targetId ? state.entities[enemy.combat.targetId] : undefined;
    if (activeTarget?.health && activeTarget.health.current > 0) {
      continue;
    }

    let nearest: GameEntity | undefined;
    let nearestDistance = Number.POSITIVE_INFINITY;
    for (const candidate of playerUnits) {
      const distanceToCandidate = distance(enemy.position, candidate.position);
      const distanceFromAnchor = distance(enemy.ai.anchor, candidate.position);
      if (distanceToCandidate <= enemy.combat.aggroRange && distanceFromAnchor <= enemy.ai.leashRange && distanceToCandidate < nearestDistance) {
        nearest = candidate;
        nearestDistance = distanceToCandidate;
      }
    }

    if (nearest) {
      enemy.combat.targetId = nearest.id;
    } else if (distance(enemy.position, enemy.ai.anchor) > 18 && enemy.mobile) {
      enemy.mobile.target = enemy.ai.anchor;
      enemy.mobile.path = findPath(state, enemy.position, enemy.ai.anchor);
    }
  }
}

function runProgressionSystem(state: GameState): void {
  const player = state.players[PLAYER_ID];
  if (!player.ageProgress) {
    return;
  }
  player.ageProgress.remainingTicks -= 1;
  if (player.ageProgress.remainingTicks <= 0) {
    player.age = player.ageProgress.targetAge;
    upgradePlayerBuildingsForAge(state, PLAYER_ID);
    addMessage(state, `Age advanced: ${ageConfigs[player.age].label}.`);
    delete player.ageProgress;
  }
}

function runObjectiveSystem(state: GameState): void {
  const completedIds = completedObjectiveIdsInOrder(state);
  for (const id of completedIds) {
    if (state.objectives.completedIds.includes(id)) {
      continue;
    }
    state.objectives.completedIds.push(id);
    addMessage(state, `Objective complete: ${objectiveTitle(id)}.`);
  }
}

function upgradePlayerBuildingsForAge(state: GameState, playerId: typeof PLAYER_ID): void {
  const player = state.players[playerId];
  for (const entity of Object.values(state.entities)) {
    if (entity.ownerId !== playerId || !entity.building || !entity.health) {
      continue;
    }
    const nextMaxHealth = maxHealthForBuilding(entity.building.type, player.age);
    if (nextMaxHealth <= entity.health.max) {
      continue;
    }
    const healthGain = nextMaxHealth - entity.health.max;
    entity.health.max = nextMaxHealth;
    entity.health.current = Math.min(nextMaxHealth, entity.health.current + healthGain);
  }
}

function runCleanupSystem(state: GameState): void {
  for (const [id, entity] of Object.entries(state.entities)) {
    if (!entity.health || entity.health.current > 0) {
      continue;
    }
    delete state.entities[id];
    state.selection.selectedIds = state.selection.selectedIds.filter((selectedId) => selectedId !== id);
    if (entity.ownerId === PLAYER_ID && entity.unit) {
      state.players[PLAYER_ID].population = Math.max(0, state.players[PLAYER_ID].population - unitConfigs[entity.unit.type].population);
    }
  }
}

function completeBuilding(state: GameState, building: GameEntity): void {
  if (!building.building || building.building.completed) {
    return;
  }
  building.building.completed = true;
  building.building.buildProgress = building.building.buildTimeTicks;
  if (building.health) {
    building.health.current = building.health.max;
  }
  const config = buildingConfigs[building.building.type];
  if (building.ownerId === PLAYER_ID && config.providesPopulation) {
    state.players[PLAYER_ID].populationCap += config.providesPopulation;
  }
  addMessage(state, `${config.label} completed.`);
}

export function canPlaceBuildingAt(state: GameState, buildingType: keyof typeof buildingConfigs, tile: TileCoord): boolean {
  return isRectBuildable(state, tile, buildingConfigs[buildingType].footprint);
}

export function canPlaceWallLineAt(state: GameState, start: TileCoord, end: TileCoord): boolean {
  return wallLineSegments(start, end).every((segment) => isRectBuildable(state, segment.tile, segment.footprint));
}

export function buildingProgressRatio(entity: GameEntity): number {
  if (!entity.building) {
    return 1;
  }
  return Math.min(1, entity.building.buildProgress / Math.max(1, entity.building.buildTimeTicks));
}

export function productionProgressRatio(entity: GameEntity): number | undefined {
  const item = entity.producer?.queue[0];
  if (!item) {
    return undefined;
  }
  return 1 - item.remainingTicks / Math.max(1, item.totalTicks);
}

export function tileSpiral(center: TileCoord, radius: number): TileCoord[] {
  const tiles: TileCoord[] = [];
  for (let y = -radius; y <= radius; y += 1) {
    for (let x = -radius; x <= radius; x += 1) {
      tiles.push({ x: center.x + x, y: center.y + y });
    }
  }
  return tiles.sort((a, b) => Math.abs(a.x - center.x) + Math.abs(a.y - center.y) - (Math.abs(b.x - center.x) + Math.abs(b.y - center.y)));
}
