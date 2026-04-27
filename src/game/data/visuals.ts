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
  frame?: string | number;
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

export type BuildingRuinVisualDef = {
  key: string;
  maxSize: number;
  originX: number;
  originY: number;
  y: number;
  alpha: number;
};

export type VisualOverlayKind = "villageGround" | "pathDecal" | "grassDetail" | "villageProp";

export type ImageDecalKey =
  | "roadCross"
  | "roadCurveEastSouth"
  | "roadCurveNorthEast"
  | "roadCurveSouthWest"
  | "roadCurveWestNorth"
  | "roadDiagonalNeSw"
  | "roadDiagonalNwSe"
  | "roadEndEast"
  | "roadEndNorth"
  | "roadEndSouth"
  | "roadEndWest"
  | "roadStraightHorizontal"
  | "roadStraightVertical"
  | "roadTEast"
  | "roadTNorth"
  | "roadTSouth"
  | "roadTWest"
  | "stoneGroundPatch"
  | "crystalGroundPatch"
  | "waterShoreCurve"
  | "grassToCrystalEast"
  | "grassToCrystalNorth"
  | "grassToCrystalSouth"
  | "grassToCrystalWest"
  | "grassToDirtEast"
  | "grassToDirtNorth"
  | "grassToDirtSouth"
  | "grassToDirtWest"
  | "grassToStoneEast"
  | "grassToStoneNorth"
  | "grassToStoneSouth"
  | "grassToStoneWest"
  | "shoreCornerNe"
  | "shoreCornerNw"
  | "shoreCornerSe"
  | "shoreCornerSw"
  | "shoreEdgeEast"
  | "shoreEdgeNorth"
  | "shoreEdgeSouth"
  | "shoreEdgeWest";

export type GrassDetailFrame =
  | "crystalFlowers"
  | "rockMoss"
  | "tallGrass"
  | "stonePatch"
  | "lowFlowers"
  | "purpleSpikes"
  | "twinCrystal"
  | "leafFlowers"
  | "crystalGrass"
  | "berryGrass"
  | "brokenStone"
  | "smallCrystals";

export type VillagePropFrame =
  | "bannerSmall"
  | "bannerTall"
  | "crate"
  | "crateStack"
  | "barrel"
  | "barrelStack"
  | "lampTall"
  | "lampSmall"
  | "validatorObelisk"
  | "crystalBench"
  | "sacks"
  | "supplyPile";

export type AtlasFrameDef = {
  x: number;
  y: number;
  width: number;
  height: number;
  originX: number;
  originY: number;
  shadow?: {
    width: number;
    height: number;
    y: number;
    alpha: number;
  };
};

export type VisualOverlayDef = {
  key: string;
  originX: number;
  originY: number;
  depth: number;
  shadow?: {
    width: number;
    height: number;
    y: number;
    alpha: number;
  };
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
  stable: {
    maxSize: 220,
    constructionScale: 0.72,
    groundPadding: { x: 20, y: 18 },
    groundOffsetY: -8,
    fallbackSize: 84,
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
      { key: assetKeys.aobMap.solanaTreeClusterA, maxSize: 96, originX: 0.5, originY: 0.9, y: 2 },
      { key: assetKeys.aobMap.solanaTreeClusterB, maxSize: 96, originX: 0.5, originY: 0.9, y: 2 },
      { key: assetKeys.aobMap.solanaPineCluster, maxSize: 88, originX: 0.5, originY: 0.92, y: 3 },
    ],
    depleted: { key: assetKeys.aobMap.stump, maxSize: 36, originX: 0.5, originY: 0.9, y: 4, alpha: 0.95 },
  },
  berries: {
    variants: [{ key: assetKeys.aobMap.solanaBerryBush, maxSize: 62, originX: 0.5, originY: 0.86, y: 3 }],
    depleted: { key: assetKeys.aobMap.bush, maxSize: 34, originX: 0.5, originY: 0.86, y: 4, alpha: 0.9 },
  },
  stone: {
    variants: [
      { key: assetKeys.aobMap.solanaStoneNodeLarge, maxSize: 72, originX: 0.5, originY: 0.88, y: 2 },
      { key: assetKeys.aobMap.solanaStoneNodeLarge, maxSize: 64, originX: 0.5, originY: 0.88, y: 2 },
    ],
    depleted: { key: assetKeys.aobMap.solanaStoneNodeSmall, maxSize: 38, originX: 0.5, originY: 0.88, y: 4, alpha: 0.75 },
  },
  gold: {
    variants: [
      { key: assetKeys.aobMap.solanaCrystalNodeLarge, maxSize: 86, originX: 0.5, originY: 0.9, y: 2 },
      { key: assetKeys.aobMap.solanaCrystalNodeLarge, maxSize: 76, originX: 0.5, originY: 0.9, y: 2 },
    ],
    depleted: { key: assetKeys.aobMap.solanaCrystalNodeSmall, maxSize: 42, originX: 0.5, originY: 0.88, y: 4, alpha: 0.65 },
  },
  farmFood: {
    variants: [],
  },
};

