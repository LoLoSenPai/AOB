import Phaser from "phaser";
import { TILE_SIZE } from "../../data/constants";
import { assetKeys } from "../../data/assets";
import {
  imageDecalVisuals,
  TERRAIN_STAMP_TILES,
  visualOverlayVisuals,
  worldSpriteOverlayVisuals,
  type ImageDecalKey,
  type WorldSpriteOverlayKey,
} from "../../data/visuals";
import { initialMapLayout, type TerrainStamp, type VisualOverlay } from "../../data/mapLayout";
import type { TileCoord, TileType } from "../../core/state/types";

type EditorTool = "terrain" | "object" | "stamp" | "moveCells" | "select" | "erase";
type EditorObjectLayer = "decal" | "object";
type CardinalSide = "north" | "east" | "south" | "west";

type EditorTerrainId = string;

type TerrainCatalogItem = {
  id: EditorTerrainId;
  label: string;
  textureKey: string;
  frame?: number;
  color: number;
  tint?: number;
  custom?: boolean;
};

type EditorTilesetDefinition = {
  id: string;
  label: string;
  textureKey: string;
  imagePath: string;
  columns: number;
  rows: number;
  tileSize: number;
  defaultFrame: number;
  color: number;
};

type EditorObjectCatalogItem = {
  id: string;
  label: string;
  category: "Solana" | "BTC" | "Resources" | "Decals" | "Transitions" | "Buildings";
  textureKey: string;
  defaultWidth: number;
  originX: number;
  originY: number;
  layer: EditorObjectLayer;
  alpha?: number;
  depthOffset?: number;
  defaultAngle?: number;
};

type EditorObjectPlacement = {
  id: string;
  assetId: string;
  x: number;
  y: number;
  width: number;
  height?: number;
  alpha: number;
  angle: number;
  depthOffset: number;
  flipX: boolean;
  flipY: boolean;
};

type EditorTerrainRotation = {
  x: number;
  y: number;
  angle: number;
};

type EditorTerrainAnimationFrame = {
  frame: number;
  duration: number;
};

type EditorAnimatedTerrainSprite = {
  sprite: Phaser.GameObjects.Image;
  textureKey: string;
  frames: EditorTerrainAnimationFrame[];
  frameIndex: number;
  elapsed: number;
};

type EditorTileLayer = {
  id: string;
  name: string;
  tiles: Array<EditorTerrainId | null>;
  opacity: number;
};

type EditorMapExport = {
  version: 1;
  width: number;
  height: number;
  tileSize: number;
  terrain: EditorTerrainId[];
  terrainLayers?: EditorTileLayer[];
  collision?: boolean[];
  terrainRotations: EditorTerrainRotation[];
  customTerrain: Array<Pick<TerrainCatalogItem, "id" | "label">>;
  objects: EditorObjectPlacement[];
};

type EditorTemplateStamp = {
  id: string;
  label: string;
  width: number;
  height: number;
  tileSize: number;
  layers: EditorTileLayer[];
  collision: boolean[];
};

type EditorCellRect = {
  x: number;
  y: number;
  w: number;
  h: number;
};

type EditorCellMoveDraft = {
  rect: EditorCellRect;
  tiles: EditorTerrainId[];
  extraLayers: Array<Array<EditorTerrainId | null>>;
  collision: boolean[];
  rotations: Array<{ x: number; y: number; angle: number }>;
  dragStart: TileCoord;
  offsetX: number;
  offsetY: number;
};

type EditorUndoSnapshot = {
  label: string;
  mapWidth: number;
  mapHeight: number;
  tileSize: number;
  terrain: EditorTerrainId[];
  extraTerrainLayers: EditorTileLayer[];
  collision: boolean[];
  terrainRotations: EditorTerrainRotation[];
  objects: EditorObjectPlacement[];
  nextObjectNumber: number;
  selectedTool: EditorTool;
  selectedTilesetId: string;
  selectedTerrainId: EditorTerrainId;
  selectedTemplateId?: string;
  selectedObjectAssetId: string;
  selectedObjectId?: string;
  selectedCellRect?: EditorCellRect;
};

type TiledTileset = {
  firstgid: number;
  name: string;
  tilewidth: number;
  tileheight: number;
  tilecount: number;
  columns: number;
};

type TiledLayer = {
  name: string;
  type: string;
  visible?: boolean;
  opacity?: number;
  data?: number[];
  properties?: Record<string, unknown> | Array<{ name: string; value: unknown }>;
};

type TiledMap = {
  width: number;
  height: number;
  tilewidth: number;
  tileheight: number;
  layers: TiledLayer[];
  tilesets: TiledTileset[];
};

const EDITOR_SAVE_KEY = "age-of-blockchains.map-editor.v1";
const TERRAIN_DEPTH = -1000;
const GRID_DEPTH = 4500;
const SELECTION_DEPTH = 6200;
const MIN_ZOOM = 0.35;
const MAX_ZOOM = 2.25;
const DEFAULT_EDITOR_TILE_SIZE = 32;
const EDITOR_TILESETS: EditorTilesetDefinition[] = [
  {
    id: "earth",
    label: "Set 1 - Earth",
    textureKey: assetKeys.editor.earthTilesetV2,
    imagePath: "/assets/editor/earth/TileSet_V2.png",
    columns: 8,
    rows: 20,
    tileSize: 32,
    defaultFrame: 48,
    color: 0x67b84a,
  },
  {
    id: "gpt2a",
    label: "Set 2A - Grass/Dirt",
    textureKey: assetKeys.editor.gptTileset2A,
    imagePath: "/assets/editor/gpt-set-2/set-2-a-clean.png",
    columns: 8,
    rows: 6,
    tileSize: 32,
    defaultFrame: 0,
    color: 0x6fb044,
  },
  {
    id: "gpt2b",
    label: "Set 2B - Water",
    textureKey: assetKeys.editor.gptTileset2B,
    imagePath: "/assets/editor/gpt-set-2/set-2-b-clean.png",
    columns: 8,
    rows: 6,
    tileSize: 32,
    defaultFrame: 0,
    color: 0x3f9f90,
  },
  {
    id: "rpgForestGround",
    label: "RPG Forest - Ground",
    textureKey: assetKeys.editor.rpgForestTileset,
    imagePath: "/assets/editor/rpg-forest/tilesets/forest-tileset.png",
    columns: 19,
    rows: 12,
    tileSize: 24,
    defaultFrame: 81,
    color: 0x2f6e22,
  },
  {
    id: "rpgForestTrees",
    label: "RPG Forest - Trees",
    textureKey: assetKeys.editor.rpgForestTrees,
    imagePath: "/assets/editor/rpg-forest/tilesets/forest-trees.png",
    columns: 10,
    rows: 20,
    tileSize: 24,
    defaultFrame: 1,
    color: 0x287221,
  },
  {
    id: "rpgForestWater",
    label: "RPG Forest - Water",
    textureKey: assetKeys.editor.rpgForestWater,
    imagePath: "/assets/editor/rpg-forest/tilesets/forest-water.png",
    columns: 8,
    rows: 28,
    tileSize: 24,
    defaultFrame: 0,
    color: 0x4a95bd,
  },
];
const DEFAULT_RPG_FOREST_TERRAIN_ID = "rpgForestGround:81";
const DEFAULT_EDITOR_TILESET_ID = "rpgForestGround";
const DEFAULT_EDITOR_TERRAIN_ID = DEFAULT_RPG_FOREST_TERRAIN_ID;
const RPG_FOREST_MAPS = [
  { id: "map1", label: "Forest Path", path: "/assets/editor/rpg-forest/maps/map1.json" },
  { id: "map2", label: "River Cliffs", path: "/assets/editor/rpg-forest/maps/map2.json" },
  { id: "map4", label: "River Bridge", path: "/assets/editor/rpg-forest/maps/map4.json" },
];
const RPG_FOREST_WATER_ANIMATION_SEQUENCES: EditorTerrainAnimationFrame[][] = [
  [2, 26, 50, 74].map((frame) => ({ frame, duration: 200 })),
  [3, 27, 51, 75].map((frame) => ({ frame, duration: 200 })),
  [4, 28, 52, 76].map((frame) => ({ frame, duration: 200 })),
  [10, 34, 58, 82].map((frame) => ({ frame, duration: 200 })),
  [12, 36, 60, 84].map((frame) => ({ frame, duration: 200 })),
  [13, 37, 61, 85].map((frame) => ({ frame, duration: 200 })),
  [14, 38, 62, 86].map((frame) => ({ frame, duration: 200 })),
  [18, 42, 66, 90].map((frame) => ({ frame, duration: 200 })),
  [
    { frame: 19, duration: 200 },
    { frame: 43, duration: 2000 },
    { frame: 67, duration: 200 },
    { frame: 91, duration: 200 },
  ],
  [20, 44, 68, 92].map((frame) => ({ frame, duration: 200 })),
  [21, 45, 69, 93].map((frame) => ({ frame, duration: 200 })),
  [22, 46, 70, 94].map((frame) => ({ frame, duration: 200 })),
  [96, 98, 100, 102, 128, 130].map((frame) => ({ frame, duration: 150 })),
  [97, 99, 101, 103, 129, 131].map((frame) => ({ frame, duration: 150 })),
  [104, 106, 108, 110, 136, 138].map((frame) => ({ frame, duration: 150 })),
  [105, 107, 109, 111, 137, 139].map((frame) => ({ frame, duration: 150 })),
  [112, 114, 116, 118, 144, 146].map((frame) => ({ frame, duration: 150 })),
  [113, 115, 117, 119, 145, 147].map((frame) => ({ frame, duration: 150 })),
  [120, 122, 124, 126, 152, 154].map((frame) => ({ frame, duration: 150 })),
  [121, 123, 125, 127, 153, 155].map((frame) => ({ frame, duration: 150 })),
  [132, 140, 148, 156].map((frame) => ({ frame, duration: 200 })),
  [133, 141, 149, 157].map((frame) => ({ frame, duration: 200 })),
  [134, 142, 150, 158].map((frame) => ({ frame, duration: 200 })),
  [135, 143, 151, 159].map((frame) => ({ frame, duration: 200 })),
];
const DEFAULT_EDITOR_MAP_WIDTH = 96;
const DEFAULT_EDITOR_MAP_HEIGHT = 64;
const MAX_UNDO_STEPS = 40;

const EDITOR_TILESET_TERRAIN_CATALOG: TerrainCatalogItem[] = EDITOR_TILESETS.flatMap((tileset) =>
  Array.from({ length: tileset.columns * tileset.rows }, (_unused, frame) => ({
    id: terrainIdForFrame(tileset.id, frame),
    label: `${tileset.label} ${frame + 1}`,
    textureKey: tileset.textureKey,
    frame,
    color: tileset.color,
  })),
);

const EDITOR_OBJECT_CATALOG: EditorObjectCatalogItem[] = [
  {
    id: "villageGround",
    label: "Solana plaza",
    category: "Decals",
    textureKey: visualOverlayVisuals.villageGround.key,
    defaultWidth: 760,
    originX: 0.5,
    originY: 0.5,
    layer: "decal",
    alpha: 0.96,
    depthOffset: -8,
  },
  {
    id: "pathDecal",
    label: "Path decal",
    category: "Decals",
    textureKey: visualOverlayVisuals.pathDecal.key,
    defaultWidth: 360,
    originX: 0.5,
    originY: 0.5,
    layer: "decal",
    alpha: 0.86,
    depthOffset: -4,
  },
  ...objectItemsFromImageDecals([
    ["stoneGroundPatch", "Stone quarry floor", 560],
    ["crystalGroundPatch", "Crystal field floor", 560],
    ["btcCopperGround", "BTC copper ground", 780],
    ["btcMiningPlaza", "BTC mining plaza", 520],
  ]),
  ...objectItemsFromImageDecals(
    [
      ["grassToDirtNorth", "Solana dirt edge N", 430],
      ["grassToDirtEast", "Solana dirt edge E", 390],
      ["grassToDirtSouth", "Solana dirt edge S", 430],
      ["grassToDirtWest", "Solana dirt edge W", 390],
      ["grassToStoneNorth", "Solana stone edge N", 430],
      ["grassToStoneEast", "Solana stone edge E", 390],
      ["grassToStoneSouth", "Solana stone edge S", 430],
      ["grassToStoneWest", "Solana stone edge W", 390],
      ["grassToCrystalNorth", "Solana crystal edge N", 430],
      ["grassToCrystalEast", "Solana crystal edge E", 390],
      ["grassToCrystalSouth", "Solana crystal edge S", 430],
      ["grassToCrystalWest", "Solana crystal edge W", 390],
      ["shoreEdgeNorth", "Solana shore edge N", 390],
      ["shoreEdgeEast", "Solana shore edge E", 390],
      ["shoreEdgeSouth", "Solana shore edge S", 390],
      ["shoreEdgeWest", "Solana shore edge W", 390],
      ["shoreCornerNe", "Solana shore corner NE", 390],
      ["shoreCornerNw", "Solana shore corner NW", 390],
      ["shoreCornerSe", "Solana shore corner SE", 390],
      ["shoreCornerSw", "Solana shore corner SW", 390],
      ["waterShoreCurve", "Solana shore curve", 430],
    ],
    "Transitions",
  ),
  ...objectItemsFromStandaloneDecals(
    [
      ["terrainV2GrassDirtEdge", "V2 grass/dirt edge", assetKeys.aobMap.terrainV2.transitions.grassDirtEdge, 128],
      ["terrainV2GrassDirtCornerOuter", "V2 grass/dirt outer", assetKeys.aobMap.terrainV2.transitions.grassDirtCornerOuter, 128],
      ["terrainV2GrassDirtCornerInner", "V2 grass/dirt inner", assetKeys.aobMap.terrainV2.transitions.grassDirtCornerInner, 128],
      ["terrainV2GrassStoneEdge", "V2 grass/stone edge", assetKeys.aobMap.terrainV2.transitions.grassStoneEdge, 128],
      ["terrainV2GrassStoneCornerOuter", "V2 grass/stone outer", assetKeys.aobMap.terrainV2.transitions.grassStoneCornerOuter, 128],
      ["terrainV2GrassStoneCornerInner", "V2 grass/stone inner", assetKeys.aobMap.terrainV2.transitions.grassStoneCornerInner, 128],
      ["terrainV2GrassCrystalEdge", "V2 grass/crystal edge", assetKeys.aobMap.terrainV2.transitions.grassCrystalEdge, 128],
      ["terrainV2GrassCrystalCornerOuter", "V2 grass/crystal outer", assetKeys.aobMap.terrainV2.transitions.grassCrystalCornerOuter, 128],
      ["terrainV2GrassCrystalCornerInner", "V2 grass/crystal inner", assetKeys.aobMap.terrainV2.transitions.grassCrystalCornerInner, 128],
      ["terrainV2GrassWaterEdge", "V2 grass/water edge", assetKeys.aobMap.terrainV2.transitions.grassWaterEdge, 128],
      ["terrainV2GrassWaterCornerOuter", "V2 grass/water outer", assetKeys.aobMap.terrainV2.transitions.grassWaterCornerOuter, 128],
      ["terrainV2GrassWaterCornerInner", "V2 grass/water inner", assetKeys.aobMap.terrainV2.transitions.grassWaterCornerInner, 128],
      ["terrainV2ShoreWaterEdge", "V2 shore/water edge", assetKeys.aobMap.terrainV2.transitions.shoreWaterEdge, 128],
      ["terrainV2ShoreWaterCornerOuter", "V2 shore/water outer", assetKeys.aobMap.terrainV2.transitions.shoreWaterCornerOuter, 128],
      ["terrainV2ShallowDeepEdge", "V2 shallow/deep edge", assetKeys.aobMap.terrainV2.transitions.shallowDeepEdge, 128],
      ["terrainV2ShallowDeepCornerOuter", "V2 shallow/deep outer", assetKeys.aobMap.terrainV2.transitions.shallowDeepCornerOuter, 128],
      ["terrainV2ShallowDeepCornerInner", "V2 shallow/deep inner", assetKeys.aobMap.terrainV2.transitions.shallowDeepCornerInner, 128],
    ],
    "Transitions",
  ),
  ...objectItemsFromTransitionTextures(),
  ...objectItemsFromStandaloneDecals([
    ["terrainV2DirtScuffSmall", "V2 dirt scuff S", assetKeys.aobMap.terrainV2.decals.dirtScuffSmall, 96],
    ["terrainV2DirtScuffMedium", "V2 dirt scuff M", assetKeys.aobMap.terrainV2.decals.dirtScuffMedium, 142],
    ["terrainV2FlowerPatchSmall", "V2 flower patch", assetKeys.aobMap.terrainV2.decals.flowerPatchSmall, 96],
    ["terrainV2StoneScatterSmall", "V2 stone scatter", assetKeys.aobMap.terrainV2.decals.stoneScatterSmall, 104],
    ["terrainV2CrystalShardsSmall", "V2 crystal shards", assetKeys.aobMap.terrainV2.decals.crystalShardsSmall, 92],
    ["terrainV2DryBushSmall", "V2 dry bush", assetKeys.aobMap.terrainV2.decals.dryBushSmall, 86],
    ["terrainV2BerryBushCluster", "V2 berry bush", assetKeys.aobMap.terrainV2.decals.berryBushCluster, 92],
    ["terrainV2LeavesTwigsSmall", "V2 leaves/twigs", assetKeys.aobMap.terrainV2.decals.leavesTwigsSmall, 96],
    ["terrainV2QuarryCracksSmall", "V2 quarry cracks", assetKeys.aobMap.terrainV2.decals.quarryCracksSmall, 118],
    ["terrainV2ShoreMudSmall", "V2 shore mud", assetKeys.aobMap.terrainV2.decals.shoreMudSmall, 104],
  ]),
  ...objectItemsFromWorldSprites([
    ["btcTownCenterT1", "BTC Town Center", "BTC", 270],
    ["btcHouseT1", "BTC House", "BTC", 152],
    ["btcBarracksT1", "BTC Barracks", "BTC", 190],
    ["btcStableT1", "BTC Stable", "BTC", 180],
    ["btcWatchtowerT1", "BTC Tower", "BTC", 118],
    ["btcMiningCampT1", "BTC Mining Camp", "BTC", 172],
    ["btcForge", "BTC Forge", "BTC", 112],
    ["btcMarketStall", "BTC Market", "BTC", 118],
    ["btcBanner", "BTC Banner", "BTC", 64],
    ["btcLanternPost", "BTC Lantern", "BTC", 44],
    ["btcCrateStack", "BTC Crates", "BTC", 72],
    ["btcMiningCart", "BTC Mining Cart", "BTC", 70],
    ["btcStoneObelisk", "BTC Obelisk", "BTC", 64],
    ["btcCampfire", "BTC Campfire", "BTC", 54],
    ["btcDeadTreeStump", "BTC Stump", "BTC", 46],
    ["btcGoldOreLarge", "BTC Gold Ore L", "BTC", 112],
    ["btcGoldOreSmall", "BTC Gold Ore S", "BTC", 64],
    ["btcDarkRockLarge", "BTC Dark Rock L", "BTC", 96],
    ["btcDarkRockSmall", "BTC Dark Rock S", "BTC", 58],
    ["btcWallHorizontal", "BTC Wall", "BTC", 156],
    ["btcGateHorizontal", "BTC Gate", "BTC", 126],
  ]),
  ...objectItemsFromTextures([
    ["solanaTreeClusterA", "Solana trees A", "Resources", assetKeys.aobMap.solanaTreeClusterA, 96, 0.9],
    ["solanaTreeClusterB", "Solana trees B", "Resources", assetKeys.aobMap.solanaTreeClusterB, 96, 0.9],
    ["solanaPineCluster", "Solana pines", "Resources", assetKeys.aobMap.solanaPineCluster, 88, 0.92],
    ["solanaStoneNodeLarge", "Solana stone L", "Resources", assetKeys.aobMap.solanaStoneNodeLarge, 72, 0.88],
    ["solanaStoneNodeSmall", "Solana stone S", "Resources", assetKeys.aobMap.solanaStoneNodeSmall, 38, 0.88],
    ["solanaCrystalNodeLarge", "Solana crystal L", "Resources", assetKeys.aobMap.solanaCrystalNodeLarge, 86, 0.9],
    ["solanaCrystalNodeSmall", "Solana crystal S", "Resources", assetKeys.aobMap.solanaCrystalNodeSmall, 42, 0.88],
    ["solanaBerryBush", "Berry bush", "Resources", assetKeys.aobMap.solanaBerryBush, 62, 0.86],
    ["solanaBannerSmall", "Small banner", "Solana", assetKeys.aobMap.solanaBannerSmall, 48, 0.96],
    ["solanaBannerTall", "Tall banner", "Solana", assetKeys.aobMap.solanaBannerTall, 58, 0.97],
    ["solanaLanternPost", "Lantern post", "Solana", assetKeys.aobMap.solanaLanternPost, 42, 0.97],
    ["solanaCrate", "Crate", "Solana", assetKeys.aobMap.solanaCrate, 44, 0.9],
    ["solanaCratesStack", "Crate stack", "Solana", assetKeys.aobMap.solanaCratesStack, 62, 0.9],
    ["solanaBarrels", "Barrels", "Solana", assetKeys.aobMap.solanaBarrels, 54, 0.91],
    ["solanaFenceShort", "Fence short", "Solana", assetKeys.aobMap.solanaFenceShort, 74, 0.86],
    ["solanaSacks", "Sacks", "Solana", assetKeys.aobMap.solanaSacks, 52, 0.91],
    ["solanaValidatorObelisk", "Validator obelisk", "Solana", assetKeys.aobMap.solanaValidatorObelisk, 62, 0.96],
    ["solanaFenceCorner", "Fence corner", "Solana", assetKeys.aobMap.solanaFenceCorner, 58, 0.88],
    ["townCenter", "Solana Town Center", "Buildings", assetKeys.aobBuildingStatic.townCenter.genesis, 278, 1],
    ["house", "Solana House", "Buildings", assetKeys.aobBuildingStatic.house.genesis, 198, 1],
    ["lumberCamp", "Lumber Camp", "Buildings", assetKeys.aobBuildingStatic.lumberCamp.genesis, 222, 1],
    ["mill", "Mill", "Buildings", assetKeys.aobBuildingStatic.mill.genesis, 320, 1],
    ["stoneCamp", "Stone Camp", "Buildings", assetKeys.aobBuildingStatic.stoneCamp.genesis, 210, 1],
    ["goldCamp", "Gold Camp", "Buildings", assetKeys.aobBuildingStatic.goldCamp.genesis, 210, 1],
    ["farm", "Farm", "Buildings", assetKeys.aobBuildingStatic.farm.genesis, 330, 1],
    ["barracks", "Barracks", "Buildings", assetKeys.aobBuildingStatic.barracks.genesis, 235, 1],
    ["stable", "Stable", "Buildings", assetKeys.aobBuildingStatic.stable.genesis, 220, 1],
    ["watchTower", "Watch Tower", "Buildings", assetKeys.aobBuildingStatic.watchTower.genesis, 235, 1],
  ]),
];

