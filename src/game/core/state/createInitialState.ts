import { ENEMY_ID, PLAYER_ID, TILE_SIZE } from "../../data/constants";
import { createEmptyStock } from "../../data/definitions";
import { initialMapLayout, type TerrainStamp } from "../../data/mapLayout";
import { setMapTile, stampBuildingGround } from "../systems/mapEditing";
import type { GameState, MapState, TileCoord, TileType } from "./types";
import { createBuilding, createResourceNode, createUnit } from "./entityFactory";

export function createInitialState(): GameState {
  const state: GameState = {
    tick: 0,
    nextEntityNumber: 1,
    nextMessageNumber: 1,
    rngSeed: 1337,
    map: createMap(),
    players: {
      [PLAYER_ID]: {
        id: PLAYER_ID,
        label: "Solo Village",
        resources: {
          ...createEmptyStock(),
          food: 220,
          wood: 300,
          stone: 100,
          gold: 40,
        },
        population: 0,
        populationCap: 0,
        age: "genesis",
      },
      [ENEMY_ID]: {
        id: ENEMY_ID,
        label: "Inactive Opponent",
        resources: createEmptyStock(),
        population: 0,
        populationCap: 999,
        age: "genesis",
      },
    },
    entities: {},
    selection: {
      playerId: PLAYER_ID,
      selectedIds: [],
    },
    messages: [],
    objectives: {
      completedIds: [],
    },
  };

  seedVillage(state);
  seedResources(state);
  return state;
}

export function addMessage(state: GameState, text: string): void {
  state.messages.push({
    id: state.nextMessageNumber,
    tick: state.tick,
    text,
  });
  state.nextMessageNumber += 1;
  state.messages = state.messages.slice(-5);
}

function createMap(): MapState {
  const width = initialMapLayout.width;
  const height = initialMapLayout.height;
  const tiles: TileType[] = Array.from({ length: width * height }, () => "grass");

  const map: MapState = {
    width,
    height,
    tileSize: TILE_SIZE,
    tiles,
  };

  for (const stamp of initialMapLayout.terrain) {
    applyTerrainStamp(map, stamp);
  }

  return map;
}

function seedVillage(state: GameState): void {
  const townCenter = createBuilding(state, "townCenter", PLAYER_ID, initialMapLayout.village.townCenter, true);
  state.entities[townCenter.id] = townCenter;
  stampBuildingGround(state.map, townCenter.tile ?? initialMapLayout.village.townCenter, townCenter.building!.footprint);

  const house = createBuilding(state, "house", PLAYER_ID, initialMapLayout.village.house, true);
  state.entities[house.id] = house;
  stampBuildingGround(state.map, house.tile ?? initialMapLayout.village.house, house.building!.footprint);

  for (const position of initialMapLayout.village.workers) {
    const worker = createUnit(state, "worker", PLAYER_ID, {
      x: position.x * TILE_SIZE + TILE_SIZE / 2,
      y: position.y * TILE_SIZE + TILE_SIZE / 2,
    });
    state.entities[worker.id] = worker;
  }
}

function seedResources(state: GameState): void {
  for (const tile of initialMapLayout.resources.tree) {
    const tree = createResourceNode(state, "tree", tile);
    state.entities[tree.id] = tree;
  }

  for (const tile of initialMapLayout.resources.stone) {
    const stone = createResourceNode(state, "stone", tile);
    state.entities[stone.id] = stone;
  }

  for (const tile of initialMapLayout.resources.gold) {
    const gold = createResourceNode(state, "gold", tile);
    state.entities[gold.id] = gold;
  }

  for (const tile of initialMapLayout.resources.berries) {
    const berries = createResourceNode(state, "berries", tile);
    state.entities[berries.id] = berries;
  }
}

function applyTerrainStamp(map: MapState, stamp: TerrainStamp): void {
  if (stamp.kind === "rect") {
    for (let y = stamp.y; y < stamp.y + stamp.h; y += 1) {
      for (let x = stamp.x; x < stamp.x + stamp.w; x += 1) {
        setMapTile(map, { x, y }, stamp.tile);
      }
    }
    return;
  }

  if (stamp.kind === "ellipse") {
    for (let y = Math.floor(stamp.cy - stamp.ry); y <= Math.ceil(stamp.cy + stamp.ry); y += 1) {
      for (let x = Math.floor(stamp.cx - stamp.rx); x <= Math.ceil(stamp.cx + stamp.rx); x += 1) {
        const nx = (x - stamp.cx) / stamp.rx;
        const ny = (y - stamp.cy) / stamp.ry;
        if (nx * nx + ny * ny <= 1) {
          setMapTile(map, { x, y }, stamp.tile);
        }
      }
    }
    return;
  }

  for (let i = 0; i < stamp.points.length - 1; i += 1) {
    const start = stamp.points[i];
    const end = stamp.points[i + 1];
    if (!start || !end) {
      continue;
    }
    stampPathSegment(map, start, end, stamp.tile, stamp.radius);
  }
}

function stampPathSegment(map: MapState, start: TileCoord, end: TileCoord, tile: TileType, radius: number): void {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const steps = Math.max(Math.abs(dx), Math.abs(dy), 1);
  for (let i = 0; i <= steps; i += 1) {
    const t = i / steps;
    const cx = Math.round(start.x + dx * t);
    const cy = Math.round(start.y + dy * t);
    for (let y = cy - radius; y <= cy + radius; y += 1) {
      for (let x = cx - radius; x <= cx + radius; x += 1) {
        if ((x - cx) * (x - cx) + (y - cy) * (y - cy) <= radius * radius + 0.8) {
          setMapTile(map, { x, y }, tile);
        }
      }
    }
  }
}