export const visualOverlayVisuals: Record<VisualOverlayKind, VisualOverlayDef> = {
  villageGround: {
    key: assetKeys.aobMap.solanaVillageGround,
    originX: 0.5,
    originY: 0.5,
    depth: -860,
  },
  pathDecal: {
    key: assetKeys.aobMap.solanaPathDecal,
    originX: 0.5,
    originY: 0.5,
    depth: -850,
  },
  grassDetail: {
    key: assetKeys.aobMap.solanaGrassDetailAtlas,
    originX: 0.5,
    originY: 0.86,
    depth: -170,
    shadow: { width: 38, height: 11, y: 3, alpha: 0.12 },
  },
  villageProp: {
    key: assetKeys.aobMap.solanaVillagePropsAtlas,
    originX: 0.5,
    originY: 0.9,
    depth: 0,
    shadow: { width: 44, height: 13, y: 3, alpha: 0.18 },
  },
};

const ROAD_DECAL_DEPTH = -868;
const TERRAIN_DECAL_DEPTH = -856;

export const imageDecalVisuals: Record<ImageDecalKey, VisualOverlayDef> = {
  roadCross: { key: assetKeys.aobMap.solanaRoadCross, originX: 0.5, originY: 0.5, depth: ROAD_DECAL_DEPTH },
  roadCurveEastSouth: { key: assetKeys.aobMap.solanaRoadCurveEastSouth, originX: 0.5, originY: 0.5, depth: ROAD_DECAL_DEPTH },
  roadCurveNorthEast: { key: assetKeys.aobMap.solanaRoadCurveNorthEast, originX: 0.5, originY: 0.5, depth: ROAD_DECAL_DEPTH },
  roadCurveSouthWest: { key: assetKeys.aobMap.solanaRoadCurveSouthWest, originX: 0.5, originY: 0.5, depth: ROAD_DECAL_DEPTH },
  roadCurveWestNorth: { key: assetKeys.aobMap.solanaRoadCurveWestNorth, originX: 0.5, originY: 0.5, depth: ROAD_DECAL_DEPTH },
  roadDiagonalNeSw: { key: assetKeys.aobMap.solanaRoadDiagonalNeSw, originX: 0.5, originY: 0.5, depth: ROAD_DECAL_DEPTH },
  roadDiagonalNwSe: { key: assetKeys.aobMap.solanaRoadDiagonalNwSe, originX: 0.5, originY: 0.5, depth: ROAD_DECAL_DEPTH },
  roadEndEast: { key: assetKeys.aobMap.solanaRoadEndEast, originX: 0.5, originY: 0.5, depth: ROAD_DECAL_DEPTH },
  roadEndNorth: { key: assetKeys.aobMap.solanaRoadEndNorth, originX: 0.5, originY: 0.5, depth: ROAD_DECAL_DEPTH },
  roadEndSouth: { key: assetKeys.aobMap.solanaRoadEndSouth, originX: 0.5, originY: 0.5, depth: ROAD_DECAL_DEPTH },
  roadEndWest: { key: assetKeys.aobMap.solanaRoadEndWest, originX: 0.5, originY: 0.5, depth: ROAD_DECAL_DEPTH },
  roadStraightHorizontal: { key: assetKeys.aobMap.solanaRoadStraightHorizontal, originX: 0.5, originY: 0.5, depth: ROAD_DECAL_DEPTH },
  roadStraightVertical: { key: assetKeys.aobMap.solanaRoadStraightVertical, originX: 0.5, originY: 0.5, depth: ROAD_DECAL_DEPTH },
  roadTEast: { key: assetKeys.aobMap.solanaRoadTEast, originX: 0.5, originY: 0.5, depth: ROAD_DECAL_DEPTH },
  roadTNorth: { key: assetKeys.aobMap.solanaRoadTNorth, originX: 0.5, originY: 0.5, depth: ROAD_DECAL_DEPTH },
  roadTSouth: { key: assetKeys.aobMap.solanaRoadTSouth, originX: 0.5, originY: 0.5, depth: ROAD_DECAL_DEPTH },
  roadTWest: { key: assetKeys.aobMap.solanaRoadTWest, originX: 0.5, originY: 0.5, depth: ROAD_DECAL_DEPTH },
  stoneGroundPatch: { key: assetKeys.aobMap.solanaStoneGroundPatch, originX: 0.5, originY: 0.5, depth: TERRAIN_DECAL_DEPTH },
  crystalGroundPatch: { key: assetKeys.aobMap.solanaCrystalGroundPatch, originX: 0.5, originY: 0.5, depth: TERRAIN_DECAL_DEPTH },
  waterShoreCurve: { key: assetKeys.aobMap.solanaWaterShoreCurve, originX: 0.5, originY: 0.5, depth: TERRAIN_DECAL_DEPTH },
  grassToCrystalEast: { key: assetKeys.aobMap.solanaGrassToCrystalEdgeEast, originX: 0.5, originY: 0.5, depth: TERRAIN_DECAL_DEPTH },
  grassToCrystalNorth: { key: assetKeys.aobMap.solanaGrassToCrystalEdgeNorth, originX: 0.5, originY: 0.5, depth: TERRAIN_DECAL_DEPTH },
  grassToCrystalSouth: { key: assetKeys.aobMap.solanaGrassToCrystalEdgeSouth, originX: 0.5, originY: 0.5, depth: TERRAIN_DECAL_DEPTH },
  grassToCrystalWest: { key: assetKeys.aobMap.solanaGrassToCrystalEdgeWest, originX: 0.5, originY: 0.5, depth: TERRAIN_DECAL_DEPTH },
  grassToDirtEast: { key: assetKeys.aobMap.solanaGrassToDirtEdgeEast, originX: 0.5, originY: 0.5, depth: TERRAIN_DECAL_DEPTH },
  grassToDirtNorth: { key: assetKeys.aobMap.solanaGrassToDirtEdgeNorth, originX: 0.5, originY: 0.5, depth: TERRAIN_DECAL_DEPTH },
  grassToDirtSouth: { key: assetKeys.aobMap.solanaGrassToDirtEdgeSouth, originX: 0.5, originY: 0.5, depth: TERRAIN_DECAL_DEPTH },
  grassToDirtWest: { key: assetKeys.aobMap.solanaGrassToDirtEdgeWest, originX: 0.5, originY: 0.5, depth: TERRAIN_DECAL_DEPTH },
  grassToStoneEast: { key: assetKeys.aobMap.solanaGrassToStoneEdgeEast, originX: 0.5, originY: 0.5, depth: TERRAIN_DECAL_DEPTH },
  grassToStoneNorth: { key: assetKeys.aobMap.solanaGrassToStoneEdgeNorth, originX: 0.5, originY: 0.5, depth: TERRAIN_DECAL_DEPTH },
  grassToStoneSouth: { key: assetKeys.aobMap.solanaGrassToStoneEdgeSouth, originX: 0.5, originY: 0.5, depth: TERRAIN_DECAL_DEPTH },
  grassToStoneWest: { key: assetKeys.aobMap.solanaGrassToStoneEdgeWest, originX: 0.5, originY: 0.5, depth: TERRAIN_DECAL_DEPTH },
  shoreCornerNe: { key: assetKeys.aobMap.solanaShoreCornerNe, originX: 0.5, originY: 0.5, depth: TERRAIN_DECAL_DEPTH },
  shoreCornerNw: { key: assetKeys.aobMap.solanaShoreCornerNw, originX: 0.5, originY: 0.5, depth: TERRAIN_DECAL_DEPTH },
  shoreCornerSe: { key: assetKeys.aobMap.solanaShoreCornerSe, originX: 0.5, originY: 0.5, depth: TERRAIN_DECAL_DEPTH },
  shoreCornerSw: { key: assetKeys.aobMap.solanaShoreCornerSw, originX: 0.5, originY: 0.5, depth: TERRAIN_DECAL_DEPTH },
  shoreEdgeEast: { key: assetKeys.aobMap.solanaShoreEdgeEast, originX: 0.5, originY: 0.5, depth: TERRAIN_DECAL_DEPTH },
  shoreEdgeNorth: { key: assetKeys.aobMap.solanaShoreEdgeNorth, originX: 0.5, originY: 0.5, depth: TERRAIN_DECAL_DEPTH },
  shoreEdgeSouth: { key: assetKeys.aobMap.solanaShoreEdgeSouth, originX: 0.5, originY: 0.5, depth: TERRAIN_DECAL_DEPTH },
  shoreEdgeWest: { key: assetKeys.aobMap.solanaShoreEdgeWest, originX: 0.5, originY: 0.5, depth: TERRAIN_DECAL_DEPTH },
};

