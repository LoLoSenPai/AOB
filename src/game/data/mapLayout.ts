import type { ResourceNodeType } from "../core/entities/types";
import type { TileCoord, TileType } from "../core/state/types";
import type { GrassDetailFrame, ImageDecalKey, VillagePropFrame, WorldSpriteOverlayKey } from "./visuals";

export type TerrainStamp =
  | {
      kind: "rect";
      tile: TileType;
      x: number;
      y: number;
      w: number;
      h: number;
    }
  | {
      kind: "ellipse";
      tile: TileType;
      cx: number;
      cy: number;
      rx: number;
      ry: number;
    }
  | {
      kind: "path";
      tile: TileType;
      points: TileCoord[];
      radius: number;
    };

export type MapLayout = {
  width: number;
  height: number;
  terrain: TerrainStamp[];
  visualOverlays: VisualOverlay[];
  resources: Record<Exclude<ResourceNodeType, "farmFood">, TileCoord[]>;
  village: {
    townCenter: TileCoord;
    house: TileCoord;
    workers: TileCoord[];
  };
};

export const BTC_VILLAGE_DISCOVERY_TILE: TileCoord = { x: 154, y: 62 };

export type VisualOverlay =
  | {
      kind: "villageGround" | "pathDecal";
      tile: TileCoord;
      width: number;
      height: number;
      angle?: number;
      alpha?: number;
      depthOffset?: number;
      flipX?: boolean;
      flipY?: boolean;
    }
  | {
      kind: "imageDecal";
      asset: ImageDecalKey;
      tile: TileCoord;
      width: number;
      height?: number;
      angle?: number;
      alpha?: number;
      depthOffset?: number;
      flipX?: boolean;
      flipY?: boolean;
    }
  | {
      kind: "worldSprite";
      asset: WorldSpriteOverlayKey;
      tile: TileCoord;
      width: number;
      height?: number;
      angle?: number;
      alpha?: number;
      depthOffset?: number;
      flipX?: boolean;
      flipY?: boolean;
    }
  | {
      kind: "grassDetail";
      frame: GrassDetailFrame;
      tile: TileCoord;
      width: number;
      angle?: number;
      alpha?: number;
      depthOffset?: number;
      flipX?: boolean;
      flipY?: boolean;
    }
  | {
      kind: "villageProp";
      frame: VillagePropFrame;
      tile: TileCoord;
      width: number;
      angle?: number;
      alpha?: number;
      depthOffset?: number;
      flipX?: boolean;
      flipY?: boolean;
    };

