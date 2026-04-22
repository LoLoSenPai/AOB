import { ticksFromSeconds, type AgeId, type ResourceType } from "./constants";
import type { BuildingType, ResourceNodeType, UnitType } from "../core/entities/types";
import type { ResourceStock } from "../core/state/types";

export type Cost = Partial<ResourceStock>;

export type UnitConfig = {
  type: UnitType;
  label: string;
  maxHealth: number;
  speed: number;
  cost: Cost;
  population: number;
  trainTicks: number;
  unlockedAge: AgeId;
  canGather: boolean;
  carryCapacity?: number;
  gatherTicks?: number;
  buildPower?: number;
  combat?: {
    damage: number;
    range: number;
    cooldownTicks: number;
    aggroRange: number;
  };
};

export type BuildingConfig = {
  type: BuildingType;
  label: string;
  footprint: {
    w: number;
    h: number;
  };
  maxHealth: number;
  cost: Cost;
  buildTicks: number;
  unlockedAge: AgeId;
  providesPopulation?: number;
  storage?: ResourceType[];
  producer?: UnitType[];
  color: number;
  roofColor: number;
};

export type WallTierConfig = {
  id: "palisade" | "stone" | "reinforced";
  label: string;
  age: AgeId;
  cost: Cost;
  maxHealth: number;
  color: number;
  accentColor: number;
};

export type ResourceConfig = {
  type: ResourceNodeType;
  label: string;
  resourceType: ResourceType;
  amount: number;
  gatherAmount: number;
  radius: number;
  regrowTicks?: number;
};

export type AgeConfig = {
  id: AgeId;
  label: string;
  nextAge?: AgeId;
  advanceCost: Cost;
  advanceTicks: number;
};

export const FARM_CONFIG = {
  maxFood: 175,
  gatherAmount: 5,
  reseedCost: { wood: 35 },
} as const;

export const unitConfigs: Record<UnitType, UnitConfig> = {
  worker: {
    type: "worker",
    label: "Villager",
    maxHealth: 45,
    speed: 42,
    cost: { food: 45 },
    population: 1,
    trainTicks: ticksFromSeconds(10),
    unlockedAge: "genesis",
    canGather: true,
    carryCapacity: 12,
    gatherTicks: ticksFromSeconds(1.3),
    buildPower: 1,
  },
  soldier: {
    type: "soldier",
    label: "Infantry",
    maxHealth: 80,
    speed: 48,
    cost: { food: 35, gold: 20 },
    population: 1,
    trainTicks: ticksFromSeconds(13),
    unlockedAge: "settlement",
    canGather: false,
    combat: {
      damage: 9,
      range: 18,
      cooldownTicks: ticksFromSeconds(0.9),
      aggroRange: 92,
    },
  },
  goblin: {
    type: "goblin",
    label: "Fork Raider",
    maxHealth: 55,
    speed: 36,
    cost: {},
    population: 0,
    trainTicks: 0,
    unlockedAge: "genesis",
    canGather: false,
    combat: {
      damage: 6,
      range: 16,
      cooldownTicks: ticksFromSeconds(1.1),
      aggroRange: 82,
    },
  },
  skeleton: {
    type: "skeleton",
    label: "Dead Chain",
    maxHealth: 65,
    speed: 32,
    cost: {},
    population: 0,
    trainTicks: 0,
    unlockedAge: "genesis",
    canGather: false,
    combat: {
      damage: 7,
      range: 16,
      cooldownTicks: ticksFromSeconds(1.2),
      aggroRange: 86,
    },
  },
};

export const buildingConfigs: Record<BuildingType, BuildingConfig> = {
  townCenter: {
    type: "townCenter",
    label: "Town Center",
    footprint: { w: 10, h: 8 },
    maxHealth: 700,
    cost: {},
    buildTicks: ticksFromSeconds(1),
    unlockedAge: "genesis",
    providesPopulation: 8,
    storage: ["food", "wood", "stone", "gold"],
    producer: ["worker"],
    color: 0x66727b,
    roofColor: 0xb5463d,
  },
  house: {
    type: "house",
    label: "House",
    footprint: { w: 5, h: 4 },
    maxHealth: 180,
    cost: { wood: 35 },
    buildTicks: ticksFromSeconds(12),
    unlockedAge: "genesis",
    providesPopulation: 4,
    color: 0x805b3b,
    roofColor: 0x9a2e33,
  },
  barracks: {
    type: "barracks",
    label: "Barracks",
    footprint: { w: 9, h: 6 },
    maxHealth: 360,
    cost: { wood: 120, stone: 40 },
    buildTicks: ticksFromSeconds(22),
    unlockedAge: "settlement",
    producer: ["soldier"],
    color: 0x5d4745,
    roofColor: 0x2d4e68,
  },
  lumberCamp: {
    type: "lumberCamp",
    label: "Wood Camp",
    footprint: { w: 7, h: 5 },
    maxHealth: 220,
    cost: { wood: 60 },
    buildTicks: ticksFromSeconds(16),
    unlockedAge: "genesis",
    storage: ["wood"],
    color: 0x7a5836,
    roofColor: 0xc2873e,
  },
  mill: {
    type: "mill",
    label: "Mill",
    footprint: { w: 7, h: 5 },
    maxHealth: 220,
    cost: { wood: 50 },
    buildTicks: ticksFromSeconds(14),
    unlockedAge: "genesis",
    storage: ["food"],
    color: 0x7a5836,
    roofColor: 0x4f8b59,
  },
  stoneCamp: {
    type: "stoneCamp",
    label: "Stone Camp",
    footprint: { w: 7, h: 5 },
    maxHealth: 230,
    cost: { wood: 60 },
    buildTicks: ticksFromSeconds(16),
    unlockedAge: "settlement",
    storage: ["stone"],
    color: 0x666061,
    roofColor: 0xb98642,
  },
  goldCamp: {
    type: "goldCamp",
    label: "Gold Camp",
    footprint: { w: 7, h: 5 },
    maxHealth: 230,
    cost: { wood: 70, stone: 20 },
    buildTicks: ticksFromSeconds(18),
    unlockedAge: "settlement",
    storage: ["gold"],
    color: 0x67606a,
    roofColor: 0xd6a83f,
  },
  farm: {
    type: "farm",
    label: "Farm",
    footprint: { w: 8, h: 6 },
    maxHealth: 140,
    cost: { wood: 60 },
    buildTicks: ticksFromSeconds(10),
    unlockedAge: "genesis",
    color: 0x6a5034,
    roofColor: 0x779b3d,
  },
  watchTower: {
    type: "watchTower",
    label: "Watch Tower",
    footprint: { w: 5, h: 5 },
    maxHealth: 420,
    cost: { wood: 70, stone: 90 },
    buildTicks: ticksFromSeconds(24),
    unlockedAge: "settlement",
    color: 0x5a4b42,
    roofColor: 0x2d6472,
  },
  wall: {
    type: "wall",
    label: "Wall",
    footprint: { w: 1, h: 1 },
    maxHealth: 140,
    cost: { wood: 8 },
    buildTicks: ticksFromSeconds(6),
    unlockedAge: "genesis",
    color: 0x8b5c34,
    roofColor: 0x5d3924,
  },
  enemyCamp: {
    type: "enemyCamp",
    label: "Fork Camp",
    footprint: { w: 4, h: 3 },
    maxHealth: 320,
    cost: {},
    buildTicks: 1,
    unlockedAge: "genesis",
    color: 0x503946,
    roofColor: 0x5b1f2c,
  },
};

