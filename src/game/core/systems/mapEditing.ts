import type { Footprint } from "../entities/types";
import type { MapState, TileCoord, TileType } from "../state/types";
import { getTileIndex, isInsideMap } from "../state/types";

export function setMapTile(map: MapState, tile: TileCoord, type: TileType): void {
  if (!isInsideMap(map, tile.x, tile.y)) {
    return;
  }
  map.tiles[getTileIndex(map, tile.x, tile.y)] = type;
}

export function stampBuildingGround(map: MapState, tile: TileCoord, footprint: Footprint, padding = 1): void {
  for (let y = tile.y - padding; y < tile.y + footprint.h + padding; y += 1) {
    for (let x = tile.x - padding; x < tile.x + footprint.w + padding; x += 1) {
      if (!isInsideMap(map, x, y)) {
        continue;
      }
      const current = map.tiles[getTileIndex(map, x, y)];
      if (current === "grass" || current === "grassDark" || current === "path" || current === "dirt") {
        setMapTile(map, { x, y }, "dirt");
      }
    }
  }
}