export class MapEditorScene extends Phaser.Scene {
  private mapWidth = DEFAULT_EDITOR_MAP_WIDTH;
  private mapHeight = DEFAULT_EDITOR_MAP_HEIGHT;
  private tileSize = DEFAULT_EDITOR_TILE_SIZE;
  private terrain: EditorTerrainId[] = [];
  private extraTerrainLayers: EditorTileLayer[] = [];
  private collision: boolean[] = [];
  private terrainRotations = new Map<string, number>();
  private customTerrainCatalog: TerrainCatalogItem[] = [];
  private transparentTerrainCache = new Map<EditorTerrainId, boolean>();
  private templateCache = new Map<string, EditorTemplateStamp>();
  private undoStack: EditorUndoSnapshot[] = [];
  private objects: EditorObjectPlacement[] = [];
  private objectSprites = new Map<string, Phaser.GameObjects.Image>();
  private terrainObjects: Phaser.GameObjects.GameObject[] = [];
  private animatedTerrainSprites: EditorAnimatedTerrainSprite[] = [];
  private templatePreviewSprites: Phaser.GameObjects.Image[] = [];
  private tilePreviewSprites: Phaser.GameObjects.Image[] = [];
  private previewCache = new Map<string, string>();
  private gridGraphics?: Phaser.GameObjects.Graphics;
  private collisionGraphics?: Phaser.GameObjects.Graphics;
  private cursorGraphics?: Phaser.GameObjects.Graphics;
  private selectionGraphics?: Phaser.GameObjects.Graphics;
  private root?: HTMLDivElement;
  private selectedTool: EditorTool = "terrain";
  private selectedTilesetId = DEFAULT_EDITOR_TILESET_ID;
  private selectedTerrainId: EditorTerrainId = DEFAULT_EDITOR_TERRAIN_ID;
  private selectedTemplate?: EditorTemplateStamp;
  private cellSelectionStart?: TileCoord;
  private selectedCellRect?: EditorCellRect;
  private cellMoveDraft?: EditorCellMoveDraft;
  private selectedObjectAssetId = "townCenter";
  private terrainBrushAngle = 0;
  private objectBrushAngle = 0;
  private selectedObjectId?: string;
  private leftPanelCollapsed = false;
  private showCollisionOverlay = false;
  private previewMode = false;
  private brushSize = 1;
  private statusText = "Editor ready.";
  private nextObjectNumber = 1;
  private painting = false;
  private panning = false;
  private draggingObjectId?: string;
  private objectPreviewSprite?: Phaser.GameObjects.Image;
  private dragObjectOffset = new Phaser.Math.Vector2();
  private panLastScreen = new Phaser.Math.Vector2();
  private cursors?: Phaser.Types.Input.Keyboard.CursorKeys;
  private keys?: Record<"W" | "A" | "S" | "D" | "SPACE" | "ESC" | "DELETE", Phaser.Input.Keyboard.Key>;

  constructor() {
    super("MapEditorScene");
  }

