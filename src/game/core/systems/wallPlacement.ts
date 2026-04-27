import type { Footprint } from "../entities/types";
import type { TileCoord } from "../state/types";

export const WALL_SEGMENT_TILE_SPAN = 4;

export type WallLineDirection = "horizontal" | "vertical";

export type WallLineSegment = {
  tile: TileCoord;
  footprint: Footprint;
  direction: WallLineDirection;
};

export function wallLineSegments(start: TileCoord, end: TileCoord): WallLineSegment[] {
  const horizontal = Math.abs(end.x - start.x) >= Math.abs(end.y - start.y);
  const delta = horizontal ? end.x - start.x : end.y - start.y;
  const direction = delta < 0 ? -1 : 1;
  const tileCount = Math.abs(delta) + 1;
  const segmentCount = Math.ceil(tileCount / WALL_SEGMENT_TILE_SPAN);
  const segments: WallLineSegment[] = [];

  for (let index = 0; index < segmentCount; index += 1) {
    const offset = index * WALL_SEGMENT_TILE_SPAN;
    const length = Math.min(WALL_SEGMENT_TILE_SPAN, tileCount - offset);
    const value =
      direction > 0
        ? (horizontal ? start.x : start.y) + offset
        : (horizontal ? start.x : start.y) - offset - length + 1;
    segments.push({
      tile: horizontal ? { x: value, y: start.y } : { x: start.x, y: value },
      footprint: horizontal ? { w: length, h: 1 } : { w: 1, h: length },
      direction: horizontal ? "horizontal" : "vertical",
    });
  }

  return segments;
}

export function wallLineCoveredTiles(start: TileCoord, end: TileCoord): TileCoord[] {
  return wallLineSegments(start, end).flatMap((segment) => {
    const tiles: TileCoord[] = [];
    for (let y = 0; y < segment.footprint.h; y += 1) {
      for (let x = 0; x < segment.footprint.w; x += 1) {
        tiles.push({ x: segment.tile.x + x, y: segment.tile.y + y });
      }
    }
    return tiles;
  });
}