export const wallTierConfigs: Record<AgeId, WallTierConfig> = {
  genesis: {
    id: "palisade",
    label: "Wood Palisade",
    age: "genesis",
    cost: { wood: 8 },
    maxHealth: 140,
    color: 0x8b5c34,
    accentColor: 0xc98a4b,
  },
  settlement: {
    id: "stone",
    label: "Stone Wall",
    age: "settlement",
    cost: { stone: 7 },
    maxHealth: 280,
    color: 0x8b8780,
    accentColor: 0xc4b8a1,
  },
  network: {
    id: "reinforced",
    label: "Reinforced Wall",
    age: "network",
    cost: { stone: 7, gold: 2 },
    maxHealth: 430,
    color: 0x69747a,
    accentColor: 0x62d5e8,
  },
};

export const resourceConfigs: Record<ResourceNodeType, ResourceConfig> = {
  berries: {
    type: "berries",
    label: "Food Patch",
    resourceType: "food",
    amount: 180,
    gatherAmount: 4,
    radius: 9,
    regrowTicks: ticksFromSeconds(45),
  },
  tree: {
    type: "tree",
    label: "Tree",
    resourceType: "wood",
    amount: 90,
    gatherAmount: 4,
    radius: 12,
    regrowTicks: ticksFromSeconds(60),
  },
  stone: {
    type: "stone",
    label: "Stone",
    resourceType: "stone",
    amount: 150,
    gatherAmount: 4,
    radius: 10,
  },
  gold: {
    type: "gold",
    label: "Gold",
    resourceType: "gold",
    amount: 120,
    gatherAmount: 3,
    radius: 10,
  },
  farmFood: {
    type: "farmFood",
    label: "Farm Food",
    resourceType: "food",
    amount: 260,
    gatherAmount: 5,
    radius: 14,
  },
};

export const ageConfigs: Record<AgeId, AgeConfig> = {
  genesis: {
    id: "genesis",
    label: "Genesis",
    nextAge: "settlement",
    advanceCost: { food: 150, wood: 120 },
    advanceTicks: ticksFromSeconds(28),
  },
  settlement: {
    id: "settlement",
    label: "Settlement",
    nextAge: "network",
    advanceCost: { food: 260, wood: 180, gold: 100 },
    advanceTicks: ticksFromSeconds(38),
  },
  network: {
    id: "network",
    label: "Network",
    advanceCost: {},
    advanceTicks: 0,
  },
};

export function createEmptyStock(): ResourceStock {
  return {
    food: 0,
    wood: 0,
    stone: 0,
    gold: 0,
  };
}

export function hasReachedAge(current: AgeId, required: AgeId): boolean {
  const order: AgeId[] = ["genesis", "settlement", "network"];
  return order.indexOf(current) >= order.indexOf(required);
}

export function wallTierForAge(age: AgeId): WallTierConfig {
  return wallTierConfigs[age];
}

export function costForBuilding(type: BuildingType, age: AgeId): Cost {
  return type === "wall" ? wallTierForAge(age).cost : buildingConfigs[type].cost;
}

export function maxHealthForBuilding(type: BuildingType, age: AgeId): number {
  return type === "wall" ? wallTierForAge(age).maxHealth : buildingConfigs[type].maxHealth;
}

export function labelForBuilding(type: BuildingType, age: AgeId): string {
  return type === "wall" ? wallTierForAge(age).label : buildingConfigs[type].label;
}

export function canAfford(stock: ResourceStock, cost: Cost): boolean {
  return Object.entries(cost).every(([resource, amount]) => stock[resource as ResourceType] >= (amount ?? 0));
}

export function applyCost(stock: ResourceStock, cost: Cost, sign: 1 | -1): ResourceStock {
  return {
    food: stock.food + sign * (cost.food ?? 0),
    wood: stock.wood + sign * (cost.wood ?? 0),
    stone: stock.stone + sign * (cost.stone ?? 0),
    gold: stock.gold + sign * (cost.gold ?? 0),
  };
}