export const initialMapLayout: MapLayout = {
  width: 224,
  height: 176,
  terrain: [
    { kind: "ellipse", tile: "water", cx: 16, cy: 106, rx: 28, ry: 27 },
    { kind: "rect", tile: "water", x: 0, y: 112, w: 38, h: 16 },
    { kind: "ellipse", tile: "water", cx: 2, cy: 96, rx: 12, ry: 18 },
    { kind: "rect", tile: "water", x: 0, y: 128, w: 58, h: 32 },
    { kind: "ellipse", tile: "water", cx: 210, cy: 42, rx: 23, ry: 48 },
    { kind: "ellipse", tile: "water", cx: 212, cy: 142, rx: 34, ry: 24 },
    { kind: "rect", tile: "water", x: 216, y: 0, w: 8, h: 176 },

    { kind: "ellipse", tile: "dirt", cx: 102, cy: 43, rx: 25, ry: 24 },
    { kind: "rect", tile: "dirt", x: 82, y: 52, w: 32, h: 14 },
    { kind: "ellipse", tile: "stoneGround", cx: 104, cy: 42, rx: 17, ry: 16 },
    { kind: "rect", tile: "stoneGround", x: 96, y: 33, w: 18, h: 20 },

    { kind: "ellipse", tile: "crystalGround", cx: 108, cy: 100, rx: 22, ry: 20 },
    { kind: "rect", tile: "crystalGround", x: 98, y: 88, w: 26, h: 24 },

    { kind: "ellipse", tile: "dirt", cx: 154, cy: 59, rx: 30, ry: 24 },
    { kind: "rect", tile: "dirt", x: 136, y: 52, w: 42, h: 20 },
    { kind: "ellipse", tile: "dirt", cx: 164, cy: 48, rx: 17, ry: 14 },
    { kind: "ellipse", tile: "dirt", cx: 138, cy: 71, rx: 13, ry: 10 },
  ],
  visualOverlays: [
    { kind: "villageGround", tile: { x: 62, y: 61 }, width: 760, height: 506, alpha: 0.96 },
    { kind: "imageDecal", asset: "stoneGroundPatch", tile: { x: 104, y: 44 }, width: 560, height: 410, alpha: 0.94, depthOffset: -4 },
    { kind: "imageDecal", asset: "grassToStoneSouth", tile: { x: 104, y: 32 }, width: 470, height: 320, alpha: 0.46 },
    { kind: "imageDecal", asset: "grassToStoneWest", tile: { x: 119, y: 44 }, width: 420, height: 320, alpha: 0.42 },
    { kind: "imageDecal", asset: "grassToStoneEast", tile: { x: 89, y: 44 }, width: 420, height: 320, alpha: 0.42 },
    { kind: "imageDecal", asset: "grassToStoneNorth", tile: { x: 104, y: 58 }, width: 470, height: 320, alpha: 0.42 },
    { kind: "imageDecal", asset: "crystalGroundPatch", tile: { x: 112, y: 102 }, width: 560, height: 410, alpha: 0.94, depthOffset: -4 },
    { kind: "imageDecal", asset: "grassToCrystalSouth", tile: { x: 112, y: 87 }, width: 480, height: 330, alpha: 0.46 },
    { kind: "imageDecal", asset: "grassToCrystalWest", tile: { x: 128, y: 102 }, width: 430, height: 330, alpha: 0.42 },
    { kind: "imageDecal", asset: "grassToCrystalEast", tile: { x: 96, y: 102 }, width: 430, height: 330, alpha: 0.42 },
    { kind: "imageDecal", asset: "grassToCrystalNorth", tile: { x: 112, y: 117 }, width: 480, height: 330, alpha: 0.4 },
    { kind: "imageDecal", asset: "btcCopperGround", tile: { x: 154, y: 61 }, width: 780, height: 538, alpha: 0.9, depthOffset: -2 },
    { kind: "imageDecal", asset: "btcMiningPlaza", tile: { x: 164, y: 48 }, width: 520, height: 335, alpha: 0.86, depthOffset: 0 },
    { kind: "worldSprite", asset: "btcDarkRockLarge", tile: { x: 132, y: 49 }, width: 96, depthOffset: -6 },
    { kind: "worldSprite", asset: "btcDarkRockSmall", tile: { x: 137, y: 47 }, width: 58, depthOffset: -6 },
    { kind: "worldSprite", asset: "btcGoldOreLarge", tile: { x: 174, y: 48 }, width: 112, depthOffset: -6 },
    { kind: "worldSprite", asset: "btcGoldOreSmall", tile: { x: 181, y: 52 }, width: 64, depthOffset: -6 },
    { kind: "worldSprite", asset: "btcTownCenterT1", tile: { x: 154, y: 60 }, width: 270, depthOffset: 12 },
    { kind: "worldSprite", asset: "btcHouseT1", tile: { x: 141, y: 58 }, width: 152, depthOffset: 8 },
    { kind: "worldSprite", asset: "btcMarketStall", tile: { x: 145, y: 48 }, width: 118, depthOffset: 4 },
    { kind: "worldSprite", asset: "btcMiningCampT1", tile: { x: 170, y: 55 }, width: 172, depthOffset: 8 },
    { kind: "worldSprite", asset: "btcBarracksT1", tile: { x: 168, y: 66 }, width: 190, depthOffset: 8 },
    { kind: "worldSprite", asset: "btcStableT1", tile: { x: 148, y: 74 }, width: 180, depthOffset: 8 },
    { kind: "worldSprite", asset: "btcForge", tile: { x: 159, y: 72 }, width: 112, depthOffset: 5 },
    { kind: "worldSprite", asset: "btcWatchtowerT1", tile: { x: 137, y: 70 }, width: 118, depthOffset: 9 },
    { kind: "worldSprite", asset: "btcBanner", tile: { x: 153, y: 47 }, width: 64, depthOffset: 7 },
    { kind: "worldSprite", asset: "btcLanternPost", tile: { x: 151, y: 70 }, width: 44, depthOffset: 6 },
    { kind: "worldSprite", asset: "btcCrateStack", tile: { x: 162, y: 65 }, width: 72, depthOffset: 6 },
    { kind: "worldSprite", asset: "btcMiningCart", tile: { x: 173, y: 61 }, width: 70, depthOffset: 6 },
    { kind: "worldSprite", asset: "btcStoneObelisk", tile: { x: 177, y: 69 }, width: 64, depthOffset: 7 },
    { kind: "worldSprite", asset: "btcCampfire", tile: { x: 149, y: 66 }, width: 54, depthOffset: 2 },
    { kind: "worldSprite", asset: "btcDeadTreeStump", tile: { x: 135, y: 61 }, width: 46, depthOffset: 1 },
    { kind: "worldSprite", asset: "btcWallHorizontal", tile: { x: 142, y: 80 }, width: 156, depthOffset: 4 },
    { kind: "worldSprite", asset: "btcGateHorizontal", tile: { x: 152, y: 80 }, width: 126, depthOffset: 5 },
    { kind: "worldSprite", asset: "btcWallHorizontal", tile: { x: 162, y: 80 }, width: 156, depthOffset: 4 },
  ],
  resources: {
    tree: [
      { x: 14, y: 18 }, { x: 19, y: 17 }, { x: 24, y: 19 }, { x: 29, y: 20 }, { x: 34, y: 22 },
      { x: 12, y: 24 }, { x: 17, y: 25 }, { x: 22, y: 27 }, { x: 27, y: 28 }, { x: 32, y: 30 }, { x: 37, y: 31 },
      { x: 10, y: 31 }, { x: 15, y: 33 }, { x: 20, y: 34 }, { x: 25, y: 36 }, { x: 30, y: 37 }, { x: 35, y: 39 },
      { x: 13, y: 40 }, { x: 18, y: 42 }, { x: 23, y: 44 }, { x: 28, y: 45 }, { x: 33, y: 47 }, { x: 38, y: 48 },
      { x: 16, y: 50 }, { x: 21, y: 52 }, { x: 26, y: 54 }, { x: 31, y: 56 },
      { x: 18, y: 66 }, { x: 24, y: 69 }, { x: 30, y: 72 }, { x: 36, y: 76 },
    ],
    stone: [
      { x: 99, y: 38 }, { x: 103, y: 37 }, { x: 108, y: 39 }, { x: 112, y: 42 },
      { x: 101, y: 46 }, { x: 105, y: 48 }, { x: 110, y: 50 }, { x: 112, y: 53 },
    ],
    gold: [
      { x: 106, y: 95 }, { x: 112, y: 94 }, { x: 118, y: 96 }, { x: 121, y: 100 },
      { x: 105, y: 104 }, { x: 111, y: 106 }, { x: 117, y: 108 }, { x: 120, y: 111 },
    ],
    berries: [
      { x: 48, y: 52 }, { x: 53, y: 55 }, { x: 67, y: 52 }, { x: 71, y: 56 },
      { x: 46, y: 82 }, { x: 52, y: 86 }, { x: 60, y: 92 }, { x: 66, y: 96 },
    ],
  },
  village: {
    townCenter: { x: 58, y: 58 },
    house: { x: 44, y: 56 },
    workers: [
      { x: 57, y: 66 },
      { x: 60, y: 67 },
      { x: 63, y: 66 },
      { x: 55, y: 54 },
      { x: 66, y: 55 },
      { x: 52, y: 67 },
    ],
  },
};
