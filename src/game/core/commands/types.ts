import type { AgeId, PlayerId } from "../../data/constants";
import type { BuildingType, EntityId, Footprint, UnitType } from "../entities/types";
import type { Vec2 } from "../state/types";

export type CommandBase = {
  playerId: PlayerId;
  issuedTick: number;
};

export type SelectUnitsCommand = CommandBase & {
  type: "selectUnits";
  entityIds: EntityId[];
};

export type MoveUnitsCommand = CommandBase & {
  type: "moveUnits";
  unitIds: EntityId[];
  target: {
    x: number;
    y: number;
  };
};

export type BuildStructureCommand = CommandBase & {
  type: "buildStructure";
  buildingType: BuildingType;
  tile: {
    x: number;
    y: number;
  };
  builderIds: EntityId[];
};

export type BuildWallLineCommand = CommandBase & {
  type: "buildWallLine";
  start: {
    x: number;
    y: number;
  };
  end: {
    x: number;
    y: number;
  };
  builderIds: EntityId[];
};

export type WallPathSegmentDraft = {
  tile: {
    x: number;
    y: number;
  };
  footprint: Footprint;
  direction: "horizontal" | "vertical";
};

export type BuildWallPathCommand = CommandBase & {
  type: "buildWallPath";
  segments: WallPathSegmentDraft[];
  builderIds: EntityId[];
};

export type AssignBuildersCommand = CommandBase & {
  type: "assignBuilders";
  buildingId: EntityId;
  builderIds: EntityId[];
};

export type TrainUnitCommand = CommandBase & {
  type: "trainUnit";
  buildingId: EntityId;
  unitType: UnitType;
};

export type SetRallyPointCommand = CommandBase & {
  type: "setRallyPoint";
  buildingId: EntityId;
  target: Vec2;
};

export type GatherResourceCommand = CommandBase & {
  type: "gatherResource";
  unitIds: EntityId[];
  resourceId: EntityId;
};

export type AttackTargetCommand = CommandBase & {
  type: "attackTarget";
  unitIds: EntityId[];
  targetId: EntityId;
};

export type QueueResearchCommand = CommandBase & {
  type: "queueResearch";
  techId: string;
};

export type AdvanceAgeCommand = CommandBase & {
  type: "advanceAge";
  buildingId: EntityId;
  targetAge?: AgeId;
};

export type ReseedFarmCommand = CommandBase & {
  type: "reseedFarm";
  farmId: EntityId;
};

export type CancelPlacementCommand = CommandBase & {
  type: "cancelPlacement";
};

export type GameCommand =
  | SelectUnitsCommand
  | MoveUnitsCommand
  | BuildStructureCommand
  | BuildWallLineCommand
  | BuildWallPathCommand
  | AssignBuildersCommand
  | TrainUnitCommand
  | SetRallyPointCommand
  | GatherResourceCommand
  | AttackTargetCommand
  | QueueResearchCommand
  | AdvanceAgeCommand
  | ReseedFarmCommand
  | CancelPlacementCommand;

type DistributiveOmit<T, K extends keyof any> = T extends unknown ? Omit<T, K> : never;

export type CommandDraft = DistributiveOmit<GameCommand, "issuedTick">;
