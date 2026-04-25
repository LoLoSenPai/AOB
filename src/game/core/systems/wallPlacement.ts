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
  const segmentCount = Math.floor(Math.abs(delta) / WALL_SEGMENT_TILE_SPAN) + 1;
  const segments: WallLineSegment[] = [];

  for (let index = 0; index < segmentCount; index += 1) {
    const offset = index * WALL_SEGMENT_TILE_SPAN;
    const value =
      direction > 0
        ? (horizontal ? start.x : start.y) + offset
        : (horizontal ? start.x : start.y) - offset - WALL_SEGMENT_TILE_SPAN + 1;
    segments.push({
      tile: horizontal ? { x: value, y: start.y } : { x: start.x, y: value },
      footprint: horizontal ? { w: WALL_SEGMENT_TILE_SPAN, h: 1 } : { w: 1, h: WALL_SEGMENT_TILE_SPAN },
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
