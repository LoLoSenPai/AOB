import type { ResourceNodeType } from "../core/entities/types";
import type { TileCoord, TileType } from "../core/state/types";

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
  resources: Record<Exclude<ResourceNodeType, "farmFood">, TileCoord[]>;
  village: {
    townCenter: TileCoord;
    house: TileCoord;
    workers: TileCoord[];
  };
};

export const initialMapLayout: MapLayout = {
  width: 128,
  height: 128,
  terrain: [
    { kind: "ellipse", tile: "water", cx: 16, cy: 106, rx: 28, ry: 27 },
    { kind: "rect", tile: "water", x: 0, y: 112, w: 38, h: 16 },
    { kind: "ellipse", tile: "water", cx: 2, cy: 96, rx: 12, ry: 18 },

    { kind: "path", tile: "path", radius: 1, points: [{ x: 34, y: 57 }, { x: 46, y: 58 }, { x: 58, y: 60 }, { x: 78, y: 58 }, { x: 91, y: 49 }] },
    { kind: "path", tile: "path", radius: 1, points: [{ x: 59, y: 62 }, { x: 58, y: 75 }, { x: 50, y: 88 }, { x: 38, y: 100 }] },
    { kind: "path", tile: "path", radius: 1, points: [{ x: 58, y: 60 }, { x: 45, y: 48 }, { x: 32, y: 38 }, { x: 22, y: 28 }] },

    { kind: "ellipse", tile: "dirt", cx: 102, cy: 43, rx: 25, ry: 24 },
    { kind: "rect", tile: "dirt", x: 82, y: 52, w: 32, h: 14 },
    { kind: "ellipse", tile: "stoneGround", cx: 104, cy: 42, rx: 17, ry: 16 },
    { kind: "rect", tile: "stoneGround", x: 96, y: 33, w: 18, h: 20 },

    { kind: "ellipse", tile: "crystalGround", cx: 108, cy: 100, rx: 22, ry: 20 },
    { kind: "rect", tile: "crystalGround", x: 98, y: 88, w: 26, h: 24 },
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
      { x: 95, y: 36 }, { x: 100, y: 38 }, { x: 106, y: 39 }, { x: 111, y: 42 },
      { x: 97, y: 47 }, { x: 103, y: 49 }, { x: 109, y: 51 }, { x: 113, y: 55 },
    ],
    gold: [
      { x: 101, y: 89 }, { x: 108, y: 91 }, { x: 116, y: 92 }, { x: 122, y: 96 },
      { x: 102, y: 103 }, { x: 110, y: 106 }, { x: 119, y: 108 }, { x: 123, y: 113 },
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
