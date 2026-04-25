import { TILE_SIZE, type AgeId } from "./constants";
import { assetKeys } from "./assets";
import { buildingConfigs } from "./definitions";
import type { BuildingType, ResourceNodeType } from "../core/entities/types";
import type { TileType } from "../core/state/types";

export type TerrainVisualDef = {
  key: string;
  canMirror: boolean;
  alpha?: number;
};

export type SpriteVisualDef = {
  key: string;
  maxSize: number;
  originX: number;
  originY: number;
  x?: number;
  y?: number;
  alpha?: number;
  tint?: number;
};

export type BuildingVisualDef = {
  maxSize: number;
  maxSizeByAge?: Partial<Record<AgeId, number>>;
  constructionScale: number;
  groundPadding: {
    x: number;
    y: number;
  };
  groundOffsetY: number;
  fallbackSize: number;
};

export type ResourceVisualDef = {
  variants: SpriteVisualDef[];
  depleted?: SpriteVisualDef;
};

export const TERRAIN_STAMP_TILES = 8;

export const terrainVisuals: Record<TileType, TerrainVisualDef> = {
  grass: {
    key: assetKeys.aobMap.baseGrass,
    canMirror: false,
  },
  grassDark: {
    key: assetKeys.aobMap.baseGrass,
    canMirror: false,
  },
  path: {
    key: assetKeys.aobMap.baseDirt,
    canMirror: false,
  },
  dirt: {
    key: assetKeys.aobMap.baseDirt,
    canMirror: false,
  },
  water: {
    key: assetKeys.aobMap.baseShallowWater,
    canMirror: false,
    alpha: 0.96,
  },
  deepWater: {
    key: assetKeys.aobMap.baseShallowWater,
    canMirror: false,
    alpha: 0.96,
  },
  stoneGround: {
    key: assetKeys.aobMap.baseRocky,
    canMirror: false,
  },
  crystalGround: {
    key: assetKeys.aobMap.crystalGround,
    canMirror: false,
  },
};

export const buildingVisuals: Partial<Record<BuildingType, BuildingVisualDef>> = {
  townCenter: {
    maxSize: 278,
    maxSizeByAge: {
      genesis: 278,
      settlement: 268,
      network: 256,
    },
    constructionScale: 0.72,
    groundPadding: { x: 120, y: 88 },
    groundOffsetY: -8,
    fallbackSize: 94,
  },
  house: {
    maxSize: 198,
    constructionScale: 0.72,
    groundPadding: { x: 56, y: 20 },
    groundOffsetY: -8,
    fallbackSize: 52,
  },
  lumberCamp: {
    maxSize: 222,
    constructionScale: 0.72,
    groundPadding: { x: 82, y: 22 },
    groundOffsetY: -8,
    fallbackSize: 70,
  },
  mill: {
    maxSize: 320,
    constructionScale: 0.72,
    groundPadding: { x: 114, y: 28 },
    groundOffsetY: -8,
    fallbackSize: 70,
  },
  stoneCamp: {
    maxSize: 210,
    constructionScale: 0.72,
    groundPadding: { x: 18, y: 16 },
    groundOffsetY: -7,
    fallbackSize: 70,
  },
  goldCamp: {
    maxSize: 210,
    constructionScale: 0.72,
    groundPadding: { x: 18, y: 16 },
    groundOffsetY: -7,
    fallbackSize: 70,
  },
  farm: {
    maxSize: 330,
    constructionScale: 0.72,
    groundPadding: { x: 112, y: 28 },
    groundOffsetY: -9,
    fallbackSize: 76,
  },
  barracks: {
    maxSize: 235,
    constructionScale: 0.72,
    groundPadding: { x: 20, y: 18 },
    groundOffsetY: -8,
    fallbackSize: 88,
  },
  watchTower: {
    maxSize: 235,
    constructionScale: 0.72,
    groundPadding: { x: 18, y: 18 },
    groundOffsetY: -8,
    fallbackSize: 66,
  },
  wall: {
    maxSize: 24,
    constructionScale: 1,
    groundPadding: { x: 0, y: 0 },
    groundOffsetY: 0,
    fallbackSize: 24,
  },
};

