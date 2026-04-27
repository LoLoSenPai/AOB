import { PLAYER_ID } from "../../data/constants";
import { BTC_VILLAGE_DISCOVERY_TILE } from "../../data/mapLayout";
import type { BuildingType, UnitType } from "../entities/types";
import type { GameState } from "../state/types";
import { isTileExplored } from "../systems/visibility";

export type ObjectiveId =
  | "villagers8"
  | "economyBuilding"
  | "settlementAge"
  | "barracks"
  | "soldiers3"
  | "stable"
  | "scout"
  | "btcVillage"
  | "exploreMap";
export type ObjectiveStatus = "todo" | "active" | "done";

export type ObjectiveView = {
  id: ObjectiveId;
  title: string;
  detail: string;
  status: ObjectiveStatus;
  current: number;
  target: number;
};

type ObjectiveDefinition = {
  id: ObjectiveId;
  title: string;
  detail: string;
  target: number;
  progress: (state: GameState) => number;
};

const ECONOMY_BUILDINGS = new Set<BuildingType>(["farm", "mill", "lumberCamp", "stoneCamp", "goldCamp"]);
const EXPLORE_TARGET_RATIO = 0.18;

export const OBJECTIVE_DEFINITIONS: ObjectiveDefinition[] = [
  {
    id: "villagers8",
    title: "8 Villagers",
    detail: "Train two more villagers at the Town Center.",
    target: 8,
    progress: (state) => playerUnitCount(state, "worker"),
  },
  {
    id: "economyBuilding",
    title: "Economy Building",
    detail: "Complete a Farm, Mill, or resource camp.",
    target: 1,
    progress: (state) => completedPlayerBuildings(state, ECONOMY_BUILDINGS),
  },
  {
    id: "settlementAge",
    title: "Settlement",
    detail: "Advance from Genesis to Settlement.",
    target: 1,
    progress: (state) => (state.players[PLAYER_ID].age === "settlement" || state.players[PLAYER_ID].age === "network" ? 1 : 0),
  },
  {
    id: "barracks",
    title: "Barracks",
    detail: "Complete a Barracks after reaching Settlement.",
    target: 1,
    progress: (state) => completedPlayerBuildings(state, new Set<BuildingType>(["barracks"])),
  },
  {
    id: "soldiers3",
    title: "3 Infantry",
    detail: "Train your first three soldiers.",
    target: 3,
    progress: (state) => playerUnitCount(state, "soldier"),
  },
  {
    id: "stable",
    title: "Stable",
    detail: "Complete a Stable after your first infantry.",
    target: 1,
    progress: (state) => completedPlayerBuildings(state, new Set<BuildingType>(["stable"])),
  },
  {
    id: "scout",
    title: "Lancer Scout",
    detail: "Train a fast scout at the Stable.",
    target: 1,
    progress: (state) => playerUnitCount(state, "scout"),
  },
  {
    id: "btcVillage",
    title: "BTC Village",
    detail: "Scout east and reveal the BTC settlement.",
    target: 1,
    progress: (state) => (isTileExplored(state, BTC_VILLAGE_DISCOVERY_TILE) ? 1 : 0),
  },
  {
    id: "exploreMap",
    title: "Explore",
    detail: "Reveal 18% of the map with units and buildings.",
    target: Math.round(EXPLORE_TARGET_RATIO * 100),
    progress: (state) => Math.floor(exploredRatio(state) * 100),
  },
];

export function objectiveViewsForState(state: GameState): ObjectiveView[] {
  let blocked = false;
  return OBJECTIVE_DEFINITIONS.map((definition) => {
    const current = Math.min(definition.target, definition.progress(state));
    const complete = current >= definition.target;
    const status: ObjectiveStatus = complete && !blocked ? "done" : blocked ? "todo" : "active";
    if (status !== "done") {
      blocked = true;
    }
    return {
      id: definition.id,
      title: definition.title,
      detail: definition.detail,
      status,
      current,
      target: definition.target,
    };
  });
}

export function completedObjectiveIdsInOrder(state: GameState): ObjectiveId[] {
  const completed: ObjectiveId[] = [];
  for (const objective of objectiveViewsForState(state)) {
    if (objective.status !== "done") {
      break;
    }
    completed.push(objective.id);
  }
  return completed;
}

export function objectiveTitle(id: ObjectiveId): string {
  return OBJECTIVE_DEFINITIONS.find((definition) => definition.id === id)?.title ?? id;
}

function playerUnitCount(state: GameState, type: UnitType): number {
  return Object.values(state.entities).filter((entity) => entity.ownerId === PLAYER_ID && entity.unit?.type === type).length;
}

function completedPlayerBuildings(state: GameState, types: Set<BuildingType>): number {
  return Object.values(state.entities).filter((entity) => entity.ownerId === PLAYER_ID && entity.building?.completed && types.has(entity.building.type)).length;
}

function exploredRatio(state: GameState): number {
  const total = state.map.width * state.map.height;
  if (total <= 0) {
    return 0;
  }
  const explored = state.visibility.exploredTiles.reduce((sum, tile) => sum + (tile ? 1 : 0), 0);
  return explored / total;
}