  create(): void {
    const demo = this.startDemoParam();
    if (demo === "v2") {
      this.loadV2DemoState();
    } else if (demo === "v3") {
      this.loadV3SheetDemoState();
    } else {
      this.loadInitialEditorState();
    }
    this.createTerrainLayer();
    this.createObjectSprites();
    this.createEditorGraphics();
    this.createUi();
    this.createInput();
    this.installDebugHooks();
    this.cameras.main.setBounds(0, 0, this.worldWidth(), this.worldHeight());
    this.cameras.main.centerOn(this.worldWidth() / 2, this.worldHeight() / 2);
    this.cameras.main.setZoom(0.95);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.destroyEditor, this);
    this.events.once(Phaser.Scenes.Events.DESTROY, this.destroyEditor, this);
  }

  private startDemoParam(): string | null {
    return new URLSearchParams(window.location.search).get("demo");
  }

  private loadInitialEditorState(): void {
    this.mapWidth = DEFAULT_EDITOR_MAP_WIDTH;
    this.mapHeight = DEFAULT_EDITOR_MAP_HEIGHT;
    this.tileSize = EDITOR_TILESETS.find((item) => item.id === DEFAULT_EDITOR_TILESET_ID)?.tileSize ?? DEFAULT_EDITOR_TILE_SIZE;
    this.terrain = Array.from({ length: this.mapWidth * this.mapHeight }, () => DEFAULT_EDITOR_TERRAIN_ID);
    this.extraTerrainLayers = [];
    this.collision = Array.from({ length: this.mapWidth * this.mapHeight }, () => false);
    this.terrainRotations.clear();
    this.objects = [];
    this.selectedObjectId = undefined;
    this.nextObjectNumber = this.objects.length + 1;
    this.selectedTilesetId = DEFAULT_EDITOR_TILESET_ID;
    this.selectedTerrainId = DEFAULT_EDITOR_TERRAIN_ID;
    this.selectedObjectAssetId = "townCenter";
  }

  update(_time: number, delta: number): void {
    this.updateCamera(delta);
    this.updateAnimatedTerrain(delta);
    this.drawCursor();
    this.drawSelection();
  }

  private createTerrainLayer(): void {
    for (const object of this.terrainObjects) {
      object.destroy();
    }
    this.terrainObjects = [];
    this.animatedTerrainSprites = [];

    for (let y = 0; y < this.mapHeight; y += 1) {
      for (let x = 0; x < this.mapWidth; x += 1) {
        const terrainId = this.terrain[this.tileIndex(x, y)] ?? DEFAULT_EDITOR_TERRAIN_ID;
        const angle = this.terrainRotationAtChunk(x, y);
        this.createTerrainTileImage(x, y, terrainId, TERRAIN_DEPTH + 6, 1, angle);
      }
    }

    this.extraTerrainLayers.forEach((layer, layerIndex) => {
      for (let y = 0; y < this.mapHeight; y += 1) {
        for (let x = 0; x < this.mapWidth; x += 1) {
          const terrainId = layer.tiles[this.tileIndex(x, y)];
          if (!terrainId) {
            continue;
          }
          this.createTerrainTileImage(x, y, terrainId, TERRAIN_DEPTH + 20 + layerIndex * 8, layer.opacity, 0);
        }
      }
    });
    this.drawCollisionOverlay();
  }

  private createTerrainTileImage(x: number, y: number, terrainId: EditorTerrainId, depth: number, alpha: number, angle: number): void {
    const item = this.terrainCatalogItem(terrainId);
    const image = this.add
      .image(x * this.tileSize + this.tileSize / 2, y * this.tileSize + this.tileSize / 2, item.textureKey, item.frame)
      .setOrigin(0.5, 0.5)
      .setDisplaySize(this.tileSize, this.tileSize)
      .setAngle(angle)
      .setDepth(depth)
      .setAlpha(alpha);
    if (item.tint) {
      image.setTint(item.tint);
    }
    this.terrainObjects.push(image);
    const animation = terrainAnimationForId(terrainId);
    if (animation) {
      const frameIndex = Math.max(0, animation.findIndex((frame) => frame.frame === item.frame));
      this.animatedTerrainSprites.push({
        sprite: image,
        textureKey: item.textureKey,
        frames: animation,
        frameIndex,
        elapsed: 0,
      });
    }
  }

  private updateAnimatedTerrain(delta: number): void {
    if (this.animatedTerrainSprites.length === 0) {
      return;
    }
    for (const animated of this.animatedTerrainSprites) {
      animated.elapsed += delta;
      let current = animated.frames[animated.frameIndex] ?? animated.frames[0];
      while (current && animated.elapsed >= current.duration) {
        animated.elapsed -= current.duration;
        animated.frameIndex = (animated.frameIndex + 1) % animated.frames.length;
        current = animated.frames[animated.frameIndex] ?? animated.frames[0];
        if (current) {
          animated.sprite.setTexture(animated.textureKey, current.frame);
        }
      }
    }
  }

  private createObjectSprites(): void {
    for (const sprite of this.objectSprites.values()) {
      sprite.destroy();
    }
    this.objectSprites.clear();
    for (const object of this.objects) {
      this.createObjectSprite(object);
    }
  }

  private createObjectSprite(object: EditorObjectPlacement): void {
    const item = objectCatalogItem(object.assetId);
    if (!item || !this.textures.exists(item.textureKey)) {
      return;
    }
    const sprite = this.add.image(object.x, object.y, item.textureKey).setOrigin(item.originX, item.originY);
    this.applyObjectSpriteState(sprite, object, item);
    this.objectSprites.set(object.id, sprite);
  }

  private applyObjectSpriteState(sprite: Phaser.GameObjects.Image, object: EditorObjectPlacement, item = objectCatalogItem(object.assetId)): void {
    if (!item) {
      return;
    }
    const frame = sprite.frame;
    const ratio = frame.realWidth > 0 ? frame.realHeight / frame.realWidth : 1;
    sprite
      .setPosition(object.x, object.y)
      .setDisplaySize(object.width, object.height ?? Math.max(1, object.width * ratio))
      .setAlpha(object.alpha)
      .setAngle(object.angle)
      .setFlipX(object.flipX)
      .setFlipY(object.flipY)
      .setDepth(item.layer === "decal" ? -850 + object.depthOffset : object.y + object.depthOffset);
  }

  private createEditorGraphics(): void {
    this.gridGraphics = this.add.graphics().setDepth(GRID_DEPTH);
    this.collisionGraphics = this.add.graphics().setDepth(GRID_DEPTH + 1);
    this.cursorGraphics = this.add.graphics().setDepth(SELECTION_DEPTH);
    this.selectionGraphics = this.add.graphics().setDepth(SELECTION_DEPTH + 1);
    this.drawGrid();
    this.drawCollisionOverlay();
  }

  private drawGrid(): void {
    if (!this.gridGraphics) {
      return;
    }
    this.gridGraphics.clear();
    if (this.previewMode) {
      return;
    }
    this.gridGraphics.lineStyle(1, 0xf8e2a0, 0.14);
    for (let x = 0; x <= this.mapWidth; x += 1) {
      this.gridGraphics.lineBetween(x * this.tileSize, 0, x * this.tileSize, this.worldHeight());
    }
    for (let y = 0; y <= this.mapHeight; y += 1) {
      this.gridGraphics.lineBetween(0, y * this.tileSize, this.worldWidth(), y * this.tileSize);
    }
    this.gridGraphics.lineStyle(2, 0xf8e2a0, 0.42);
    this.gridGraphics.strokeRect(0, 0, this.worldWidth(), this.worldHeight());
  }

  private drawCollisionOverlay(): void {
    if (!this.collisionGraphics) {
      return;
    }
    this.collisionGraphics.clear();
    if (!this.showCollisionOverlay || this.previewMode) {
      return;
    }
    this.collisionGraphics.fillStyle(0xff3355, 0.28);
    this.collisionGraphics.lineStyle(1, 0xffd6d6, 0.42);
    for (let y = 0; y < this.mapHeight; y += 1) {
      for (let x = 0; x < this.mapWidth; x += 1) {
        if (!this.collision[this.tileIndex(x, y)]) {
          continue;
        }
        this.collisionGraphics.fillRect(x * this.tileSize, y * this.tileSize, this.tileSize, this.tileSize);
        this.collisionGraphics.strokeRect(x * this.tileSize + 1, y * this.tileSize + 1, this.tileSize - 2, this.tileSize - 2);
      }
    }
  }

  private createUi(): void {
    this.root = document.createElement("div");
    this.root.id = "map-editor-root";
    this.root.className = "map-editor-root";
    document.body.appendChild(this.root);
    this.root.addEventListener("click", this.handleUiClick);
    this.root.addEventListener("input", this.handleUiInput);
    this.root.addEventListener("change", this.handleUiChange);
    this.renderUi();
  }

  private renderUi(): void {
    if (!this.root) {
      return;
    }
    if (this.previewMode) {
      this.root.innerHTML = `
        <div class="map-editor-shell map-editor-shell--preview">
          <header class="map-editor-topbar">
            <div class="map-editor-brand">
            <strong>Map Preview</strong>
              <span>${this.mapWidth} x ${this.mapHeight} tiles @ ${this.tileSize}px</span>
            </div>
            <div class="map-editor-actions">
              <button data-editor-action="exit-preview">Back to editor</button>
              <button data-editor-action="play">Play RTS</button>
            </div>
          </header>
          <footer class="map-editor-status">${escapeHtml(this.statusText)}</footer>
        </div>
      `;
      return;
    }
    this.root.innerHTML = `
      <div class="map-editor-shell${this.leftPanelCollapsed ? " map-editor-shell--left-collapsed" : ""}">
        <header class="map-editor-topbar">
          <div class="map-editor-brand">
            <strong>Age of Blockchains Map Editor</strong>
            <span>${this.mapWidth} x ${this.mapHeight} tiles @ ${this.tileSize}px</span>
          </div>
          <div class="map-editor-actions">
            <button data-editor-action="toggle-left-panel">${this.leftPanelCollapsed ? "Show tools" : "Hide tools"}</button>
            <button data-editor-action="toggle-collision">${this.showCollisionOverlay ? "Hide collision" : "Show collision"}</button>
            <button data-editor-action="undo">Undo${this.undoStack.length > 0 ? ` (${this.undoStack.length})` : ""}</button>
            <button data-editor-action="preview-map">Preview</button>
            <button data-editor-action="play">Play</button>
            <button data-editor-action="save-local">Save local</button>
            <button data-editor-action="load-local">Load local</button>
            <button data-editor-action="load-project-map">Load project map</button>
            <button data-editor-action="copy-export">Copy JSON</button>
            <button data-editor-action="download-export">Download JSON</button>
            <button data-editor-action="import-json">Import JSON</button>
            <button data-editor-action="reset">Reset</button>
            <input hidden data-editor-json-file type="file" accept="application/json,.json" />
            <input hidden data-editor-terrain-file type="file" accept="image/png,image/webp,image/jpeg" multiple />
          </div>
        </header>
        <aside class="map-editor-panel map-editor-panel--left">
          <div class="map-editor-section">
            <div class="map-editor-section-title">Tools</div>
            <div class="map-editor-tool-grid">
              ${this.toolButton("terrain", "Terrain")}
              ${this.toolButton("object", "Object")}
              ${this.toolButton("stamp", "Stamp")}
              ${this.toolButton("moveCells", "Move cells")}
              ${this.toolButton("select", "Select")}
              ${this.toolButton("erase", "Erase")}
            </div>
          </div>
          <div class="map-editor-section">
            <div class="map-editor-section-title">Current brush</div>
            ${this.currentBrushHtml()}
          </div>
          <div class="map-editor-section">
            <label class="map-editor-range">
              <span>Tiles</span>
              <input data-editor-brush type="range" min="1" max="5" value="${this.brushSize}" />
              <strong>${this.brushSize}</strong>
            </label>
          </div>
          <div class="map-editor-section">
            <div class="map-editor-section-title">Terrain tiles</div>
            <div class="map-editor-muted">Click a cell in the sheet, then paint exact map tiles.</div>
            ${this.tilesetPickerHtml()}
          </div>
          <div class="map-editor-section">
            <div class="map-editor-section-title">RPG Forest maps</div>
            <div class="map-editor-template-actions">
              <button data-editor-action="load-rpg-blank">Blank RPG map</button>
            </div>
            <div class="map-editor-muted">Load a sample as a full map, or use it as a block stamp.</div>
            <div class="map-editor-template-list">
              ${this.rpgForestTemplateButtonsHtml()}
            </div>
          </div>
          <div class="map-editor-section map-editor-section--objects">
            <div class="map-editor-section-title">Objects and decals</div>
            ${this.objectPaletteHtml()}
          </div>
        </aside>
        <aside class="map-editor-panel map-editor-panel--right">
          <div class="map-editor-section">
            <div class="map-editor-section-title">Selection</div>
            ${this.selectedObjectHtml()}
          </div>
          <div class="map-editor-section">
            <div class="map-editor-section-title">Map size</div>
            <div class="map-editor-size-row">
              <label>W <input data-editor-map-width type="number" min="32" max="512" value="${this.mapWidth}" /></label>
              <label>H <input data-editor-map-height type="number" min="32" max="512" value="${this.mapHeight}" /></label>
              <button data-editor-action="resize-map">Resize</button>
            </div>
          </div>
          <div class="map-editor-help">
            <strong>Controls</strong>
            <span>Left drag paints terrain.</span>
            <span>Object tool places the selected asset.</span>
            <span>Stamp previews a sample block before paste.</span>
            <span>Move cells: drag a rectangle, then drag it again to move terrain.</span>
            <span>Select tool moves placed objects.</span>
            <span>Mouse wheel zooms. Right or middle drag pans.</span>
            <span>P toggles the left tools panel.</span>
            <span>R rotates the active terrain/object brush.</span>
            <span>Delete removes selected object.</span>
          </div>
        </aside>
        <footer class="map-editor-status">${escapeHtml(this.statusText)}</footer>
      </div>
    `;
  }

  private toolButton(tool: EditorTool, label: string): string {
    const active = this.selectedTool === tool ? " map-editor-button--active" : "";
    return `<button class="map-editor-tool-button${active}" data-editor-tool="${tool}">${label}</button>`;
  }

  private tilesetPickerHtml(): string {
    const tileset = this.selectedTileset();
    const selectedInfo = terrainFrameInfoFromId(this.selectedTerrainId);
    const frame = selectedInfo?.tileset.id === tileset.id ? selectedInfo.frame : tileset.defaultFrame;
    const column = frame % tileset.columns;
    const row = Math.floor(frame / tileset.columns);
    const selectedStyle = [
      `--tileset-columns:${tileset.columns}`,
      `--tileset-rows:${tileset.rows}`,
      `--tileset-native-width:${tileset.columns * tileset.tileSize}px`,
      `--tileset-native-height:${tileset.rows * tileset.tileSize}px`,
      `--selected-column:${column}`,
      `--selected-row:${row}`,
    ].join(";");
    const tabs = EDITOR_TILESETS.map((item) => {
      const active = item.id === tileset.id ? " map-editor-button--active" : "";
      return `<button class="map-editor-tileset-tab${active}" data-editor-tileset="${escapeAttr(item.id)}">${escapeHtml(item.label)}</button>`;
    }).join("");
    return `
      <div class="map-editor-tileset-card">
        <div class="map-editor-tileset-tabs">${tabs}</div>
        <div class="map-editor-tileset-picker" data-editor-tileset-picker style="${selectedStyle}">
          <div class="map-editor-tileset-canvas" data-editor-tileset-canvas>
            <img src="${tileset.imagePath}" alt="" />
            <span class="map-editor-tileset-selection"></span>
          </div>
        </div>
        <div class="map-editor-tileset-meta">
          <strong>${escapeHtml(this.terrainCatalogItem(terrainIdForFrame(tileset.id, frame)).label)}</strong>
          <span>Frame ${frame + 1} / ${tileset.columns * tileset.rows}</span>
        </div>
      </div>
    `;
  }

  private rpgForestTemplateButtonsHtml(): string {
    return RPG_FOREST_MAPS.map((map) => {
      const selected = this.selectedTemplate?.id === map.id ? " map-editor-button--active" : "";
      return `
        <div class="map-editor-template-row">
          <strong>${escapeHtml(map.label)}</strong>
          <button data-editor-rpg-map="${escapeAttr(map.id)}">Load map</button>
          <button class="${selected}" data-editor-rpg-stamp="${escapeAttr(map.id)}">Use block</button>
        </div>
      `;
    }).join("");
  }

  private currentBrushHtml(): string {
    if (this.selectedTool === "stamp") {
      const template = this.selectedTemplate;
      return `
        <div class="map-editor-current-card">
          <span class="map-editor-current-preview map-editor-current-preview--stamp">${template ? `${template.width}x${template.height}` : ""}</span>
          <span>
            <strong>${escapeHtml(template?.label ?? "No block selected")}</strong>
            <small>${template ? `RPG Forest block - ${template.layers.length} layer(s)` : "Choose a sample block in the bottom panel"}</small>
          </span>
        </div>
      `;
    }
    if (this.selectedTool === "moveCells") {
      const rect = this.selectedCellRect;
      return `
        <div class="map-editor-current-card">
          <span class="map-editor-current-preview map-editor-current-preview--stamp">${rect ? `${rect.w}x${rect.h}` : ""}</span>
          <span>
            <strong>${rect ? "Cell selection" : "Move cells"}</strong>
            <small>${rect ? `Drag inside the selection to move it` : "Drag a rectangle on the map"}</small>
          </span>
        </div>
      `;
    }
    if (this.selectedTool === "object") {
      const item = objectCatalogItem(this.selectedObjectAssetId);
      const preview = item ? this.previewForTexture(item.textureKey) : "";
      const angle = item ? this.placementAngleForObject(item) : 0;
      return `
        <div class="map-editor-current-card">
          <span class="map-editor-current-preview">${preview ? `<img src="${preview}" alt="" style="transform: rotate(${angle}deg);" />` : ""}</span>
          <span>
            <strong>${escapeHtml(item?.label ?? "No object")}</strong>
            <small>${escapeHtml(item?.category ?? "Object")} - ${angle} deg</small>
          </span>
        </div>
        <div class="map-editor-current-actions">
          <button data-editor-action="rotate-brush-left">Rotate -90</button>
          <button data-editor-action="rotate-brush-right">Rotate +90</button>
          <button data-editor-action="reset-brush-rotation">Reset</button>
        </div>
      `;
    }
    const item = this.terrainCatalogItem(this.selectedTool === "erase" ? DEFAULT_EDITOR_TERRAIN_ID : this.selectedTerrainId);
    const preview = this.previewForTexture(item.textureKey, item.frame);
    const angle = this.selectedTool === "terrain" ? this.terrainBrushAngle : 0;
    return `
      <div class="map-editor-current-card">
        <span class="map-editor-current-preview">${preview ? `<img src="${preview}" alt="" style="transform: rotate(${angle}deg);" />` : ""}</span>
        <span><strong>${escapeHtml(item.label)}</strong><small>${this.selectedTool === "erase" ? "Erase to default tile" : `Terrain tile - ${angle} deg`}</small></span>
      </div>
      ${
        this.selectedTool === "terrain"
          ? `<div class="map-editor-current-actions">
              <button data-editor-action="rotate-brush-left">Rotate -90</button>
              <button data-editor-action="rotate-brush-right">Rotate +90</button>
              <button data-editor-action="reset-brush-rotation">Reset</button>
            </div>`
          : ""
      }
    `;
  }

  private objectPaletteHtml(): string {
    const visibleObjects = EDITOR_OBJECT_CATALOG.filter((item) => item.category !== "Decals" && item.category !== "Transitions");
    const categories = Array.from(new Set(visibleObjects.map((item) => item.category)));
    return categories
      .map((category) => {
        const buttons = visibleObjects
          .filter((item) => item.category === category)
          .map((item) => this.objectButton(item))
          .join("");
        return `
          <details class="map-editor-object-group" ${category === "Buildings" || category === "Resources" ? "open" : ""}>
            <summary>${category}</summary>
            <div class="map-editor-object-grid">${buttons}</div>
          </details>
        `;
      })
      .join("");
  }

  private objectButton(item: EditorObjectCatalogItem): string {
    const active = this.selectedObjectAssetId === item.id ? " map-editor-object-button--active" : "";
    const preview = this.previewForTexture(item.textureKey);
    return `
      <button class="map-editor-object-button${active}" data-editor-object="${escapeAttr(item.id)}" title="${escapeAttr(item.label)}">
        ${preview ? `<img src="${preview}" alt="" />` : `<span class="map-editor-object-fallback"></span>`}
        <span>${escapeHtml(item.label)}</span>
      </button>
    `;
  }

  private selectedObjectHtml(): string {
    const object = this.selectedObjectId ? this.objects.find((item) => item.id === this.selectedObjectId) : undefined;
    const catalog = object ? objectCatalogItem(object.assetId) : undefined;
    if (!object || !catalog) {
      return `<p class="map-editor-muted">No object selected.</p>`;
    }
    const sizeControl =
      catalog.category === "Transitions"
        ? `<p class="map-editor-muted">Transition tile: fixed ${TERRAIN_STAMP_TILES * TILE_SIZE} x ${TERRAIN_STAMP_TILES * TILE_SIZE}, snapped to terrain chunks.</p>`
        : `
      <label class="map-editor-range">
        <span>Width</span>
        <input data-editor-selected-width type="range" min="16" max="900" value="${Math.round(object.width)}" />
        <strong>${Math.round(object.width)}</strong>
      </label>`;
    return `
      <div class="map-editor-selected-card">
        <strong>${escapeHtml(catalog.label)}</strong>
        <span>${Math.round(object.x)}, ${Math.round(object.y)}</span>
      </div>
      ${sizeControl}
      <label class="map-editor-range">
        <span>Alpha</span>
        <input data-editor-selected-alpha type="range" min="20" max="100" value="${Math.round(object.alpha * 100)}" />
        <strong>${Math.round(object.alpha * 100)}%</strong>
      </label>
      <label class="map-editor-field">
        <span>Depth offset</span>
        <input data-editor-selected-depth type="number" min="-200" max="200" value="${Math.round(object.depthOffset)}" />
      </label>
      <div class="map-editor-tool-grid">
        <button data-editor-action="rotate-selected-left">Rotate -90</button>
        <button data-editor-action="rotate-selected-right">Rotate +90</button>
        <button data-editor-action="flip-selected-x">Flip X</button>
        <button data-editor-action="flip-selected-y">Flip Y</button>
        <button class="map-editor-danger" data-editor-action="delete-selected">Delete</button>
      </div>
    `;
  }

  private handleUiClick = (event: MouseEvent): void => {
    const target = event.target as HTMLElement;
    const toolButton = target.closest("[data-editor-tool]") as HTMLElement | null;
    const tilesetButton = target.closest("[data-editor-tileset]") as HTMLElement | null;
    const rpgMapButton = target.closest("[data-editor-rpg-map]") as HTMLElement | null;
    const rpgStampButton = target.closest("[data-editor-rpg-stamp]") as HTMLElement | null;
    const terrainButton = target.closest("[data-editor-terrain]") as HTMLElement | null;
    const objectButton = target.closest("[data-editor-object]") as HTMLElement | null;
    const actionButton = target.closest("[data-editor-action]") as HTMLElement | null;
    const tilesetPicker = target.closest("[data-editor-tileset-picker]") as HTMLElement | null;

    if (toolButton) {
      this.selectedTool = toolButton.dataset.editorTool as EditorTool;
      this.setStatus(`Tool: ${this.selectedTool}`);
      this.renderUi();
      return;
    }
    if (tilesetButton) {
      this.selectTileset(tilesetButton.dataset.editorTileset ?? DEFAULT_EDITOR_TILESET_ID);
      return;
    }
    if (rpgMapButton) {
      void this.loadRpgForestMap(rpgMapButton.dataset.editorRpgMap ?? "map2");
      return;
    }
    if (rpgStampButton) {
      void this.selectRpgForestTemplate(rpgStampButton.dataset.editorRpgStamp ?? "map2");
      return;
    }
    if (tilesetPicker) {
      this.pickTilesetFrame(event, tilesetPicker);
      return;
    }
    if (terrainButton) {
      this.selectedTerrainId = terrainButton.dataset.editorTerrain ?? DEFAULT_EDITOR_TERRAIN_ID;
      this.selectedTilesetId = terrainFrameInfoFromId(this.selectedTerrainId)?.tileset.id ?? this.selectedTilesetId;
      this.selectedTool = "terrain";
      this.setStatus(`Terrain: ${this.terrainCatalogItem(this.selectedTerrainId).label}`);
      this.renderUi();
      return;
    }
    if (objectButton) {
      this.selectedObjectAssetId = objectButton.dataset.editorObject ?? this.selectedObjectAssetId;
      this.selectedTool = "object";
      this.objectBrushAngle = 0;
      this.setStatus(`Object: ${objectCatalogItem(this.selectedObjectAssetId)?.label ?? this.selectedObjectAssetId}`);
      this.renderUi();
      return;
    }
    if (actionButton) {
      this.handleAction(actionButton.dataset.editorAction ?? "");
    }
  };

  private handleUiInput = (event: Event): void => {
    const target = event.target as HTMLInputElement;
    if (target.matches("[data-editor-brush]")) {
      this.brushSize = Phaser.Math.Clamp(Number(target.value) || 1, 1, 5);
      this.renderUi();
      return;
    }
    const selected = this.selectedObject();
    if (!selected) {
      return;
    }
    if (target.matches("[data-editor-selected-width]")) {
      this.pushUndoSnapshot("resize object");
      const catalog = objectCatalogItem(selected.assetId);
      if (catalog?.category === "Transitions") {
        const dimensions = this.objectDimensionsForCatalogItem(catalog);
        selected.width = dimensions.width;
        selected.height = dimensions.height;
      } else {
        selected.width = Phaser.Math.Clamp(Number(target.value) || selected.width, 16, 900);
        selected.height = undefined;
      }
      this.syncObjectSprite(selected);
      this.renderUi();
      return;
    }
    if (target.matches("[data-editor-selected-alpha]")) {
      this.pushUndoSnapshot("change object alpha");
      selected.alpha = Phaser.Math.Clamp((Number(target.value) || 100) / 100, 0.2, 1);
      this.syncObjectSprite(selected);
      this.renderUi();
      return;
    }
    if (target.matches("[data-editor-selected-depth]")) {
      this.pushUndoSnapshot("change object depth");
      selected.depthOffset = Phaser.Math.Clamp(Number(target.value) || 0, -200, 200);
      this.syncObjectSprite(selected);
    }
  };

  private handleUiChange = (event: Event): void => {
    const target = event.target as HTMLInputElement;
    if (target.matches("[data-editor-json-file]") && target.files?.[0]) {
      void this.importJsonFile(target.files[0]);
      target.value = "";
    }
    if (target.matches("[data-editor-terrain-file]") && target.files?.length) {
      this.loadCustomTerrainFiles(Array.from(target.files));
      target.value = "";
    }
  };

  private pickTilesetFrame(event: MouseEvent, picker: HTMLElement): void {
    const tileset = this.selectedTileset();
    const canvas = picker.querySelector<HTMLElement>("[data-editor-tileset-canvas]");
    if (!canvas) {
      return;
    }
    const rect = canvas.getBoundingClientRect();
    const localX = Phaser.Math.Clamp(event.clientX - rect.left, 0, rect.width - 1);
    const localY = Phaser.Math.Clamp(event.clientY - rect.top, 0, rect.height - 1);
    const column = Phaser.Math.Clamp(Math.floor((localX / rect.width) * tileset.columns), 0, tileset.columns - 1);
    const row = Phaser.Math.Clamp(Math.floor((localY / rect.height) * tileset.rows), 0, tileset.rows - 1);
    const frame = row * tileset.columns + column;
    this.selectedTerrainId = terrainIdForFrame(tileset.id, frame);
    this.selectedTool = "terrain";
    this.setStatus(`Terrain: ${this.terrainCatalogItem(this.selectedTerrainId).label}`);
    this.renderUi();
  }

  private handleAction(action: string): void {
    switch (action) {
      case "play":
        this.playGame();
        break;
      case "preview-map":
        this.enterPreviewMode();
        break;
      case "exit-preview":
        this.exitPreviewMode();
        break;
      case "undo":
        this.undoLastAction();
        break;
      case "toggle-collision":
        this.toggleCollisionOverlay();
        break;
      case "save-local":
        this.saveLocal();
        break;
      case "load-local":
        this.loadLocal();
        break;
      case "load-project-map":
        void this.loadProjectEditorMap();
        break;
      case "load-v2-demo":
        this.pushUndoSnapshot("load V2 demo");
        this.loadV2DemoMap();
        break;
      case "load-v3-demo":
        this.pushUndoSnapshot("load V3 demo");
        this.loadV3SheetDemoMap();
        break;
      case "load-rpg-blank":
        this.pushUndoSnapshot("load blank RPG map");
        this.loadBlankRpgForestMap();
        break;
      case "load-current-layout":
        this.pushUndoSnapshot("load current RTS layout");
        this.loadCurrentRuntimeLayout();
        break;
      case "copy-export":
        void this.copyExport();
        break;
      case "download-export":
        this.downloadExport();
        break;
      case "import-json":
        this.root?.querySelector<HTMLInputElement>("[data-editor-json-file]")?.click();
        break;
      case "import-terrain":
        this.root?.querySelector<HTMLInputElement>("[data-editor-terrain-file]")?.click();
        break;
      case "resize-map":
        this.pushUndoSnapshot("resize map");
        this.resizeFromUi();
        break;
      case "delete-selected":
        this.deleteSelectedObject();
        break;
      case "flip-selected-x":
        this.flipSelected("x");
        break;
      case "flip-selected-y":
        this.flipSelected("y");
        break;
      case "rotate-selected-left":
        this.rotateSelected(-90);
        break;
      case "rotate-selected-right":
        this.rotateSelected(90);
        break;
      case "rotate-brush-left":
        this.rotateActiveBrush(-90);
        break;
      case "rotate-brush-right":
        this.rotateActiveBrush(90);
        break;
      case "reset-brush-rotation":
        this.resetActiveBrushRotation();
        break;
      case "toggle-left-panel":
        this.toggleLeftPanel();
        break;
      case "reset":
        this.resetEditor();
        break;
      default:
        break;
    }
  }

  private createInput(): void {
    this.cursors = this.input.keyboard?.createCursorKeys();
    this.keys = this.input.keyboard?.addKeys("W,A,S,D,SPACE,ESC,DELETE") as
      | Record<"W" | "A" | "S" | "D" | "SPACE" | "ESC" | "DELETE", Phaser.Input.Keyboard.Key>
      | undefined;

    this.input.on(Phaser.Input.Events.POINTER_DOWN, (pointer: Phaser.Input.Pointer) => {
      if (pointer.middleButtonDown() || pointer.rightButtonDown() || this.keys?.SPACE.isDown) {
        this.startPan(pointer);
        return;
      }
      if (!pointer.leftButtonDown()) {
        return;
      }
      this.handlePrimaryDown(pointer);
    });
    this.input.on(Phaser.Input.Events.POINTER_MOVE, (pointer: Phaser.Input.Pointer) => {
      if (this.panning) {
        this.updatePan(pointer);
        return;
      }
      if (this.draggingObjectId) {
        this.dragSelectedObject(pointer);
        return;
      }
      if (this.cellMoveDraft) {
        this.updateCellMoveDraft(pointer);
        return;
      }
      if (this.cellSelectionStart) {
        this.updateCellSelection(pointer);
        return;
      }
      if (this.painting) {
        if (this.selectedTool === "terrain" || this.selectedTool === "erase") {
          this.paintAtPointer(pointer, this.selectedTool === "erase" ? DEFAULT_EDITOR_TERRAIN_ID : this.selectedTerrainId);
        }
      }
    });
    this.input.on(Phaser.Input.Events.POINTER_UP, () => {
      if (this.cellMoveDraft) {
        this.applyCellMoveDraft();
      }
      this.painting = false;
      this.panning = false;
      this.draggingObjectId = undefined;
      this.cellSelectionStart = undefined;
    });
    this.input.on(Phaser.Input.Events.POINTER_WHEEL, (_pointer: Phaser.Input.Pointer, _objects: Phaser.GameObjects.GameObject[], _dx: number, dy: number) => {
      const camera = this.cameras.main;
      camera.setZoom(Phaser.Math.Clamp(camera.zoom + (dy > 0 ? -0.1 : 0.1), MIN_ZOOM, MAX_ZOOM));
    });

    this.input.keyboard?.on("keydown-ESC", () => {
      this.selectedTool = "select";
      this.selectedObjectId = undefined;
      this.selectedTemplate = undefined;
      this.selectedCellRect = undefined;
      this.cellSelectionStart = undefined;
      this.cellMoveDraft = undefined;
      this.setStatus("Selection cleared.");
      this.renderUi();
    });
    this.input.keyboard?.on("keydown-DELETE", () => this.deleteSelectedObject());
    this.input.keyboard?.on("keydown-Z", (event: KeyboardEvent) => {
      if (event.ctrlKey || event.metaKey) {
        event.preventDefault();
        this.undoLastAction();
      }
    });
    this.input.keyboard?.on("keydown-ONE", () => this.setToolFromShortcut("terrain"));
    this.input.keyboard?.on("keydown-TWO", () => this.setToolFromShortcut("object"));
    this.input.keyboard?.on("keydown-THREE", () => this.setToolFromShortcut("stamp"));
    this.input.keyboard?.on("keydown-FOUR", () => this.setToolFromShortcut("moveCells"));
    this.input.keyboard?.on("keydown-FIVE", () => this.setToolFromShortcut("select"));
    this.input.keyboard?.on("keydown-SIX", () => this.setToolFromShortcut("erase"));
    this.input.keyboard?.on("keydown-R", () => {
      if (this.selectedTool === "object" || this.selectedTool === "terrain") {
        this.rotateActiveBrush(90);
      }
    });
    this.input.keyboard?.on("keydown-P", () => this.toggleLeftPanel());
  }

  private handlePrimaryDown(pointer: Phaser.Input.Pointer): void {
    if (this.previewMode) {
      return;
    }
    if (this.selectedTool === "terrain" || this.selectedTool === "erase") {
      this.pushUndoSnapshot(this.selectedTool === "erase" ? "erase terrain" : "paint terrain");
      this.painting = true;
      this.paintAtPointer(pointer, this.selectedTool === "erase" ? DEFAULT_EDITOR_TERRAIN_ID : this.selectedTerrainId);
      return;
    }
    if (this.selectedTool === "object") {
      this.placeObjectAtPointer(pointer);
      return;
    }
    if (this.selectedTool === "stamp") {
      this.stampTemplateAtPointer(pointer);
      return;
    }
    if (this.selectedTool === "moveCells") {
      this.startCellMoveInteraction(pointer);
      return;
    }
    const object = this.objectAtPointer(pointer);
    this.selectedObjectId = object?.id;
    if (object) {
      this.pushUndoSnapshot("move object");
      this.draggingObjectId = object.id;
      const point = this.worldPointFromPointer(pointer);
      this.dragObjectOffset.set(point.x - object.x, point.y - object.y);
      this.setStatus(`Selected ${objectCatalogItem(object.assetId)?.label ?? object.assetId}.`);
    } else {
      this.setStatus("No object selected.");
    }
    this.renderUi();
  }

  private paintAtPointer(pointer: Phaser.Input.Pointer, terrainId: EditorTerrainId): void {
    const tile = this.tileFromPointer(pointer);
    if (!tile) {
      return;
    }
    let changed = false;
    const angle = this.selectedTool === "erase" ? 0 : this.terrainBrushAngle;
    const overlayLayer = this.selectedTool !== "erase" && this.isOverlayTerrain(terrainId) ? this.ensureManualOverlayLayer(terrainId) : undefined;
    for (const cell of this.chunksForBrush(tile)) {
      const index = this.tileIndex(cell.x, cell.y);
      if (this.selectedTool === "erase") {
        if (this.terrain[index] !== DEFAULT_EDITOR_TERRAIN_ID) {
          this.terrain[index] = DEFAULT_EDITOR_TERRAIN_ID;
          changed = true;
        }
        for (const layer of this.extraTerrainLayers) {
          if (layer.tiles[index]) {
            layer.tiles[index] = null;
            changed = true;
          }
        }
        if (this.collision[index]) {
          this.collision[index] = false;
          changed = true;
        }
      } else if (overlayLayer) {
        if (overlayLayer.tiles[index] !== terrainId) {
          overlayLayer.tiles[index] = terrainId;
          changed = true;
        }
        if (this.terrainBlocksMovement(terrainId) && !this.collision[index]) {
          this.collision[index] = true;
          changed = true;
        }
      } else {
        if (this.terrain[index] !== terrainId) {
          this.terrain[index] = terrainId;
          changed = true;
        }
        if (this.clearExtraTerrainAt(index)) {
          changed = true;
        }
        const blocksMovement = this.terrainBlocksMovement(terrainId);
        if (this.collision[index] !== blocksMovement) {
          this.collision[index] = blocksMovement;
          changed = true;
        }
      }
      if (!overlayLayer && this.setTerrainRotationAtChunk(cell.x, cell.y, angle)) {
        changed = true;
      }
    }
    if (changed) {
      this.createTerrainLayer();
    }
    const mode = overlayLayer ? "overlay" : this.selectedTool === "erase" ? "erased" : `${angle} deg`;
    this.statusText = `Painted ${this.terrainCatalogItem(terrainId).label} at ${tile.x}, ${tile.y} (${mode}).`;
  }

  private clearExtraTerrainAt(index: number): boolean {
    let changed = false;
    for (const layer of this.extraTerrainLayers) {
      if (!layer.tiles[index]) {
        continue;
      }
      layer.tiles[index] = null;
      changed = true;
    }
    return changed;
  }

  private normalizeImportedCollision(rawCollision: unknown): boolean[] {
    const expectedLength = this.mapWidth * this.mapHeight;
    if (Array.isArray(rawCollision)) {
      return Array.from({ length: expectedLength }, (_unused, index) => Boolean(rawCollision[index]));
    }
    return Array.from({ length: expectedLength }, (_unused, index) => {
      if (this.terrainBlocksMovement(this.terrain[index] ?? DEFAULT_EDITOR_TERRAIN_ID)) {
        return true;
      }
      return this.extraTerrainLayers.some((layer) => {
        const terrainId = layer.tiles[index];
        return Boolean(terrainId && this.terrainBlocksMovement(terrainId));
      });
    });
  }

  private terrainBlocksMovement(terrainId: EditorTerrainId): boolean {
    const info = terrainFrameInfoFromId(terrainId);
    if (!info) {
      return false;
    }
    if (info.tileset.id === "rpgForestWater" || info.tileset.id === "rpgForestTrees") {
      return true;
    }
    return info.tileset.id === "rpgForestGround" && this.isOverlayTerrain(terrainId);
  }

  private ensureManualOverlayLayer(terrainId: EditorTerrainId): EditorTileLayer {
    const tilesetId = terrainFrameInfoFromId(terrainId)?.tileset.id ?? "overlay";
    const id = `manual-overlay-${tilesetId}`;
    let layer = this.extraTerrainLayers.find((item) => item.id === id);
    if (!layer) {
      layer = {
        id,
        name: `${this.selectedTileset().label} overlay`,
        tiles: Array.from({ length: this.mapWidth * this.mapHeight }, () => null),
        opacity: 1,
      };
      this.extraTerrainLayers.push(layer);
    }
    return layer;
  }

  private startCellMoveInteraction(pointer: Phaser.Input.Pointer): void {
    const tile = this.tileFromPointer(pointer);
    if (!tile) {
      return;
    }
    if (this.selectedCellRect && isTileInRect(tile, this.selectedCellRect)) {
      this.cellMoveDraft = this.createCellMoveDraft(this.selectedCellRect, tile);
      this.setStatus(`Move selection ${this.selectedCellRect.w} x ${this.selectedCellRect.h}. Drag to place it.`);
      return;
    }
    this.cellSelectionStart = tile;
    this.cellMoveDraft = undefined;
    this.selectedCellRect = { x: tile.x, y: tile.y, w: 1, h: 1 };
    this.setStatus(`Cell selection started at ${tile.x}, ${tile.y}.`);
  }

  private updateCellSelection(pointer: Phaser.Input.Pointer): void {
    const start = this.cellSelectionStart;
    const tile = this.tileFromPointer(pointer);
    if (!start || !tile) {
      return;
    }
    this.selectedCellRect = rectFromTiles(start, tile);
    this.statusText = `Selected ${this.selectedCellRect.w} x ${this.selectedCellRect.h} cells.`;
  }

  private createCellMoveDraft(rect: EditorCellRect, dragStart: TileCoord): EditorCellMoveDraft {
    const tiles: EditorTerrainId[] = [];
    for (let y = 0; y < rect.h; y += 1) {
      for (let x = 0; x < rect.w; x += 1) {
        tiles.push(this.terrain[this.tileIndex(rect.x + x, rect.y + y)] ?? DEFAULT_EDITOR_TERRAIN_ID);
      }
    }
    const extraLayers = this.extraTerrainLayers.map((layer) => {
      const layerTiles: Array<EditorTerrainId | null> = [];
      for (let y = 0; y < rect.h; y += 1) {
        for (let x = 0; x < rect.w; x += 1) {
          layerTiles.push(layer.tiles[this.tileIndex(rect.x + x, rect.y + y)] ?? null);
        }
      }
      return layerTiles;
    });
    const collision: boolean[] = [];
    for (let y = 0; y < rect.h; y += 1) {
      for (let x = 0; x < rect.w; x += 1) {
        collision.push(Boolean(this.collision[this.tileIndex(rect.x + x, rect.y + y)]));
      }
    }
    const rotations = this.exportTerrainRotations()
      .filter((rotation) => isTileInRect(rotation, rect))
      .map((rotation) => ({ x: rotation.x - rect.x, y: rotation.y - rect.y, angle: rotation.angle }));
    return {
      rect: { ...rect },
      tiles,
      extraLayers,
      collision,
      rotations,
      dragStart,
      offsetX: 0,
      offsetY: 0,
    };
  }

  private updateCellMoveDraft(pointer: Phaser.Input.Pointer): void {
    const draft = this.cellMoveDraft;
    const tile = this.tileFromPointer(pointer);
    if (!draft || !tile) {
      return;
    }
    draft.offsetX = Phaser.Math.Clamp(tile.x - draft.dragStart.x, -draft.rect.x, this.mapWidth - draft.rect.x - draft.rect.w);
    draft.offsetY = Phaser.Math.Clamp(tile.y - draft.dragStart.y, -draft.rect.y, this.mapHeight - draft.rect.y - draft.rect.h);
    this.statusText = `Moving cells to ${draft.rect.x + draft.offsetX}, ${draft.rect.y + draft.offsetY}.`;
  }

  private applyCellMoveDraft(): void {
    const draft = this.cellMoveDraft;
    if (!draft) {
      return;
    }
    this.cellMoveDraft = undefined;
    if (draft.offsetX === 0 && draft.offsetY === 0) {
      this.setStatus("Cell move cancelled.");
      return;
    }

    this.pushUndoSnapshot("move cells");
    for (let y = 0; y < draft.rect.h; y += 1) {
      for (let x = 0; x < draft.rect.w; x += 1) {
        const sourceX = draft.rect.x + x;
        const sourceY = draft.rect.y + y;
        this.terrain[this.tileIndex(sourceX, sourceY)] = DEFAULT_EDITOR_TERRAIN_ID;
        for (const layer of this.extraTerrainLayers) {
          layer.tiles[this.tileIndex(sourceX, sourceY)] = null;
        }
        this.collision[this.tileIndex(sourceX, sourceY)] = false;
        this.terrainRotations.delete(terrainChunkKey(sourceX, sourceY));
      }
    }

    const targetX = draft.rect.x + draft.offsetX;
    const targetY = draft.rect.y + draft.offsetY;
    for (let y = 0; y < draft.rect.h; y += 1) {
      for (let x = 0; x < draft.rect.w; x += 1) {
        const targetIndex = this.tileIndex(targetX + x, targetY + y);
        const sourceIndex = y * draft.rect.w + x;
        this.terrain[targetIndex] = draft.tiles[sourceIndex] ?? DEFAULT_EDITOR_TERRAIN_ID;
        for (const [layerIndex, layer] of this.extraTerrainLayers.entries()) {
          layer.tiles[targetIndex] = draft.extraLayers[layerIndex]?.[sourceIndex] ?? null;
        }
        this.collision[targetIndex] = Boolean(draft.collision[sourceIndex]);
      }
    }
    for (const rotation of draft.rotations) {
      this.setTerrainRotationAtChunk(targetX + rotation.x, targetY + rotation.y, rotation.angle);
    }

    this.selectedCellRect = { x: targetX, y: targetY, w: draft.rect.w, h: draft.rect.h };
    this.createTerrainLayer();
    this.setStatus(`Moved ${draft.rect.w} x ${draft.rect.h} cells.`);
    this.renderUi();
  }

  private placeObjectAtPointer(pointer: Phaser.Input.Pointer): void {
    const item = objectCatalogItem(this.selectedObjectAssetId);
    if (!item) {
      return;
    }
    this.pushUndoSnapshot("place object");
    const point = this.worldPointFromPointer(pointer);
    const position = this.snappedWorldForObject(item, point.x, point.y);
    const dimensions = this.objectDimensionsForCatalogItem(item);
    const object: EditorObjectPlacement = {
      id: `object-${this.nextObjectNumber++}`,
      assetId: item.id,
      x: position.x,
      y: position.y,
      width: dimensions.width,
      height: dimensions.height,
      alpha: item.alpha ?? 1,
      angle: this.placementAngleForObject(item),
      depthOffset: item.depthOffset ?? 0,
      flipX: false,
      flipY: false,
    };
    this.objects.push(object);
    this.createObjectSprite(object);
    this.selectedObjectId = object.id;
    this.setStatus(`Placed ${item.label}.`);
    this.renderUi();
  }

  private dragSelectedObject(pointer: Phaser.Input.Pointer): void {
    const object = this.objects.find((item) => item.id === this.draggingObjectId);
    if (!object) {
      return;
    }
    const item = objectCatalogItem(object.assetId);
    const point = this.worldPointFromPointer(pointer);
    const position = item
      ? this.snappedWorldForObject(item, point.x - this.dragObjectOffset.x, point.y - this.dragObjectOffset.y)
      : this.snappedWorld(point.x - this.dragObjectOffset.x, point.y - this.dragObjectOffset.y);
    object.x = position.x;
    object.y = position.y;
    this.syncObjectSprite(object);
  }

  private syncObjectSprite(object: EditorObjectPlacement): void {
    const sprite = this.objectSprites.get(object.id);
    if (sprite) {
      this.applyObjectSpriteState(sprite, object);
    }
  }

  private selectedObject(): EditorObjectPlacement | undefined {
    return this.selectedObjectId ? this.objects.find((object) => object.id === this.selectedObjectId) : undefined;
  }

  private objectAtPointer(pointer: Phaser.Input.Pointer): EditorObjectPlacement | undefined {
    return [...this.objects]
      .sort((a, b) => (this.objectSprites.get(b.id)?.depth ?? 0) - (this.objectSprites.get(a.id)?.depth ?? 0))
      .find((object) => {
        const point = this.worldPointFromPointer(pointer);
        return this.objectSprites.get(object.id)?.getBounds().contains(point.x, point.y);
      });
  }

  private deleteSelectedObject(): void {
    const id = this.selectedObjectId;
    if (!id) {
      return;
    }
    this.pushUndoSnapshot("delete object");
    this.objects = this.objects.filter((object) => object.id !== id);
    this.objectSprites.get(id)?.destroy();
    this.objectSprites.delete(id);
    this.selectedObjectId = undefined;
    this.setStatus("Object deleted.");
    this.renderUi();
  }

  private flipSelected(axis: "x" | "y"): void {
    const object = this.selectedObject();
    if (!object) {
      return;
    }
    this.pushUndoSnapshot("flip object");
    if (axis === "x") {
      object.flipX = !object.flipX;
    } else {
      object.flipY = !object.flipY;
    }
    this.syncObjectSprite(object);
    this.renderUi();
  }

  private rotateSelected(delta: number): void {
    const object = this.selectedObject();
    if (!object) {
      return;
    }
    this.pushUndoSnapshot("rotate object");
    object.angle = normalizeAngle(object.angle + delta);
    this.syncObjectSprite(object);
    this.renderUi();
  }

  private rotateActiveBrush(delta: number): void {
    if (this.selectedTool === "terrain") {
      this.terrainBrushAngle = normalizeAngle(this.terrainBrushAngle + delta);
      this.setStatus(`Terrain brush rotation: ${this.terrainBrushAngle} deg.`);
      this.renderUi();
      return;
    }
    if (this.selectedTool !== "object") {
      return;
    }
    this.objectBrushAngle = normalizeAngle(this.objectBrushAngle + delta);
    this.setStatus(`Object brush rotation: ${this.objectBrushAngle} deg.`);
    this.renderUi();
  }

  private resetActiveBrushRotation(): void {
    if (this.selectedTool === "terrain") {
      this.terrainBrushAngle = 0;
      this.setStatus("Terrain brush rotation reset.");
      this.renderUi();
      return;
    }
    if (this.selectedTool !== "object") {
      return;
    }
    this.objectBrushAngle = 0;
    this.setStatus("Object brush rotation reset.");
    this.renderUi();
  }

  private toggleLeftPanel(): void {
    this.leftPanelCollapsed = !this.leftPanelCollapsed;
    this.setStatus(this.leftPanelCollapsed ? "Tools panel hidden." : "Tools panel shown.");
    this.renderUi();
  }

  private toggleCollisionOverlay(): void {
    this.showCollisionOverlay = !this.showCollisionOverlay;
    this.drawCollisionOverlay();
    this.setStatus(this.showCollisionOverlay ? "Collision overlay shown." : "Collision overlay hidden.");
    this.renderUi();
  }

  private selectTileset(id: string): void {
    const tileset = EDITOR_TILESETS.find((item) => item.id === id) ?? EDITOR_TILESETS[0];
    this.selectedTilesetId = tileset.id;
    const selectedInfo = terrainFrameInfoFromId(this.selectedTerrainId);
    if (selectedInfo?.tileset.id !== tileset.id) {
      this.selectedTerrainId = terrainIdForFrame(tileset.id, tileset.defaultFrame);
    }
    this.selectedTool = "terrain";
    this.setStatus(`Tileset: ${tileset.label}.`);
    this.renderUi();
  }

  private enterPreviewMode(): void {
    this.previewMode = true;
    this.painting = false;
    this.draggingObjectId = undefined;
    this.selectedObjectId = undefined;
    this.hideObjectPreview();
    this.drawGrid();
    this.drawCollisionOverlay();
    this.setStatus("Preview mode. Pan and zoom are still available.");
    this.renderUi();
  }

  private exitPreviewMode(): void {
    this.previewMode = false;
    this.drawGrid();
    this.drawCollisionOverlay();
    this.setStatus("Back to editor.");
    this.renderUi();
  }

  private drawCursor(): void {
    if (!this.cursorGraphics) {
      return;
    }
    this.cursorGraphics.clear();
    if (this.previewMode) {
      this.hideObjectPreview();
      this.hideTemplatePreview();
      this.hideTilePreview();
      return;
    }
    const pointer = this.input.activePointer;
    if (this.selectedTool === "object") {
      this.hideTemplatePreview();
      this.hideTilePreview();
      this.updateObjectPreview(pointer);
      return;
    }
    this.hideObjectPreview();
    if (this.selectedTool === "stamp") {
      this.hideTilePreview();
      this.updateTemplatePreview(pointer);
      return;
    }
    this.hideTemplatePreview();
    const tile = this.tileFromPointer(pointer);
    if (!tile || this.selectedTool === "select" || this.selectedTool === "moveCells") {
      this.hideTilePreview();
      return;
    }
    if (this.selectedTool === "terrain") {
      this.updateTerrainTilePreview(tile);
    } else {
      this.hideTilePreview();
    }
    this.cursorGraphics.lineStyle(2, this.selectedTool === "erase" ? 0xff6e57 : 0xffe6a6, 0.88);
    for (const chunk of this.chunksForBrush(tile)) {
      this.cursorGraphics.strokeRect(chunk.x * this.tileSize, chunk.y * this.tileSize, this.tileSize, this.tileSize);
    }
  }

  private updateTerrainTilePreview(tile: TileCoord): void {
    const item = this.terrainCatalogItem(this.selectedTerrainId);
    const chunks = this.chunksForBrush(tile);
    for (let index = 0; index < chunks.length; index += 1) {
      const chunk = chunks[index];
      let sprite = this.tilePreviewSprites[index];
      if (!sprite) {
        sprite = this.add.image(0, 0, item.textureKey, item.frame).setOrigin(0.5, 0.5).setDepth(SELECTION_DEPTH - 3);
        this.tilePreviewSprites[index] = sprite;
      }
      sprite
        .setTexture(item.textureKey, item.frame)
        .setPosition(chunk.x * this.tileSize + this.tileSize / 2, chunk.y * this.tileSize + this.tileSize / 2)
        .setDisplaySize(this.tileSize, this.tileSize)
        .setAngle(this.isOverlayTerrain(this.selectedTerrainId) ? 0 : this.terrainBrushAngle)
        .setAlpha(this.isOverlayTerrain(this.selectedTerrainId) ? 1 : 0.86)
        .setVisible(true);
      if (item.tint) {
        sprite.setTint(item.tint);
      } else {
        sprite.clearTint();
      }
    }
    for (let index = chunks.length; index < this.tilePreviewSprites.length; index += 1) {
      this.tilePreviewSprites[index]?.setVisible(false);
    }
  }

  private updateTemplatePreview(pointer: Phaser.Input.Pointer): void {
    const template = this.selectedTemplate;
    const tile = this.tileFromPointer(pointer);
    if (!template || !tile || !this.cursorGraphics) {
      this.hideTemplatePreview();
      return;
    }

    const overflow =
      tile.x < 0 ||
      tile.y < 0 ||
      tile.x + template.width > this.mapWidth ||
      tile.y + template.height > this.mapHeight ||
      template.tileSize !== this.tileSize;
    this.cursorGraphics.fillStyle(overflow ? 0xff6e57 : 0x67e4e9, overflow ? 0.06 : 0.08);
    this.cursorGraphics.fillRect(tile.x * this.tileSize, tile.y * this.tileSize, template.width * this.tileSize, template.height * this.tileSize);

    let previewIndex = 0;
    const maxPreviewTiles = 1200;
    for (let y = 0; y < template.height; y += 1) {
      for (let x = 0; x < template.width; x += 1) {
        if (previewIndex >= maxPreviewTiles) {
          break;
        }
        const terrainId = topTerrainIdAtTemplateCell(template, x, y);
        if (!terrainId) {
          continue;
        }
        const item = this.terrainCatalogItem(terrainId);
        let sprite = this.templatePreviewSprites[previewIndex];
        if (!sprite) {
          sprite = this.add.image(0, 0, item.textureKey, item.frame).setOrigin(0.5, 0.5).setDepth(SELECTION_DEPTH - 2);
          this.templatePreviewSprites[previewIndex] = sprite;
        }
        sprite
          .setTexture(item.textureKey, item.frame)
          .setPosition((tile.x + x) * this.tileSize + this.tileSize / 2, (tile.y + y) * this.tileSize + this.tileSize / 2)
          .setDisplaySize(this.tileSize, this.tileSize)
          .setAlpha(overflow ? 0.45 : 1)
          .setVisible(true);
        if (item.tint) {
          sprite.setTint(item.tint);
        } else {
          sprite.clearTint();
        }
        previewIndex += 1;
      }
    }
    for (let index = previewIndex; index < this.templatePreviewSprites.length; index += 1) {
      this.templatePreviewSprites[index]?.setVisible(false);
    }

    this.cursorGraphics.lineStyle(2, overflow ? 0xff6e57 : 0x8efcff, 0.95);
    this.cursorGraphics.strokeRect(tile.x * this.tileSize, tile.y * this.tileSize, template.width * this.tileSize, template.height * this.tileSize);
    this.cursorGraphics.lineStyle(1, 0xf8e2a0, 0.32);
    for (let x = 1; x < template.width; x += 1) {
      this.cursorGraphics.lineBetween((tile.x + x) * this.tileSize, tile.y * this.tileSize, (tile.x + x) * this.tileSize, (tile.y + template.height) * this.tileSize);
    }
    for (let y = 1; y < template.height; y += 1) {
      this.cursorGraphics.lineBetween(tile.x * this.tileSize, (tile.y + y) * this.tileSize, (tile.x + template.width) * this.tileSize, (tile.y + y) * this.tileSize);
    }
  }

  private hideTemplatePreview(): void {
    for (const sprite of this.templatePreviewSprites) {
      sprite.setVisible(false);
    }
  }

  private hideTilePreview(): void {
    for (const sprite of this.tilePreviewSprites) {
      sprite.setVisible(false);
    }
  }

  private updateObjectPreview(pointer: Phaser.Input.Pointer): void {
    const item = objectCatalogItem(this.selectedObjectAssetId);
    const tile = this.tileFromPointer(pointer);
    if (!item || !tile || !this.textures.exists(item.textureKey)) {
      this.hideObjectPreview();
      return;
    }
    const point = this.worldPointFromPointer(pointer);
    const position = this.snappedWorldForObject(item, point.x, point.y);
    if (!this.objectPreviewSprite || this.objectPreviewSprite.texture.key !== item.textureKey) {
      this.objectPreviewSprite?.destroy();
      this.objectPreviewSprite = this.add.image(position.x, position.y, item.textureKey).setOrigin(item.originX, item.originY);
    }
    const dimensions = this.objectDimensionsForCatalogItem(item);
    const ratio = this.objectPreviewSprite.frame.realWidth > 0 ? this.objectPreviewSprite.frame.realHeight / this.objectPreviewSprite.frame.realWidth : 1;
    this.objectPreviewSprite
      .setVisible(true)
      .setPosition(position.x, position.y)
      .setOrigin(item.originX, item.originY)
      .setDisplaySize(dimensions.width, dimensions.height ?? Math.max(1, dimensions.width * ratio))
      .setAlpha(0.48)
      .setAngle(this.placementAngleForObject(item))
      .setDepth(SELECTION_DEPTH - 1);
  }

  private hideObjectPreview(): void {
    this.objectPreviewSprite?.setVisible(false);
  }

  private drawSelection(): void {
    if (!this.selectionGraphics) {
      return;
    }
    this.selectionGraphics.clear();
    if (this.previewMode) {
      return;
    }
    if (this.selectedCellRect) {
      this.selectionGraphics.lineStyle(2, 0xffe58f, 0.92);
      this.selectionGraphics.strokeRect(
        this.selectedCellRect.x * this.tileSize,
        this.selectedCellRect.y * this.tileSize,
        this.selectedCellRect.w * this.tileSize,
        this.selectedCellRect.h * this.tileSize,
      );
    }
    if (this.cellMoveDraft) {
      const x = this.cellMoveDraft.rect.x + this.cellMoveDraft.offsetX;
      const y = this.cellMoveDraft.rect.y + this.cellMoveDraft.offsetY;
      this.selectionGraphics.fillStyle(0x67e4e9, 0.1);
      this.selectionGraphics.fillRect(x * this.tileSize, y * this.tileSize, this.cellMoveDraft.rect.w * this.tileSize, this.cellMoveDraft.rect.h * this.tileSize);
      this.selectionGraphics.lineStyle(2, 0x8efcff, 0.95);
      this.selectionGraphics.strokeRect(x * this.tileSize, y * this.tileSize, this.cellMoveDraft.rect.w * this.tileSize, this.cellMoveDraft.rect.h * this.tileSize);
    }
    const sprite = this.selectedObjectId ? this.objectSprites.get(this.selectedObjectId) : undefined;
    if (!sprite) {
      return;
    }
    const bounds = sprite.getBounds();
    this.selectionGraphics.lineStyle(2, 0x8efcff, 0.92);
    this.selectionGraphics.strokeRect(bounds.x, bounds.y, bounds.width, bounds.height);
  }

  private updateCamera(delta: number): void {
    const camera = this.cameras.main;
    const speed = (delta / 1000) * 560 / camera.zoom;
    const left = this.cursors?.left.isDown || this.keys?.A.isDown;
    const right = this.cursors?.right.isDown || this.keys?.D.isDown;
    const up = this.cursors?.up.isDown || this.keys?.W.isDown;
    const down = this.cursors?.down.isDown || this.keys?.S.isDown;
    if (left) {
      camera.scrollX -= speed;
    }
    if (right) {
      camera.scrollX += speed;
    }
    if (up) {
      camera.scrollY -= speed;
    }
    if (down) {
      camera.scrollY += speed;
    }
  }

  private startPan(pointer: Phaser.Input.Pointer): void {
    this.panning = true;
    this.panLastScreen.set(pointer.x, pointer.y);
  }

  private updatePan(pointer: Phaser.Input.Pointer): void {
    const camera = this.cameras.main;
    camera.scrollX -= (pointer.x - this.panLastScreen.x) / camera.zoom;
    camera.scrollY -= (pointer.y - this.panLastScreen.y) / camera.zoom;
    this.panLastScreen.set(pointer.x, pointer.y);
  }

  private setToolFromShortcut(tool: EditorTool): void {
    this.selectedTool = tool;
    this.setStatus(`Tool: ${tool}`);
    this.renderUi();
  }

  private pushUndoSnapshot(label: string): void {
    this.undoStack.push(this.createUndoSnapshot(label));
    if (this.undoStack.length > MAX_UNDO_STEPS) {
      this.undoStack.shift();
    }
  }

  private createUndoSnapshot(label: string): EditorUndoSnapshot {
    return {
      label,
      mapWidth: this.mapWidth,
      mapHeight: this.mapHeight,
      tileSize: this.tileSize,
      terrain: [...this.terrain],
      extraTerrainLayers: this.extraTerrainLayers.map(cloneTerrainLayer),
      collision: [...this.collision],
      terrainRotations: this.exportTerrainRotations(),
      objects: this.objects.map((object) => ({ ...object })),
      nextObjectNumber: this.nextObjectNumber,
      selectedTool: this.selectedTool,
      selectedTilesetId: this.selectedTilesetId,
      selectedTerrainId: this.selectedTerrainId,
      selectedTemplateId: this.selectedTemplate?.id,
      selectedObjectAssetId: this.selectedObjectAssetId,
      selectedObjectId: this.selectedObjectId,
      selectedCellRect: this.selectedCellRect ? { ...this.selectedCellRect } : undefined,
    };
  }

  private undoLastAction(): void {
    const snapshot = this.undoStack.pop();
    if (!snapshot) {
      this.setStatus("Nothing to undo.");
      this.renderUi();
      return;
    }
    this.restoreUndoSnapshot(snapshot);
    this.setStatus(`Undid ${snapshot.label}.`);
    this.renderUi();
  }

  private restoreUndoSnapshot(snapshot: EditorUndoSnapshot): void {
    this.mapWidth = snapshot.mapWidth;
    this.mapHeight = snapshot.mapHeight;
    this.tileSize = snapshot.tileSize;
    this.terrain = [...snapshot.terrain];
    this.extraTerrainLayers = snapshot.extraTerrainLayers.map(cloneTerrainLayer);
    this.collision = [...snapshot.collision];
    this.terrainRotations.clear();
    for (const rotation of snapshot.terrainRotations) {
      this.importTerrainRotation(rotation);
    }
    this.objects = snapshot.objects.map((object) => ({ ...object }));
    this.nextObjectNumber = snapshot.nextObjectNumber;
    this.selectedTool = snapshot.selectedTool;
    this.selectedTilesetId = snapshot.selectedTilesetId;
    this.selectedTerrainId = snapshot.selectedTerrainId;
    this.selectedTemplate = snapshot.selectedTemplateId ? this.templateCache.get(snapshot.selectedTemplateId) : undefined;
    this.selectedObjectAssetId = snapshot.selectedObjectAssetId;
    this.selectedObjectId = snapshot.selectedObjectId;
    this.selectedCellRect = snapshot.selectedCellRect ? { ...snapshot.selectedCellRect } : undefined;
    this.cellSelectionStart = undefined;
    this.cellMoveDraft = undefined;
    this.painting = false;
    this.draggingObjectId = undefined;
    this.createTerrainLayer();
    this.createObjectSprites();
    this.drawGrid();
    this.cameras.main.setBounds(0, 0, this.worldWidth(), this.worldHeight());
  }

  private saveLocal(): void {
    localStorage.setItem(EDITOR_SAVE_KEY, this.exportJson());
    this.setStatus("Saved in browser local storage.");
    this.renderUi();
  }

  private loadLocal(): void {
    const json = localStorage.getItem(EDITOR_SAVE_KEY);
    if (!json) {
      this.setStatus("No local save found.");
      this.renderUi();
      return;
    }
    this.pushUndoSnapshot("load local save");
    this.importJson(json);
  }

  private async loadProjectEditorMap(): Promise<void> {
    this.setStatus("Loading /aob-editor-map.json...");
    this.renderUi();
    try {
      const response = await fetch("/aob-editor-map.json", { cache: "no-store" });
      if (!response.ok) {
        throw new Error("/aob-editor-map.json not found.");
      }
      this.pushUndoSnapshot("load project map");
      this.importJson(await response.text());
      this.setStatus("Project editor map loaded from /aob-editor-map.json.");
    } catch (error) {
      this.setStatus(error instanceof Error ? error.message : "Project map load failed.");
    }
    this.renderUi();
  }

  private async loadRpgForestMap(mapId: string): Promise<void> {
    const map = RPG_FOREST_MAPS.find((item) => item.id === mapId) ?? RPG_FOREST_MAPS[1];
    this.setStatus(`Loading ${map.label}...`);
    this.renderUi();
    try {
      const response = await fetch(map.path);
      if (!response.ok) {
        throw new Error(`Could not load ${map.path}.`);
      }
      const data = (await response.json()) as TiledMap;
      this.pushUndoSnapshot(`load ${map.label}`);
      this.importTiledMap(data, map.label);
    } catch (error) {
      this.setStatus(error instanceof Error ? error.message : "RPG Forest map import failed.");
      this.renderUi();
    }
  }

  private importTiledMap(data: TiledMap, label: string): void {
    const mapped = tiledMapToEditorTemplate(data, label);

    this.mapWidth = mapped.width;
    this.mapHeight = mapped.height;
    this.tileSize = mapped.tileSize;
    this.terrain = mapped.layers[0]?.tiles.map((tile) => tile ?? DEFAULT_RPG_FOREST_TERRAIN_ID) ?? [];
    this.extraTerrainLayers = mapped.layers.slice(1);
    this.collision = [...mapped.collision];
    this.terrainRotations.clear();
    this.objects = [];
    this.selectedObjectId = undefined;
    this.nextObjectNumber = 1;
    this.selectedTilesetId = "rpgForestGround";
    this.selectedTerrainId = DEFAULT_RPG_FOREST_TERRAIN_ID;
    this.selectedTemplate = undefined;
    this.selectedTool = "terrain";
    this.createTerrainLayer();
    this.createObjectSprites();
    this.drawGrid();
    this.cameras.main.setBounds(0, 0, this.worldWidth(), this.worldHeight());
    this.cameras.main.centerOn(this.worldWidth() / 2, this.worldHeight() / 2);
    this.cameras.main.setZoom(1.35);
    this.setStatus(`${label} loaded as a ${mapped.width} x ${mapped.height} RPG Forest map.`);
    this.renderUi();
  }

  private async selectRpgForestTemplate(mapId: string): Promise<void> {
    const map = RPG_FOREST_MAPS.find((item) => item.id === mapId) ?? RPG_FOREST_MAPS[1];
    const cached = this.templateCache.get(map.id);
    if (cached) {
      this.selectedTemplate = cached;
      this.selectedTool = "stamp";
      this.setStatus(`${cached.label} selected as a block. Click the map to paste it.`);
      this.renderUi();
      return;
    }

    this.setStatus(`Loading ${map.label} block...`);
    this.renderUi();
    try {
      const response = await fetch(map.path);
      if (!response.ok) {
        throw new Error(`Could not load ${map.path}.`);
      }
      const data = (await response.json()) as TiledMap;
      const template = tiledMapToEditorTemplate(data, map.label, map.id);
      this.templateCache.set(map.id, template);
      this.selectedTemplate = template;
      this.selectedTool = "stamp";
      this.setStatus(`${template.label} selected as a block. Click the map to paste it.`);
    } catch (error) {
      this.setStatus(error instanceof Error ? error.message : "RPG Forest block import failed.");
    }
    this.renderUi();
  }

  private stampTemplateAtPointer(pointer: Phaser.Input.Pointer): void {
    const template = this.selectedTemplate;
    const tile = this.tileFromPointer(pointer);
    if (!template || !tile) {
      this.setStatus("Choose an RPG Forest block first.");
      this.renderUi();
      return;
    }

    if (template.tileSize !== this.tileSize) {
      this.setStatus(`This block uses ${template.tileSize}px tiles. Start a Blank RPG map or Current RTS map first.`);
      this.renderUi();
      return;
    }

    this.pushUndoSnapshot("paste block");
    const startX = Phaser.Math.Clamp(tile.x, 0, Math.max(0, this.mapWidth - 1));
    const startY = Phaser.Math.Clamp(tile.y, 0, Math.max(0, this.mapHeight - 1));
    const baseLayer = template.layers[0];
    let changed = false;
    if (baseLayer) {
      for (let y = 0; y < template.height; y += 1) {
        for (let x = 0; x < template.width; x += 1) {
          const targetX = startX + x;
          const targetY = startY + y;
          if (!this.isInside(targetX, targetY)) {
            continue;
          }
          const terrainId = baseLayer.tiles[y * template.width + x];
          if (!terrainId) {
            continue;
          }
          this.terrain[this.tileIndex(targetX, targetY)] = terrainId;
          this.terrainRotations.delete(terrainChunkKey(targetX, targetY));
          changed = true;
        }
      }
    }

    for (const [layerIndex, sourceLayer] of template.layers.slice(1).entries()) {
      const targetLayer = this.ensureTemplateLayer(template, layerIndex);
      for (let y = 0; y < template.height; y += 1) {
        for (let x = 0; x < template.width; x += 1) {
          const targetX = startX + x;
          const targetY = startY + y;
          if (!this.isInside(targetX, targetY)) {
            continue;
          }
          const terrainId = sourceLayer.tiles[y * template.width + x];
          if (!terrainId) {
            continue;
          }
          targetLayer.tiles[this.tileIndex(targetX, targetY)] = terrainId;
          changed = true;
        }
      }
    }

    for (let y = 0; y < template.height; y += 1) {
      for (let x = 0; x < template.width; x += 1) {
        const targetX = startX + x;
        const targetY = startY + y;
        if (!this.isInside(targetX, targetY)) {
          continue;
        }
        const targetIndex = this.tileIndex(targetX, targetY);
        const nextCollision = Boolean(template.collision[y * template.width + x]);
        if (this.collision[targetIndex] !== nextCollision) {
          this.collision[targetIndex] = nextCollision;
          changed = true;
        }
      }
    }

    if (changed) {
      this.createTerrainLayer();
    }
    this.setStatus(`${template.label} pasted at ${startX}, ${startY}.`);
    this.renderUi();
  }

  private ensureTemplateLayer(template: EditorTemplateStamp, sourceLayerIndex: number): EditorTileLayer {
    const id = `stamp-${safeId(template.id)}-${sourceLayerIndex}`;
    let layer = this.extraTerrainLayers.find((item) => item.id === id);
    if (!layer) {
      layer = {
        id,
        name: `${template.label} stamp ${sourceLayerIndex + 1}`,
        tiles: Array.from({ length: this.mapWidth * this.mapHeight }, () => null),
        opacity: template.layers[sourceLayerIndex + 1]?.opacity ?? 1,
      };
      this.extraTerrainLayers.push(layer);
    }
    return layer;
  }

  private loadBlankRpgForestMap(): void {
    this.mapWidth = 160;
    this.mapHeight = 112;
    this.tileSize = EDITOR_TILESETS.find((item) => item.id === "rpgForestGround")?.tileSize ?? 24;
    this.terrain = Array.from({ length: this.mapWidth * this.mapHeight }, () => DEFAULT_RPG_FOREST_TERRAIN_ID);
    this.extraTerrainLayers = [];
    this.collision = Array.from({ length: this.mapWidth * this.mapHeight }, () => false);
    this.terrainRotations.clear();
    this.objects = [];
    this.selectedObjectId = undefined;
    this.nextObjectNumber = 1;
    this.selectedTilesetId = "rpgForestGround";
    this.selectedTerrainId = DEFAULT_RPG_FOREST_TERRAIN_ID;
    this.selectedTemplate = undefined;
    this.selectedTool = "terrain";
    this.createTerrainLayer();
    this.createObjectSprites();
    this.drawGrid();
    this.cameras.main.setBounds(0, 0, this.worldWidth(), this.worldHeight());
    this.cameras.main.centerOn(this.worldWidth() / 2, this.worldHeight() / 2);
    this.cameras.main.setZoom(0.9);
    this.setStatus("Blank RPG Forest map loaded.");
    this.renderUi();
  }

  private loadCurrentRuntimeLayout(): void {
    this.mapWidth = initialMapLayout.width;
    this.mapHeight = initialMapLayout.height;
    this.tileSize = EDITOR_TILESETS.find((item) => item.id === "rpgForestGround")?.tileSize ?? 24;
    this.terrain = Array.from({ length: this.mapWidth * this.mapHeight }, () => DEFAULT_RPG_FOREST_TERRAIN_ID);
    this.extraTerrainLayers = [];
    this.collision = Array.from({ length: this.mapWidth * this.mapHeight }, () => false);
    this.terrainRotations.clear();
    this.objects = [];
    this.selectedObjectId = undefined;
    this.nextObjectNumber = 1;

    for (const stamp of initialMapLayout.terrain) {
      this.applyRuntimeTerrainStamp(stamp);
    }
    for (const overlay of initialMapLayout.visualOverlays) {
      this.addObjectFromRuntimeOverlay(overlay);
    }
    this.addCurrentRuntimeBuilding("townCenter", initialMapLayout.village.townCenter);
    this.addCurrentRuntimeBuilding("house", initialMapLayout.village.house);
    this.addRuntimeResourceObjects();

    this.selectedTilesetId = "rpgForestGround";
    this.selectedTerrainId = DEFAULT_RPG_FOREST_TERRAIN_ID;
    this.selectedTemplate = undefined;
    this.selectedTool = "terrain";
    this.createTerrainLayer();
    this.createObjectSprites();
    this.drawGrid();
    this.cameras.main.setBounds(0, 0, this.worldWidth(), this.worldHeight());
    this.cameras.main.centerOn(initialMapLayout.village.townCenter.x * this.tileSize, initialMapLayout.village.townCenter.y * this.tileSize);
    this.cameras.main.setZoom(0.75);
    this.setStatus("Current RTS layout loaded as an editable RPG Forest draft.");
    this.renderUi();
  }

  private applyRuntimeTerrainStamp(stamp: TerrainStamp): void {
    const terrainId = rpgForestTerrainIdForRuntimeTile(stamp.tile);
    const paint = (x: number, y: number): void => {
      if (this.isInside(x, y)) {
        this.terrain[this.tileIndex(x, y)] = terrainId;
      }
    };

    if (stamp.kind === "rect") {
      for (let y = stamp.y; y < stamp.y + stamp.h; y += 1) {
        for (let x = stamp.x; x < stamp.x + stamp.w; x += 1) {
          paint(x, y);
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
            paint(x, y);
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
      const dx = end.x - start.x;
      const dy = end.y - start.y;
      const steps = Math.max(Math.abs(dx), Math.abs(dy), 1);
      for (let step = 0; step <= steps; step += 1) {
        const t = step / steps;
        const cx = Math.round(start.x + dx * t);
        const cy = Math.round(start.y + dy * t);
        for (let y = cy - stamp.radius; y <= cy + stamp.radius; y += 1) {
          for (let x = cx - stamp.radius; x <= cx + stamp.radius; x += 1) {
            const distance = Math.hypot(x - cx, y - cy);
            if (distance <= stamp.radius + 0.2) {
              paint(x, y);
            }
          }
        }
      }
    }
  }

  private addObjectFromRuntimeOverlay(overlay: VisualOverlay): void {
    const assetId = editorAssetIdForRuntimeOverlay(overlay);
    if (!assetId || !objectCatalogItem(assetId)) {
      return;
    }
    this.addObjectPlacement({
      assetId,
      tile: overlay.tile,
      width: overlay.width,
      height: "height" in overlay ? overlay.height : undefined,
      alpha: overlay.alpha,
      angle: overlay.angle,
      depthOffset: overlay.depthOffset,
      flipX: overlay.flipX,
      flipY: overlay.flipY,
    });
  }

  private addCurrentRuntimeBuilding(assetId: string, tile: TileCoord): void {
    const item = objectCatalogItem(assetId);
    if (!item) {
      return;
    }
    this.addObjectPlacement({
      assetId,
      tile,
      width: item.defaultWidth,
      depthOffset: item.depthOffset,
    });
  }

  private addRuntimeResourceObjects(): void {
    const resourceObjects: Array<[TileCoord[], string, number]> = [
      [initialMapLayout.resources.tree, "solanaTreeClusterA", 86],
      [initialMapLayout.resources.stone, "solanaStoneNodeSmall", 36],
      [initialMapLayout.resources.gold, "solanaCrystalNodeSmall", 38],
      [initialMapLayout.resources.berries, "solanaBerryBush", 46],
    ];
    for (const [tiles, assetId, width] of resourceObjects) {
      for (const tile of tiles) {
        this.addObjectPlacement({ assetId, tile, width, depthOffset: 0 });
      }
    }
  }

  private addObjectPlacement(options: {
    assetId: string;
    tile: TileCoord;
    width: number;
    height?: number;
    alpha?: number;
    angle?: number;
    depthOffset?: number;
    flipX?: boolean;
    flipY?: boolean;
  }): void {
    const item = objectCatalogItem(options.assetId);
    if (!item) {
      return;
    }
    const runtimeScale = this.tileSize / TILE_SIZE;
    const object: EditorObjectPlacement = {
      id: `object-${this.nextObjectNumber++}`,
      assetId: options.assetId,
      x: options.tile.x * this.tileSize + this.tileSize / 2,
      y: options.tile.y * this.tileSize + this.tileSize / 2,
      width: Math.max(1, options.width * runtimeScale),
      height: options.height ? Math.max(1, options.height * runtimeScale) : undefined,
      alpha: options.alpha ?? item.alpha ?? 1,
      angle: options.angle ?? item.defaultAngle ?? 0,
      depthOffset: options.depthOffset ?? item.depthOffset ?? 0,
      flipX: options.flipX ?? false,
      flipY: options.flipY ?? false,
    };
    this.objects.push(object);
  }

  private async copyExport(): Promise<void> {
    try {
      await navigator.clipboard.writeText(this.exportJson());
      this.setStatus("JSON copied to clipboard.");
    } catch {
      this.setStatus("Clipboard blocked. Use Download JSON.");
    }
    this.renderUi();
  }

  private downloadExport(): void {
    const blob = new Blob([this.exportJson()], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "aob-editor-map.json";
    link.click();
    URL.revokeObjectURL(url);
    this.setStatus("JSON export downloaded.");
    this.renderUi();
  }

  private async importJsonFile(file: File): Promise<void> {
    this.pushUndoSnapshot("import JSON");
    this.importJson(await file.text());
  }

  private importJson(json: string): void {
    try {
      const data = JSON.parse(json) as Partial<EditorMapExport>;
      if (data.version !== 1 || !data.width || !data.height || !Array.isArray(data.terrain) || data.terrain.length !== data.width * data.height) {
        throw new Error("Invalid map editor JSON.");
      }
      this.mapWidth = Phaser.Math.Clamp(Math.round(data.width), 8, 512);
      this.mapHeight = Phaser.Math.Clamp(Math.round(data.height), 8, 512);
      this.tileSize = Phaser.Math.Clamp(Math.round(data.tileSize ?? DEFAULT_EDITOR_TILE_SIZE), 16, 64);
      this.terrain = data.terrain.map((tile) => String(tile));
      this.extraTerrainLayers = Array.isArray(data.terrainLayers)
        ? data.terrainLayers.map((layer, index) => normalizeImportedTerrainLayer(layer, this.mapWidth, this.mapHeight, index))
        : [];
      this.collision = this.normalizeImportedCollision(data.collision);
      this.terrainRotations = new Map();
      if (Array.isArray(data.terrainRotations)) {
        for (const rotation of data.terrainRotations) {
          this.importTerrainRotation(rotation);
        }
      }
      this.objects = Array.isArray(data.objects) ? data.objects.map((object) => normalizeImportedObject(object)) : [];
      this.nextObjectNumber = this.objects.length + 1;
      this.createTerrainLayer();
      this.createObjectSprites();
      this.drawGrid();
      this.cameras.main.setBounds(0, 0, this.worldWidth(), this.worldHeight());
      this.setStatus("Map JSON imported.");
    } catch (error) {
      this.setStatus(error instanceof Error ? error.message : "Import failed.");
    }
    this.renderUi();
  }

  private exportJson(): string {
    const data: EditorMapExport = {
      version: 1,
      width: this.mapWidth,
      height: this.mapHeight,
      tileSize: this.tileSize,
      terrain: this.terrain,
      terrainLayers: this.extraTerrainLayers,
      collision: this.collision,
      terrainRotations: this.exportTerrainRotations(),
      customTerrain: this.customTerrainCatalog.map((item) => ({ id: item.id, label: item.label })),
      objects: this.objects,
    };
    return JSON.stringify(data, null, 2);
  }

  private loadCustomTerrainFiles(files: File[]): void {
    if (files.length === 0) {
      return;
    }
    const loadedItems: TerrainCatalogItem[] = [];
    const runId = Date.now();
    for (const [index, file] of files.entries()) {
      const id = `custom:${safeId(file.name)}-${runId}-${index}`;
      const textureKey = `editor-custom-terrain-${runId}-${index}`;
      const url = URL.createObjectURL(file);
      loadedItems.push({
        id,
        label: file.name.replace(/\.[^.]+$/, ""),
        textureKey,
        color: 0x7db34b,
        custom: true,
      });
      this.load.image(textureKey, url);
    }
    this.load.once(Phaser.Loader.Events.COMPLETE, () => {
      this.customTerrainCatalog.push(...loadedItems);
      this.selectedTerrainId = loadedItems[0]?.id ?? this.selectedTerrainId;
      this.selectedTool = "terrain";
      this.setStatus(`${loadedItems.length} custom terrain tile(s) loaded for this session.`);
      this.renderUi();
    });
    this.load.start();
  }

  private resizeFromUi(): void {
    const width = Number(this.root?.querySelector<HTMLInputElement>("[data-editor-map-width]")?.value) || this.mapWidth;
    const height = Number(this.root?.querySelector<HTMLInputElement>("[data-editor-map-height]")?.value) || this.mapHeight;
    this.resizeMap(Phaser.Math.Clamp(Math.round(width), 32, 512), Phaser.Math.Clamp(Math.round(height), 32, 512));
  }

  private resizeMap(width: number, height: number): void {
    const oldTerrain = this.terrain;
    const oldCollision = this.collision;
    const oldWidth = this.mapWidth;
    const oldHeight = this.mapHeight;
    this.mapWidth = width;
    this.mapHeight = height;
    this.terrain = Array.from({ length: width * height }, (_unused, index) => {
      const x = index % width;
      const y = Math.floor(index / width);
      return x < oldWidth && y < oldHeight ? oldTerrain[y * oldWidth + x] ?? DEFAULT_EDITOR_TERRAIN_ID : DEFAULT_EDITOR_TERRAIN_ID;
    });
    this.collision = Array.from({ length: width * height }, (_unused, index) => {
      const x = index % width;
      const y = Math.floor(index / width);
      return x < oldWidth && y < oldHeight ? Boolean(oldCollision[y * oldWidth + x]) : false;
    });
    this.terrainRotations = new Map(
      [...this.terrainRotations.entries()].filter(([key]) => {
        const chunk = tileCoordFromChunkKey(key);
        return Boolean(chunk && chunk.x < width && chunk.y < height);
      }),
    );
    this.extraTerrainLayers = this.extraTerrainLayers.map((layer) => ({
      ...layer,
      tiles: Array.from({ length: width * height }, (_unused, index) => {
        const x = index % width;
        const y = Math.floor(index / width);
        return x < oldWidth && y < oldHeight ? layer.tiles[y * oldWidth + x] ?? null : null;
      }),
    }));
    this.objects = this.objects.filter((object) => object.x >= 0 && object.y >= 0 && object.x <= this.worldWidth() && object.y <= this.worldHeight());
    this.createTerrainLayer();
    this.createObjectSprites();
    this.drawGrid();
    this.cameras.main.setBounds(0, 0, this.worldWidth(), this.worldHeight());
    this.setStatus(`Map resized to ${width} x ${height}.`);
    this.renderUi();
  }

  private loadV2DemoMap(): void {
    this.loadV2DemoState();
    this.createTerrainLayer();
    this.createObjectSprites();
    this.drawGrid();
    this.cameras.main.setBounds(0, 0, this.worldWidth(), this.worldHeight());
    this.cameras.main.centerOn(68 * TILE_SIZE, 58 * TILE_SIZE);
    this.cameras.main.setZoom(0.95);
    this.setStatus("V2 demo map loaded. Use it as a disposable composition test.");
    this.renderUi();
  }

  private loadV2DemoState(): void {
    this.mapWidth = 160;
    this.mapHeight = 112;
    this.tileSize = DEFAULT_EDITOR_TILE_SIZE;
    this.terrain = Array.from({ length: this.mapWidth * this.mapHeight }, () => "terrainV2:grassBright");
    this.extraTerrainLayers = [];
    this.collision = Array.from({ length: this.mapWidth * this.mapHeight }, () => false);
    this.terrainRotations.clear();
    this.objects = [];
    this.nextObjectNumber = 1;
    this.selectedObjectId = undefined;
    this.selectedTool = "select";
    this.selectedTerrainId = "terrainV2:grassBright";
    this.selectedObjectAssetId = "townCenter";

    const chunksX = Math.ceil(this.mapWidth / TERRAIN_STAMP_TILES);
    const chunksY = Math.ceil(this.mapHeight / TERRAIN_STAMP_TILES);

    const paintChunk = (chunkX: number, chunkY: number, terrainId: EditorTerrainId, angle = 0): void => {
      const startX = chunkX * TERRAIN_STAMP_TILES;
      const startY = chunkY * TERRAIN_STAMP_TILES;
      if (!this.isInside(startX, startY)) {
        return;
      }
      for (let y = startY; y < Math.min(this.mapHeight, startY + TERRAIN_STAMP_TILES); y += 1) {
        for (let x = startX; x < Math.min(this.mapWidth, startX + TERRAIN_STAMP_TILES); x += 1) {
          this.terrain[this.tileIndex(x, y)] = terrainId;
        }
      }
      this.setTerrainRotationAtChunk(startX, startY, angle);
    };

    const paintEllipse = (centerX: number, centerY: number, radiusX: number, radiusY: number, terrainId: EditorTerrainId, angle = 0): void => {
      for (let y = 0; y < chunksY; y += 1) {
        for (let x = 0; x < chunksX; x += 1) {
          const dx = (x - centerX) / radiusX;
          const dy = (y - centerY) / radiusY;
          if (dx * dx + dy * dy <= 1) {
            paintChunk(x, y, terrainId, angle);
          }
        }
      }
    };

    const paintChunkLine = (points: Array<[number, number]>, terrainId: EditorTerrainId, angle = 0): void => {
      for (const [x, y] of points) {
        paintChunk(x, y, terrainId, angle);
      }
    };

    const addObject = (
      assetId: string,
      x: number,
      y: number,
      options: Partial<Omit<EditorObjectPlacement, "id" | "assetId" | "x" | "y">> = {},
    ): void => {
      const item = objectCatalogItem(assetId);
      if (!item) {
        return;
      }
      const dimensions = this.objectDimensionsForCatalogItem(item);
      this.objects.push({
        id: `object-${this.nextObjectNumber++}`,
        assetId,
        x,
        y,
        width: options.width ?? dimensions.width,
        height: options.height ?? dimensions.height,
        alpha: options.alpha ?? item.alpha ?? 1,
        angle: normalizeAngle(options.angle ?? item.defaultAngle ?? 0),
        depthOffset: options.depthOffset ?? item.depthOffset ?? 0,
        flipX: options.flipX ?? false,
        flipY: options.flipY ?? false,
      });
    };

    const addAtTile = (
      assetId: string,
      tileX: number,
      tileY: number,
      options: Partial<Omit<EditorObjectPlacement, "id" | "assetId" | "x" | "y">> = {},
    ): void => addObject(assetId, tileX * TILE_SIZE + TILE_SIZE / 2, tileY * TILE_SIZE + TILE_SIZE / 2, options);

    paintEllipse(3, 3, 2.6, 2.0, "terrainV2:grassDark");
    paintEllipse(17, 2, 2.4, 1.6, "terrainV2:grassDark");
    paintEllipse(16, 11, 2.8, 1.7, "terrainV2:grassDark");
    paintEllipse(3, 12, 1.8, 1.1, "terrainV2:grassDark");

    paintEllipse(2.5, 10.5, 3.4, 2.3, "terrainV2:shoreWetSand");
    paintEllipse(2.5, 10.5, 2.8, 1.8, "terrainV2:waterShallow");
    paintEllipse(2.4, 10.6, 1.5, 1.0, "terrainV2:waterDeep");

    paintEllipse(8, 6, 3.8, 2.4, "terrainV2:dirtVillage");
    paintChunkLine(
      [
        [10, 5],
        [11, 5],
        [12, 4],
        [6, 8],
        [5, 9],
        [4, 10],
        [10, 7],
        [11, 8],
        [12, 9],
      ],
      "terrainV2:dirtRoad",
    );

    paintEllipse(14, 3.5, 2.2, 1.5, "terrainV2:stoneGround");
    paintEllipse(13.5, 9.5, 2.2, 1.6, "terrainV2:crystalGround");
    paintEllipse(17.2, 6.2, 1.7, 1.4, "terrainV2:btcCopperGround");

    addAtTile("villageGround", 66, 58, { width: 900, alpha: 0.94, depthOffset: -24 });
    addAtTile("stoneGroundPatch", 112, 30, { width: 560, alpha: 0.88, angle: 90, depthOffset: -22 });
    addAtTile("crystalGroundPatch", 110, 82, { width: 620, alpha: 0.88, depthOffset: -22 });
    addAtTile("btcCopperGround", 139, 58, { width: 540, alpha: 0.9, depthOffset: -22 });

    addAtTile("terrainV2DirtScuffMedium", 54, 55, { alpha: 0.72, angle: 90, depthOffset: -5 });
    addAtTile("terrainV2DirtScuffMedium", 75, 62, { alpha: 0.68, angle: 180, depthOffset: -5 });
    addAtTile("terrainV2DirtScuffSmall", 61, 72, { alpha: 0.7, depthOffset: -5 });
    addAtTile("terrainV2FlowerPatchSmall", 42, 43, { alpha: 0.86 });
    addAtTile("terrainV2FlowerPatchSmall", 88, 66, { alpha: 0.86, angle: 90 });
    addAtTile("terrainV2BerryBushCluster", 51, 68, { alpha: 0.9 });
    addAtTile("terrainV2LeavesTwigsSmall", 34, 52, { alpha: 0.78 });
    addAtTile("terrainV2ShoreMudSmall", 34, 86, { alpha: 0.72, angle: 180, depthOffset: -4 });

    addAtTile("townCenter", 65, 58, { width: 350 });
    addAtTile("house", 44, 51, { width: 212 });
    addAtTile("lumberCamp", 36, 71, { width: 226 });
    addAtTile("mill", 82, 43, { width: 278 });
    addAtTile("barracks", 88, 75, { width: 252 });
    addAtTile("stable", 66, 82, { width: 235 });
    addAtTile("farm", 52, 36, { width: 265 });
    addAtTile("stoneCamp", 108, 33, { width: 205 });
    addAtTile("goldCamp", 105, 82, { width: 205 });

    for (const [assetId, tileX, tileY, width] of [
      ["solanaTreeClusterA", 21, 22, 104],
      ["solanaTreeClusterB", 31, 31, 108],
      ["solanaPineCluster", 43, 25, 96],
      ["solanaTreeClusterA", 25, 44, 98],
      ["solanaTreeClusterB", 18, 68, 104],
      ["solanaPineCluster", 34, 79, 94],
      ["solanaTreeClusterA", 24, 91, 102],
      ["solanaTreeClusterB", 132, 92, 104],
      ["solanaPineCluster", 142, 78, 94],
    ] satisfies Array<[string, number, number, number]>) {
      addAtTile(assetId, tileX, tileY, { width });
    }

    for (const [assetId, tileX, tileY, width] of [
      ["solanaStoneNodeLarge", 108, 20, 82],
      ["solanaStoneNodeLarge", 116, 28, 78],
      ["solanaStoneNodeSmall", 101, 31, 42],
      ["solanaStoneNodeSmall", 119, 38, 42],
      ["terrainV2StoneScatterSmall", 110, 42, 108],
      ["terrainV2QuarryCracksSmall", 113, 25, 126],
      ["solanaCrystalNodeLarge", 102, 74, 94],
      ["solanaCrystalNodeLarge", 115, 80, 92],
      ["solanaCrystalNodeLarge", 107, 92, 88],
      ["solanaCrystalNodeSmall", 124, 88, 45],
      ["solanaCrystalNodeSmall", 98, 88, 45],
      ["terrainV2CrystalShardsSmall", 118, 72, 92],
    ] satisfies Array<[string, number, number, number]>) {
      addAtTile(assetId, tileX, tileY, { width });
    }

    for (const [assetId, tileX, tileY, width, angle] of [
      ["solanaBannerTall", 50, 44, 58, 0],
      ["solanaBannerTall", 81, 58, 58, 0],
      ["solanaLanternPost", 54, 70, 45, 0],
      ["solanaLanternPost", 76, 48, 45, 0],
      ["solanaCratesStack", 43, 63, 64, 0],
      ["solanaBarrels", 84, 68, 56, 0],
      ["solanaFenceShort", 39, 61, 80, 0],
      ["solanaFenceShort", 92, 55, 80, 90],
      ["solanaValidatorObelisk", 67, 42, 66, 0],
      ["terrainV2DryBushSmall", 30, 60, 86, 0],
      ["terrainV2DryBushSmall", 94, 91, 86, 90],
    ] satisfies Array<[string, number, number, number, number]>) {
      addAtTile(assetId, tileX, tileY, { width, angle });
    }

    addAtTile("btcTownCenterT1", 137, 57, { width: 258 });
    addAtTile("btcHouseT1", 126, 68, { width: 150 });
    addAtTile("btcMiningCampT1", 148, 68, { width: 165 });
    addAtTile("btcBanner", 132, 47, { width: 62 });
    addAtTile("btcGoldOreLarge", 142, 47, { width: 108 });
    addAtTile("btcLanternPost", 151, 58, { width: 44 });
    addAtTile("btcWallHorizontal", 135, 79, { width: 155 });
    addAtTile("btcGateHorizontal", 146, 79, { width: 124 });
  }

  private loadV3SheetDemoMap(): void {
    this.loadV3SheetDemoState();
    this.createTerrainLayer();
    this.createObjectSprites();
    this.drawGrid();
    this.cameras.main.setBounds(0, 0, this.worldWidth(), this.worldHeight());
    this.cameras.main.centerOn(56 * TILE_SIZE, 42 * TILE_SIZE);
    this.cameras.main.setZoom(1.05);
    this.setStatus("V3 spritesheet demo loaded. This tests strict full-square tiles, not painterly decals.");
    this.renderUi();
  }

  private loadV3SheetDemoState(): void {
    this.mapWidth = 112;
    this.mapHeight = 80;
    this.tileSize = DEFAULT_EDITOR_TILE_SIZE;
    this.terrain = Array.from({ length: this.mapWidth * this.mapHeight }, () => "terrainV3:grassDirt:grass");
    this.extraTerrainLayers = [];
    this.collision = Array.from({ length: this.mapWidth * this.mapHeight }, () => false);
    this.terrainRotations.clear();
    this.objects = [];
    this.nextObjectNumber = 1;
    this.selectedObjectId = undefined;
    this.selectedTool = "terrain";
    this.selectedTerrainId = "terrainV3:grassDirt:cornerInner";
    this.selectedObjectAssetId = "townCenter";

    const paintChunk = (chunkX: number, chunkY: number, terrainId: EditorTerrainId, angle = 0): void => {
      const startX = chunkX * TERRAIN_STAMP_TILES;
      const startY = chunkY * TERRAIN_STAMP_TILES;
      if (!this.isInside(startX, startY)) {
        return;
      }
      for (let y = startY; y < Math.min(this.mapHeight, startY + TERRAIN_STAMP_TILES); y += 1) {
        for (let x = startX; x < Math.min(this.mapWidth, startX + TERRAIN_STAMP_TILES); x += 1) {
          this.terrain[this.tileIndex(x, y)] = terrainId;
        }
      }
      this.setTerrainRotationAtChunk(startX, startY, angle);
    };

    const addObject = (
      assetId: string,
      tileX: number,
      tileY: number,
      options: Partial<Omit<EditorObjectPlacement, "id" | "assetId" | "x" | "y">> = {},
    ): void => {
      const item = objectCatalogItem(assetId);
      if (!item) {
        return;
      }
      const dimensions = this.objectDimensionsForCatalogItem(item);
      this.objects.push({
        id: `object-${this.nextObjectNumber++}`,
        assetId,
        x: tileX * TILE_SIZE + TILE_SIZE / 2,
        y: tileY * TILE_SIZE + TILE_SIZE / 2,
        width: options.width ?? dimensions.width,
        height: options.height ?? dimensions.height,
        alpha: options.alpha ?? item.alpha ?? 1,
        angle: normalizeAngle(options.angle ?? item.defaultAngle ?? 0),
        depthOffset: options.depthOffset ?? item.depthOffset ?? 0,
        flipX: options.flipX ?? false,
        flipY: options.flipY ?? false,
      });
    };

    const paintDirtBlob = (left: number, top: number, right: number, bottom: number): void => {
      for (let y = top + 1; y < bottom; y += 1) {
        for (let x = left + 1; x < right; x += 1) {
          paintChunk(x, y, "terrainV3:grassDirt:dirt");
        }
      }
      for (let x = left + 1; x < right; x += 1) {
        paintChunk(x, top, "terrainV3:grassDirt:edgeHorizontal", 0);
        paintChunk(x, bottom, "terrainV3:grassDirt:edgeHorizontal", 180);
      }
      for (let y = top + 1; y < bottom; y += 1) {
        paintChunk(left, y, "terrainV3:grassDirt:edgeVertical", 0);
        paintChunk(right, y, "terrainV3:grassDirt:edgeVertical", 180);
      }
      paintChunk(left, top, "terrainV3:grassDirt:cornerOuter", 270);
      paintChunk(right, top, "terrainV3:grassDirt:cornerOuter", 0);
      paintChunk(right, bottom, "terrainV3:grassDirt:cornerOuter", 90);
      paintChunk(left, bottom, "terrainV3:grassDirt:cornerOuter", 180);
    };

    const paintStoneBlob = (left: number, top: number, right: number, bottom: number): void => {
      for (let y = top + 1; y < bottom; y += 1) {
        for (let x = left + 1; x < right; x += 1) {
          paintChunk(x, y, "terrainV3:grassStone:stone");
        }
      }
      for (let x = left + 1; x < right; x += 1) {
        paintChunk(x, top, "terrainV3:grassStone:edgeHorizontal", 0);
        paintChunk(x, bottom, "terrainV3:grassStone:edgeHorizontal", 180);
      }
      for (let y = top + 1; y < bottom; y += 1) {
        paintChunk(left, y, "terrainV3:grassStone:edgeVertical", 0);
        paintChunk(right, y, "terrainV3:grassStone:edgeVertical", 180);
      }
      paintChunk(left, top, "terrainV3:grassStone:cornerOuter", 270);
      paintChunk(right, top, "terrainV3:grassStone:cornerOuter", 0);
      paintChunk(right, bottom, "terrainV3:grassStone:cornerOuter", 90);
      paintChunk(left, bottom, "terrainV3:grassStone:cornerOuter", 180);
    };

    const paintWaterBlob = (left: number, top: number, right: number, bottom: number): void => {
      for (let y = top; y <= bottom; y += 1) {
        for (let x = left; x <= right; x += 1) {
          paintChunk(x, y, "terrainV3:shoreWater:shore");
        }
      }
      for (let y = top + 2; y < bottom; y += 1) {
        for (let x = left + 2; x < right; x += 1) {
          paintChunk(x, y, "terrainV3:shoreWater:shallowWater");
        }
      }
      for (let x = left + 2; x < right; x += 1) {
        paintChunk(x, top + 1, "terrainV3:shoreWater:edgeHorizontal", 0);
        paintChunk(x, bottom, "terrainV3:shoreWater:edgeHorizontal", 180);
      }
      for (let y = top + 2; y < bottom; y += 1) {
        paintChunk(left + 1, y, "terrainV3:shoreWater:edgeVertical", 0);
        paintChunk(right, y, "terrainV3:shoreWater:edgeVertical", 180);
      }
      paintChunk(left + 1, top + 1, "terrainV3:shoreWater:cornerOuter", 270);
      paintChunk(right, top + 1, "terrainV3:shoreWater:cornerOuter", 0);
      paintChunk(right, bottom, "terrainV3:shoreWater:cornerOuter", 90);
      paintChunk(left + 1, bottom, "terrainV3:shoreWater:cornerOuter", 180);
    };

    paintDirtBlob(3, 2, 9, 6);
    paintChunk(5, 3, "terrainV3:grassDirt:cornerInner", 0);
    paintStoneBlob(10, 1, 13, 4);
    paintWaterBlob(0, 6, 4, 9);

    addObject("townCenter", 50, 39, { width: 315 });
    addObject("house", 37, 35, { width: 190 });
    addObject("lumberCamp", 38, 58, { width: 210 });
    addObject("stoneCamp", 94, 25, { width: 190 });
    addObject("solanaTreeClusterA", 18, 21, { width: 96 });
    addObject("solanaTreeClusterB", 23, 54, { width: 96 });
    addObject("solanaStoneNodeLarge", 90, 17, { width: 74 });
    addObject("solanaStoneNodeSmall", 103, 32, { width: 42 });
    addObject("solanaBannerTall", 57, 30, { width: 56 });
    addObject("solanaLanternPost", 69, 47, { width: 43 });
  }

  private resetEditor(): void {
    this.pushUndoSnapshot("reset editor");
    this.loadInitialEditorState();
    this.createTerrainLayer();
    this.createObjectSprites();
    this.drawGrid();
    this.cameras.main.setBounds(0, 0, this.worldWidth(), this.worldHeight());
    this.cameras.main.centerOn(this.worldWidth() / 2, this.worldHeight() / 2);
    this.cameras.main.setZoom(0.95);
    this.setStatus("Editor reset to a blank tileset map.");
    this.renderUi();
  }

  private playGame(): void {
    this.destroyEditor();
    const url = new URL(window.location.href);
    url.searchParams.delete("editor");
    window.history.replaceState(null, "", `${url.pathname}${url.search}${url.hash}`);
    this.scene.start("WorldScene");
  }

  private installDebugHooks(): void {
    const debugWindow = window as typeof window & {
      render_game_to_text?: () => string;
      exportMapEditorJson?: () => string;
      importMapEditorJson?: (json: string) => void;
      setMapEditorTool?: (tool: EditorTool) => void;
    };
    debugWindow.render_game_to_text = () =>
      {
        const pointer = this.input.activePointer;
        const pointerScreen = this.screenPointFromPointer(pointer);
        const pointerWorld = this.worldPointFromPointer(pointer);
        const pointerTile = this.tileFromPointer(pointer);
        return JSON.stringify({
          mode: "map-editor",
          selectedTool: this.selectedTool,
          selectedTileset: this.selectedTilesetId,
          selectedTerrain: this.selectedTerrainId,
          selectedTemplate: this.selectedTemplate
            ? {
                id: this.selectedTemplate.id,
                width: this.selectedTemplate.width,
                height: this.selectedTemplate.height,
                layers: this.selectedTemplate.layers.length,
              }
            : undefined,
          selectedCellRect: this.selectedCellRect,
          cellMoveDraft: this.cellMoveDraft
            ? {
                x: this.cellMoveDraft.rect.x + this.cellMoveDraft.offsetX,
                y: this.cellMoveDraft.rect.y + this.cellMoveDraft.offsetY,
                w: this.cellMoveDraft.rect.w,
                h: this.cellMoveDraft.rect.h,
              }
            : undefined,
          previewMode: this.previewMode,
          terrainBrushAngle: this.terrainBrushAngle,
          terrainRotationCount: this.terrainRotations.size,
          selectedObjectAsset: this.selectedObjectAssetId,
          selectedObjectId: this.selectedObjectId,
          undoCount: this.undoStack.length,
          leftPanelCollapsed: this.leftPanelCollapsed,
          showCollisionOverlay: this.showCollisionOverlay,
          width: this.mapWidth,
          height: this.mapHeight,
          objectCount: this.objects.length,
          nonGrassTiles: this.terrain.filter((tile) => tile !== DEFAULT_EDITOR_TERRAIN_ID).length,
          extraTerrainLayerCount: this.extraTerrainLayers.length,
          collisionCount: this.collision.filter(Boolean).length,
          animatedTileCount: this.animatedTerrainSprites.length,
          customTerrainCount: this.customTerrainCatalog.length,
          pointer: {
            screenX: pointerScreen.x,
            screenY: pointerScreen.y,
            worldX: pointerWorld.x,
            worldY: pointerWorld.y,
            tileX: pointerTile?.x,
            tileY: pointerTile?.y,
          },
          camera: {
            scrollX: this.cameras.main.scrollX,
            scrollY: this.cameras.main.scrollY,
            zoom: this.cameras.main.zoom,
            width: this.cameras.main.width,
            height: this.cameras.main.height,
            viewX: this.cameras.main.worldView.x,
            viewY: this.cameras.main.worldView.y,
            viewWidth: this.cameras.main.worldView.width,
            viewHeight: this.cameras.main.worldView.height,
          },
          editorTileSize: this.tileSize,
          defaultTerrain: DEFAULT_EDITOR_TERRAIN_ID,
        });
      };
    debugWindow.exportMapEditorJson = () => this.exportJson();
    debugWindow.importMapEditorJson = (json: string) => this.importJson(json);
    debugWindow.setMapEditorTool = (tool: EditorTool) => {
      this.selectedTool = tool;
      this.renderUi();
    };
  }

  private destroyEditor(): void {
    this.root?.removeEventListener("click", this.handleUiClick);
    this.root?.removeEventListener("input", this.handleUiInput);
    this.root?.removeEventListener("change", this.handleUiChange);
    this.root?.remove();
    this.root = undefined;
    this.objectPreviewSprite?.destroy();
    this.objectPreviewSprite = undefined;
    for (const sprite of this.templatePreviewSprites) {
      sprite.destroy();
    }
    this.templatePreviewSprites = [];
    for (const sprite of this.tilePreviewSprites) {
      sprite.destroy();
    }
    this.tilePreviewSprites = [];
    this.animatedTerrainSprites = [];
    this.collisionGraphics?.destroy();
    this.collisionGraphics = undefined;
  }

  private previewForTexture(textureKey: string, frameName?: string | number): string {
    const cacheKey = `${textureKey}:${frameName ?? "__base"}`;
    const cached = this.previewCache.get(cacheKey);
    if (cached !== undefined) {
      return cached;
    }
    const texture = this.textures.get(textureKey);
    const frame = texture?.get(frameName);
    if (!texture || !frame) {
      this.previewCache.set(cacheKey, "");
      return "";
    }
    const canvas = document.createElement("canvas");
    const max = 64;
    const ratio = frame.cutWidth > 0 ? frame.cutHeight / frame.cutWidth : 1;
    canvas.width = ratio >= 1 ? Math.max(1, Math.round(max / ratio)) : max;
    canvas.height = ratio >= 1 ? max : Math.max(1, Math.round(max * ratio));
    const context = canvas.getContext("2d");
    if (!context) {
      this.previewCache.set(cacheKey, "");
      return "";
    }
    context.imageSmoothingEnabled = false;
    const sourceImage = frame.source.image as CanvasImageSource;
    context.drawImage(sourceImage, frame.cutX, frame.cutY, frame.cutWidth, frame.cutHeight, 0, 0, canvas.width, canvas.height);
    const url = canvas.toDataURL("image/png");
    this.previewCache.set(cacheKey, url);
    return url;
  }

  private terrainCatalog(): TerrainCatalogItem[] {
    return [...EDITOR_TILESET_TERRAIN_CATALOG, ...this.customTerrainCatalog];
  }

  private terrainCatalogItem(id: EditorTerrainId): TerrainCatalogItem {
    return this.terrainCatalog().find((item) => item.id === id) ?? EDITOR_TILESET_TERRAIN_CATALOG[0];
  }

  private isOverlayTerrain(terrainId: EditorTerrainId): boolean {
    const cached = this.transparentTerrainCache.get(terrainId);
    if (cached !== undefined) {
      return cached;
    }
    const item = this.terrainCatalogItem(terrainId);
    const frame = this.textures.get(item.textureKey)?.get(item.frame);
    if (!frame) {
      this.transparentTerrainCache.set(terrainId, false);
      return false;
    }
    const hasTransparency = frameHasTransparentPixels(frame);
    this.transparentTerrainCache.set(terrainId, hasTransparency);
    return hasTransparency;
  }

  private selectedTileset(): EditorTilesetDefinition {
    return EDITOR_TILESETS.find((item) => item.id === this.selectedTilesetId) ?? EDITOR_TILESETS[0];
  }

  private setStatus(text: string): void {
    this.statusText = text;
  }

  private tileFromPointer(pointer: Phaser.Input.Pointer): TileCoord | undefined {
    const point = this.worldPointFromPointer(pointer);
    const x = Math.floor(point.x / this.tileSize);
    const y = Math.floor(point.y / this.tileSize);
    return this.isInside(x, y) ? { x, y } : undefined;
  }

  private chunksForBrush(center: TileCoord): TileCoord[] {
    const chunks = new Map<string, TileCoord>();
    const centerChunkX = center.x;
    const centerChunkY = center.y;
    const startOffset = -Math.floor((this.brushSize - 1) / 2);
    const endOffset = Math.ceil((this.brushSize - 1) / 2);
    for (let offsetY = startOffset; offsetY <= endOffset; offsetY += 1) {
      for (let offsetX = startOffset; offsetX <= endOffset; offsetX += 1) {
        const chunkX = centerChunkX + offsetX;
        const chunkY = centerChunkY + offsetY;
        if (!this.isInside(chunkX, chunkY)) {
          continue;
        }
        chunks.set(`${chunkX}:${chunkY}`, { x: chunkX, y: chunkY });
      }
    }
    return [...chunks.values()];
  }

  private worldPointFromPointer(pointer: Phaser.Input.Pointer): Phaser.Math.Vector2 {
    const screen = this.screenPointFromPointer(pointer);
    return this.cameras.main.getWorldPoint(screen.x, screen.y);
  }

  private screenPointFromPointer(pointer: Phaser.Input.Pointer): Phaser.Math.Vector2 {
    const event = pointer.event as MouseEvent | PointerEvent | WheelEvent | undefined;
    if (event && "clientX" in event) {
      const bounds = this.game.canvas.getBoundingClientRect();
      const scaleX = this.scale.width / Math.max(1, bounds.width);
      const scaleY = this.scale.height / Math.max(1, bounds.height);
      return new Phaser.Math.Vector2((event.clientX - bounds.left) * scaleX, (event.clientY - bounds.top) * scaleY);
    }
    return new Phaser.Math.Vector2(pointer.x, pointer.y);
  }

  private snappedWorld(worldX: number, worldY: number): Phaser.Math.Vector2 {
    const x = Phaser.Math.Clamp(
      Math.round(worldX / this.tileSize) * this.tileSize + this.tileSize / 2,
      this.tileSize / 2,
      this.worldWidth() - this.tileSize / 2,
    );
    const y = Phaser.Math.Clamp(
      Math.round(worldY / this.tileSize) * this.tileSize + this.tileSize / 2,
      this.tileSize / 2,
      this.worldHeight() - this.tileSize / 2,
    );
    return new Phaser.Math.Vector2(x, y);
  }

  private snappedWorldForObject(item: EditorObjectCatalogItem, worldX: number, worldY: number): Phaser.Math.Vector2 {
    if (item.category === "Transitions") {
      return this.snappedChunkWorld(worldX, worldY);
    }
    return this.snappedWorld(worldX, worldY);
  }

  private snappedChunkWorld(worldX: number, worldY: number): Phaser.Math.Vector2 {
    const chunkSize = TERRAIN_STAMP_TILES * TILE_SIZE;
    const halfChunk = chunkSize / 2;
    const x = Phaser.Math.Clamp(Math.floor(worldX / chunkSize) * chunkSize + halfChunk, halfChunk, this.worldWidth() - halfChunk);
    const y = Phaser.Math.Clamp(Math.floor(worldY / chunkSize) * chunkSize + halfChunk, halfChunk, this.worldHeight() - halfChunk);
    return new Phaser.Math.Vector2(x, y);
  }

  private objectDimensionsForCatalogItem(item: EditorObjectCatalogItem): { width: number; height?: number } {
    if (item.category !== "Transitions") {
      return { width: item.defaultWidth };
    }
    const chunkSize = TERRAIN_STAMP_TILES * TILE_SIZE;
    return { width: chunkSize, height: chunkSize };
  }

  private placementAngleForObject(item: EditorObjectCatalogItem): number {
    return normalizeAngle((item.defaultAngle ?? 0) + this.objectBrushAngle);
  }

  private terrainRotationAtChunk(x: number, y: number): number {
    return this.terrainRotations.get(terrainChunkKey(x, y)) ?? 0;
  }

  private setTerrainRotationAtChunk(x: number, y: number, angle: number): boolean {
    const key = terrainChunkKey(x, y);
    const next = normalizeChunkAngle(angle);
    const previous = this.terrainRotations.get(key) ?? 0;
    if (next === 0) {
      this.terrainRotations.delete(key);
    } else {
      this.terrainRotations.set(key, next);
    }
    return previous !== next;
  }

  private exportTerrainRotations(): EditorTerrainRotation[] {
    return [...this.terrainRotations.entries()]
      .map(([key, angle]) => {
        const chunk = tileCoordFromChunkKey(key);
        return chunk ? { x: chunk.x, y: chunk.y, angle } : undefined;
      })
      .filter((rotation): rotation is EditorTerrainRotation => Boolean(rotation))
      .sort((a, b) => a.y - b.y || a.x - b.x);
  }

  private importTerrainRotation(rotation: EditorTerrainRotation): void {
    const x = Math.round(Number(rotation.x) || 0);
    const y = Math.round(Number(rotation.y) || 0);
    const angle = normalizeChunkAngle(Number(rotation.angle) || 0);
    if (angle === 0 || !this.isInside(x, y)) {
      return;
    }
    this.terrainRotations.set(terrainChunkKey(x, y), angle);
  }

  private tileIndex(x: number, y: number): number {
    return y * this.mapWidth + x;
  }

  private isInside(x: number, y: number): boolean {
    return x >= 0 && y >= 0 && x < this.mapWidth && y < this.mapHeight;
  }

  private worldWidth(): number {
    return this.mapWidth * this.tileSize;
  }

  private worldHeight(): number {
    return this.mapHeight * this.tileSize;
  }
}

function objectCatalogItem(id: string): EditorObjectCatalogItem | undefined {
  return EDITOR_OBJECT_CATALOG.find((item) => item.id === id);
}

function cloneTerrainLayer(layer: EditorTileLayer): EditorTileLayer {
  return {
    id: layer.id,
    name: layer.name,
    opacity: layer.opacity,
    tiles: [...layer.tiles],
  };
}

function rectFromTiles(a: TileCoord, b: TileCoord): EditorCellRect {
  const x = Math.min(a.x, b.x);
  const y = Math.min(a.y, b.y);
  return {
    x,
    y,
    w: Math.abs(a.x - b.x) + 1,
    h: Math.abs(a.y - b.y) + 1,
  };
}

function isTileInRect(tile: TileCoord, rect: EditorCellRect): boolean {
  return tile.x >= rect.x && tile.y >= rect.y && tile.x < rect.x + rect.w && tile.y < rect.y + rect.h;
}

function topTerrainIdAtTemplateCell(template: EditorTemplateStamp, x: number, y: number): EditorTerrainId | null {
  const index = y * template.width + x;
  for (let layerIndex = template.layers.length - 1; layerIndex >= 0; layerIndex -= 1) {
    const terrainId = template.layers[layerIndex]?.tiles[index];
    if (terrainId) {
      return terrainId;
    }
  }
  return null;
}

function tiledMapToEditorTemplate(data: TiledMap, label: string, id = safeId(label)): EditorTemplateStamp {
  if (!data.width || !data.height || data.tilewidth !== 24 || data.tileheight !== 24 || !Array.isArray(data.layers) || !Array.isArray(data.tilesets)) {
    throw new Error("Unsupported RPG Forest Tiled map.");
  }

  const visibleTileLayers = data.layers.filter(
    (layer) => layer.type === "tilelayer" && layer.visible !== false && Array.isArray(layer.data) && !isRpgForestUtilityLayer(layer.name),
  );
  if (visibleTileLayers.length === 0) {
    throw new Error("RPG Forest map has no visible tile layers.");
  }
  const collisionLayers = data.layers.filter(
    (layer) => layer.type === "tilelayer" && Array.isArray(layer.data) && Boolean(tiledLayerProperty(layer, "collision")),
  );

  const layers = visibleTileLayers.map((layer, index): EditorTileLayer => {
    const tiles = Array.from({ length: data.width * data.height }, (_unused, tileIndex) => {
      const gid = layer.data?.[tileIndex] ?? 0;
      return tiledGidToTerrainId(gid, data.tilesets);
    });
    return {
      id: `rpg-${safeId(layer.name)}-${index}`,
      name: layer.name,
      tiles,
      opacity: Phaser.Math.Clamp(layer.opacity ?? 1, 0.2, 1),
    };
  });

  return {
    id,
    label,
    width: data.width,
    height: data.height,
    tileSize: data.tilewidth,
    layers,
    collision: Array.from({ length: data.width * data.height }, (_unused, tileIndex) =>
      collisionLayers.some((layer) => Boolean(layer.data?.[tileIndex])),
    ),
  };
}

function rpgForestTerrainIdForRuntimeTile(tile: TileType): EditorTerrainId {
  switch (tile) {
    case "water":
    case "deepWater":
      return "rpgForestWater:0";
    case "path":
    case "dirt":
      return "rpgForestGround:1";
    case "stoneGround":
    case "crystalGround":
      return "rpgForestGround:2";
    case "grassDark":
    case "grass":
    default:
      return DEFAULT_RPG_FOREST_TERRAIN_ID;
  }
}

function editorAssetIdForRuntimeOverlay(overlay: VisualOverlay): string | undefined {
  switch (overlay.kind) {
    case "villageGround":
    case "pathDecal":
      return overlay.kind;
    case "imageDecal":
    case "worldSprite":
      return overlay.asset;
    case "grassDetail":
    case "villageProp":
      return undefined;
    default:
      return undefined;
  }
}

function normalizeImportedTerrainLayer(layer: unknown, width: number, height: number, index: number): EditorTileLayer {
  const candidate = layer as Partial<EditorTileLayer>;
  const expectedLength = width * height;
  const rawTiles = Array.isArray(candidate.tiles) ? candidate.tiles : [];
  return {
    id: typeof candidate.id === "string" && candidate.id.length > 0 ? candidate.id : `layer-${index}`,
    name: typeof candidate.name === "string" && candidate.name.length > 0 ? candidate.name : `Layer ${index + 1}`,
    opacity: Phaser.Math.Clamp(Number(candidate.opacity) || 1, 0.2, 1),
    tiles: Array.from({ length: expectedLength }, (_unused, tileIndex) => {
      const tile = rawTiles[tileIndex];
      return typeof tile === "string" && tile.length > 0 ? tile : null;
    }),
  };
}

function isRpgForestUtilityLayer(name: string): boolean {
  const normalized = name.toLowerCase();
  return normalized.includes("collision") || normalized.includes("move to") || normalized.includes("transfer");
}

function tiledLayerProperty(layer: TiledLayer, key: string): unknown {
  if (!layer.properties) {
    return undefined;
  }
  if (Array.isArray(layer.properties)) {
    return layer.properties.find((property) => property.name === key)?.value;
  }
  return layer.properties[key];
}

function tiledGidToTerrainId(rawGid: number, tilesets: TiledTileset[]): EditorTerrainId | null {
  const gid = Math.trunc(rawGid) & 0x1fffffff;
  if (gid <= 0) {
    return null;
  }
  const sortedTilesets = [...tilesets].sort((a, b) => a.firstgid - b.firstgid);
  let matchingTileset: TiledTileset | undefined;
  for (const tileset of sortedTilesets) {
    if (tileset.firstgid <= gid) {
      matchingTileset = tileset;
      continue;
    }
    break;
  }
  if (!matchingTileset) {
    return null;
  }
  const editorTilesetId = rpgForestTilesetIdForTiledName(matchingTileset.name);
  if (!editorTilesetId) {
    return null;
  }
  return terrainIdForFrame(editorTilesetId, gid - matchingTileset.firstgid);
}

function rpgForestTilesetIdForTiledName(name: string): string | undefined {
  switch (name.toLowerCase()) {
    case "forest tileset":
      return "rpgForestGround";
    case "forest trees":
      return "rpgForestTrees";
    case "forest water":
      return "rpgForestWater";
    default:
      return undefined;
  }
}

function terrainIdForFrame(tilesetId: string, frame: number): EditorTerrainId {
  return `${tilesetId}:${frame}`;
}

function terrainFrameInfoFromId(id: EditorTerrainId): { tileset: EditorTilesetDefinition; frame: number } | undefined {
  const match = /^([^:]+):(\d+)$/.exec(id);
  if (!match) {
    return undefined;
  }
  const tileset = EDITOR_TILESETS.find((item) => item.id === match[1]);
  if (!tileset) {
    return undefined;
  }
  return {
    tileset,
    frame: Phaser.Math.Clamp(Number(match[2]) || 0, 0, tileset.columns * tileset.rows - 1),
  };
}

function terrainAnimationForId(id: EditorTerrainId): EditorTerrainAnimationFrame[] | undefined {
  const info = terrainFrameInfoFromId(id);
  if (info?.tileset.id !== "rpgForestWater") {
    return undefined;
  }
  return RPG_FOREST_WATER_ANIMATION_SEQUENCES.find((sequence) => sequence.some((frame) => frame.frame === info.frame));
}

function frameHasTransparentPixels(frame: Phaser.Textures.Frame): boolean {
  if (frame.cutWidth <= 0 || frame.cutHeight <= 0) {
    return false;
  }
  const canvas = document.createElement("canvas");
  canvas.width = frame.cutWidth;
  canvas.height = frame.cutHeight;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) {
    return false;
  }
  context.imageSmoothingEnabled = false;
  context.drawImage(frame.source.image as CanvasImageSource, frame.cutX, frame.cutY, frame.cutWidth, frame.cutHeight, 0, 0, frame.cutWidth, frame.cutHeight);
  const pixels = context.getImageData(0, 0, frame.cutWidth, frame.cutHeight).data;
  for (let index = 3; index < pixels.length; index += 4) {
    if (pixels[index] < 250) {
      return true;
    }
  }
  return false;
}

function objectItemsFromImageDecals(
  items: Array<[ImageDecalKey, string, number]>,
  category: EditorObjectCatalogItem["category"] = "Decals",
): EditorObjectCatalogItem[] {
  const fixedTransitionWidth = TERRAIN_STAMP_TILES * TILE_SIZE;
  return items.map(([id, label, defaultWidth]) => ({
    id,
    label,
    category,
    textureKey: imageDecalVisuals[id].key,
    defaultWidth: category === "Transitions" ? fixedTransitionWidth : defaultWidth,
    originX: 0.5,
    originY: 0.5,
    layer: "decal",
    alpha: category === "Transitions" ? 1 : 0.92,
    depthOffset: -4,
  }));
}

function objectItemsFromTransitionTextures(): EditorObjectCatalogItem[] {
  const chunk = TERRAIN_STAMP_TILES * TILE_SIZE;
  return [
    ...transitionVariants("runtimeShoreEdge", "Runtime shore edge", assetKeys.aobMap.shoreEdge, chunk, "south"),
    ...transitionCornerVariants("runtimeShoreCorner", "Runtime shore corner", assetKeys.aobMap.shoreCorner, chunk),
    ...transitionVariants("runtimeGrassDirtEdge", "Runtime grass/dirt edge", assetKeys.aobMap.grassDirtEdge, chunk, "east"),
    ...transitionCornerVariants("runtimeGrassDirtCorner", "Runtime grass/dirt corner", assetKeys.aobMap.grassDirtCornerOuter, chunk),
    ...transitionVariants("runtimeGrassStoneEdge", "Runtime grass/stone edge", assetKeys.aobMap.grassStoneEdge, chunk, "east"),
    ...transitionCornerVariants("runtimeGrassStoneCorner", "Runtime grass/stone corner", assetKeys.aobMap.grassStoneCornerOuter, chunk),
    ...transitionVariants("runtimeDirtStoneEdge", "Runtime dirt/stone edge", assetKeys.aobMap.dirtStoneEdge, chunk, "east"),
    ...transitionCornerVariants("runtimeDirtStoneCorner", "Runtime dirt/stone corner", assetKeys.aobMap.dirtStoneCornerOuter, chunk),
  ];
}

function transitionVariants(id: string, label: string, textureKey: string, defaultWidth: number, baseSide: CardinalSide): EditorObjectCatalogItem[] {
  const sides: CardinalSide[] = ["north", "east", "south", "west"];
  return sides.map((side) => ({
    id: `${id}-${side}`,
    label: `${label} ${sideLabel(side)}`,
    category: "Transitions",
    textureKey,
    defaultWidth,
    originX: 0.5,
    originY: 0.5,
    layer: "decal",
    alpha: 1,
    depthOffset: -4,
    defaultAngle: rotationForSide(baseSide, side),
  }));
}

function transitionCornerVariants(id: string, label: string, textureKey: string, defaultWidth: number): EditorObjectCatalogItem[] {
  return [
    ["se", 0],
    ["sw", 90],
    ["nw", 180],
    ["ne", 270],
  ].map(([corner, angle]) => ({
    id: `${id}-${corner}`,
    label: `${label} ${String(corner).toUpperCase()}`,
    category: "Transitions",
    textureKey,
    defaultWidth,
    originX: 0.5,
    originY: 0.5,
    layer: "decal",
    alpha: 1,
    depthOffset: -4,
    defaultAngle: Number(angle),
  }));
}

function objectItemsFromStandaloneDecals(
  items: Array<[string, string, string, number]>,
  category: EditorObjectCatalogItem["category"] = "Decals",
): EditorObjectCatalogItem[] {
  return items.map(([id, label, textureKey, defaultWidth]) => ({
    id,
    label,
    category,
    textureKey,
    defaultWidth,
    originX: 0.5,
    originY: 0.5,
    layer: "decal",
    alpha: 1,
    depthOffset: -4,
  }));
}

function objectItemsFromWorldSprites(
  items: Array<[WorldSpriteOverlayKey, string, EditorObjectCatalogItem["category"], number]>,
): EditorObjectCatalogItem[] {
  return items.map(([id, label, category, defaultWidth]) => {
    const visual = worldSpriteOverlayVisuals[id];
    return {
      id,
      label,
      category,
      textureKey: visual.key,
      defaultWidth,
      originX: visual.originX,
      originY: visual.originY,
      layer: "object",
      alpha: 1,
      depthOffset: 0,
    };
  });
}

function objectItemsFromTextures(
  items: Array<[string, string, EditorObjectCatalogItem["category"], string, number, number]>,
): EditorObjectCatalogItem[] {
  return items.map(([id, label, category, textureKey, defaultWidth, originY]) => ({
    id,
    label,
    category,
    textureKey,
    defaultWidth,
    originX: 0.5,
    originY,
    layer: "object",
    alpha: 1,
    depthOffset: 0,
  }));
}

function normalizeImportedObject(input: EditorObjectPlacement): EditorObjectPlacement {
  const catalog = objectCatalogItem(String(input.assetId));
  const isTransition = catalog?.category === "Transitions";
  const fixedTransitionSize = TERRAIN_STAMP_TILES * TILE_SIZE;
  return {
    id: String(input.id || `imported-${Date.now()}`),
    assetId: catalog?.id ?? EDITOR_OBJECT_CATALOG[0].id,
    x: Number(input.x) || TILE_SIZE / 2,
    y: Number(input.y) || TILE_SIZE / 2,
    width: isTransition ? fixedTransitionSize : Phaser.Math.Clamp(Number(input.width) || catalog?.defaultWidth || 64, 8, 1200),
    height: isTransition ? fixedTransitionSize : input.height === undefined ? undefined : Phaser.Math.Clamp(Number(input.height) || 8, 8, 1200),
    alpha: Phaser.Math.Clamp(Number(input.alpha) || 1, 0.2, 1),
    angle: Number(input.angle) || 0,
    depthOffset: Phaser.Math.Clamp(Number(input.depthOffset) || 0, -200, 200),
    flipX: Boolean(input.flipX),
    flipY: Boolean(input.flipY),
  };
}

function sideLabel(side: CardinalSide): string {
  switch (side) {
    case "north":
      return "N";
    case "east":
      return "E";
    case "south":
      return "S";
    case "west":
      return "W";
  }
}

function rotationForSide(baseSide: CardinalSide, targetSide: CardinalSide): number {
  const order: CardinalSide[] = ["north", "east", "south", "west"];
  const base = order.indexOf(baseSide);
  const target = order.indexOf(targetSide);
  return ((target - base + 4) % 4) * 90;
}

function normalizeAngle(angle: number): number {
  return ((angle % 360) + 360) % 360;
}

function normalizeChunkAngle(angle: number): number {
  return normalizeAngle(Math.round(angle / 90) * 90);
}

function terrainChunkKey(x: number, y: number): string {
  return `${x}:${y}`;
}

function tileCoordFromChunkKey(key: string): TileCoord | undefined {
  const [x, y] = key.split(":").map((value) => Number(value));
  if (!Number.isFinite(x) || !Number.isFinite(y)) {
    return undefined;
  }
  return { x, y };
}

function safeId(name: string): string {
  return name
    .replace(/\.[^.]+$/, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40);
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => {
    switch (char) {
      case "&":
        return "&amp;";
      case "<":
        return "&lt;";
      case ">":
        return "&gt;";
      case '"':
        return "&quot;";
      case "'":
        return "&#39;";
      default:
        return char;
    }
  });
}

function escapeAttr(value: string): string {
  return escapeHtml(value);
}
