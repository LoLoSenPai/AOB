import { ENEMY_ID, PLAYER_ID, TILE_SIZE } from "../../data/constants";
import { createEmptyStock } from "../../data/definitions";
import type { GameState, MapState, TileType } from "./types";
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
  const width = 128;
  const height = 128;
  const terrainChunkSize = 8;
  const tiles: TileType[] = Array.from({ length: width * height }, () => "grass");

  function setTile(x: number, y: number, tile: TileType): void {
    if (x >= 0 && y >= 0 && x < width && y < height) {
      tiles[y * width + x] = tile;
    }
  }

  function fillChunk(cx: number, cy: number, tile: TileType): void {
    for (let y = cy * terrainChunkSize; y < (cy + 1) * terrainChunkSize; y += 1) {
      for (let x = cx * terrainChunkSize; x < (cx + 1) * terrainChunkSize; x += 1) {
        setTile(x, y, tile);
      }
    }
  }

  function setChunkShape(chunks: Array<readonly [number, number]>, tile: TileType): void {
    for (const [cx, cy] of chunks) {
      fillChunk(cx, cy, tile);
    }
  }

  // South-west lake. Keep the whole corner in shallow water so the shoreline reads cleanly.
  setChunkShape(
    [
      [0, 9], [1, 9], [2, 9],
      [0, 10], [1, 10], [2, 10], [3, 10],
      [0, 11], [1, 11], [2, 11], [3, 11],
      [0, 12], [1, 12], [2, 12], [3, 12], [4, 12],
      [0, 13], [1, 13], [2, 13], [3, 13], [4, 13],
      [0, 14], [1, 14], [2, 14], [3, 14],
      [0, 15], [1, 15], [2, 15],
    ],
    "water",
  );

  // North-east stone quarry: grass plateau at the top, dirt excavation below, rocky core inside.
  setChunkShape(
    [
      [10, 2], [11, 2], [12, 2],
      [9, 3], [10, 3], [11, 3], [12, 3], [13, 3],
      [9, 4], [10, 4], [11, 4], [12, 4], [13, 4],
      [9, 5], [10, 5], [11, 5], [12, 5], [13, 5],
      [10, 6], [11, 6], [12, 6], [13, 6],
      [10, 7], [11, 7], [12, 7],
    ],
    "dirt",
  );

  setChunkShape(
    [
      [10, 3], [11, 3], [12, 3],
      [10, 4], [11, 4], [12, 4],
      [10, 5], [11, 5], [12, 5],
      [11, 6],
    ],
    "stoneGround",
  );

  // South-east crystal field, kept separate from the quarry by a full grass band.
  setChunkShape(
    [
      [13, 10], [14, 10],
      [13, 11], [14, 11], [15, 11],
      [13, 12], [14, 12], [15, 12],
      [14, 13], [15, 13],
      [14, 14], [15, 14],
    ],
    "crystalGround",
  );

  return {
    width,
    height,
    tileSize: TILE_SIZE,
    tiles,
  };
}

function seedVillage(state: GameState): void {
  const townCenter = createBuilding(state, "townCenter", PLAYER_ID, { x: 58, y: 58 }, true);
  state.entities[townCenter.id] = townCenter;

  const house = createBuilding(state, "house", PLAYER_ID, { x: 49, y: 58 }, true);
  state.entities[house.id] = house;

  const starts = [
    { x: 57, y: 66 },
    { x: 60, y: 67 },
    { x: 63, y: 66 },
    { x: 55, y: 54 },
    { x: 66, y: 55 },
    { x: 52, y: 67 },
  ];

  for (const position of starts) {
    const worker = createUnit(state, "worker", PLAYER_ID, {
      x: position.x * TILE_SIZE + TILE_SIZE / 2,
      y: position.y * TILE_SIZE + TILE_SIZE / 2,
    });
    state.entities[worker.id] = worker;
  }
}

function seedResources(state: GameState): void {
  const treeTiles = [
    [14, 18], [19, 17], [24, 19], [29, 20], [34, 22],
    [12, 24], [17, 25], [22, 27], [27, 28], [32, 30], [37, 31],
    [10, 31], [15, 33], [20, 34], [25, 36], [30, 37], [35, 39],
    [13, 40], [18, 42], [23, 44], [28, 45], [33, 47], [38, 48],
    [16, 50], [21, 52], [26, 54], [31, 56],
    [18, 66], [24, 69], [30, 72], [36, 76],
  ];

  for (const [x, y] of treeTiles) {
    const tree = createResourceNode(state, "tree", { x, y });
    state.entities[tree.id] = tree;
  }

  for (const [x, y] of [
    [95, 40],
    [100, 42],
    [106, 44],
    [111, 47],
    [97, 51],
    [103, 54],
    [109, 56],
    [114, 59],
    [101, 62],
    [107, 65],
  ]) {
    const stone = createResourceNode(state, "stone", { x, y });
    state.entities[stone.id] = stone;
  }

  for (const [x, y] of [
    [112, 73],
    [118, 76],
    [122, 80],
    [111, 87],
    [118, 91],
    [123, 95],
    [114, 101],
    [120, 104],
  ]) {
    const gold = createResourceNode(state, "gold", { x, y });
    state.entities[gold.id] = gold;
  }

  for (const [x, y] of [
    [48, 52],
    [53, 55],
    [67, 52],
    [71, 56],
    [46, 82],
    [52, 86],
    [60, 92],
    [66, 96],
  ]) {
    const berries = createResourceNode(state, "berries", { x, y });
    state.entities[berries.id] = berries;
  }
}
