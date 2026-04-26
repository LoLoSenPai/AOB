import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";

const outDir = path.resolve("public/maps");
fs.mkdirSync(outDir, { recursive: true });

const TILE_SIZE = 16;
const mapWidth = 128;
const mapHeight = 128;

const tileTypes = ["grass", "grassDark", "path", "dirt", "water", "deepWater", "stoneGround", "crystalGround"];
const tileGids = Object.fromEntries(tileTypes.map((type, index) => [type, index + 1]));

const terrainStamps = [
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
];

const resources = {
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
};

const village = {
  townCenter: { x: 58, y: 58, w: 10, h: 8 },
  house: { x: 44, y: 56, w: 5, h: 4 },
  workers: [
    { x: 57, y: 66 },
    { x: 60, y: 67 },
    { x: 63, y: 66 },
    { x: 55, y: 54 },
    { x: 66, y: 55 },
    { x: 52, y: 67 },
  ],
};

createBiomeTilesetImage(path.join(outDir, "aob-biome-tiles.png"));
writeJson("aob-biome-tileset.tsj", createTileset());
writeJson("solana-village.tmj", createMap());

console.log("Wrote public/maps/solana-village.tmj");

function createMap() {
  let nextObjectId = 1;
  const biomeTiles = Array.from({ length: mapWidth * mapHeight }, () => "grass");
  for (const stamp of terrainStamps) {
    applyStamp(biomeTiles, stamp);
  }

  const resourceObjects = [];
  for (const [type, tiles] of Object.entries(resources)) {
    for (const tile of tiles) {
      resourceObjects.push(pointObject(nextObjectId++, `${type}-${resourceObjects.length + 1}`, type, tile));
    }
  }

  const villageObjects = [
    rectObject(nextObjectId++, "town-center", "townCenter", village.townCenter),
    rectObject(nextObjectId++, "starter-house", "house", village.house),
    ...village.workers.map((tile, index) => pointObject(nextObjectId++, `worker-${index + 1}`, "worker", tile)),
  ];

  const roadObjects = terrainStamps
    .filter((stamp) => stamp.kind === "path")
    .map((stamp, index) => polylineObject(nextObjectId++, `road-${index + 1}`, stamp.points, stamp.radius));

  return {
    type: "map",
    version: "1.10",
    tiledversion: "1.11.2",
    orientation: "orthogonal",
    renderorder: "right-down",
    compressionlevel: -1,
    infinite: false,
    width: mapWidth,
    height: mapHeight,
    tilewidth: TILE_SIZE,
    tileheight: TILE_SIZE,
    nextlayerid: 5,
    nextobjectid: nextObjectId,
    properties: [
      { name: "purpose", type: "string", value: "Authoring map. Tiled paints gameplay/biome masks; runtime turns them into richer terrain." },
      { name: "gameTileSize", type: "int", value: TILE_SIZE },
      { name: "initialCameraTileX", type: "int", value: 62 },
      { name: "initialCameraTileY", type: "int", value: 64 },
    ],
    tilesets: [{ firstgid: 1, source: "aob-biome-tileset.tsj" }],
    layers: [
      {
        id: 1,
        name: "biome-mask",
        type: "tilelayer",
        opacity: 1,
        visible: true,
        x: 0,
        y: 0,
        width: mapWidth,
        height: mapHeight,
        data: biomeTiles.map((type) => tileGids[type]),
        properties: [{ name: "runtimeRole", type: "string", value: "terrain" }],
      },
      {
        id: 2,
        name: "roads-guide",
        type: "objectgroup",
        opacity: 1,
        visible: true,
        x: 0,
        y: 0,
        objects: roadObjects,
        properties: [{ name: "runtimeRole", type: "string", value: "roadGuide" }],
      },
      {
        id: 3,
        name: "resource-spawns",
        type: "objectgroup",
        opacity: 1,
        visible: true,
        x: 0,
        y: 0,
        objects: resourceObjects,
        properties: [{ name: "runtimeRole", type: "string", value: "resources" }],
      },
      {
        id: 4,
        name: "starting-village",
        type: "objectgroup",
        opacity: 1,
        visible: true,
        x: 0,
        y: 0,
        objects: villageObjects,
        properties: [{ name: "runtimeRole", type: "string", value: "village" }],
      },
    ],
  };
}

function createTileset() {
  return {
    type: "tileset",
    version: "1.10",
    tiledversion: "1.11.2",
    name: "aob-biome",
    tilewidth: TILE_SIZE,
    tileheight: TILE_SIZE,
    spacing: 0,
    margin: 0,
    tilecount: tileTypes.length,
    columns: tileTypes.length,
    image: "aob-biome-tiles.png",
    imagewidth: TILE_SIZE * tileTypes.length,
    imageheight: TILE_SIZE,
    tiles: tileTypes.map((type, id) => ({
      id,
      type,
      properties: [{ name: "tileType", type: "string", value: type }],
    })),
  };
}