export const grassDetailFrames: Record<GrassDetailFrame, AtlasFrameDef> = {
  crystalFlowers: { x: 44, y: 151, width: 180, height: 115, originX: 0.5, originY: 0.88 },
  rockMoss: { x: 298, y: 149, width: 181, height: 117, originX: 0.5, originY: 0.88 },
  tallGrass: { x: 563, y: 126, width: 156, height: 137, originX: 0.5, originY: 0.9 },
  stonePatch: { x: 797, y: 133, width: 180, height: 135, originX: 0.5, originY: 0.88 },
  lowFlowers: { x: 63, y: 421, width: 161, height: 115, originX: 0.5, originY: 0.88 },
  purpleSpikes: { x: 305, y: 391, width: 168, height: 152, originX: 0.5, originY: 0.9 },
  twinCrystal: { x: 551, y: 402, width: 180, height: 135, originX: 0.5, originY: 0.9 },
  leafFlowers: { x: 795, y: 405, width: 174, height: 132, originX: 0.5, originY: 0.88 },
  crystalGrass: { x: 44, y: 692, width: 180, height: 127, originX: 0.5, originY: 0.9 },
  berryGrass: { x: 302, y: 696, width: 168, height: 117, originX: 0.5, originY: 0.88 },
  brokenStone: { x: 548, y: 687, width: 183, height: 137, originX: 0.5, originY: 0.9 },
  smallCrystals: { x: 801, y: 689, width: 173, height: 128, originX: 0.5, originY: 0.9 },
};

