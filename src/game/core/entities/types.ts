import type { PlayerId, ResourceType } from "../../data/constants";
import type { TileCoord, Vec2 } from "../state/types";

export type EntityId = string;
export type EntityKind = "unit" | "building" | "resource";
export type UnitType = "worker" | "soldier" | "archer" | "goblin" | "skeleton";
export type BuildingType =
  | "townCenter"
  | "house"
  | "barracks"
  | "lumberCamp"
  | "mill"
  | "stoneCamp"
  | "goldCamp"
  | "farm"
  | "watchTower"
  | "wall"
  | "enemyCamp";
export type ResourceNodeType = "berries" | "tree" | "stone" | "gold" | "farmFood";
export type UnitVisualState = "idle" | "walking" | "gathering" | "carrying" | "building" | "attacking" | "hurt" | "dead";

export type Footprint = {
  w: number;
  h: number;
};

export type HealthComponent = {
  current: number;
  max: number;
};

export type MobileComponent = {
  speed: number;
  target?: Vec2;
  path: Vec2[];
};

export type WorkerTask =
  | {
      kind: "gather";
      resourceId: EntityId;
      phase: "toResource" | "gathering" | "toStorage";
      cooldownTicks: number;
      storageId?: EntityId;
    }
  | {
      kind: "build";
      buildingId: EntityId;
      approachTile?: TileCoord;
    };

export type WorkerComponent = {
  carryCapacity: number;
  gatherTicks: number;
  buildPower: number;
  carrying?: {
    type: ResourceType;
    amount: number;
  };
  task?: WorkerTask;
};

export type ResourceNodeComponent = {
  type: ResourceNodeType;
  resourceType: ResourceType;
  amount: number;
  maxAmount: number;
  gatherAmount: number;
  regrowTicksRemaining?: number;
};

export type FarmComponent = {
  resourceType: "food";
  food: number;
  maxFood: number;
  gatherAmount: number;
  reseedCost: {
    wood: number;
  };
  depleted: boolean;
};

export type BuildingComponent = {
  type: BuildingType;
  completed: boolean;
  buildProgress: number;
  buildTimeTicks: number;
  footprint: Footprint;
};

export type StorageComponent = {
  accepts: ResourceType[];
};

export type ProductionQueueItem = {
  id: string;
  unitType: UnitType;
  remainingTicks: number;
  totalTicks: number;
};

export type ProducerComponent = {
  queue: ProductionQueueItem[];
  rallyPoint?: Vec2;
};

export type CombatComponent = {
  damage: number;
  range: number;
  cooldownTicks: number;
  cooldownRemaining: number;
  targetId?: EntityId;
  aggroRange: number;
};

export type AiComponent = {
  behavior: "guard";
  anchor: Vec2;
  leashRange: number;
};

export type GameEntity = {
  id: EntityId;
  kind: EntityKind;
  label: string;
  ownerId?: PlayerId;
  position: Vec2;
  tile?: TileCoord;
  radius: number;
  visualState: UnitVisualState;
  unit?: {
    type: UnitType;
  };
  health?: HealthComponent;
  mobile?: MobileComponent;
  worker?: WorkerComponent;
  resourceNode?: ResourceNodeComponent;
  building?: BuildingComponent;
  storage?: StorageComponent;
  producer?: ProducerComponent;
  farm?: FarmComponent;
  combat?: CombatComponent;
  ai?: AiComponent;
};
