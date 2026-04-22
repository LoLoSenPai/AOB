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
  const tiles: TileType[] = Array.from({ length: width * height }, (_, index) => {
    const x = index % width;
    const y = Math.floor(index / width);
    const noise = (x * 17 + y * 31 + Math.floor(x / 7) * 13) % 17;
    return noise === 0 ? "grassDark" : "grass";
  });

  function setTile(x: number, y: number, tile: TileType): void {
    if (x >= 0 && y >= 0 && x < width && y < height) {
      tiles[y * width + x] = tile;
    }
  }

  function fillEllipse(cx: number, cy: number, rx: number, ry: number, tile: TileType): void {
    for (let y = cy - ry; y <= cy + ry; y += 1) {
      for (let x = cx - rx; x <= cx + rx; x += 1) {
        const dx = (x - cx) / rx;
        const dy = (y - cy) / ry;
        if (dx * dx + dy * dy <= 1) {
          setTile(x, y, tile);
        }
      }
    }
  }

  fillEllipse(58, 58, 20, 15, "grass");
  fillEllipse(34, 45, 14, 10, "grass");
  fillEllipse(92, 47, 15, 11, "grass");
  fillEllipse(84, 80, 18, 11, "grass");
  fillEllipse(37, 82, 15, 10, "grass");

  fillEllipse(89, 45, 14, 11, "stoneGround");
  fillEllipse(82, 80, 10, 8, "stoneGround");
  fillEllipse(103, 64, 14, 13, "crystalGround");

  fillEllipse(17, 101, 20, 17, "water");
  fillEllipse(7, 113, 12, 16, "deepWater");
  fillEllipse(109, 23, 7, 14, "water");

  return {
    width,
    height,
    tileSize: TILE_SIZE,
    tiles,
  };
}

function seedVillage(state: GameState): void {
  const townCenter = createBuilding(state, "townCenter", PLAYER_ID, { x: 55, y: 55 }, true);
  state.entities[townCenter.id] = townCenter;

  const house = createBuilding(state, "house", PLAYER_ID, { x: 48, y: 55 }, true);
  state.entities[house.id] = house;

  const starts = [
    { x: 55, y: 63 },
    { x: 58, y: 64 },
    { x: 61, y: 63 },
    { x: 53, y: 51 },
    { x: 64, y: 52 },
    { x: 50, y: 64 },
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
    [26, 32],
    [29, 31],
    [32, 33],
    [24, 36],
    [28, 37],
    [33, 38],
    [37, 35],
    [23, 42],
    [28, 44],
    [34, 44],
    [39, 42],
    [17, 51],
    [22, 55],
    [28, 55],
    [34, 53],
    [39, 57],
    [75, 32],
    [79, 30],
    [83, 34],
    [88, 36],
  ];

  for (const [x, y] of treeTiles) {
    const tree = createResourceNode(state, "tree", { x, y });
    state.entities[tree.id] = tree;
  }

  for (const [x, y] of [
    [82, 38],
    [86, 39],
    [91, 42],
    [96, 44],
    [88, 52],
    [93, 54],
    [78, 76],
    [84, 83],
  ]) {
    const stone = createResourceNode(state, "stone", { x, y });
    state.entities[stone.id] = stone;
  }

  for (const [x, y] of [
    [100, 55],
    [105, 58],
    [109, 64],
    [97, 71],
    [103, 75],
  ]) {
    const gold = createResourceNode(state, "gold", { x, y });
    state.entities[gold.id] = gold;
  }

  for (const [x, y] of [
    [65, 50],
    [68, 51],
    [72, 53],
    [70, 65],
    [74, 66],
    [49, 69],
    [52, 70],
    [35, 75],
  ]) {
    const berries = createResourceNode(state, "berries", { x, y });
    state.entities[berries.id] = berries;
  }
}
