import { PLAYER_ID, RESOURCE_TYPES, type PlayerId, type ResourceType } from "../../data/constants";
import type { EntityId, GameEntity } from "../entities/types";
import type { GameState } from "../state/types";

export type WorkerTaskCounts = {
  total: number;
  idle: number;
  gathering: number;
  building: number;
  carrying: number;
  byResource: Record<ResourceType, number>;
};

export function workerTaskCountsForPlayer(state: GameState, playerId: PlayerId = PLAYER_ID): WorkerTaskCounts {
  const counts: WorkerTaskCounts = {
    total: 0,
    idle: 0,
    gathering: 0,
    building: 0,
    carrying: 0,
    byResource: {
      food: 0,
      wood: 0,
      stone: 0,
      gold: 0,
    },
  };

  for (const worker of playerWorkers(state, playerId)) {
    counts.total += 1;
    if (worker.worker?.carrying) {
      counts.carrying += 1;
    }
    const task = worker.worker?.task;
    if (!task) {
      if (isIdleWorker(worker)) {
        counts.idle += 1;
      }
      continue;
    }
    if (task.kind === "build") {
      counts.building += 1;
      continue;
    }
    counts.gathering += 1;
    const resource = state.entities[task.resourceId];
    const type = resource?.resourceNode?.resourceType ?? resource?.farm?.resourceType;
    if (type && RESOURCE_TYPES.includes(type)) {
      counts.byResource[type] += 1;
    }
  }

  return counts;
}

export function idleWorkerIdsForPlayer(state: GameState, playerId: PlayerId = PLAYER_ID): EntityId[] {
  return playerWorkers(state, playerId)
    .filter(isIdleWorker)
    .map((worker) => worker.id);
}

function playerWorkers(state: GameState, playerId: PlayerId): GameEntity[] {
  return Object.values(state.entities).filter((entity) => entity.ownerId === playerId && Boolean(entity.worker));
}

function isIdleWorker(entity: GameEntity): boolean {
  const mobileBusy = Boolean(entity.mobile?.target || (entity.mobile?.path.length ?? 0) > 0);
  return Boolean(entity.worker && !entity.worker.task && !entity.worker.carrying && !mobileBusy);
}