function applyStamp(tiles, stamp) {
  if (stamp.kind === "rect") {
    for (let y = stamp.y; y < stamp.y + stamp.h; y += 1) {
      for (let x = stamp.x; x < stamp.x + stamp.w; x += 1) {
        setTile(tiles, x, y, stamp.tile);
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
          setTile(tiles, x, y, stamp.tile);
        }
      }
    }
    return;
  }

  for (let i = 0; i < stamp.points.length - 1; i += 1) {
    const start = stamp.points[i];
    const end = stamp.points[i + 1];
    stampPathSegment(tiles, start, end, stamp.tile, stamp.radius);
  }
}

function stampPathSegment(tiles, start, end, tile, radius) {
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
          setTile(tiles, x, y, tile);
        }
      }
    }
  }
}

function setTile(tiles, x, y, tile) {
  if (x < 0 || y < 0 || x >= mapWidth || y >= mapHeight) {
    return;
  }
  tiles[y * mapWidth + x] = tile;
}

function pointObject(id, name, type, tile) {
  return {
    id,
    name,
    type,
    point: true,
    x: tile.x * TILE_SIZE + TILE_SIZE / 2,
    y: tile.y * TILE_SIZE + TILE_SIZE / 2,
    width: 0,
    height: 0,
    rotation: 0,
    visible: true,
    properties: [
      { name: "tileX", type: "int", value: tile.x },
      { name: "tileY", type: "int", value: tile.y },
    ],
  };
}

function rectObject(id, name, type, rect) {
  return {
    id,
    name,
    type,
    x: rect.x * TILE_SIZE,
    y: rect.y * TILE_SIZE,
    width: rect.w * TILE_SIZE,
    height: rect.h * TILE_SIZE,
    rotation: 0,
    visible: true,
    properties: [
      { name: "tileX", type: "int", value: rect.x },
      { name: "tileY", type: "int", value: rect.y },
      { name: "footprintW", type: "int", value: rect.w },
      { name: "footprintH", type: "int", value: rect.h },
    ],
  };
}

function polylineObject(id, name, points, radius) {
  const [first, ...rest] = points;
  return {
    id,
    name,
    type: "road",
    x: first.x * TILE_SIZE + TILE_SIZE / 2,
    y: first.y * TILE_SIZE + TILE_SIZE / 2,
    width: 0,
    height: 0,
    rotation: 0,
    visible: true,
    polyline: rest.map((point) => ({
      x: (point.x - first.x) * TILE_SIZE,
      y: (point.y - first.y) * TILE_SIZE,
    })),
    properties: [
      { name: "radiusTiles", type: "int", value: radius },
    ],
  };
}

function writeJson(filename, value) {
  fs.writeFileSync(path.join(outDir, filename), `${JSON.stringify(value, null, 2)}\n`);
}

function createBiomeTilesetImage(filename) {
  const colors = [
    [78, 129, 43, 255],
    [55, 104, 34, 255],
    [166, 115, 61, 255],
    [116, 78, 45, 255],
    [43, 128, 145, 255],
    [23, 77, 108, 255],
    [116, 116, 110, 255],
    [86, 58, 128, 255],
  ];
  const width = TILE_SIZE * colors.length;
  const height = TILE_SIZE;
  const pixels = Buffer.alloc(width * height * 4);
  for (let tile = 0; tile < colors.length; tile += 1) {
    for (let y = 0; y < TILE_SIZE; y += 1) {
      for (let x = 0; x < TILE_SIZE; x += 1) {
        const index = ((y * width) + tile * TILE_SIZE + x) * 4;
        const color = colors[tile];
        const checker = ((x + y) % 5 === 0) ? 10 : 0;
        pixels[index] = Math.min(255, color[0] + checker);
        pixels[index + 1] = Math.min(255, color[1] + checker);
        pixels[index + 2] = Math.min(255, color[2] + checker);
        pixels[index + 3] = color[3];
      }
    }
  }
  fs.writeFileSync(filename, encodePng(width, height, pixels));
}

function encodePng(width, height, rgba) {
  const rowStride = width * 4;
  const raw = Buffer.alloc((rowStride + 1) * height);
  for (let y = 0; y < height; y += 1) {
    raw[y * (rowStride + 1)] = 0;
    rgba.copy(raw, y * (rowStride + 1) + 1, y * rowStride, (y + 1) * rowStride);
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", Buffer.concat([uint32(width), uint32(height), Buffer.from([8, 6, 0, 0, 0])])),
    chunk("IDAT", zlib.deflateSync(raw)),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

function chunk(type, data) {
  const typeBuffer = Buffer.from(type, "ascii");
  return Buffer.concat([
    uint32(data.length),
    typeBuffer,
    data,
    uint32(crc32(Buffer.concat([typeBuffer, data]))),
  ]);
}

function uint32(value) {
  const buffer = Buffer.alloc(4);
  buffer.writeUInt32BE(value >>> 0);
  return buffer;
}

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc ^= byte;
    for (let i = 0; i < 8; i += 1) {
      crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}