export const resourceVisuals: Record<ResourceNodeType, ResourceVisualDef> = {
  tree: {
    variants: [
      { key: assetKeys.aobMap.trees, maxSize: 78, originX: 0.5, originY: 0.9, y: 2 },
      { key: assetKeys.aobMap.treesAlt, maxSize: 82, originX: 0.5, originY: 0.9, y: 2 },
      { key: assetKeys.aobMap.pineTree, maxSize: 70, originX: 0.5, originY: 0.92, y: 3 },
    ],
    depleted: { key: assetKeys.aobMap.stump, maxSize: 36, originX: 0.5, originY: 0.9, y: 4, alpha: 0.95 },
  },
  berries: {
    variants: [{ key: assetKeys.aobMap.fruitBush, maxSize: 50, originX: 0.5, originY: 0.86, y: 3 }],
    depleted: { key: assetKeys.aobMap.bush, maxSize: 34, originX: 0.5, originY: 0.86, y: 4, alpha: 0.9 },
  },
  stone: {
    variants: [
      { key: assetKeys.aobMap.rocks, maxSize: 50, originX: 0.5, originY: 0.86, y: 2 },
      { key: assetKeys.aobMap.bigRocks, maxSize: 58, originX: 0.5, originY: 0.86, y: 2 },
    ],
    depleted: { key: assetKeys.aobMap.rock, maxSize: 28, originX: 0.5, originY: 0.86, y: 4, alpha: 0.65 },
  },
  gold: {
    variants: [
      { key: assetKeys.aobMap.crystalNode, maxSize: 60, originX: 0.5, originY: 0.9, y: 1 },
      { key: assetKeys.aobMap.crystalNodeAlt, maxSize: 60, originX: 0.5, originY: 0.9, y: 1 },
    ],
    depleted: { key: assetKeys.aobMap.crystalSprout, maxSize: 34, originX: 0.5, originY: 0.88, y: 4, alpha: 0.55 },
  },
  farmFood: {
    variants: [],
  },
};

export function terrainVisualFor(tile: TileType): TerrainVisualDef {
  return terrainVisuals[tile] ?? terrainVisuals.grass;
}

export function buildingStaticAssetKeyForType(type: BuildingType, completed: boolean, ownerAge: AgeId): string | undefined {
  switch (type) {
    case "townCenter":
      return completed ? assetKeys.aobBuildingStatic.townCenter[ownerAge] : assetKeys.aobBuildingStatic.construction;
    case "house":
      return completed ? assetKeys.aobBuildingStatic.house[ownerAge] : assetKeys.aobBuildingStatic.construction;
    case "lumberCamp":
      return completed ? assetKeys.aobBuildingStatic.lumberCamp[ownerAge] : assetKeys.aobBuildingStatic.construction;
    case "mill":
      return completed ? assetKeys.aobBuildingStatic.mill[ownerAge] : assetKeys.aobBuildingStatic.construction;
    case "stoneCamp":
      return completed ? assetKeys.aobBuildingStatic.stoneCamp[ownerAge] : assetKeys.aobBuildingStatic.construction;
    case "goldCamp":
      return completed ? assetKeys.aobBuildingStatic.goldCamp[ownerAge] : assetKeys.aobBuildingStatic.construction;
    case "farm":
      return completed ? assetKeys.aobBuildingStatic.farm[ownerAge] : assetKeys.aobBuildingStatic.construction;
    case "barracks":
      return completed ? assetKeys.aobBuildingStatic.barracks[ownerAge] : assetKeys.aobBuildingStatic.construction;
    case "watchTower":
      return completed ? assetKeys.aobBuildingStatic.watchTower[ownerAge] : assetKeys.aobBuildingStatic.construction;
    default:
      return undefined;
  }
}

export function buildingStaticVisualSizeForType(type: BuildingType, age?: AgeId): number {
  const visual = buildingVisuals[type];
  return (age ? visual?.maxSizeByAge?.[age] : undefined) ?? visual?.maxSize ?? 48;
}

export function constructionVisualSizeForType(type: BuildingType): number {
  const visual = buildingVisuals[type];
  return Math.round((visual?.maxSize ?? 48) * (visual?.constructionScale ?? 1));
}

export function buildingFallbackVisualSizeForType(type: BuildingType): number {
  return buildingVisuals[type]?.fallbackSize ?? Math.max(buildingConfigs[type].footprint.w, buildingConfigs[type].footprint.h) * TILE_SIZE * 1.35;
}

export function buildingGroundBoundsForType(type: BuildingType, _age: AgeId): { x: number; y: number; width: number; height: number } {
  const footprint = buildingConfigs[type].footprint;
  const visual = buildingVisuals[type];
  const padding = visual?.groundPadding ?? { x: 8, y: 8 };
  const yOffset = visual?.groundOffsetY ?? -4;
  const width = roundedEven(footprint.w * TILE_SIZE + padding.x);
  const height = roundedEven(footprint.h * TILE_SIZE + padding.y);
  return {
    x: -width / 2,
    y: -height / 2 + yOffset,
    width,
    height,
  };
}

function roundedEven(value: number): number {
  const rounded = Math.round(value);
  return rounded % 2 === 0 ? rounded : rounded + 1;
}