export const villagePropFrames: Record<VillagePropFrame, AtlasFrameDef> = {
  bannerSmall: { x: 57, y: 94, width: 130, height: 229, originX: 0.5, originY: 0.96, shadow: { width: 34, height: 12, y: 0, alpha: 0.2 } },
  bannerTall: { x: 253, y: 40, width: 160, height: 285, originX: 0.5, originY: 0.97, shadow: { width: 36, height: 12, y: 0, alpha: 0.2 } },
  crate: { x: 502, y: 117, width: 146, height: 140, originX: 0.5, originY: 0.88, shadow: { width: 56, height: 16, y: 2, alpha: 0.18 } },
  crateStack: { x: 752, y: 83, width: 198, height: 194, originX: 0.5, originY: 0.9, shadow: { width: 66, height: 19, y: 2, alpha: 0.2 } },
  barrel: { x: 54, y: 413, width: 125, height: 151, originX: 0.5, originY: 0.91, shadow: { width: 45, height: 15, y: 2, alpha: 0.18 } },
  barrelStack: { x: 289, y: 429, width: 180, height: 139, originX: 0.5, originY: 0.91, shadow: { width: 60, height: 16, y: 2, alpha: 0.18 } },
  lampTall: { x: 568, y: 365, width: 131, height: 225, originX: 0.5, originY: 0.97, shadow: { width: 32, height: 12, y: 0, alpha: 0.2 } },
  lampSmall: { x: 799, y: 386, width: 128, height: 204, originX: 0.5, originY: 0.97, shadow: { width: 32, height: 12, y: 0, alpha: 0.2 } },
  validatorObelisk: { x: 54, y: 688, width: 150, height: 260, originX: 0.5, originY: 0.96, shadow: { width: 54, height: 18, y: 1, alpha: 0.2 } },
  crystalBench: { x: 303, y: 735, width: 174, height: 124, originX: 0.5, originY: 0.9, shadow: { width: 62, height: 16, y: 2, alpha: 0.17 } },
  sacks: { x: 547, y: 727, width: 184, height: 140, originX: 0.5, originY: 0.91, shadow: { width: 62, height: 16, y: 2, alpha: 0.18 } },
  supplyPile: { x: 788, y: 733, width: 178, height: 134, originX: 0.5, originY: 0.91, shadow: { width: 64, height: 17, y: 2, alpha: 0.18 } },
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
    case "stable":
      return completed ? assetKeys.aobBuildingStatic.stable[ownerAge] : assetKeys.aobBuildingStatic.construction;
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

export function buildingRuinVisualForType(type: BuildingType): BuildingRuinVisualDef | undefined {
  switch (type) {
    case "house":
    case "lumberCamp":
    case "stoneCamp":
    case "goldCamp":
    case "watchTower":
      return {
        key: assetKeys.aobBuildingRuins.small,
        maxSize: 190,
        originX: 0.5,
        originY: 1,
        y: 0,
        alpha: 0.96,
      };
    case "farm":
    case "mill":
    case "barracks":
    case "stable":
      return {
        key: assetKeys.aobBuildingRuins.medium,
        maxSize: 245,
        originX: 0.5,
        originY: 1,
        y: 0,
        alpha: 0.96,
      };
    case "townCenter":
      return {
        key: assetKeys.aobBuildingRuins.large,
        maxSize: 320,
        originX: 0.5,
        originY: 1,
        y: 0,
        alpha: 0.98,
      };
    default:
      return undefined;
  }
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
