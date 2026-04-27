import Phaser from "phaser";
import { PLAYER_ID, TILE_SIZE, type AgeId } from "../../data/constants";
import { assetKeys, type HumanAction } from "../../data/assets";
import { buildingConfigs, wallTierForAge } from "../../data/definitions";
import { initialMapLayout, type VisualOverlay } from "../../data/mapLayout";
import {
  grassDetailFrames,
  villagePropFrames,
  buildingFallbackVisualSizeForType,
  buildingGroundBoundsForType,
  buildingRuinVisualForType,
  buildingStaticAssetKeyForType,
  buildingStaticVisualSizeForType,
  constructionVisualSizeForType,
  imageDecalVisuals,
  resourceVisuals,
  terrainVisualFor,
  TERRAIN_STAMP_TILES,
  visualOverlayVisuals,
  type AtlasFrameDef,
} from "../../data/visuals";
import type { BuildingType, EntityId, GameEntity } from "../../core/entities/types";
import { idleWorkerIdsForPlayer, workerTaskCountsForPlayer } from "../../core/selectors/economy";
import { objectiveViewsForState } from "../../core/selectors/objectives";
import { Simulation } from "../../core/simulation/Simulation";
import type { BuildingEvent, CombatEvent, MapState, ResourceStock, TileCoord, TileType, Vec2 } from "../../core/state/types";
import { worldToTile } from "../../core/systems/mapQueries";
import { canPlaceBuildingAt, canPlaceWallSegmentsAt } from "../../core/systems/simulationSystems";
import { exploredTileRatio, isTileExplored, isWorldPositionExplored } from "../../core/systems/visibility";
import { wallLineSegments, type WallLineDirection, type WallLineSegment } from "../../core/systems/wallPlacement";
import { registerAnimations } from "../world/AnimationRegistry";
import { HudController, type HudRenderContext } from "../ui/HudController";

type EntityView = {
  container: Phaser.GameObjects.Container;
  ground?: Phaser.GameObjects.TileSprite;
  sprites: Phaser.GameObjects.Sprite[];
  smoke?: Phaser.GameObjects.Sprite;
  graphics?: Phaser.GameObjects.Graphics;
  selection: Phaser.GameObjects.Graphics;
  health: Phaser.GameObjects.Graphics;
  selectionCorners?: Phaser.GameObjects.Image[];
  animationFamily?: "human" | "tinySoldier" | "tinyArcher" | "tinyScout" | "goblin" | "skeleton";
  lastAnimation?: string;
  lastBuildingSignature?: string;
  lastBuildingCompleted?: boolean;
  completionEffectStartedAt?: number;
  staticBuildingType?: BuildingType;
  facingX?: -1 | 1;
};

type RuinView = {
  sprite: Phaser.GameObjects.Image;
};

type CardinalSide = "north" | "east" | "south" | "west";

type NeighboringTerrain = Record<CardinalSide, TileType>;

const CARDINAL_SIDES: CardinalSide[] = ["north", "east", "south", "west"];

type WallVisual = {
  visible: boolean;
  textureKey: string;
  width: number;
  height: number;
  x?: number;
  y?: number;
  flipX?: boolean;
  flipY?: boolean;
};

type WallSpriteVisual = {
  textureKey: string;
  width: number;
  height: number;
  x: number;
  y: number;
  flipX?: boolean;
  flipY?: boolean;
};

type WallDraft = {
  points: TileCoord[];
};

type WallOrientationMode = "auto" | WallLineDirection;

const TERRAIN_BASE_DEPTH = -1000;
const TERRAIN_TRANSITION_DEPTH = -950;
const UNIT_SPRITE_SCALE = 1.28;
const UNIT_SPRITE_ORIGIN_Y = 0.61;
const TINY_COMBAT_SPRITE_SCALE = 1.45;
const GROUND_PAD_DEPTH = -875;
const FOG_DEPTH = 8_400;
const FOG_CHUNK_TILES = 2;
const USE_SUNNYSIDE_TERRAIN = false;
const USE_SUNNYSIDE_BUILDINGS = false;
const USE_BUILDING_GROUND_PADS = false;
const USE_BUILDING_SMOKE = USE_SUNNYSIDE_BUILDINGS;
const USE_BUILDING_COMPLETION_BOUNCE = USE_SUNNYSIDE_BUILDINGS;
const SUNNYSIDE_CURSOR_CSS: Record<string, string> = {
  default: 'url("/assets/sunnyside/ui/cursor_01.png") 0 0, default',
  pointer: 'url("/assets/sunnyside/ui/cursor_02.png") 0 0, pointer',
  copy: 'url("/assets/sunnyside/ui/cursor_03.png") 0 0, copy',
  cell: 'url("/assets/sunnyside/ui/cursor_04.png") 0 0, cell',
  crosshair: 'url("/assets/sunnyside/ui/cursor_05.png") 0 0, crosshair',
};

type SunnysideTerrainKind = "grass" | "dirt" | "waterEdge" | "waterDeep" | "stone" | "crystal";

type BuildingSpriteDef = {
  key: string;
  frame?: string | number;
  maxSize: number;
  originX: number;
  originY: number;
  x?: number;
  y: number;
  alpha?: number;
};

type SunnysideBuildingPartDef = Omit<BuildingSpriteDef, "y"> & {
  yOffset?: number;
};

type SunnysideBuildingBlueprint = {
  parts: SunnysideBuildingPartDef[];
  visualSize: number;
};

type BuildingSmokeDef = {
  xFactor: number;
  yFactor: number;
  maxSize: number;
  alpha: number;
};

const SUNNYSIDE_GRASS_FRAMES = [65, 66, 129, 130, 131, 132, 133, 134, 192, 193, 194, 195, 196, 197, 198, 199, 257, 258, 259, 328, 329];
const SUNNYSIDE_DIRT_FRAMES = [457, 458, 459, 521, 522];
const SUNNYSIDE_WATER_EDGE_FRAMES = [542, 543, 544, 545];
const SUNNYSIDE_WATER_DEEP_FRAMES = [1163, 1164, 1165, 1166, 1227, 1228, 1229, 1230, 1291, 1292, 1293, 1294];
const SUNNYSIDE_STONE_FRAMES = [961, 962, 963, 964, 965, 969, 970, 973, 974, 1025, 1029, 1032, 1033, 1034, 1035, 1036, 1037, 1038];
const SUNNYSIDE_CRYSTAL_GROUND_FRAMES = [457, 458, 459, 521, 522, 532, 533];

export class WorldScene extends Phaser.Scene {
  private simulation!: Simulation;
  private hud!: HudController;
  private readonly entityViews = new Map<EntityId, EntityView>();
  private readonly ruinViews = new Map<number, RuinView>();
  private dragStartWorld?: Vec2;
  private dragStartScreen?: Vec2;
  private dragGraphics?: Phaser.GameObjects.Graphics;
  private placementGraphics?: Phaser.GameObjects.Graphics;
  private rallyGraphics?: Phaser.GameObjects.Graphics;
  private fogGraphics?: Phaser.GameObjects.Graphics;
  private placementPreviewGround?: Phaser.GameObjects.TileSprite;
  private placementPreviewSprite?: Phaser.GameObjects.Sprite;
  private readonly wallPreviewSprites: Phaser.GameObjects.Sprite[] = [];
  private placementType?: BuildingType;
  private wallDraft?: WallDraft;
  private wallDragStartTile?: TileCoord;
  private wallOrientationMode: WallOrientationMode = "auto";
  private buildMenuOpen = false;
  private previousSelectedIds = new Set<EntityId>();
  private hoveredEntityId?: EntityId;
  private keys!: Record<string, Phaser.Input.Keyboard.Key>;
  private isPanning = false;
  private panLastScreen?: Vec2;
  private currentCursor = "";
  private solanaAtlasFramesRegistered = false;
  private sunnysideFramesRegistered = false;
  private nextIdleWorkerIndex = 0;
  private lastCombatEventId = -1;
  private lastBuildingEventId = -1;
  private lastFogSignature = "";

  constructor() {
    super("WorldScene");
  }

  create(): void {
    registerAnimations(this);
    this.simulation = new Simulation();
    this.configureTerrainTextureFilters();
    if (USE_SUNNYSIDE_BUILDINGS) {
      this.registerSunnysideFrames();
    }
    this.createTerrain();
    this.createMapDecor();
    this.createFogOverlay();
    this.createInput();
    this.createHud();
    this.installDebugHooks();

    this.cameras.main.setBounds(0, 0, this.simulation.state.map.width * TILE_SIZE, this.simulation.state.map.height * TILE_SIZE);
    this.cameras.main.centerOn(62 * TILE_SIZE, 64 * TILE_SIZE);
    this.cameras.main.setZoom(1.22);

    this.dragGraphics = this.add.graphics().setDepth(10_000);
    this.placementGraphics = this.add.graphics().setDepth(9_999);
    this.rallyGraphics = this.add.graphics().setDepth(9_998);
  }

  private configureTerrainTextureFilters(): void {
    for (const key of [
      assetKeys.aobMap.baseGrass,
      assetKeys.aobMap.baseDirt,
      assetKeys.aobMap.baseRocky,
      assetKeys.aobMap.baseShallowWater,
      assetKeys.aobMap.crystalGround,
      assetKeys.aobMap.grassDirtEdge,
      assetKeys.aobMap.grassDirtCornerOuter,
      assetKeys.aobMap.grassDirtCornerInner,
      assetKeys.aobMap.grassStoneEdge,
      assetKeys.aobMap.grassStoneCornerOuter,
      assetKeys.aobMap.dirtStoneEdge,
      assetKeys.aobMap.dirtStoneCornerOuter,
      assetKeys.aobMap.shoreEdge,
      assetKeys.aobMap.shoreCorner,
      assetKeys.aobMap.solanaVillageGround,
      assetKeys.aobMap.solanaPathDecal,
      assetKeys.aobMap.solanaGrassDetailAtlas,
      assetKeys.aobMap.solanaCrystalClusterLarge,
      assetKeys.aobMap.solanaVillagePropsAtlas,
      assetKeys.aobMap.solanaRoadStraight,
      assetKeys.aobMap.solanaRoadCurveLeft,
      assetKeys.aobMap.solanaRoadIntersection,
      assetKeys.aobMap.solanaRoadEnd,
      assetKeys.aobMap.solanaRoadCross,
      assetKeys.aobMap.solanaRoadCurveEastSouth,
      assetKeys.aobMap.solanaRoadCurveNorthEast,
      assetKeys.aobMap.solanaRoadCurveSouthWest,
      assetKeys.aobMap.solanaRoadCurveWestNorth,
      assetKeys.aobMap.solanaRoadDiagonalNeSw,
      assetKeys.aobMap.solanaRoadDiagonalNwSe,
      assetKeys.aobMap.solanaRoadEndEast,
      assetKeys.aobMap.solanaRoadEndNorth,
      assetKeys.aobMap.solanaRoadEndSouth,
      assetKeys.aobMap.solanaRoadEndWest,
      assetKeys.aobMap.solanaRoadStraightHorizontal,
      assetKeys.aobMap.solanaRoadStraightVertical,
      assetKeys.aobMap.solanaRoadTEast,
      assetKeys.aobMap.solanaRoadTNorth,
      assetKeys.aobMap.solanaRoadTSouth,
      assetKeys.aobMap.solanaRoadTWest,
      assetKeys.aobMap.solanaStoneGroundPatch,
      assetKeys.aobMap.solanaCrystalGroundPatch,
      assetKeys.aobMap.solanaWaterShoreCurve,
      assetKeys.aobMap.solanaGrassToCrystalEdgeEast,
      assetKeys.aobMap.solanaGrassToCrystalEdgeNorth,
      assetKeys.aobMap.solanaGrassToCrystalEdgeSouth,
      assetKeys.aobMap.solanaGrassToCrystalEdgeWest,
      assetKeys.aobMap.solanaGrassToDirtEdgeEast,
      assetKeys.aobMap.solanaGrassToDirtEdgeNorth,
      assetKeys.aobMap.solanaGrassToDirtEdgeSouth,
      assetKeys.aobMap.solanaGrassToDirtEdgeWest,
      assetKeys.aobMap.solanaGrassToStoneEdgeEast,
      assetKeys.aobMap.solanaGrassToStoneEdgeNorth,
      assetKeys.aobMap.solanaGrassToStoneEdgeSouth,
      assetKeys.aobMap.solanaGrassToStoneEdgeWest,
      assetKeys.aobMap.solanaShoreCornerNe,
      assetKeys.aobMap.solanaShoreCornerNw,
      assetKeys.aobMap.solanaShoreCornerSe,
      assetKeys.aobMap.solanaShoreCornerSw,
      assetKeys.aobMap.solanaShoreEdgeEast,
      assetKeys.aobMap.solanaShoreEdgeNorth,
      assetKeys.aobMap.solanaShoreEdgeSouth,
      assetKeys.aobMap.solanaShoreEdgeWest,
      assetKeys.aobMap.solanaTreeClusterA,
      assetKeys.aobMap.solanaTreeClusterB,
      assetKeys.aobMap.solanaPineCluster,
      assetKeys.aobMap.solanaStoneNodeLarge,
      assetKeys.aobMap.solanaStoneNodeSmall,
      assetKeys.aobMap.solanaCrystalNodeLarge,
      assetKeys.aobMap.solanaCrystalNodeSmall,
      assetKeys.aobMap.solanaBerryBush,
      assetKeys.aobMap.solanaBannerSmall,
      assetKeys.aobMap.solanaBannerTall,
      assetKeys.aobMap.solanaLanternPost,
      assetKeys.aobMap.solanaCrate,
      assetKeys.aobMap.solanaCratesStack,
      assetKeys.aobMap.solanaBarrels,
      assetKeys.aobMap.solanaFenceShort,
      assetKeys.aobMap.solanaSacks,
      assetKeys.aobMap.solanaValidatorObelisk,
      assetKeys.aobMap.solanaFenceCorner,
      assetKeys.aobBuildingRuins.small,
      assetKeys.aobBuildingRuins.medium,
      assetKeys.aobBuildingRuins.large,
    ]) {
      this.textures.get(key).setFilter(Phaser.Textures.FilterMode.LINEAR);
    }
    for (const key of [
      assetKeys.tiles,
      assetKeys.forest,
      assetKeys.elements.tree1,
      assetKeys.elements.tree2,
      assetKeys.elements.rock,
      assetKeys.elements.wood,
      assetKeys.elements.wheat,
      assetKeys.elements.carrot,
      assetKeys.elements.soil,
      assetKeys.elements.windmill,
      assetKeys.elements.fire,
      assetKeys.elements.smoke,
      assetKeys.tinyRpg.soldier.idle,
      assetKeys.tinyRpg.soldier.walk,
      assetKeys.tinyRpg.soldier.attack,
      assetKeys.tinyRpg.soldier.hurt,
      assetKeys.tinyRpg.soldier.death,
      assetKeys.tinyRpg.archer.idle,
      assetKeys.tinyRpg.archer.walk,
      assetKeys.tinyRpg.archer.attack,
      assetKeys.tinyRpg.archer.hurt,
      assetKeys.tinyRpg.archer.death,
      assetKeys.tinyRpg.scout.idle,
      assetKeys.tinyRpg.scout.walk,
      assetKeys.tinyRpg.scout.attack,
      assetKeys.tinyRpg.scout.hurt,
      assetKeys.tinyRpg.scout.death,
      assetKeys.tinyRpg.arrow,
      assetKeys.ui.selectBoxTl,
      assetKeys.ui.selectBoxTr,
      assetKeys.ui.selectBoxBl,
      assetKeys.ui.selectBoxBr,
    ]) {
      this.textures.get(key).setFilter(Phaser.Textures.FilterMode.NEAREST);
    }
  }

  update(_time: number, delta: number): void {
    this.simulation.update(delta);
    this.updateCamera(delta);
    this.updateHoverTarget();
    this.syncEntityViews();
    this.playCombatEvents();
    this.playBuildingEvents();
    this.updateFogOverlay();
    this.updateSelectionPulse();
    this.updatePlacementPreview();
    this.updateRallyMarker();
    this.updateCursor();
    if (this.buildMenuOpen && this.selectedWorkerIds().length === 0) {
      this.buildMenuOpen = false;
    }
    this.hud.render(this.simulation.state, this.createHudRenderContext());
  }

  private createTerrain(): void {
    if (USE_SUNNYSIDE_TERRAIN) {
      this.createSunnysideTerrain();
      return;
    }

    const state = this.simulation.state;
    const chunkSize = TERRAIN_STAMP_TILES * TILE_SIZE;
    const worldWidth = state.map.width * TILE_SIZE;
    const worldHeight = state.map.height * TILE_SIZE;
    this.add
      .tileSprite(worldWidth / 2, worldHeight / 2, worldWidth, worldHeight, assetKeys.aobMap.baseGrass)
      .setOrigin(0.5, 0.5)
      .setDepth(TERRAIN_BASE_DEPTH);

    for (let y = 0; y < state.map.height; y += TERRAIN_STAMP_TILES) {
      for (let x = 0; x < state.map.width; x += TERRAIN_STAMP_TILES) {
        const kind = terrainKindForChunk(state.map, x, y);
        if (isGrassLike(kind) || shouldLetVisualDecalCover(kind, x, y)) {
          continue;
        }
        const visual = terrainVisualFor(kind);
        const variation = hash2(x, y);
        const tile = this.add
          .image(x * TILE_SIZE, y * TILE_SIZE, visual.key)
          .setOrigin(0, 0)
          .setDisplaySize(chunkSize, chunkSize)
          .setDepth(TERRAIN_BASE_DEPTH + 6)
          .setAlpha(visual.alpha ?? 1);

        if (visual.canMirror) {
          tile.setFlipX((variation & 1) === 1);
          tile.setFlipY((variation & 2) === 2);
        }
      }
    }

    this.createTerrainTransitions(state, chunkSize);
    this.createVisualOverlays();
  }

  private createSunnysideTerrain(): void {
    this.registerSunnysideFrames();
    const state = this.simulation.state;
    const data: number[][] = [];

    for (let y = 0; y < state.map.height; y += 1) {
      const row: number[] = [];
      for (let x = 0; x < state.map.width; x += 1) {
        const tile = state.map.tiles[y * state.map.width + x] ?? "grass";
        const kind = sunnysideTerrainKindForTile(state.map, tile, x, y);
        row.push(sunnysideTerrainFrameForKind(kind, x, y));
      }
      data.push(row);
    }

    const map = this.make.tilemap({ data, tileWidth: TILE_SIZE, tileHeight: TILE_SIZE });
    const tileset = map.addTilesetImage(assetKeys.tiles, assetKeys.tiles, TILE_SIZE, TILE_SIZE, 0, 0);
    if (!tileset) {
      return;
    }
    map.createLayer(0, tileset, 0, 0)?.setDepth(TERRAIN_BASE_DEPTH);
  }

  private createTerrainTransitions(state: Simulation["state"], chunkSize: number): void {
    for (let y = 0; y < state.map.height; y += TERRAIN_STAMP_TILES) {
      for (let x = 0; x < state.map.width; x += TERRAIN_STAMP_TILES) {
        const kind = terrainKindForChunk(state.map, x, y);
        const north = terrainKindForChunk(state.map, x, y - TERRAIN_STAMP_TILES);
        const east = terrainKindForChunk(state.map, x + TERRAIN_STAMP_TILES, y);
        const south = terrainKindForChunk(state.map, x, y + TERRAIN_STAMP_TILES);
        const west = terrainKindForChunk(state.map, x - TERRAIN_STAMP_TILES, y);
        const worldX = x * TILE_SIZE + chunkSize / 2;
        const worldY = y * TILE_SIZE + chunkSize / 2;
        const neighbors = { north, east, south, west };
        if (shouldSkipVisualDecalTransitions(kind, neighbors, x, y)) {
          continue;
        }
        if (isGrassLike(kind)) {
          this.placeTransitionEdges(worldX, worldY, chunkSize, neighbors, isWaterChunk, assetKeys.aobMap.shoreEdge, "south");
          this.placeTransitionCorner(worldX, worldY, chunkSize, neighbors, isWaterChunk, assetKeys.aobMap.shoreCorner);
          for (const side of ["north", "east", "west"] as CardinalSide[]) {
            if (!isDirtLike(neighbors[side])) {
              continue;
            }
            this.add
              .image(worldX, worldY, assetKeys.aobMap.grassDirtEdge)
              .setOrigin(0.5, 0.5)
              .setDisplaySize(chunkSize, chunkSize)
              .setAngle(rotationForSide("east", side))
              .setDepth(TERRAIN_TRANSITION_DEPTH);
          }
          this.placeTransitionCorner(worldX, worldY, chunkSize, neighbors, isDirtLike, assetKeys.aobMap.grassDirtCornerOuter);
          this.placeTransitionEdges(worldX, worldY, chunkSize, neighbors, isStoneLike, assetKeys.aobMap.grassStoneEdge, "east");
          this.placeTransitionCorner(worldX, worldY, chunkSize, neighbors, isStoneLike, assetKeys.aobMap.grassStoneCornerOuter);
          continue;
        }

        if (isDirtLike(kind)) {
          this.placeTransitionEdges(worldX, worldY, chunkSize, neighbors, isStoneLike, assetKeys.aobMap.dirtStoneEdge, "east");
          this.placeTransitionCorner(worldX, worldY, chunkSize, neighbors, isStoneLike, assetKeys.aobMap.dirtStoneCornerOuter);
        }
      }
    }
  }

  private placeTransitionEdges(
    worldX: number,
    worldY: number,
    chunkSize: number,
    neighbors: NeighboringTerrain,
    matches: (tile: TileType) => boolean,
    textureKey: string,
    baseSide: CardinalSide,
  ): void {
    for (const side of CARDINAL_SIDES) {
      if (!matches(neighbors[side])) {
        continue;
      }
      this.add
        .image(worldX, worldY, textureKey)
        .setOrigin(0.5, 0.5)
        .setDisplaySize(chunkSize, chunkSize)
        .setAngle(rotationForSide(baseSide, side))
        .setDepth(TERRAIN_TRANSITION_DEPTH);
    }
  }

  private placeTransitionCorner(
    worldX: number,
    worldY: number,
    chunkSize: number,
    neighbors: NeighboringTerrain,
    matches: (tile: TileType) => boolean,
    textureKey: string,
  ): void {
    const { north, east, south, west } = neighbors;
    let angle: number | undefined;

    if (matches(south) && matches(east)) {
      angle = 0;
    } else if (matches(south) && matches(west)) {
      angle = 90;
    } else if (matches(north) && matches(west)) {
      angle = 180;
    } else if (matches(north) && matches(east)) {
      angle = 270;
    }

    if (angle === undefined) {
      return;
    }

    this.add
      .image(worldX, worldY, textureKey)
      .setOrigin(0.5, 0.5)
      .setDisplaySize(chunkSize, chunkSize)
      .setAngle(angle)
      .setDepth(TERRAIN_TRANSITION_DEPTH + 1);
  }

  private createVisualOverlays(): void {
    this.registerSolanaAtlasFrames();
    for (const overlay of initialMapLayout.visualOverlays) {
      this.addVisualOverlay(overlay);
    }
  }

  private createFogOverlay(): void {
    this.fogGraphics = this.add.graphics().setDepth(FOG_DEPTH);
    this.updateFogOverlay(true);
  }

  private updateFogOverlay(force = false): void {
    const visibility = this.simulation.state.visibility;
    const exploredCount = visibility.exploredTiles.reduce((total, explored) => total + (explored ? 1 : 0), 0);
    const signature = `${exploredCount}`;
    if (!force && signature === this.lastFogSignature) {
      return;
    }
    this.lastFogSignature = signature;
    const graphics = this.fogGraphics;
    if (!graphics) {
      return;
    }

    graphics.clear();
    graphics.fillStyle(0x030609, 0.58);
    const chunkSize = FOG_CHUNK_TILES * TILE_SIZE;
    for (let y = 0; y < this.simulation.state.map.height; y += FOG_CHUNK_TILES) {
      for (let x = 0; x < this.simulation.state.map.width; x += FOG_CHUNK_TILES) {
        if (isFogChunkExplored(this.simulation.state, x, y)) {
          continue;
        }
        graphics.fillRect(x * TILE_SIZE, y * TILE_SIZE, chunkSize, chunkSize);
      }
    }
  }

  private registerSunnysideFrames(): void {
    if (this.sunnysideFramesRegistered) {
      return;
    }
    this.registerAtlasFrames(assetKeys.tiles, sunnysideBuildingFrames);
    this.sunnysideFramesRegistered = true;
  }

  private registerSolanaAtlasFrames(): void {
    if (this.solanaAtlasFramesRegistered) {
      return;
    }
    this.registerAtlasFrames(assetKeys.aobMap.solanaGrassDetailAtlas, grassDetailFrames);
    this.registerAtlasFrames(assetKeys.aobMap.solanaVillagePropsAtlas, villagePropFrames);
    this.solanaAtlasFramesRegistered = true;
  }

  private registerAtlasFrames(textureKey: string, frames: Record<string, AtlasFrameDef>): void {
    const texture = this.textures.get(textureKey);
    for (const [name, frame] of Object.entries(frames)) {
      if (!texture.has(name)) {
        texture.add(name, 0, frame.x, frame.y, frame.width, frame.height);
      }
    }
  }

  private addVisualOverlay(overlay: VisualOverlay): void {
    const worldX = overlay.tile.x * TILE_SIZE + TILE_SIZE / 2;
    const worldY = overlay.tile.y * TILE_SIZE + TILE_SIZE / 2;
    if (overlay.kind === "imageDecal") {
      const visual = imageDecalVisuals[overlay.asset];
      this.add
        .image(worldX, worldY, visual.key)
        .setOrigin(visual.originX, visual.originY)
        .setDisplaySize(overlay.width, overlay.height ?? overlay.width)
        .setAngle(overlay.angle ?? 0)
        .setFlipX(Boolean(overlay.flipX))
        .setFlipY(Boolean(overlay.flipY))
        .setDepth(visual.depth + (overlay.depthOffset ?? 0))
        .setAlpha(overlay.alpha ?? 1);
      return;
    }
    const visual = visualOverlayVisuals[overlay.kind];
    if (!("frame" in overlay)) {
      this.add
        .image(worldX, worldY, visual.key)
        .setOrigin(visual.originX, visual.originY)
        .setDisplaySize(overlay.width, overlay.height)
        .setAngle(overlay.angle ?? 0)
        .setFlipX(Boolean(overlay.flipX))
        .setFlipY(Boolean(overlay.flipY))
        .setDepth(visual.depth + (overlay.depthOffset ?? 0))
        .setAlpha(overlay.alpha ?? 1);
      return;
    }

    let frameName: string;
    let frame: AtlasFrameDef;
    if (overlay.kind === "grassDetail") {
      frameName = overlay.frame;
      frame = grassDetailFrames[overlay.frame];
    } else {
      frameName = overlay.frame;
      frame = villagePropFrames[overlay.frame];
    }
    const container = this.add.container(worldX, worldY);
    const frameShadow = frame.shadow ?? visual.shadow;
    if (frameShadow) {
      const shadow = this.add.graphics();
      const ratio = overlay.width / Math.max(frame.width, frame.height);
      shadow.fillStyle(0x090b07, frameShadow.alpha);
      shadow.fillEllipse(0, frameShadow.y, frameShadow.width * ratio, frameShadow.height * ratio);
      container.add(shadow);
    }

    const sprite = this.add.image(0, 0, visual.key, frameName).setOrigin(frame.originX, frame.originY);
    setMaxDisplaySize(sprite, overlay.width);
    sprite.setAngle(overlay.angle ?? 0);
    sprite.setFlipX(Boolean(overlay.flipX));
    sprite.setFlipY(Boolean(overlay.flipY));
    sprite.setAlpha(overlay.alpha ?? 1);
    container.add(sprite);
    container.setDepth(visual.depth === 0 ? worldY + (overlay.depthOffset ?? -2) : visual.depth + (overlay.depthOffset ?? 0));
  }

  private createMapDecor(): void {
    const state = this.simulation.state;
    const blocked = buildDecorBlockedTiles(state);

    for (let y = 2; y < state.map.height - 2; y += 1) {
      for (let x = 2; x < state.map.width - 2; x += 1) {
        if (blocked.has(tileCoordKey(x, y))) {
          continue;
        }

        const tile = state.map.tiles[y * state.map.width + x] ?? "grass";
        const naturalDecor = naturalDecorForTile(state.map, tile, x, y);
        if (!naturalDecor) {
          continue;
        }

        this.addDecorSprite({
          ...naturalDecor,
          tileX: x,
          tileY: y,
        });
        blocked.add(tileCoordKey(x, y));
      }
    }

    for (const decor of villageDecorLayout()) {
      if (blocked.has(tileCoordKey(decor.tileX, decor.tileY))) {
        continue;
      }
      this.addDecorSprite(decor);
      blocked.add(tileCoordKey(decor.tileX, decor.tileY));
    }
  }

  private addDecorSprite(decor: DecorPlacement): void {
    const worldX = decor.tileX * TILE_SIZE + TILE_SIZE / 2;
    const worldY = decor.tileY * TILE_SIZE + TILE_SIZE / 2;
    if (decor.maxSize >= 30) {
      const shadow = this.add.graphics();
      shadow
        .setPosition(worldX, worldY)
        .setDepth(worldY + (decor.depthOffset ?? -2) - 1)
        .fillStyle(0x090b07, 0.13)
        .fillEllipse(0, 3, decor.maxSize * 0.72, Math.max(8, decor.maxSize * 0.2));
    }
    const sprite = this.add
      .sprite(worldX, worldY, decor.key, decor.frame ?? decorFrameForKey(decor.key))
      .setOrigin(decor.originX ?? 0.5, decor.originY ?? 0.86)
      .setDepth(worldY + (decor.depthOffset ?? -2))
      .setAlpha(decor.alpha ?? 1);

    setMaxDisplaySize(sprite, decor.maxSize);
  }

  private createInput(): void {
    this.keys = this.input.keyboard?.addKeys("W,A,S,D,UP,DOWN,LEFT,RIGHT,ESC,SPACE,F,H,B,PERIOD,ENTER,DELETE") as Record<string, Phaser.Input.Keyboard.Key>;
    this.input.mouse?.disableContextMenu();
    this.setCursor("default");

    this.input.on(Phaser.Input.Events.POINTER_DOWN, (pointer: Phaser.Input.Pointer) => {
      const button = mouseButton(pointer);
      if (button === 1 || (button === 0 && this.keys.SPACE?.isDown)) {
        this.startMousePan(pointer);
        return;
      }
      if (button !== 0) {
        return;
      }
      if (this.placementType === "wall") {
        this.startWallDrag(pointer);
        return;
      }
      this.dragStartWorld = { x: pointer.worldX, y: pointer.worldY };
      this.dragStartScreen = { x: pointer.x, y: pointer.y };
    });

    this.input.on(Phaser.Input.Events.POINTER_MOVE, (pointer: Phaser.Input.Pointer) => {
      if (this.isPanning) {
        this.updateMousePan(pointer);
        return;
      }
      if (this.placementType === "wall") {
        this.clearSelectionDrag();
        return;
      }
      this.drawDragRect(pointer);
    });

    this.input.on(Phaser.Input.Events.POINTER_UP, (pointer: Phaser.Input.Pointer) => {
      if (this.isPanning) {
        this.stopMousePan();
        return;
      }
      const button = mouseButton(pointer);
      if (button === 2) {
        if (this.placementType === "wall") {
          this.cancelWallDraftOrPlacement();
          return;
        }
        if (this.placementType) {
          this.cancelPlacement();
          return;
        }
        this.handleCommandClick(pointer);
        return;
      }
      if (button === 0 && this.placementType === "wall") {
        this.finishWallDrag(pointer);
        return;
      }
      if (button === 0) {
        this.handlePrimaryClick(pointer);
      }
    });

    this.input.on(Phaser.Input.Events.POINTER_WHEEL, (_pointer: Phaser.Input.Pointer, _objects: Phaser.GameObjects.GameObject[], _dx: number, dy: number) => {
      const camera = this.cameras.main;
      const nextZoom = Phaser.Math.Clamp(camera.zoom + (dy > 0 ? -0.1 : 0.1), 0.8, 1.7);
      camera.setZoom(nextZoom);
    });
  }

  private createHud(): void {
    const root = document.getElementById("hud-root");
    if (!root) {
      throw new Error("Missing #hud-root.");
    }
    this.hud = new HudController(root, {
      onBuildRequest: (buildingType) => {
        this.placementType = buildingType;
        this.wallDraft = undefined;
        this.buildMenuOpen = false;
      },
      onOpenBuildMenu: () => {
        this.buildMenuOpen = true;
        this.playUiClick(520, 0.02);
      },
      onCloseBuildMenu: () => {
        this.buildMenuOpen = false;
        this.playUiClick(420, 0.018);
      },
      onCancelPlacement: () => {
        this.cancelPlacement();
      },
      onClearWallDraft: () => {
        this.clearWallDraft();
      },
      onToggleWallOrientation: () => {
        this.toggleWallOrientation();
      },
      onConfirmPlacement: () => {
        this.confirmWallDraft();
      },
      onTrainRequest: (unitType) => {
        const selectedBuilding = this.getSelectedBuilding();
        if (selectedBuilding) {
          this.simulation.dispatch({
            type: "trainUnit",
            playerId: PLAYER_ID,
            buildingId: selectedBuilding.id,
            unitType,
          });
        }
      },
      onAdvanceAgeRequest: () => {
        const townCenter = this.getSelectedBuilding("townCenter") ?? Object.values(this.simulation.state.entities).find((entity) => entity.ownerId === PLAYER_ID && entity.building?.type === "townCenter");
        if (townCenter) {
          this.simulation.dispatch({
            type: "advanceAge",
            playerId: PLAYER_ID,
            buildingId: townCenter.id,
          });
        }
      },
      onReseedFarmRequest: (farmId) => {
        this.simulation.dispatch({
          type: "reseedFarm",
          playerId: PLAYER_ID,
          farmId,
        });
      },
      onCancelConstruction: (buildingId) => {
        this.simulation.dispatch({
          type: "cancelConstruction",
          playerId: PLAYER_ID,
          buildingId,
        });
      },
      onDestroyBuilding: (buildingId) => {
        this.simulation.dispatch({
          type: "destroyBuilding",
          playerId: PLAYER_ID,
          buildingId,
        });
      },
      onSelectIdleWorker: () => {
        this.selectNextIdleWorker();
      },
      onSelectTownCenter: () => {
        this.selectTownCenter();
      },
    });
  }

  private createHudRenderContext(): HudRenderContext {
    const camera = this.cameras.main;
    const wallDraftSegments = this.wallDraftPreviewSegments();
    return {
      placementType: this.placementType,
      wallLineStarted: Boolean(this.wallDraft),
      wallSegmentCount: wallDraftSegments.length,
      wallPlacementCanConfirm: Boolean(this.wallDraft) && wallDraftSegments.length > 0 && canPlaceWallSegmentsAt(this.simulation.state, wallDraftSegments),
      wallOrientationMode: this.wallOrientationMode,
      buildMenuOpen: this.buildMenuOpen,
      camera: {
        x: Math.max(0, camera.scrollX),
        y: Math.max(0, camera.scrollY),
        width: camera.width / camera.zoom,
        height: camera.height / camera.zoom,
      },
    };
  }

  private installDebugHooks(): void {
    const debugWindow = window as typeof window & {
      render_game_to_text?: () => string;
      advanceTime?: (milliseconds: number) => void;
      setCameraTile?: (x: number, y: number, zoom?: number) => void;
      setPlayerResources?: (resources: Partial<ResourceStock>) => void;
    };
    debugWindow.render_game_to_text = () => {
      const state = this.simulation.state;
      const entities = Object.values(state.entities);
      const player = state.players[PLAYER_ID];
      const selected = state.selection.selectedIds.map((id) => state.entities[id]?.label ?? id);
      const primary = state.selection.selectedIds.map((id) => state.entities[id]).find(Boolean);
      return JSON.stringify({
        tick: state.tick,
        player: {
          age: player.age,
          resources: player.resources,
          population: player.population,
          populationCap: player.populationCap,
          ageProgress: player.ageProgress,
        },
        selected,
        selectedDetail: primary
          ? {
              id: primary.id,
              label: primary.label,
              queue: primary.producer?.queue.map((item) => ({
                unitType: item.unitType,
                remainingTicks: item.remainingTicks,
                totalTicks: item.totalTicks,
              })),
              rallyPoint: primary.producer?.rallyPoint,
            }
          : undefined,
        counts: {
          units: entities.filter((entity) => entity.kind === "unit").length,
          buildings: entities.filter((entity) => entity.kind === "building").length,
          resources: entities.filter((entity) => entity.kind === "resource").length,
          walls: entities.filter((entity) => entity.building?.type === "wall").length,
          completedWalls: entities.filter((entity) => entity.building?.type === "wall" && entity.building.completed).length,
        },
        visuals: {
          ruins: this.ruinViews.size,
          exploredRatio: exploredTileRatio(state),
        },
        workerTasks: workerTaskCountsForPlayer(state),
        wallDraft: this.wallDraft
          ? {
              points: this.wallDraft.points,
              segments: this.wallDraftPreviewSegments().map((segment) => ({
                tile: segment.tile,
                footprint: segment.footprint,
                direction: segment.direction,
              })),
            }
          : undefined,
        objectives: objectiveViewsForState(state).map((objective) => ({
          id: objective.id,
          status: objective.status,
          current: objective.current,
          target: objective.target,
        })),
        messages: state.messages.slice(-3).map((message) => message.text),
      });
    };
    debugWindow.advanceTime = (milliseconds: number) => {
      let remaining = Math.max(0, milliseconds);
      while (remaining > 0) {
        const step = Math.min(250, remaining);
        this.simulation.update(step);
        remaining -= step;
      }
      this.syncEntityViews();
      this.hud.render(this.simulation.state, this.createHudRenderContext());
    };
    debugWindow.setCameraTile = (x: number, y: number, zoom?: number) => {
      this.cameras.main.centerOn(x * TILE_SIZE, y * TILE_SIZE);
      if (zoom !== undefined) {
        this.cameras.main.setZoom(Phaser.Math.Clamp(zoom, 0.8, 1.7));
      }
    };
    debugWindow.setPlayerResources = (resources: Partial<ResourceStock>) => {
      Object.assign(this.simulation.state.players[PLAYER_ID].resources, resources);
      this.hud.render(this.simulation.state, this.createHudRenderContext());
    };
  }

  private updateCamera(delta: number): void {
    const camera = this.cameras.main;
    const speed = (delta / 1000) * 420 / camera.zoom;
    const left = this.keys.A?.isDown || this.keys.LEFT?.isDown;
    const right = this.keys.D?.isDown || this.keys.RIGHT?.isDown;
    const up = this.keys.W?.isDown || this.keys.UP?.isDown;
    const down = this.keys.S?.isDown || this.keys.DOWN?.isDown;

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
    this.updateEdgeScroll(delta);
    if (Phaser.Input.Keyboard.JustDown(this.keys.ESC)) {
      if (this.placementType) {
        this.cancelPlacement();
      } else if (this.buildMenuOpen) {
        this.buildMenuOpen = false;
      }
    }
    if (Phaser.Input.Keyboard.JustDown(this.keys.ENTER) && this.placementType === "wall") {
      this.confirmWallDraft();
    }
    if (Phaser.Input.Keyboard.JustDown(this.keys.H)) {
      this.selectTownCenter();
    }
    if (Phaser.Input.Keyboard.JustDown(this.keys.PERIOD)) {
      this.selectNextIdleWorker();
    }
    if (Phaser.Input.Keyboard.JustDown(this.keys.B) && this.selectedWorkerIds().length > 0) {
      this.cancelPlacement();
      this.buildMenuOpen = true;
    }
    if (Phaser.Input.Keyboard.JustDown(this.keys.DELETE)) {
      this.destroyOrCancelSelectedBuilding();
    }
    if (Phaser.Input.Keyboard.JustDown(this.keys.F)) {
      if (this.scale.isFullscreen) {
        this.scale.stopFullscreen();
      } else {
        this.scale.startFullscreen();
      }
    }
  }

  private cancelPlacement(): void {
    this.placementType = undefined;
    this.clearWallDraft();
    this.placementGraphics?.clear();
    this.hidePlacementPreviewGround();
    this.hidePlacementPreviewSprite();
    this.hideWallPlacementPreview();
  }

  private clearWallDraft(): void {
    this.wallDraft = undefined;
    this.wallDragStartTile = undefined;
    this.clearSelectionDrag();
    this.hideWallPlacementPreview();
  }

  private cancelWallDraftOrPlacement(): void {
    if (this.wallDraft || this.wallDragStartTile) {
      this.clearWallDraft();
      return;
    }
    this.cancelPlacement();
  }

  private toggleWallOrientation(): void {
    this.wallOrientationMode = this.wallOrientationMode === "auto" ? "horizontal" : this.wallOrientationMode === "horizontal" ? "vertical" : "auto";
    this.playUiClick(460, 0.014);
  }

  private selectTownCenter(): void {
    const townCenter = Object.values(this.simulation.state.entities).find(
      (entity) => entity.ownerId === PLAYER_ID && entity.building?.type === "townCenter",
    );
    if (townCenter) {
      this.selectEntity(townCenter.id, true);
    }
  }

  private destroyOrCancelSelectedBuilding(): void {
    const building = this.getSelectedBuilding();
    if (!building?.building) {
      return;
    }
    if (building.building.completed && building.building.type === "townCenter") {
      return;
    }
    this.simulation.dispatch({
      type: building.building.completed ? "destroyBuilding" : "cancelConstruction",
      playerId: PLAYER_ID,
      buildingId: building.id,
    });
  }

  private selectNextIdleWorker(): void {
    const idleWorkerIds = idleWorkerIdsForPlayer(this.simulation.state, PLAYER_ID);
    if (idleWorkerIds.length === 0) {
      return;
    }
    const id = idleWorkerIds[this.nextIdleWorkerIndex % idleWorkerIds.length];
    this.nextIdleWorkerIndex += 1;
    this.selectEntity(id, true);
  }

  private selectEntity(id: EntityId, centerCamera: boolean): void {
    const entity = this.simulation.state.entities[id];
    if (!entity) {
      return;
    }
    this.cancelPlacement();
    this.buildMenuOpen = false;
    this.simulation.dispatch({
      type: "selectUnits",
      playerId: PLAYER_ID,
      entityIds: [id],
    });
    if (centerCamera) {
      this.cameras.main.centerOn(entity.position.x, entity.position.y);
    }
  }

  private playUiClick(frequency = 620, volume = 0.018): void {
    const AudioContextClass = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) {
      return;
    }
    try {
      const context = new AudioContextClass();
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.type = "triangle";
      oscillator.frequency.value = frequency;
      gain.gain.value = volume;
      oscillator.connect(gain);
      gain.connect(context.destination);
      oscillator.start();
      gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 0.08);
      oscillator.stop(context.currentTime + 0.08);
    } catch {
      // Audio feedback is optional and may be blocked by browser settings.
    }
  }

  private updateEdgeScroll(delta: number): void {
    if (this.isPanning || !this.game.canvas.matches(":hover")) {
      return;
    }

    const pointer = this.input.activePointer;
    const edgeMargin = 28;
    const camera = this.cameras.main;
    const speed = (delta / 1000) * 360 / camera.zoom;
    let dx = 0;
    let dy = 0;

    if (pointer.x <= edgeMargin) {
      dx -= speed;
    } else if (pointer.x >= this.scale.width - edgeMargin) {
      dx += speed;
    }

    if (pointer.y <= edgeMargin) {
      dy -= speed;
    } else if (pointer.y >= this.scale.height - edgeMargin) {
      dy += speed;
    }

    camera.scrollX += dx;
    camera.scrollY += dy;
  }

  private startMousePan(pointer: Phaser.Input.Pointer): void {
    this.isPanning = true;
    this.panLastScreen = { x: pointer.x, y: pointer.y };
    this.dragStartWorld = undefined;
    this.dragStartScreen = undefined;
    this.dragGraphics?.clear();
    this.setCursor("grabbing");
  }

  private updateMousePan(pointer: Phaser.Input.Pointer): void {
    if (!this.panLastScreen) {
      this.panLastScreen = { x: pointer.x, y: pointer.y };
      return;
    }
    const camera = this.cameras.main;
    camera.scrollX -= (pointer.x - this.panLastScreen.x) / camera.zoom;
    camera.scrollY -= (pointer.y - this.panLastScreen.y) / camera.zoom;
    this.panLastScreen = { x: pointer.x, y: pointer.y };
  }

  private stopMousePan(): void {
    this.isPanning = false;
    this.panLastScreen = undefined;
    this.updateCursor();
  }

  private clearSelectionDrag(): void {
    this.dragStartWorld = undefined;
    this.dragStartScreen = undefined;
    this.dragGraphics?.clear();
  }

  private syncEntityViews(): void {
    const entities = this.simulation.state.entities;
    for (const [id, view] of this.entityViews) {
      if (!entities[id]) {
        view.ground?.destroy();
        view.container.destroy(true);
        this.entityViews.delete(id);
      }
    }

    for (const entity of Object.values(entities)) {
      let view = this.entityViews.get(entity.id);
      if (!view) {
        view = this.createEntityView(entity);
        this.entityViews.set(entity.id, view);
      }
      this.updateEntityView(entity, view);
    }
  }

  private updateSelectionPulse(): void {
    const selected = new Set(this.simulation.state.selection.selectedIds);
    let hasNewSelection = false;
    for (const id of selected) {
      if (this.previousSelectedIds.has(id)) {
        continue;
      }
      const view = this.entityViews.get(id);
      if (!view) {
        continue;
      }
      hasNewSelection = true;
    }
    if (hasNewSelection) {
      this.playUiClick(560, 0.016);
    }
    this.previousSelectedIds = selected;
  }

  private updateHoverTarget(): void {
    if (this.placementType || this.isPanning || this.dragStartWorld || !this.game.canvas.matches(":hover")) {
      this.hoveredEntityId = undefined;
      return;
    }

    const pointer = this.input.activePointer;
    this.hoveredEntityId = this.getEntityAt({ x: pointer.worldX, y: pointer.worldY })?.id;
  }

  private createEntityView(entity: GameEntity): EntityView {
    if (entity.kind === "unit") {
      return this.createUnitView(entity);
    }
    if (entity.kind === "resource") {
      return this.createResourceView(entity);
    }
    return this.createBuildingView(entity);
  }

  private createUnitView(entity: GameEntity): EntityView {
    const container = this.add.container(entity.position.x, entity.position.y);
    const shadow = this.add.graphics();
    shadow.fillStyle(0x000000, 0.22);
    shadow.fillEllipse(0, 1, 18, 7);
    container.add(shadow);

    const sprites: Phaser.GameObjects.Sprite[] = [];
    let animationFamily: EntityView["animationFamily"] = "human";
    if (entity.unit?.type === "goblin") {
      const sprite = this.add.sprite(0, 0, assetKeys.goblin.idle, 0).setOrigin(0.5, UNIT_SPRITE_ORIGIN_Y);
      sprites.push(sprite);
      animationFamily = "goblin";
    } else if (entity.unit?.type === "skeleton") {
      const sprite = this.add.sprite(0, 0, assetKeys.skeleton.idle, 0).setOrigin(0.5, UNIT_SPRITE_ORIGIN_Y);
      sprites.push(sprite);
      animationFamily = "skeleton";
    } else if (entity.unit?.type === "soldier") {
      const sprite = this.add.sprite(0, 0, assetKeys.tinyRpg.soldier.idle, 0).setOrigin(0.5, UNIT_SPRITE_ORIGIN_Y);
      sprites.push(sprite);
      animationFamily = "tinySoldier";
    } else if (entity.unit?.type === "archer") {
      const sprite = this.add.sprite(0, 0, assetKeys.tinyRpg.archer.idle, 0).setOrigin(0.5, UNIT_SPRITE_ORIGIN_Y);
      sprites.push(sprite);
      animationFamily = "tinyArcher";
    } else if (entity.unit?.type === "scout") {
      const sprite = this.add.sprite(0, 0, assetKeys.tinyRpg.scout.idle, 0).setOrigin(0.5, UNIT_SPRITE_ORIGIN_Y);
      sprites.push(sprite);
      animationFamily = "tinyScout";
    } else {
      const base = this.add.sprite(0, 0, assetKeys.human.base.idle, 0).setOrigin(0.5, UNIT_SPRITE_ORIGIN_Y);
      const hair = this.add.sprite(0, 0, assetKeys.human.hair.idle, 0).setOrigin(0.5, UNIT_SPRITE_ORIGIN_Y);
      const tools = this.add.sprite(0, 0, assetKeys.human.tools.idle, 0).setOrigin(0.5, UNIT_SPRITE_ORIGIN_Y);
      sprites.push(base, hair, tools);
    }

    const spriteScale = animationFamily === "tinySoldier" || animationFamily === "tinyArcher" || animationFamily === "tinyScout" ? TINY_COMBAT_SPRITE_SCALE : UNIT_SPRITE_SCALE;
    for (const sprite of sprites) {
      sprite.setScale(spriteScale);
      container.add(sprite);
    }

    const selection = this.add.graphics();
    const health = this.add.graphics();
    container.add(selection);
    const selectionCorners = this.createSelectionCorners(container);
    container.add(health);
    return { container, sprites, selection, health, selectionCorners, animationFamily };
  }

  private createResourceView(entity: GameEntity): EntityView {
    const container = this.add.container(entity.position.x, entity.position.y);
    const sprites: Phaser.GameObjects.Sprite[] = [];
    const shadow = this.add.graphics();
    shadow.fillStyle(0x10150b, 0.22);
    shadow.fillEllipse(0, 1, 28, 10);
    container.add(shadow);

    const visual = resourceVisualFor(entity);
    if (visual) {
      const sprite = this.add.sprite(visual.x, visual.y, visual.key, visual.frame).setOrigin(visual.originX, visual.originY);
      setMaxDisplaySize(sprite, visual.maxSize);
      if (visual.tint) {
        sprite.setTint(visual.tint);
      }
      if (visual.alpha !== undefined) {
        sprite.setAlpha(visual.alpha);
      }
      sprites.push(sprite);
    } else {
      const placeholder = this.add.sprite(0, 3, assetKeys.aobMap.bush).setOrigin(0.5, 0.86);
      setMaxDisplaySize(placeholder, 36);
      placeholder.setTint(0xa6b769);
      placeholder.setAlpha(0.82);
      sprites.push(placeholder);
    }

    for (const sprite of sprites) {
      container.add(sprite);
    }
    const selection = this.add.graphics();
    const health = this.add.graphics();
    container.add(selection);
    const selectionCorners = this.createSelectionCorners(container);
    container.add(health);
    return { container, sprites, selection, health, selectionCorners };
  }

  private createBuildingView(entity: GameEntity): EntityView {
    const container = this.add.container(entity.position.x, entity.position.y);
    const ground = createGroundPad(this, entity.building?.type);
    const graphics = this.add.graphics();
    container.add(graphics);
    const sprites: Phaser.GameObjects.Sprite[] = [];

    const ownerAge = entity.ownerId ? this.simulation.state.players[entity.ownerId]?.age : undefined;
    const staticDefs = buildingSpriteDefs(entity, ownerAge ?? "genesis");
    const buildingKey = buildingAssetKey(entity);
    let staticBuildingType: BuildingType | undefined;
    if (staticDefs.length > 0) {
      for (const staticDef of staticDefs) {
        const sprite = this.add
          .sprite(staticDef.x ?? 0, staticDef.y, staticDef.key, staticDef.frame)
          .setOrigin(staticDef.originX, staticDef.originY)
          .setAlpha(staticDef.alpha ?? 1);
        setMaxDisplaySize(sprite, staticDef.maxSize);
        sprites.push(sprite);
        container.add(sprite);
      }
      staticBuildingType = entity.building?.type;
    } else if (entity.building?.type === "wall") {
      const sprite = this.add.sprite(0, 0, assetKeys.aobWalls.palisadeHorizontal).setOrigin(0.5, 0.5);
      setMaxDisplaySize(sprite, 30);
      sprites.push(sprite);
      container.add(sprite);
    } else if (buildingKey) {
      const sprite = this.add.sprite(0, buildingSpriteBaselineY(entity), buildingKey).setOrigin(0.5, 1);
      setMaxDisplaySize(sprite, buildingVisualSize(entity));
      sprites.push(sprite);
      container.add(sprite);
    } else if (entity.building?.type === "enemyCamp") {
      const campfire = this.add.sprite(0, -6, assetKeys.aobMap.campfire).setOrigin(0.5, 0.82);
      const flag = this.add.sprite(18, -12, assetKeys.aobMap.flag).setOrigin(0.5, 0.9);
      setMaxDisplaySize(campfire, 38);
      setMaxDisplaySize(flag, 34);
      sprites.push(campfire, flag);
      container.add(campfire);
      container.add(flag);
    }

    const smoke = this.add.sprite(0, 0, assetKeys.elements.smoke, 0).setOrigin(0.5, 1);
    smoke.setVisible(false);
    container.add(smoke);

    const selection = this.add.graphics();
    const health = this.add.graphics();
    container.add(selection);
    const selectionCorners = this.createSelectionCorners(container);
    container.add(health);
    return {
      container,
      ground,
      sprites,
      smoke,
      graphics,
      selection,
      health,
      selectionCorners,
      staticBuildingType,
      lastBuildingSignature: buildingSpriteSignature(staticDefs),
      lastBuildingCompleted: entity.building?.completed,
    };
  }

  private createSelectionCorners(container: Phaser.GameObjects.Container): Phaser.GameObjects.Image[] {
    const corners = [
      this.add.image(0, 0, assetKeys.ui.selectBoxTl).setOrigin(0, 0),
      this.add.image(0, 0, assetKeys.ui.selectBoxTr).setOrigin(1, 0),
      this.add.image(0, 0, assetKeys.ui.selectBoxBl).setOrigin(0, 1),
      this.add.image(0, 0, assetKeys.ui.selectBoxBr).setOrigin(1, 1),
    ];
    for (const corner of corners) {
      corner.setVisible(false);
      corner.setScale(1.8);
      container.add(corner);
    }
    return corners;
  }

  private updateEntityView(entity: GameEntity, view: EntityView): void {
    view.container.setPosition(entity.position.x, entity.position.y);
    view.container.setDepth(entity.position.y);
    this.updateFacing(entity, view);
    this.updateAnimation(entity, view);
    if (entity.resourceNode) {
      this.updateResourceSprites(entity, view);
    }
    if (view.graphics && entity.building) {
      const ownerAge = entity.ownerId ? this.simulation.state.players[entity.ownerId]?.age : undefined;
      this.updateBuildingGround(entity, view, ownerAge ?? "genesis");
      drawBuilding(view.graphics, entity, view.sprites.length > 0, ownerAge);
      this.updateBuildingSprites(entity, view, ownerAge);
      this.updateBuildingSmoke(entity, view);
      this.updateBuildingCompletionEffect(entity, view);
    }
    this.drawSelection(entity, view);
    this.drawHealth(entity, view);
  }

  private updateAnimation(entity: GameEntity, view: EntityView): void {
    if (!view.animationFamily) {
      return;
    }
    const action = actionForEntity(entity, this.simulation.state.entities);
    const animationKey = `${view.animationFamily}-${action}`;
    if (view.lastAnimation === animationKey) {
      return;
    }
    view.lastAnimation = animationKey;
    if (view.animationFamily === "human") {
      for (const sprite of view.sprites) {
        const part = sprite.texture.key.includes("base") ? "base" : sprite.texture.key.includes("hair") ? "hair" : "tools";
        sprite.play(`human-${part}-${action}`, true);
      }
      return;
    }
    if (view.animationFamily === "tinySoldier" || view.animationFamily === "tinyArcher" || view.animationFamily === "tinyScout") {
      view.sprites[0]?.play(`${view.animationFamily}-${tinyCombatAction(action)}`, true);
      return;
    }
    for (const sprite of view.sprites) {
      sprite.play(animationKey, true);
    }
  }

  private updateFacing(entity: GameEntity, view: EntityView): void {
    if (!view.animationFamily) {
      return;
    }

    const facing = facingForEntity(entity, this.simulation.state.entities) ?? view.facingX ?? 1;
    view.facingX = facing;
    for (const sprite of view.sprites) {
      sprite.setFlipX(facing < 0);
    }
  }

  private playCombatEvents(): void {
    for (const event of this.simulation.state.combatEvents) {
      if (event.id <= this.lastCombatEventId) {
        continue;
      }
      if (event.kind === "arrow") {
        this.playArrowProjectile(event);
      } else {
        this.playHitSpark(event.target, event.damage, false);
      }
      this.lastCombatEventId = Math.max(this.lastCombatEventId, event.id);
    }
  }

  private playBuildingEvents(): void {
    for (const event of this.simulation.state.buildingEvents) {
      if (event.id <= this.lastBuildingEventId) {
        continue;
      }
      if (event.kind === "destroyed") {
        this.spawnBuildingRuin(event);
      }
      this.lastBuildingEventId = Math.max(this.lastBuildingEventId, event.id);
    }
  }

  private spawnBuildingRuin(event: BuildingEvent): void {
    const visual = buildingRuinVisualForType(event.buildingType);
    if (!visual || this.ruinViews.has(event.id)) {
      return;
    }

    const baselineY = event.footprint.h * TILE_SIZE * 0.5 + 2;
    const sprite = this.add
      .image(event.position.x, event.position.y + baselineY + visual.y, visual.key)
      .setOrigin(visual.originX, visual.originY)
      .setDepth(event.position.y + baselineY - 3)
      .setAlpha(0);
    setMaxDisplaySize(sprite, visual.maxSize);
    this.ruinViews.set(event.id, { sprite });

    this.tweens.add({
      targets: sprite,
      alpha: visual.alpha,
      duration: 180,
      ease: "Cubic.easeOut",
    });
  }

  private playArrowProjectile(event: CombatEvent): void {
    const source = { x: event.source.x, y: event.source.y - 26 };
    const target = { x: event.target.x, y: event.target.y - 20 };
    const distance = Phaser.Math.Distance.Between(source.x, source.y, target.x, target.y);
    const arrow = this.add.image(source.x, source.y, assetKeys.tinyRpg.arrow).setOrigin(0.5, 0.5);
    arrow.setDepth(Math.max(source.y, target.y) + 60);
    arrow.setScale(0.9);
    arrow.setRotation(Phaser.Math.Angle.Between(source.x, source.y, target.x, target.y));

    this.tweens.add({
      targets: arrow,
      x: target.x,
      y: target.y,
      duration: Phaser.Math.Clamp(distance * 2.2, 130, 360),
      ease: "Linear",
      onComplete: () => {
        arrow.destroy();
        this.playHitSpark(target, event.damage, true);
      },
    });
  }

  private playHitSpark(point: Vec2, damage: number, ranged: boolean): void {
    const graphics = this.add.graphics();
    graphics.setPosition(point.x, point.y - 16);
    graphics.setDepth(point.y + 72);
    const color = ranged ? 0x7ff3ff : 0xffd66d;
    graphics.fillStyle(color, ranged ? 0.2 : 0.16);
    graphics.fillCircle(0, 0, ranged ? 9 : 7);
    graphics.lineStyle(2, color, 0.9);
    graphics.strokeCircle(0, 0, ranged ? 9 : 7);
    graphics.lineBetween(-6, 0, 6, 0);
    graphics.lineBetween(0, -6, 0, 6);

    const label = this.add
      .text(point.x, point.y - 30, `-${Math.ceil(damage)}`, {
        fontFamily: "Trebuchet MS, Verdana, sans-serif",
        fontSize: "12px",
        color: ranged ? "#dffcff" : "#ffe0a0",
        stroke: "#1b1210",
        strokeThickness: 3,
      })
      .setOrigin(0.5, 0.5)
      .setDepth(point.y + 74);

    this.tweens.add({
      targets: graphics,
      alpha: 0,
      scale: 1.8,
      duration: 360,
      ease: "Cubic.easeOut",
      onComplete: () => graphics.destroy(),
    });
    this.tweens.add({
      targets: label,
      y: label.y - 14,
      alpha: 0,
      duration: 620,
      ease: "Cubic.easeOut",
      onComplete: () => label.destroy(),
    });
  }

  private updateBuildingSprites(entity: GameEntity, view: EntityView, ownerAge: AgeId | undefined): void {
    if (entity.building?.type === "wall") {
      this.updateWallSprite(entity, view, ownerAge ?? "genesis");
      return;
    }

    if (view.staticBuildingType && entity.building) {
      this.updateStaticBuildingSprite(entity, view, ownerAge ?? "genesis");
      return;
    }

    for (const sprite of view.sprites) {
      sprite.clearTint();
      sprite.setAlpha(entity.building?.completed ? 1 : 0.55);
      if (entity.building) {
        sprite.setOrigin(0.5, 1);
        sprite.setY(buildingSpriteBaselineY(entity));
      }
      if (entity.building?.completed && entity.ownerId === PLAYER_ID) {
        if (ownerAge === "settlement") {
          sprite.setTint(0xfff0dc);
        } else if (ownerAge === "network") {
          sprite.setTint(0xdffbff);
        }
      }
      if (entity.farm?.depleted) {
        sprite.setTint(0x8d8276);
        sprite.setAlpha(0.78);
      }
    }
  }

  private updateBuildingGround(entity: GameEntity, view: EntityView, ownerAge: AgeId): void {
    const ground = view.ground;
    if (!entity.building || !ground) {
      return;
    }

    if (entity.building.type === "wall" || entity.building.type === "enemyCamp") {
      ground.setVisible(false);
      return;
    }

    const bounds = buildingGroundBoundsForType(entity.building.type, ownerAge);
    const centerY = bounds.y + bounds.height / 2;
    ground.setVisible(true);
    ground.setDepth(GROUND_PAD_DEPTH);
    ground.setPosition(entity.position.x, entity.position.y + centerY);
    ground.setSize(bounds.width, bounds.height);
    ground.setDisplaySize(bounds.width, bounds.height);
    ground.setAlpha(entity.building.completed ? 0.24 : 0.42);
  }

  private updateStaticBuildingSprite(entity: GameEntity, view: EntityView, ownerAge: AgeId): void {
    if (!entity.building || !view.staticBuildingType) {
      return;
    }

    const spriteDefs = buildingSpriteDefs(entity, ownerAge);
    if (spriteDefs.length === 0) {
      return;
    }

    this.ensureBuildingSprites(view, spriteDefs);
    view.lastBuildingSignature = buildingSpriteSignature(spriteDefs);

    for (let index = 0; index < spriteDefs.length; index += 1) {
      const sprite = view.sprites[index];
      const spriteDef = spriteDefs[index];
      if (!sprite || !spriteDef) {
        continue;
      }

      if (sprite.texture.key !== spriteDef.key || sprite.frame.name !== spriteDef.frame) {
        sprite.setTexture(spriteDef.key, spriteDef.frame);
      }

      sprite.setVisible(true);
      sprite.clearTint();
      sprite.setAlpha(spriteDef.alpha ?? (entity.building.completed ? 1 : 0.48));
      sprite.setOrigin(spriteDef.originX, spriteDef.originY);
      sprite.setPosition(spriteDef.x ?? 0, spriteDef.y);
      setMaxDisplaySize(sprite, spriteDef.maxSize);
      this.updateBuildingSpriteAnimation(entity, sprite);

      if (entity.farm?.depleted) {
        sprite.setTint(0x8d8276);
        sprite.setAlpha(0.78);
      }
    }
  }

  private ensureBuildingSprites(view: EntityView, spriteDefs: BuildingSpriteDef[]): void {
    while (view.sprites.length < spriteDefs.length) {
      const spriteDef = spriteDefs[view.sprites.length];
      const sprite = this.add.sprite(0, 0, spriteDef?.key ?? assetKeys.tiles, spriteDef?.frame);
      view.sprites.push(sprite);
      view.container.addAt(sprite, Math.max(1, view.sprites.length));
    }

    for (let index = spriteDefs.length; index < view.sprites.length; index += 1) {
      view.sprites[index]?.setVisible(false);
    }
  }

  private updateBuildingSpriteAnimation(entity: GameEntity, sprite: Phaser.GameObjects.Sprite): void {
    if (!entity.building?.completed) {
      sprite.stop();
      return;
    }
    if (entity.building.type === "mill" && sprite.texture.key === assetKeys.elements.windmill) {
      sprite.play("element-windmill-idle", true);
    }
  }

  private updateBuildingSmoke(entity: GameEntity, view: EntityView): void {
    const smoke = view.smoke;
    if (!smoke || !entity.building) {
      return;
    }
    if (!USE_BUILDING_SMOKE) {
      smoke.setVisible(false);
      smoke.stop();
      return;
    }

    const smokeDef = smokeDefForBuilding(entity.building.type);
    const buildingSprite = view.sprites[0];
    if (!entity.building.completed || !smokeDef || !buildingSprite?.visible) {
      smoke.setVisible(false);
      smoke.stop();
      return;
    }

    smoke.setVisible(true);
    smoke.setPosition(
      buildingSprite.x + buildingSprite.displayWidth * smokeDef.xFactor,
      buildingSprite.y - buildingSprite.displayHeight * smokeDef.yFactor,
    );
    smoke.setTint(0xf4fbff);
    smoke.setAlpha(smokeDef.alpha);
    setMaxDisplaySize(smoke, smokeDef.maxSize);
    smoke.play("element-smoke-idle", true);
  }

  private updateBuildingCompletionEffect(entity: GameEntity, view: EntityView): void {
    if (!entity.building) {
      view.container.setScale(1);
      return;
    }
    if (!USE_BUILDING_COMPLETION_BOUNCE) {
      view.lastBuildingCompleted = entity.building.completed;
      view.completionEffectStartedAt = undefined;
      view.container.setScale(1);
      return;
    }

    if (view.lastBuildingCompleted === false && entity.building.completed) {
      view.completionEffectStartedAt = this.time.now;
      this.playUiClick(720, 0.014);
    }
    view.lastBuildingCompleted = entity.building.completed;

    if (view.completionEffectStartedAt === undefined) {
      view.container.setScale(1);
      return;
    }

    const elapsed = this.time.now - view.completionEffectStartedAt;
    const duration = 420;
    if (elapsed >= duration) {
      view.completionEffectStartedAt = undefined;
      view.container.setScale(1);
      return;
    }

    const t = elapsed / duration;
    const bounce = Math.sin(t * Math.PI) * (1 - t);
    view.container.setScale(1 + bounce * 0.08, 1 - bounce * 0.045);
  }

  private updateWallSprite(entity: GameEntity, view: EntityView, ownerAge: AgeId): void {
    const sprite = view.sprites[0];
    if (!sprite || !entity.building) {
      return;
    }

    const visual = wallVisualFor(entity);
    if (!visual.visible) {
      sprite.setVisible(false);
      return;
    }

    if (sprite.texture.key !== visual.textureKey) {
      sprite.setTexture(visual.textureKey);
    }

    sprite.setVisible(true);
    sprite.clearTint();
    const tier = wallTierForAge(ownerAge);
    if (tier.id === "stone") {
      sprite.setTint(0xe0ddd0);
    } else if (tier.id === "reinforced") {
      sprite.setTint(0xdffcff);
    }
    sprite.setAlpha(entity.building.completed ? 1 : 0.58);
    sprite.setOrigin(0.5, 0.5);
    sprite.setPosition(visual.x ?? 0, visual.y ?? 0);
    sprite.setFlipX(Boolean(visual.flipX));
    sprite.setFlipY(Boolean(visual.flipY));
    sprite.setDisplaySize(visual.width, visual.height);
  }

  private updateResourceSprites(entity: GameEntity, view: EntityView): void {
    const visual = resourceVisualFor(entity);
    const sprite = view.sprites[0];
    if (!visual || !sprite) {
      return;
    }
    if (sprite.texture.key !== visual.key || sprite.frame.name !== visual.frame) {
      sprite.setTexture(visual.key, visual.frame);
    }
    sprite.setPosition(visual.x, visual.y);
    sprite.setOrigin(visual.originX, visual.originY);
    setMaxDisplaySize(sprite, visual.maxSize);
    sprite.clearTint();
    if (visual.tint) {
      sprite.setTint(visual.tint);
    }
    sprite.setAlpha(visual.alpha ?? 1);
  }

  private drawSelection(entity: GameEntity, view: EntityView): void {
    view.selection.clear();
    this.hideSelectionCorners(view);
    const selected = this.simulation.state.selection.selectedIds.includes(entity.id);
    const hovered = this.hoveredEntityId === entity.id;
    const constructing = Boolean(entity.ownerId === PLAYER_ID && entity.building && entity.building.type !== "wall" && !entity.building.completed);
    if (!selected && !hovered && !constructing) {
      return;
    }
    const color = entity.kind === "resource" ? 0xe7c86b : entity.ownerId === PLAYER_ID ? 0xd8d2b4 : 0xe85a4a;
    const alpha = selected ? 0.78 : 0.38;
    if (entity.building) {
      const ownerAge = entity.ownerId ? this.simulation.state.players[entity.ownerId]?.age ?? "genesis" : "genesis";
      const bounds = buildingInteractionBounds(entity, ownerAge);
      this.showSelectionCorners(view, bounds, color, selected ? 1 : constructing ? 0.72 : alpha, selected || constructing);
      return;
    }
    if (selected) {
      view.selection.fillStyle(color, entity.resourceNode ? 0.08 : 0.1);
      view.selection.fillEllipse(0, 2, entity.resourceNode ? 28 : 20, entity.resourceNode ? 11 : 8);
    }
    view.selection.lineStyle(selected ? 2 : 1, color, alpha);
    view.selection.strokeEllipse(0, 2, entity.resourceNode ? 30 : 21, entity.resourceNode ? 12 : 9);
  }

  private showSelectionCorners(view: EntityView, bounds: { x: number; y: number; width: number; height: number }, color: number, alpha: number, animated = false): void {
    const corners = view.selectionCorners;
    if (!corners || corners.length < 4) {
      return;
    }
    const [topLeft, topRight, bottomLeft, bottomRight] = corners;
    const pulse = animated ? 1 + Math.sin(this.time.now * 0.008) * 0.08 : 1;
    const drift = animated ? 2 + Math.sin(this.time.now * 0.012) * 1.2 : 0;
    topLeft.setPosition(bounds.x - drift, bounds.y - drift);
    topRight.setPosition(bounds.x + bounds.width + drift, bounds.y - drift);
    bottomLeft.setPosition(bounds.x - drift, bounds.y + bounds.height + drift);
    bottomRight.setPosition(bounds.x + bounds.width + drift, bounds.y + bounds.height + drift);
    for (const corner of corners) {
      corner.setVisible(true);
      corner.setTint(color);
      corner.setAlpha(alpha);
      corner.setScale(1.8 * pulse);
    }
  }

  private hideSelectionCorners(view: EntityView): void {
    for (const corner of view.selectionCorners ?? []) {
      corner.setVisible(false);
    }
  }

  private drawHealth(entity: GameEntity, view: EntityView): void {
    view.health.clear();
    if (!entity.health) {
      return;
    }
    const selected = this.simulation.state.selection.selectedIds.includes(entity.id);
    const shouldDraw = entity.building ? entity.health.current < entity.health.max : entity.health.current < entity.health.max || selected;
    if (!shouldDraw) {
      return;
    }
    const width = entity.building ? Math.max(28, entity.building.footprint.w * TILE_SIZE) : 24;
    const y = entity.building ? buildingHealthBarY(entity) : -39;
    const ratio = Phaser.Math.Clamp(entity.health.current / entity.health.max, 0, 1);
    view.health.fillStyle(0x251914, 0.9);
    view.health.fillRect(-width / 2, y, width, 4);
    view.health.fillStyle(entity.ownerId === PLAYER_ID ? 0x7fd65c : 0xd85a4c, 0.95);
    view.health.fillRect(-width / 2, y, width * ratio, 4);
  }

  private drawDragRect(pointer: Phaser.Input.Pointer): void {
    this.dragGraphics?.clear();
    if (!this.dragStartWorld || !this.dragStartScreen || this.placementType) {
      return;
    }
    const screenDistance = Phaser.Math.Distance.Between(this.dragStartScreen.x, this.dragStartScreen.y, pointer.x, pointer.y);
    if (screenDistance < 6) {
      return;
    }
    const x = Math.min(this.dragStartWorld.x, pointer.worldX);
    const y = Math.min(this.dragStartWorld.y, pointer.worldY);
    const width = Math.abs(pointer.worldX - this.dragStartWorld.x);
    const height = Math.abs(pointer.worldY - this.dragStartWorld.y);
    this.dragGraphics?.fillStyle(0x69c936, 0.24);
    this.dragGraphics?.fillRect(x, y, width, height);
    this.dragGraphics?.lineStyle(1, 0x9cff70, 0.95);
    this.dragGraphics?.strokeRect(x, y, width, height);
  }

  private handlePrimaryClick(pointer: Phaser.Input.Pointer): void {
    if (this.placementType) {
      this.confirmPlacement(pointer);
      return;
    }

    const wasDrag = this.dragStartScreen ? Phaser.Math.Distance.Between(this.dragStartScreen.x, this.dragStartScreen.y, pointer.x, pointer.y) > 6 : false;
    if (wasDrag && this.dragStartWorld) {
      const ids = this.entitiesInRect(this.dragStartWorld, { x: pointer.worldX, y: pointer.worldY });
      this.simulation.dispatch({
        type: "selectUnits",
        playerId: PLAYER_ID,
        entityIds: ids,
      });
    } else {
      const target = this.getEntityAt({ x: pointer.worldX, y: pointer.worldY });
      if (target && (target.ownerId === PLAYER_ID || target.kind === "resource")) {
        this.simulation.dispatch({
          type: "selectUnits",
          playerId: PLAYER_ID,
          entityIds: [target.id],
        });
      } else if (target?.ownerId && target.ownerId !== PLAYER_ID) {
        this.commandSelectedToTarget(target, { x: pointer.worldX, y: pointer.worldY });
      } else {
        this.simulation.dispatch({
          type: "selectUnits",
          playerId: PLAYER_ID,
          entityIds: [],
        });
      }
    }

    this.dragStartWorld = undefined;
    this.dragStartScreen = undefined;
    this.dragGraphics?.clear();
  }

  private handleCommandClick(pointer: Phaser.Input.Pointer): void {
    const target = this.getEntityAt({ x: pointer.worldX, y: pointer.worldY });
    if (target) {
      this.commandSelectedToTarget(target, { x: pointer.worldX, y: pointer.worldY });
    } else {
      const producer = this.getSelectedProducerBuilding();
      if (producer && this.selectedUnitIds().length === 0) {
        const rallyPoint = { x: pointer.worldX, y: pointer.worldY };
        this.simulation.dispatch({
          type: "setRallyPoint",
          playerId: PLAYER_ID,
          buildingId: producer.id,
          target: rallyPoint,
        });
        this.showCommandIndicator(rallyPoint, "rally");
        return;
      }
      if (this.selectedUnitIds().length > 0) {
        this.showCommandIndicator({ x: pointer.worldX, y: pointer.worldY }, "move");
      }
      this.simulation.dispatch({
        type: "moveUnits",
        playerId: PLAYER_ID,
        unitIds: this.selectedUnitIds(),
        target: { x: pointer.worldX, y: pointer.worldY },
      });
    }
  }

  private commandSelectedToTarget(target: GameEntity, fallback: Vec2): void {
    const selectedUnits = this.selectedUnitIds();
    if (selectedUnits.length === 0) {
      return;
    }
    if (target.ownerId === PLAYER_ID && target.building && !target.building.completed) {
      const workerIds = this.selectedWorkerIds();
      if (workerIds.length === 0) {
        return;
      }
      this.simulation.dispatch({
        type: "assignBuilders",
        playerId: PLAYER_ID,
        buildingId: target.id,
        builderIds: workerIds,
      });
      this.showCommandIndicator(target.position, "build");
      return;
    }
    if (isRepairablePlayerBuilding(target) && this.selectedWorkerIds().length > 0) {
      const workerIds = this.selectedWorkerIds();
      this.simulation.dispatch({
        type: "repairBuilding",
        playerId: PLAYER_ID,
        buildingId: target.id,
        builderIds: workerIds,
      });
      this.showCommandIndicator(target.position, "build");
      return;
    }
    if (isGatherableEntity(target)) {
      const workerIds = this.selectedWorkerIds();
      if (workerIds.length === 0) {
        return;
      }
      this.simulation.dispatch({
        type: "gatherResource",
        playerId: PLAYER_ID,
        unitIds: workerIds,
        resourceId: target.id,
      });
      this.showCommandIndicator(target.position, "gather");
      return;
    }
    if (target.ownerId && target.ownerId !== PLAYER_ID) {
      this.simulation.dispatch({
        type: "attackTarget",
        playerId: PLAYER_ID,
        unitIds: selectedUnits,
        targetId: target.id,
      });
      this.showCommandIndicator(target.position, "attack");
      return;
    }
    this.showCommandIndicator(fallback, "move");
    this.simulation.dispatch({
      type: "moveUnits",
      playerId: PLAYER_ID,
      unitIds: selectedUnits,
      target: fallback,
    });
  }

  private confirmPlacement(pointer: Phaser.Input.Pointer): void {
    if (!this.placementType) {
      return;
    }
    const tile = worldToTile({ x: pointer.worldX, y: pointer.worldY });
    if (this.placementType === "wall") {
      this.finishWallDrag(pointer);
      return;
    }
    if (!canPlaceBuildingAt(this.simulation.state, this.placementType, tile)) {
      return;
    }
    this.simulation.dispatch({
      type: "buildStructure",
      playerId: PLAYER_ID,
      buildingType: this.placementType,
      tile,
      builderIds: this.selectedWorkerIds(),
    });
    this.showCommandIndicator(
      {
        x: (tile.x + buildingConfigs[this.placementType].footprint.w / 2) * TILE_SIZE,
        y: (tile.y + buildingConfigs[this.placementType].footprint.h / 2) * TILE_SIZE,
      },
      "build",
    );
    this.cancelPlacement();
    this.dragStartWorld = undefined;
    this.dragStartScreen = undefined;
  }

  private startWallDrag(pointer: Phaser.Input.Pointer): void {
    const tile = worldToTile({ x: pointer.worldX, y: pointer.worldY });
    this.wallDragStartTile = tile;
    this.wallDraft = { points: [tile] };
    this.clearSelectionDrag();
  }

  private finishWallDrag(pointer: Phaser.Input.Pointer): void {
    if (this.placementType !== "wall" || !this.wallDragStartTile) {
      this.clearWallDraft();
      return;
    }
    const start = this.wallDragStartTile;
    const hover = worldToTile({ x: pointer.worldX, y: pointer.worldY });
    const end = normalizeWallLineEnd(start, hover, this.wallOrientationMode);
    if (sameTile(start, end)) {
      this.clearWallDraft();
      return;
    }

    const segments = wallLineSegments(start, end);
    if (!this.confirmWallSegments(segments)) {
      this.playUiClick(210, 0.018);
    }
    this.clearWallDraft();
  }

  private confirmWallDraft(): void {
    if (this.placementType !== "wall" || !this.wallDraft) {
      return;
    }
    const segments = wallSegmentsForDraftPoints(this.wallDraft.points);
    if (!this.confirmWallSegments(segments)) {
      this.playUiClick(210, 0.018);
      return;
    }
    this.clearWallDraft();
  }

  private confirmWallSegments(segments: WallLineSegment[]): boolean {
    if (this.placementType !== "wall" || segments.length === 0 || !canPlaceWallSegmentsAt(this.simulation.state, segments)) {
      return false;
    }
    this.simulation.dispatch({
      type: "buildWallPath",
      playerId: PLAYER_ID,
      segments,
      builderIds: this.selectedWorkerIds(),
    });

    const middle = segments[Math.floor(segments.length / 2)];
    if (middle) {
      this.showCommandIndicator(
        {
          x: (middle.tile.x + middle.footprint.w / 2) * TILE_SIZE,
          y: (middle.tile.y + middle.footprint.h / 2) * TILE_SIZE,
        },
        "build",
      );
    }
    return true;
  }

  private updatePlacementPreview(): void {
    this.placementGraphics?.clear();
    if (!this.placementType) {
      this.hidePlacementPreviewGround();
      this.hidePlacementPreviewSprite();
      this.hideWallPlacementPreview();
      return;
    }
    const pointer = this.input.activePointer;
    const tile = worldToTile({ x: pointer.worldX, y: pointer.worldY });
    if (this.placementType === "wall") {
      this.hidePlacementPreviewGround();
      this.hidePlacementPreviewSprite();
      this.updateWallPlacementPreview(tile);
      return;
    }
    this.hideWallPlacementPreview();
    const config = buildingConfigs[this.placementType];
    const playerAge = this.simulation.state.players[PLAYER_ID].age;
    const valid = canPlaceBuildingAt(this.simulation.state, this.placementType, tile);
    const centerX = (tile.x + config.footprint.w / 2) * TILE_SIZE;
    const centerY = (tile.y + config.footprint.h / 2) * TILE_SIZE;
    const bounds = buildingGroundBoundsForType(this.placementType, playerAge);
    this.updatePlacementPreviewGround(this.placementType, centerX, centerY, valid);
    this.updatePlacementPreviewSprite(this.placementType, tile, valid);
    if (this.placementGraphics) {
      drawWorldCornerBrackets(this.placementGraphics, bounds.x + centerX, bounds.y + centerY, bounds.width, bounds.height, valid ? 0xe6d58a : 0xe66a58, valid ? 0.78 : 0.72, 2);
    }
  }

  private updateRallyMarker(): void {
    this.rallyGraphics?.clear();
    const building = this.getSelectedProducerBuilding();
    const rallyPoint = building?.producer?.rallyPoint;
    if (!building || !rallyPoint || !this.rallyGraphics) {
      return;
    }

    this.rallyGraphics.lineStyle(1, 0x67e4e9, 0.5);
    this.rallyGraphics.lineBetween(building.position.x, building.position.y, rallyPoint.x, rallyPoint.y);
    this.rallyGraphics.fillStyle(0x0b1719, 0.62);
    this.rallyGraphics.fillCircle(rallyPoint.x, rallyPoint.y, 12);
    this.rallyGraphics.lineStyle(2, 0x67e4e9, 0.92);
    this.rallyGraphics.strokeCircle(rallyPoint.x, rallyPoint.y, 12);
    this.rallyGraphics.lineBetween(rallyPoint.x, rallyPoint.y - 13, rallyPoint.x, rallyPoint.y + 10);
    this.rallyGraphics.fillStyle(0x9a5cff, 0.92);
    this.rallyGraphics.fillTriangle(rallyPoint.x + 1, rallyPoint.y - 12, rallyPoint.x + 13, rallyPoint.y - 7, rallyPoint.x + 1, rallyPoint.y - 2);
  }

  private updatePlacementPreviewSprite(type: BuildingType, tile: TileCoord, valid: boolean): void {
    const age = this.simulation.state.players[PLAYER_ID].age;
    const previewDef = buildingPreviewSpriteDef(type, age, tile);
    if (!previewDef) {
      this.hidePlacementPreviewSprite();
      return;
    }

    const config = buildingConfigs[type];
    const x = (tile.x + config.footprint.w / 2) * TILE_SIZE;
    const y = (tile.y + config.footprint.h / 2) * TILE_SIZE + previewDef.y;
    if (!this.placementPreviewSprite) {
      this.placementPreviewSprite = this.add.sprite(x, y, previewDef.key, previewDef.frame).setOrigin(previewDef.originX, previewDef.originY).setDepth(10_000);
    } else if (this.placementPreviewSprite.texture.key !== previewDef.key || this.placementPreviewSprite.frame.name !== previewDef.frame) {
      this.placementPreviewSprite.setTexture(previewDef.key, previewDef.frame);
    }

    this.placementPreviewSprite.setVisible(true);
    this.placementPreviewSprite.setPosition(x, y);
    this.placementPreviewSprite.setOrigin(previewDef.originX, previewDef.originY);
    this.placementPreviewSprite.setAlpha(valid ? 0.72 : 0.5);
    this.placementPreviewSprite.clearTint();
    if (!valid) {
      this.placementPreviewSprite.setTint(0xff9b8a);
    }
    setMaxDisplaySize(this.placementPreviewSprite, previewDef.maxSize);
  }

  private hidePlacementPreviewSprite(): void {
    this.placementPreviewSprite?.setVisible(false);
  }

  private updatePlacementPreviewGround(type: BuildingType, centerX: number, centerY: number, valid: boolean): void {
    if (!USE_BUILDING_GROUND_PADS) {
      this.hidePlacementPreviewGround();
      return;
    }

    const age = this.simulation.state.players[PLAYER_ID].age;
    const bounds = buildingGroundBoundsForType(type, age);
    if (!this.placementPreviewGround) {
      const groundTexture = groundPadTexture();
      this.placementPreviewGround = this.add
        .tileSprite(centerX, centerY + bounds.y + bounds.height / 2, bounds.width, bounds.height, groundTexture.key, groundTexture.frame)
        .setOrigin(0.5, 0.5)
        .setDepth(GROUND_PAD_DEPTH);
    }

    this.placementPreviewGround.setVisible(true);
    this.placementPreviewGround.setPosition(centerX, centerY + bounds.y + bounds.height / 2);
    this.placementPreviewGround.setSize(bounds.width, bounds.height);
    this.placementPreviewGround.setDisplaySize(bounds.width, bounds.height);
    this.placementPreviewGround.setAlpha(valid ? 0.28 : 0.2);
    this.placementPreviewGround.clearTint();
    if (!valid) {
      this.placementPreviewGround.setTint(0xf0a090);
    }
  }

  private hidePlacementPreviewGround(): void {
    this.placementPreviewGround?.setVisible(false);
  }

  private updateWallPlacementPreview(hoverTile: TileCoord): void {
    const points = this.wallDraftPreviewPoints(hoverTile);
    const segments = wallSegmentsForDraftPoints(points);
    const valid = segments.length > 0 && canPlaceWallSegmentsAt(this.simulation.state, segments);
    this.updateWallPreviewSprites(wallSegmentSpriteVisuals(segments), valid);
  }

  private wallDraftPreviewSegments(hoverTile?: TileCoord): WallLineSegment[] {
    return wallSegmentsForDraftPoints(this.wallDraftPreviewPoints(hoverTile));
  }

  private wallDraftPreviewPoints(hoverTile?: TileCoord): TileCoord[] {
    if (this.placementType !== "wall") {
      return [];
    }
    const pointerTile = hoverTile ?? worldToTile({ x: this.input.activePointer.worldX, y: this.input.activePointer.worldY });
    if (!this.wallDraft) {
      return [pointerTile, pointerTile];
    }
    const lastPoint = this.wallDraft.points.at(-1);
    if (!lastPoint) {
      return [];
    }
    const previewEnd = normalizeWallLineEnd(lastPoint, pointerTile, this.wallOrientationMode);
    return sameTile(previewEnd, lastPoint) ? this.wallDraft.points : [...this.wallDraft.points, previewEnd];
  }

  private updateWallPreviewSprites(visuals: WallSpriteVisual[], valid: boolean): void {
    for (let index = 0; index < visuals.length; index += 1) {
      const visual = visuals[index];
      let sprite = this.wallPreviewSprites[index];
      if (!sprite) {
        sprite = this.add.sprite(visual.x, visual.y, visual.textureKey).setOrigin(0.5, 0.5).setDepth(10_000 + index);
        this.wallPreviewSprites[index] = sprite;
      } else if (sprite.texture.key !== visual.textureKey) {
        sprite.setTexture(visual.textureKey);
      }
      sprite.setVisible(true);
      sprite.setPosition(visual.x, visual.y);
      sprite.setAlpha(valid ? 0.58 : 0.44);
      sprite.clearTint();
      if (!valid) {
        sprite.setTint(0xff7567);
      }
      sprite.setFlipX(Boolean(visual.flipX));
      sprite.setFlipY(Boolean(visual.flipY));
      sprite.setDisplaySize(visual.width, visual.height);
    }

    for (let index = visuals.length; index < this.wallPreviewSprites.length; index += 1) {
      this.wallPreviewSprites[index]?.setVisible(false);
    }
  }

  private hideWallPlacementPreview(): void {
    for (const sprite of this.wallPreviewSprites) {
      sprite.setVisible(false);
    }
  }

  private getEntityAt(point: Vec2): GameEntity | undefined {
    const entities = Object.values(this.simulation.state.entities)
      .filter((entity) => entity.ownerId === PLAYER_ID || isWorldPositionExplored(this.simulation.state, entity.position))
      .filter((entity) => hitTestEntity(entity, point, this.simulation.state.players[entity.ownerId ?? PLAYER_ID]?.age))
      .sort((a, b) => b.position.y - a.position.y);
    return entities[0];
  }

  private entitiesInRect(a: Vec2, b: Vec2): EntityId[] {
    const left = Math.min(a.x, b.x);
    const right = Math.max(a.x, b.x);
    const top = Math.min(a.y, b.y);
    const bottom = Math.max(a.y, b.y);
    return Object.values(this.simulation.state.entities)
      .filter((entity) => entity.ownerId === PLAYER_ID && entity.kind === "unit")
      .filter((entity) => entity.position.x >= left && entity.position.x <= right && entity.position.y >= top && entity.position.y <= bottom)
      .map((entity) => entity.id);
  }

  private selectedUnitIds(): EntityId[] {
    return this.simulation.state.selection.selectedIds.filter((id) => {
      const entity = this.simulation.state.entities[id];
      return entity?.kind === "unit" && entity.ownerId === PLAYER_ID;
    });
  }

  private selectedWorkerIds(): EntityId[] {
    return this.simulation.state.selection.selectedIds.filter((id) => {
      const entity = this.simulation.state.entities[id];
      return Boolean(entity?.worker && entity.ownerId === PLAYER_ID);
    });
  }

  private getSelectedBuilding(type?: BuildingType): GameEntity | undefined {
    return this.simulation.state.selection.selectedIds
      .map((id) => this.simulation.state.entities[id])
      .find((entity) => entity?.building && entity.ownerId === PLAYER_ID && (!type || entity.building.type === type));
  }

  private getSelectedProducerBuilding(): GameEntity | undefined {
    return this.simulation.state.selection.selectedIds
      .map((id) => this.simulation.state.entities[id])
      .find((entity) => entity?.producer && entity.building?.completed && entity.ownerId === PLAYER_ID);
  }

  private updateCursor(): void {
    if (this.isPanning) {
      this.setCursor("grabbing");
      return;
    }

    const pointer = this.input.activePointer;
    if (this.placementType) {
      const tile = worldToTile({ x: pointer.worldX, y: pointer.worldY });
      const wallSegments = this.placementType === "wall" ? this.wallDraftPreviewSegments(tile) : [];
      const valid = this.placementType === "wall" ? wallSegments.length > 0 && canPlaceWallSegmentsAt(this.simulation.state, wallSegments) : canPlaceBuildingAt(this.simulation.state, this.placementType, tile);
      this.setCursor(valid ? "copy" : "not-allowed");
      return;
    }

    if (this.keys.SPACE?.isDown) {
      this.setCursor("grab");
      return;
    }

    const selectedUnits = this.selectedUnitIds();
    if (selectedUnits.length === 0) {
      if (this.getSelectedProducerBuilding()) {
        this.setCursor("crosshair");
        return;
      }
      this.setCursor("default");
      return;
    }

    const hover = this.getEntityAt({ x: pointer.worldX, y: pointer.worldY });
    if (hover?.ownerId && hover.ownerId !== PLAYER_ID) {
      this.setCursor("crosshair");
      return;
    }
    if (hover?.ownerId === PLAYER_ID && hover.building && !hover.building.completed && this.selectedWorkerIds().length > 0) {
      this.setCursor("cell");
      return;
    }
    if (hover && isRepairablePlayerBuilding(hover) && this.selectedWorkerIds().length > 0) {
      this.setCursor("cell");
      return;
    }
    if (hover && isGatherableEntity(hover) && this.selectedWorkerIds().length > 0) {
      this.setCursor("pointer");
      return;
    }

    this.setCursor("pointer");
  }

  private setCursor(cursor: string): void {
    if (this.currentCursor === cursor) {
      return;
    }
    this.currentCursor = cursor;
    this.input.setDefaultCursor(SUNNYSIDE_CURSOR_CSS[cursor] ?? cursor);
  }

  private showCommandIndicator(point: Vec2, kind: "move" | "attack" | "gather" | "build" | "rally"): void {
    const graphics = this.add.graphics();
    graphics.setPosition(point.x, point.y);
    graphics.setDepth(20_000);

    switch (kind) {
      case "attack":
        graphics.fillStyle(0xff5b4d, 0.16);
        graphics.fillCircle(0, 0, 12);
        graphics.lineStyle(2, 0xff5b4d, 0.95);
        graphics.strokeCircle(0, 0, 12);
        graphics.lineBetween(-7, -7, 7, 7);
        graphics.lineBetween(7, -7, -7, 7);
        break;
      case "gather":
        graphics.fillStyle(0x88e35f, 0.14);
        graphics.fillCircle(0, 0, 11);
        graphics.lineStyle(2, 0x88e35f, 0.95);
        graphics.strokeCircle(0, 0, 10);
        graphics.lineBetween(0, -13, 8, -3);
        graphics.lineBetween(8, -3, 0, 7);
        graphics.lineBetween(0, 7, -8, -3);
        graphics.lineBetween(-8, -3, 0, -13);
        break;
      case "build":
        graphics.fillStyle(0xf0c45d, 0.14);
        graphics.fillRect(-12, -9, 24, 18);
        graphics.lineStyle(2, 0xf0c45d, 0.95);
        graphics.strokeRect(-12, -9, 24, 18);
        graphics.lineBetween(-14, -9, 0, -18);
        graphics.lineBetween(0, -18, 14, -9);
        break;
      case "rally":
        graphics.fillStyle(0x67e4e9, 0.14);
        graphics.fillCircle(0, 0, 12);
        graphics.lineStyle(2, 0x67e4e9, 0.95);
        graphics.strokeCircle(0, 0, 12);
        graphics.lineBetween(0, -14, 0, 9);
        graphics.fillStyle(0x9a5cff, 0.9);
        graphics.fillTriangle(1, -13, 13, -8, 1, -3);
        break;
      case "move":
      default:
        graphics.fillStyle(0xf0d65c, 0.16);
        graphics.fillCircle(0, 0, 11);
        graphics.lineStyle(2, 0xf0d65c, 0.95);
        graphics.strokeCircle(0, 0, 10);
        graphics.lineBetween(-10, 0, -3, 0);
        graphics.lineBetween(3, 0, 10, 0);
        graphics.lineBetween(0, -10, 0, -3);
        graphics.lineBetween(0, 3, 0, 10);
        break;
    }

    this.tweens.add({
      targets: graphics,
      alpha: 0,
      scale: 1.8,
      duration: 650,
      ease: "Cubic.easeOut",
      onComplete: () => graphics.destroy(),
    });
  }
}

const sunnysideBuildingFrames: Record<string, AtlasFrameDef> = {
  "sunnyside-building-hall-blue": { x: 320, y: 160, width: 144, height: 64, originX: 0.5, originY: 0.98 },
  "sunnyside-building-hall-green": { x: 320, y: 288, width: 144, height: 64, originX: 0.5, originY: 0.98 },
  "sunnyside-building-hall-orange": { x: 320, y: 432, width: 144, height: 64, originX: 0.5, originY: 0.98 },
  "sunnyside-building-hall-red": { x: 320, y: 560, width: 144, height: 64, originX: 0.5, originY: 0.98 },
  "sunnyside-building-hall-purple": { x: 320, y: 688, width: 144, height: 64, originX: 0.5, originY: 0.98 },
  "sunnyside-building-house-blue": { x: 520, y: 168, width: 32, height: 56, originX: 0.5, originY: 0.98 },
  "sunnyside-building-house-green": { x: 520, y: 296, width: 32, height: 56, originX: 0.5, originY: 0.98 },
  "sunnyside-building-house-orange": { x: 520, y: 424, width: 32, height: 56, originX: 0.5, originY: 0.98 },
  "sunnyside-building-house-red": { x: 520, y: 552, width: 32, height: 56, originX: 0.5, originY: 0.98 },
  "sunnyside-building-house-purple": { x: 520, y: 680, width: 32, height: 56, originX: 0.5, originY: 0.98 },
  "sunnyside-building-tower-blue": { x: 472, y: 151, width: 32, height: 99, originX: 0.5, originY: 0.98 },
  "sunnyside-building-tower-green": { x: 472, y: 279, width: 32, height: 99, originX: 0.5, originY: 0.98 },
  "sunnyside-building-tower-orange": { x: 472, y: 407, width: 32, height: 99, originX: 0.5, originY: 0.98 },
  "sunnyside-building-tower-red": { x: 472, y: 535, width: 32, height: 99, originX: 0.5, originY: 0.98 },
  "sunnyside-building-tower-purple": { x: 472, y: 663, width: 32, height: 99, originX: 0.5, originY: 0.98 },
  "sunnyside-building-workbench": { x: 595, y: 256, width: 29, height: 48, originX: 0.5, originY: 0.98 },
  "sunnyside-building-forge": { x: 628, y: 256, width: 27, height: 48, originX: 0.5, originY: 0.98 },
  "sunnyside-building-stone-machine": { x: 704, y: 292, width: 64, height: 55, originX: 0.5, originY: 0.98 },
  "sunnyside-building-wood-stack": { x: 624, y: 144, width: 32, height: 32, originX: 0.5, originY: 0.98 },
  "sunnyside-building-market-chests": { x: 576, y: 474, width: 64, height: 27, originX: 0.5, originY: 0.98 },
  "sunnyside-building-red-rug": { x: 644, y: 563, width: 41, height: 42, originX: 0.5, originY: 0.82 },
};

function sunnysideTerrainKindForTile(map: MapState, tile: TileType, x: number, y: number): SunnysideTerrainKind {
  if (tile === "water" || tile === "deepWater") {
    if (tile === "deepWater") {
      return "waterDeep";
    }
    return hasNearbyTile(map, x, y, isLandChunk, 1) ? "waterEdge" : "waterDeep";
  }
  if (tile === "stoneGround") {
    return "stone";
  }
  if (tile === "crystalGround") {
    return "crystal";
  }
  if (tile === "dirt" || tile === "path" || isSunnysideVillagePlazaTile(x, y)) {
    return "dirt";
  }
  if (hasNearbyTile(map, x, y, isWaterChunk, 1) && hash2(x, y) % 6 === 0) {
    return "dirt";
  }
  return "grass";
}

function sunnysideTerrainFrameForKind(kind: SunnysideTerrainKind, x: number, y: number): number {
  switch (kind) {
    case "waterEdge":
      return pickFrame(SUNNYSIDE_WATER_EDGE_FRAMES, x, y);
    case "waterDeep":
      return pickFrame(SUNNYSIDE_WATER_DEEP_FRAMES, x, y);
    case "stone":
      return pickFrame(SUNNYSIDE_STONE_FRAMES, x, y);
    case "crystal":
      return pickFrame(SUNNYSIDE_CRYSTAL_GROUND_FRAMES, x, y);
    case "dirt":
      return pickFrame(SUNNYSIDE_DIRT_FRAMES, x, y);
    case "grass":
    default:
      return pickFrame(SUNNYSIDE_GRASS_FRAMES, x, y);
  }
}

function pickFrame(frames: readonly number[], x: number, y: number): number {
  return frames[hash2(x, y) % frames.length] ?? frames[0] ?? 0;
}

function isSunnysideVillagePlazaTile(x: number, y: number): boolean {
  return (
    inNoisyEllipse(x, y, 59, 60, 16, 11, 0.18) ||
    inNoisyEllipse(x, y, 44, 57, 7, 5, 0.12) ||
    inNoisyEllipse(x, y, 72, 56, 8, 6, 0.12)
  );
}

function inNoisyEllipse(x: number, y: number, cx: number, cy: number, rx: number, ry: number, noise: number): boolean {
  const normalized = ((x - cx) * (x - cx)) / (rx * rx) + ((y - cy) * (y - cy)) / (ry * ry);
  const edgeNoise = ((hash2(x, y) % 100) / 100 - 0.5) * noise;
  return normalized <= 1 + edgeNoise;
}

function sunnysideBuildingBlueprintForType(type: BuildingType, age: AgeId): SunnysideBuildingBlueprint | undefined {
  const ageColor = age === "network" ? "purple" : age === "settlement" ? "green" : "blue";
  const ageHall = `sunnyside-building-hall-${ageColor}`;
  const ageHouse = `sunnyside-building-house-${ageColor}`;
  const ageTower = `sunnyside-building-tower-${ageColor}`;
  switch (type) {
    case "townCenter":
      return {
        visualSize: 222,
        parts: [
          { key: assetKeys.tiles, frame: ageHall, maxSize: 214, originX: 0.5, originY: 0.98, yOffset: 2 },
          { key: assetKeys.tiles, frame: ageTower, maxSize: 74, originX: 0.5, originY: 0.98, x: 84, yOffset: -6 },
          { key: assetKeys.tiles, frame: "sunnyside-building-wood-stack", maxSize: 42, originX: 0.5, originY: 0.98, x: -90, yOffset: 4 },
          { key: assetKeys.tiles, frame: "sunnyside-building-market-chests", maxSize: 54, originX: 0.5, originY: 0.98, x: 88, yOffset: 7 },
        ],
      };
    case "house":
      return {
        visualSize: 74,
        parts: [{ key: assetKeys.tiles, frame: ageHouse, maxSize: 74, originX: 0.5, originY: 0.98, yOffset: 1 }],
      };
    case "lumberCamp":
      return {
        visualSize: 104,
        parts: [
          { key: assetKeys.tiles, frame: "sunnyside-building-workbench", maxSize: 82, originX: 0.5, originY: 0.98, x: 12, yOffset: 1 },
          { key: assetKeys.tiles, frame: "sunnyside-building-wood-stack", maxSize: 48, originX: 0.5, originY: 0.98, x: -36, yOffset: 5 },
          { key: assetKeys.elements.wood, maxSize: 28, originX: 0.5, originY: 0.84, x: 48, yOffset: 4 },
        ],
      };
    case "mill":
      return {
        visualSize: 128,
        parts: [{ key: assetKeys.elements.windmill, frame: 0, maxSize: 128, originX: 0.5, originY: 0.98, yOffset: 2 }],
      };
    case "stoneCamp":
      return {
        visualSize: 116,
        parts: [
          { key: assetKeys.tiles, frame: "sunnyside-building-stone-machine", maxSize: 92, originX: 0.5, originY: 0.98, x: -8, yOffset: 1 },
          { key: assetKeys.elements.rock, maxSize: 34, originX: 0.5, originY: 0.82, x: 50, yOffset: 6 },
        ],
      };
    case "goldCamp":
      return {
        visualSize: 106,
        parts: [
          { key: assetKeys.tiles, frame: "sunnyside-building-house-purple", maxSize: 68, originX: 0.5, originY: 0.98, x: -20, yOffset: 1 },
          { key: assetKeys.aobMap.solanaCrystalNodeSmall, maxSize: 38, originX: 0.5, originY: 0.88, x: 32, yOffset: 5 },
        ],
      };
    case "barracks":
      return {
        visualSize: 194,
        parts: [
          { key: assetKeys.tiles, frame: "sunnyside-building-hall-red", maxSize: 188, originX: 0.5, originY: 0.98, yOffset: 2 },
          { key: assetKeys.tiles, frame: "sunnyside-building-red-rug", maxSize: 42, originX: 0.5, originY: 0.82, x: 62, yOffset: 8 },
        ],
      };
    case "stable":
      return {
        visualSize: 178,
        parts: [
          { key: assetKeys.tiles, frame: "sunnyside-building-hall-orange", maxSize: 170, originX: 0.5, originY: 0.98, yOffset: 2 },
          { key: assetKeys.tiles, frame: "sunnyside-building-wood-stack", maxSize: 42, originX: 0.5, originY: 0.98, x: -62, yOffset: 6 },
        ],
      };
    case "watchTower":
      return {
        visualSize: 96,
        parts: [{ key: assetKeys.tiles, frame: ageTower, maxSize: 94, originX: 0.5, originY: 0.98, yOffset: 1 }],
      };
    case "farm":
      return {
        visualSize: 104,
        parts: [{ key: assetKeys.elements.soil, maxSize: 104, originX: 0.5, originY: 0.5, yOffset: -3 }],
      };
    default:
      return undefined;
  }
}

function smokeDefForBuilding(type: BuildingType): BuildingSmokeDef | undefined {
  switch (type) {
    case "townCenter":
      return { xFactor: 0.15, yFactor: 0.84, maxSize: 46, alpha: 0.88 };
    case "house":
      return { xFactor: 0.16, yFactor: 0.82, maxSize: 32, alpha: 0.82 };
    case "lumberCamp":
      return { xFactor: 0.14, yFactor: 0.8, maxSize: 32, alpha: 0.78 };
    case "barracks":
      return { xFactor: 0.13, yFactor: 0.82, maxSize: 38, alpha: 0.78 };
    case "stoneCamp":
    case "goldCamp":
      return { xFactor: 0.11, yFactor: 0.82, maxSize: 28, alpha: 0.72 };
    case "watchTower":
      return { xFactor: 0, yFactor: 0.9, maxSize: 26, alpha: 0.68 };
    default:
      return undefined;
  }
}

function buildingPreviewSpriteDef(type: BuildingType, age: AgeId, _tile: TileCoord): BuildingSpriteDef | undefined {
  return buildingSpriteDefsForType(type, true, age, buildingConfigs[type].footprint)[0];
}

function buildingSpriteDefs(entity: GameEntity, ownerAge: AgeId): BuildingSpriteDef[] {
  if (!entity.building) {
    return [];
  }
  return buildingSpriteDefsForType(entity.building.type, entity.building.completed, ownerAge, entity.building.footprint);
}

function buildingSpriteDefsForType(type: BuildingType, completed: boolean, ownerAge: AgeId, footprint: { w: number; h: number }): BuildingSpriteDef[] {
  if (USE_SUNNYSIDE_BUILDINGS) {
    const blueprint = sunnysideBuildingBlueprintForType(type, ownerAge);
    if (blueprint) {
      return blueprint.parts.map((part) => ({
        key: part.key,
        frame: part.frame,
        maxSize: part.maxSize,
        originX: part.originX,
        originY: part.originY,
        x: part.x,
        y: footprint.h * TILE_SIZE * 0.5 + 2 + (part.yOffset ?? 0),
        alpha: part.alpha ?? (completed ? 1 : 0.46),
      }));
    }
  }

  const textureKey = buildingStaticAssetKeyForType(type, completed, ownerAge);
  if (!textureKey) {
    return [];
  }
  return [
    {
      key: textureKey,
      maxSize: completed ? buildingStaticVisualSizeForType(type, ownerAge) : constructionVisualSizeForType(type),
      originX: 0.5,
      originY: 1,
      y: footprint.h * TILE_SIZE * 0.5 + 2,
    },
  ];
}

function buildingSpriteSignature(spriteDefs: BuildingSpriteDef[]): string {
  return spriteDefs.map((def) => `${def.key}:${String(def.frame ?? "")}:${def.maxSize}:${def.x ?? 0}:${def.y}:${def.alpha ?? ""}`).join("|");
}

function groundPadTexture(): { key: string; frame?: string | number } {
  return USE_SUNNYSIDE_BUILDINGS ? { key: assetKeys.tiles, frame: SUNNYSIDE_DIRT_FRAMES[0] } : { key: assetKeys.aobMap.baseDirt };
}

function decorFrameForKey(key: string): string | number | undefined {
  if (key === assetKeys.elements.tree1 || key === assetKeys.elements.tree2 || key === assetKeys.elements.windmill || key === assetKeys.elements.fire || key === assetKeys.elements.smoke) {
    return 0;
  }
  return undefined;
}

function terrainKindForChunk(map: MapState, startX: number, startY: number): TileType {
  if (startX < 0 || startY < 0 || startX >= map.width || startY >= map.height) {
    return "water";
  }

  const counts: Record<TileType, number> = {
    grass: 0,
    grassDark: 0,
    path: 0,
    dirt: 0,
    water: 0,
    deepWater: 0,
    stoneGround: 0,
    crystalGround: 0,
  };

  for (let y = startY; y < Math.min(map.height, startY + TERRAIN_STAMP_TILES); y += 1) {
    for (let x = startX; x < Math.min(map.width, startX + TERRAIN_STAMP_TILES); x += 1) {
      const tile = map.tiles[y * map.width + x] ?? "grass";
      counts[tile] += 1;
    }
  }

  const area = Math.min(map.width - startX, TERRAIN_STAMP_TILES) * Math.min(map.height - startY, TERRAIN_STAMP_TILES);
  if (counts.water + counts.deepWater >= area * 0.36) {
    return "water";
  }
  if (counts.crystalGround >= area * 0.34) {
    return "crystalGround";
  }
  if (counts.stoneGround >= area * 0.34) {
    return "stoneGround";
  }
  if (counts.path >= area * 0.3) {
    return "path";
  }
  if (counts.dirt >= area * 0.3) {
    return "dirt";
  }
  return counts.grassDark > counts.grass ? "grassDark" : "grass";
}

function shouldLetVisualDecalCover(tile: TileType, startX: number, startY: number): boolean {
  return (
    isDirtLike(tile) ||
    (isStoneQuarryDecalArea(startX, startY) && isStoneQuarryCoveredTile(tile)) ||
    (isCrystalFieldDecalArea(startX, startY) && tile === "crystalGround")
  );
}

function shouldSkipVisualDecalTransitions(kind: TileType, neighbors: NeighboringTerrain, startX: number, startY: number): boolean {
  if (isDirtLike(kind) || Object.values(neighbors).some(isDirtLike)) {
    return true;
  }
  if (isStoneQuarryDecalArea(startX, startY) && (isStoneQuarryCoveredTile(kind) || Object.values(neighbors).some(isStoneQuarryCoveredTile))) {
    return true;
  }
  return isCrystalFieldDecalArea(startX, startY) && (kind === "crystalGround" || Object.values(neighbors).some((tile) => tile === "crystalGround"));
}

function isStoneQuarryDecalArea(startX: number, startY: number): boolean {
  const centerX = startX + TERRAIN_STAMP_TILES / 2;
  const centerY = startY + TERRAIN_STAMP_TILES / 2;
  return centerX >= 78 && centerX <= 128 && centerY >= 24 && centerY <= 70;
}

function isCrystalFieldDecalArea(startX: number, startY: number): boolean {
  const centerX = startX + TERRAIN_STAMP_TILES / 2;
  const centerY = startY + TERRAIN_STAMP_TILES / 2;
  return centerX >= 88 && centerX <= 128 && centerY >= 80 && centerY <= 126;
}

function isGrassLike(tile: TileType): boolean {
  return tile === "grass" || tile === "grassDark";
}

function isDirtLike(tile: TileType): boolean {
  return tile === "dirt" || tile === "path";
}

function isStoneLike(tile: TileType): boolean {
  return tile === "stoneGround";
}

function isStoneQuarryCoveredTile(tile: TileType): boolean {
  return tile === "stoneGround" || tile === "dirt";
}

function rotationForSide(baseSide: CardinalSide, targetSide: CardinalSide): number {
  const indexDelta = CARDINAL_SIDES.indexOf(targetSide) - CARDINAL_SIDES.indexOf(baseSide);
  return ((indexDelta % 4) + 4) % 4 * 90;
}

function hash2(x: number, y: number): number {
  let value = Math.imul(x, 374_761_393) ^ Math.imul(y, 668_265_263);
  value = Math.imul(value ^ (value >>> 13), 1_274_126_177);
  return (value ^ (value >>> 16)) >>> 0;
}

function setMaxDisplaySize(sprite: Phaser.GameObjects.Image | Phaser.GameObjects.Sprite, maxSize: number): void {
  const currentMax = Math.max(sprite.width, sprite.height);
  if (currentMax <= 0) {
    return;
  }
  sprite.setScale(maxSize / currentMax);
}

type ResourceVisual = {
  key: string;
  frame?: string | number;
  maxSize: number;
  originX: number;
  originY: number;
  x: number;
  y: number;
  tint?: number;
  alpha?: number;
};

type DecorPlacement = {
  tileX: number;
  tileY: number;
  key: string;
  frame?: string | number;
  maxSize: number;
  originX?: number;
  originY?: number;
  alpha?: number;
  depthOffset?: number;
};

function resourceVisualFor(entity: GameEntity): ResourceVisual | undefined {
  const node = entity.resourceNode;
  if (!node) {
    return undefined;
  }
  const def = resourceVisuals[node.type];
  const visual = node.amount <= 0 ? (def.depleted ?? def.variants[0]) : def.variants[numericId(entity.id) % Math.max(1, def.variants.length)];
  if (!visual) {
    return undefined;
  }
  return {
    key: visual.key,
    frame: visual.frame,
    maxSize: visual.maxSize,
    originX: visual.originX,
    originY: visual.originY,
    x: visual.x ?? 0,
    y: visual.y ?? 0,
    tint: visual.tint,
    alpha: visual.alpha,
  };
}

function normalizeWallLineEnd(start: TileCoord, hover: TileCoord, mode: WallOrientationMode): TileCoord {
  if (mode === "horizontal") {
    return { x: hover.x, y: start.y };
  }
  if (mode === "vertical") {
    return { x: start.x, y: hover.y };
  }
  return Math.abs(hover.x - start.x) >= Math.abs(hover.y - start.y) ? { x: hover.x, y: start.y } : { x: start.x, y: hover.y };
}

function sameTile(a: TileCoord, b: TileCoord): boolean {
  return a.x === b.x && a.y === b.y;
}

function wallSegmentsForDraftPoints(points: TileCoord[]): WallLineSegment[] {
  const segments: WallLineSegment[] = [];
  for (let index = 0; index < points.length - 1; index += 1) {
    const start = points[index];
    const end = points[index + 1];
    if (!start || !end) {
      continue;
    }
    const segmentStart = index === 0 ? start : nextTileAfterCorner(start, end);
    if (!segmentStart) {
      continue;
    }
    segments.push(...wallLineSegments(segmentStart, end));
  }
  return segments;
}

function nextTileAfterCorner(start: TileCoord, end: TileCoord): TileCoord | undefined {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  if (dx === 0 && dy === 0) {
    return undefined;
  }
  if (Math.abs(dx) >= Math.abs(dy)) {
    return { x: start.x + Math.sign(dx), y: start.y };
  }
  return { x: start.x, y: start.y + Math.sign(dy) };
}

function isGatherableEntity(entity: GameEntity): boolean {
  if (entity.resourceNode) {
    return entity.resourceNode.amount > 0;
  }
  return Boolean(entity.farm && entity.building?.completed && !entity.farm.depleted && entity.farm.food > 0);
}

function isRepairablePlayerBuilding(entity: GameEntity): boolean {
  return Boolean(
    entity.ownerId === PLAYER_ID &&
      entity.building?.completed &&
      entity.health &&
      entity.health.current < entity.health.max,
  );
}

function buildingAssetKey(entity: GameEntity): string | undefined {
  return entity.building ? buildingAssetKeyForType(entity.building.type) : undefined;
}

function buildingAssetKeyForType(type: BuildingType): string | undefined {
  switch (type) {
    case "townCenter":
      return assetKeys.aobBuildings.townCenter;
    case "house":
      return assetKeys.aobBuildings.house;
    case "barracks":
      return assetKeys.aobBuildings.barracks;
    case "stable":
      return assetKeys.aobBuildings.stable;
    case "lumberCamp":
      return assetKeys.aobBuildings.lumberCamp;
    case "mill":
      return assetKeys.aobBuildings.mill;
    case "stoneCamp":
      return assetKeys.aobBuildings.stoneCamp;
    case "goldCamp":
      return assetKeys.aobBuildings.goldCamp;
    case "farm":
      return assetKeys.aobBuildings.farm;
    case "watchTower":
      return assetKeys.aobBuildings.watchTower;
    case "wall":
      return undefined;
    default:
      return undefined;
  }
}

function buildingStaticAssetKey(entity: GameEntity, ownerAge: AgeId): string | undefined {
  if (!entity.building) {
    return undefined;
  }

  return buildingStaticAssetKeyForType(entity.building.type, entity.building.completed, ownerAge);
}

function buildingRenderedVisualSize(entity: GameEntity): number {
  return buildingStaticAssetKey(entity, "genesis") ? buildingStaticVisualSize(entity) : buildingVisualSize(entity);
}

function buildingStaticVisualSize(entity: GameEntity, ownerAge?: AgeId): number {
  if (!entity.building) {
    return 48;
  }
  if (USE_SUNNYSIDE_BUILDINGS) {
    const blueprint = sunnysideBuildingBlueprintForType(entity.building.type, ownerAge ?? "genesis");
    if (blueprint) {
      return blueprint.visualSize;
    }
  }
  return entity.building.completed ? buildingStaticVisualSizeForType(entity.building.type, ownerAge) : constructionVisualSizeForType(entity.building.type);
}

function buildingVisualSize(entity: GameEntity): number {
  return entity.building ? buildingFallbackVisualSizeForType(entity.building.type) : 48;
}

function buildingSpriteBaselineY(entity: GameEntity): number {
  if (!entity.building) {
    return 0;
  }
  return entity.building.footprint.h * TILE_SIZE * 0.5 + 2;
}

function buildingHealthBarY(entity: GameEntity): number {
  if (!entity.building) {
    return -39;
  }
  return buildingSpriteBaselineY(entity) - buildingRenderedVisualSize(entity) - 8;
}

function mouseButton(pointer: Phaser.Input.Pointer): number {
  const event = pointer.event;
  if (event instanceof MouseEvent) {
    return event.button;
  }
  return pointer.leftButtonDown() ? 0 : pointer.rightButtonDown() ? 2 : 0;
}

function numericId(id: string): number {
  const match = id.match(/_(\d+)$/);
  return match ? Number(match[1]) : 0;
}

function actionForEntity(entity: GameEntity, entities: Record<EntityId, GameEntity>): HumanAction {
  if (entity.visualState === "gathering" && entity.worker?.task?.kind === "gather") {
    const target = entities[entity.worker.task.resourceId];
    const resourceType = target?.resourceNode?.resourceType ?? target?.farm?.resourceType;
    if (resourceType === "wood") {
      return "axe";
    }
    if (resourceType === "stone" || resourceType === "gold") {
      return "mining";
    }
    if (resourceType === "food") {
      return "carry";
    }
  }

  switch (entity.visualState) {
    case "walking":
      return "walk";
    case "gathering":
      return "carry";
    case "carrying":
      return "carry";
    case "building":
      return "hammering";
    case "attacking":
      return "attack";
    case "hurt":
      return "hurt";
    case "dead":
      return "death";
    case "idle":
    default:
      return "idle";
  }
}

function tinyCombatAction(action: HumanAction): "idle" | "walk" | "attack" | "hurt" | "death" {
  switch (action) {
    case "walk":
      return "walk";
    case "attack":
      return "attack";
    case "hurt":
      return "hurt";
    case "death":
      return "death";
    default:
      return "idle";
  }
}

function facingForEntity(entity: GameEntity, entities: Record<EntityId, GameEntity>): -1 | 1 | undefined {
  const actionTarget = actionTargetForEntity(entity, entities);
  if (actionTarget) {
    return actionTarget.x < entity.position.x ? -1 : 1;
  }

  const waypoint = entity.mobile?.path[0] ?? entity.mobile?.target;
  if (!waypoint) {
    return undefined;
  }
  const dx = waypoint.x - entity.position.x;
  if (Math.abs(dx) < 0.5) {
    return undefined;
  }
  return dx < 0 ? -1 : 1;
}

function actionTargetForEntity(entity: GameEntity, entities: Record<EntityId, GameEntity>): Vec2 | undefined {
  if (entity.visualState === "gathering" && entity.worker?.task?.kind === "gather") {
    return entities[entity.worker.task.resourceId]?.position;
  }
  if (entity.visualState === "building" && entity.worker?.task?.kind === "build") {
    return entities[entity.worker.task.buildingId]?.position;
  }
  if (entity.visualState === "building" && entity.worker?.task?.kind === "repair") {
    return entities[entity.worker.task.buildingId]?.position;
  }
  if (entity.visualState === "attacking" && entity.combat?.targetId) {
    return entities[entity.combat.targetId]?.position;
  }
  return undefined;
}

function drawBuilding(graphics: Phaser.GameObjects.Graphics, entity: GameEntity, hasSprite: boolean, ownerAge: AgeId | undefined): void {
  if (!entity.building) {
    return;
  }
  graphics.clear();
  if (entity.building.type === "wall") {
    if (hasSprite) {
      drawWallConstructionProgress(entity);
      return;
    }
    drawWall(graphics, entity, ownerAge ?? "genesis");
    return;
  }
  const config = buildingConfigs[entity.building.type];
  const width = entity.building.footprint.w * TILE_SIZE;
  const height = entity.building.footprint.h * TILE_SIZE;
  const age = ownerAge ?? "genesis";
  const groundBounds = buildingGroundBoundsForType(entity.building.type, age);
  const alpha = entity.building.completed ? 0.96 : 0.52;
  const x = -width / 2;
  const y = -height / 2;
  const progress = entity.building.completed ? 1 : entity.building.buildProgress / Math.max(1, entity.building.buildTimeTicks);

  if (hasSprite) {
    if (!entity.building.completed) {
      graphics.fillStyle(0xe3b85c, 0.95);
      graphics.fillRect(x + 3, y + height - 7, (width - 6) * progress, 4);
      graphics.lineStyle(1, 0xf4dc94, 0.7);
      graphics.strokeRect(groundBounds.x, groundBounds.y, groundBounds.width, groundBounds.height);
    }
    if (entity.farm?.depleted) {
      graphics.fillStyle(0x251914, 0.5);
      graphics.fillRect(x + 4, y + 5, width - 8, height - 10);
      graphics.lineStyle(1, 0xd7b56d, 0.8);
      graphics.strokeRect(x + 5, y + 6, width - 10, height - 12);
    }
    return;
  }
  graphics.fillStyle(config.color, alpha);
  graphics.fillRect(x, y + height * 0.34, width, height * 0.66);
  graphics.lineStyle(1, 0x211611, 0.65);
  graphics.strokeRect(x, y + height * 0.34, width, height * 0.66);
  graphics.fillStyle(config.roofColor, alpha);
  graphics.fillTriangle(x - 4, y + height * 0.42, 0, y - 7, x + width + 4, y + height * 0.42);
  graphics.lineStyle(2, 0x3b241a, 0.78);
  graphics.strokeTriangle(x - 4, y + height * 0.42, 0, y - 7, x + width + 4, y + height * 0.42);

  if (!entity.building.completed) {
    graphics.fillStyle(0xe3b85c, 0.95);
    graphics.fillRect(x + 3, y + height - 7, (width - 6) * progress, 4);
  }

  if (entity.building.type === "farm") {
    graphics.fillStyle(0x4c3624, 0.85);
    graphics.fillRect(x + 4, y + 5, width - 8, height - 10);
    graphics.lineStyle(1, 0x7c5a36, 0.8);
    for (let row = 0; row < 4; row += 1) {
      graphics.lineBetween(x + 5, y + 8 + row * 11, x + width - 5, y + 8 + row * 11);
    }
  }
}

function drawWorldCornerBrackets(
  graphics: Phaser.GameObjects.Graphics,
  x: number,
  y: number,
  width: number,
  height: number,
  color: number,
  alpha: number,
  lineWidth: number,
): void {
  graphics.lineStyle(lineWidth, color, alpha);
  drawCornerLines(graphics, x, y, width, height);
}

function drawCornerLines(graphics: Phaser.GameObjects.Graphics, x: number, y: number, width: number, height: number): void {
  const segment = Math.max(14, Math.min(width, height) * 0.18);
  const right = x + width;
  const bottom = y + height;
  graphics.lineBetween(x, y, x + segment, y);
  graphics.lineBetween(x, y, x, y + segment);
  graphics.lineBetween(right, y, right - segment, y);
  graphics.lineBetween(right, y, right, y + segment);
  graphics.lineBetween(x, bottom, x + segment, bottom);
  graphics.lineBetween(x, bottom, x, bottom - segment);
  graphics.lineBetween(right, bottom, right - segment, bottom);
  graphics.lineBetween(right, bottom, right, bottom - segment);
}

function createGroundPad(scene: Phaser.Scene, type: BuildingType | undefined): Phaser.GameObjects.TileSprite | undefined {
  if (!USE_BUILDING_GROUND_PADS) {
    return undefined;
  }

  if (!type || type === "wall" || type === "enemyCamp") {
    return undefined;
  }

  const groundTexture = groundPadTexture();
  return scene.add
    .tileSprite(0, 0, 64, 64, groundTexture.key, groundTexture.frame)
    .setOrigin(0.5, 0.5);
}

function isWaterChunk(tile: TileType): boolean {
  return tile === "water" || tile === "deepWater";
}

function isLandChunk(tile: TileType): boolean {
  return !isWaterChunk(tile);
}

function naturalDecorForTile(map: MapState, tile: TileType, x: number, y: number): Omit<DecorPlacement, "tileX" | "tileY"> | undefined {
  const hash = hash2(x, y);
  const distanceFromStart = Phaser.Math.Distance.Between(x, y, 56, 56);
  const nearWater = hasNearbyTile(map, x, y, isWaterChunk, 2);

  if ((tile === "grass" || tile === "grassDark") && distanceFromStart > 14 && !nearWater) {
    if (hash % 577 === 0) {
      return { key: assetKeys.aobMap.bush, maxSize: 34, originY: 0.88, alpha: 0.92 };
    }
    if (hash % 883 === 0) {
      const treeRoll = hash % 3;
      return {
        key: treeRoll === 0 ? assetKeys.aobMap.trees : treeRoll === 1 ? assetKeys.aobMap.treesAlt : assetKeys.aobMap.pineTree,
        maxSize: treeRoll === 2 ? 56 : 64,
        originY: treeRoll === 2 ? 0.92 : 0.9,
        alpha: 0.94,
      };
    }
    if (hash % 431 === 0) {
      return { key: assetKeys.aobMap.flowerPatch, maxSize: 30, originY: 0.88, alpha: 0.9 };
    }
    if (hash % 271 === 0) {
      return { key: assetKeys.aobMap.grassPatch, maxSize: 30, originY: 0.88, alpha: 0.88 };
    }
  }

  if (tile === "stoneGround" && hash % 137 === 0) {
    return { key: assetKeys.aobMap.rock, maxSize: 24, originY: 0.86, alpha: 0.74 };
  }

  if (tile === "crystalGround" && hash % 149 === 0) {
    return { key: assetKeys.aobMap.crystalSprout, maxSize: 28, originY: 0.88, alpha: 0.9 };
  }

  return undefined;
}

function hasNearbyTile(map: MapState, x: number, y: number, matches: (tile: TileType) => boolean, radius: number): boolean {
  for (let offsetY = -radius; offsetY <= radius; offsetY += 1) {
    for (let offsetX = -radius; offsetX <= radius; offsetX += 1) {
      const tile = map.tiles[(y + offsetY) * map.width + (x + offsetX)];
      if (tile && matches(tile)) {
        return true;
      }
    }
  }
  return false;
}

function villageDecorLayout(): DecorPlacement[] {
  return [
    { tileX: 44, tileY: 52, key: assetKeys.aobMap.solanaBannerSmall, maxSize: 48, originY: 0.96 },
    { tileX: 45, tileY: 61, key: assetKeys.aobMap.solanaFenceShort, maxSize: 52, originY: 0.9 },
    { tileX: 44, tileY: 62, key: assetKeys.aobMap.solanaFenceCorner, maxSize: 52, originY: 0.9 },
    { tileX: 47, tileY: 64, key: assetKeys.aobMap.bench, maxSize: 32, originY: 0.9 },
    { tileX: 50, tileY: 49, key: assetKeys.aobMap.solanaSacks, maxSize: 50, originY: 0.9 },
    { tileX: 50, tileY: 60, key: assetKeys.aobMap.solanaCratesStack, maxSize: 52, originY: 0.9 },
    { tileX: 58, tileY: 66, key: assetKeys.aobMap.trough, maxSize: 34, originY: 0.9 },
    { tileX: 63, tileY: 49, key: assetKeys.aobMap.solanaLanternPost, maxSize: 44, originY: 0.97 },
    { tileX: 64, tileY: 60, key: assetKeys.aobMap.solanaBarrels, maxSize: 48, originY: 0.9 },
    { tileX: 42, tileY: 55, key: assetKeys.aobMap.woodPile, maxSize: 38, originY: 0.9 },
    { tileX: 83, tileY: 44, key: assetKeys.aobMap.cart, maxSize: 34, originY: 0.9 },
    { tileX: 88, tileY: 46, key: assetKeys.aobMap.solanaBannerTall, maxSize: 58, originY: 0.97 },
    { tileX: 89, tileY: 79, key: assetKeys.aobMap.well, maxSize: 34, originY: 0.9 },
    { tileX: 95, tileY: 80, key: assetKeys.aobMap.solanaValidatorObelisk, maxSize: 58, originY: 0.96 },
    { tileX: 101, tileY: 62, key: assetKeys.aobMap.logStack, maxSize: 38, originY: 0.9 },
  ];
}

function buildDecorBlockedTiles(state: Simulation["state"]): Set<string> {
  const blocked = new Set<string>();

  for (const entity of Object.values(state.entities)) {
    if (entity.unit) {
      continue;
    }

    if (entity.building) {
      const centerTile = worldToTile(entity.position);
      const startX = centerTile.x - Math.floor(entity.building.footprint.w / 2) - 1;
      const startY = centerTile.y - Math.floor(entity.building.footprint.h / 2) - 1;
      for (let y = startY; y < startY + entity.building.footprint.h + 2; y += 1) {
        for (let x = startX; x < startX + entity.building.footprint.w + 2; x += 1) {
          blocked.add(tileCoordKey(x, y));
        }
      }
      continue;
    }

    const tile = worldToTile(entity.position);
    for (let oy = -1; oy <= 1; oy += 1) {
      for (let ox = -1; ox <= 1; ox += 1) {
        blocked.add(tileCoordKey(tile.x + ox, tile.y + oy));
      }
    }
  }

  return blocked;
}

function tileCoordKey(x: number, y: number): string {
  return `${x}:${y}`;
}

function isFogChunkExplored(state: Simulation["state"], startX: number, startY: number): boolean {
  for (let y = startY; y < Math.min(state.map.height, startY + FOG_CHUNK_TILES); y += 1) {
    for (let x = startX; x < Math.min(state.map.width, startX + FOG_CHUNK_TILES); x += 1) {
      if (isTileExplored(state, { x, y })) {
        return true;
      }
    }
  }
  return false;
}

function drawWallConstructionProgress(entity: GameEntity): void {
  if (!entity.building || entity.building.completed) {
    return;
  }
}

function wallVisualFor(entity: GameEntity): WallVisual {
  if (!entity.building) {
    return {
      visible: false,
      textureKey: assetKeys.aobWalls.palisadeHorizontal,
      width: 1,
      height: 1,
    };
  }

  const direction = entity.building.footprint.w >= entity.building.footprint.h ? "horizontal" : "vertical";
  const size = wallDisplaySizeForFootprint(entity.building.footprint);
  return {
    visible: true,
    textureKey: direction === "horizontal" ? assetKeys.aobWalls.palisadeHorizontal : assetKeys.aobWalls.palisadeVertical,
    width: size.width,
    height: size.height,
    y: direction === "horizontal" ? 3 : 0,
  };
}

function wallSegmentSpriteVisuals(segments: WallLineSegment[]): WallSpriteVisual[] {
  return segments.map((segment) => {
    const textureKey = segment.direction === "horizontal" ? assetKeys.aobWalls.palisadeHorizontal : assetKeys.aobWalls.palisadeVertical;
    const size = wallDisplaySizeForSegment(segment);
    return {
      textureKey,
      width: size.width,
      height: size.height,
      x: (segment.tile.x + segment.footprint.w / 2) * TILE_SIZE,
      y: (segment.tile.y + segment.footprint.h / 2) * TILE_SIZE + wallPreviewYOffset(segment),
    };
  });
}

function wallDisplaySizeForSegment(segment: WallLineSegment): { width: number; height: number } {
  return wallDisplaySizeForFootprint(segment.footprint);
}

function wallDisplaySizeForFootprint(footprint: { w: number; h: number }): { width: number; height: number } {
  if (footprint.w >= footprint.h) {
    const width = footprint.w * TILE_SIZE + 8;
    return {
      width,
      height: Math.max(34, width / 2.36),
    };
  }

  const height = footprint.h * TILE_SIZE + 8;
  return {
    width: 24,
    height,
  };
}

function wallPreviewYOffset(segment: WallLineSegment): number {
  return segment.direction === "horizontal" ? 3 : 0;
}

function drawWall(graphics: Phaser.GameObjects.Graphics, entity: GameEntity, ownerAge: AgeId): void {
  if (!entity.building) {
    return;
  }
  const tier = wallTierForAge(ownerAge);
  const width = entity.building.footprint.w * TILE_SIZE;
  const height = entity.building.footprint.h * TILE_SIZE;
  const x = -width / 2;
  const y = -height / 2;
  const progress = entity.building.completed ? 1 : entity.building.buildProgress / Math.max(1, entity.building.buildTimeTicks);

  graphics.lineStyle(1, 0x1a120d, 0.5);

  if (tier.id === "palisade") {
    graphics.fillStyle(tier.color, entity.building.completed ? 0.98 : 0.58);
    for (let i = 0; i < 4; i += 1) {
      const sx = x + 2 + i * 4;
      graphics.fillRect(sx, y + 3, 3, 15);
      graphics.fillTriangle(sx, y + 3, sx + 1.5, y - 1, sx + 3, y + 3);
    }
    graphics.lineStyle(2, tier.accentColor, 0.75);
    graphics.lineBetween(x + 1, y + 8, x + width - 1, y + 8);
    graphics.lineBetween(x + 1, y + 13, x + width - 1, y + 13);
  } else if (tier.id === "stone") {
    graphics.fillStyle(tier.color, entity.building.completed ? 0.98 : 0.58);
    graphics.fillRect(x + 1, y + 3, width - 2, height - 1);
    graphics.lineStyle(1, 0x403c39, 0.75);
    graphics.strokeRect(x + 1, y + 3, width - 2, height - 1);
    graphics.lineStyle(1, tier.accentColor, 0.58);
    graphics.lineBetween(x + 2, y + 8, x + width - 2, y + 8);
    graphics.lineBetween(x + 2, y + 13, x + width - 2, y + 13);
    graphics.lineBetween(x + 6, y + 3, x + 6, y + 8);
    graphics.lineBetween(x + 10, y + 8, x + 10, y + 13);
  } else {
    graphics.fillStyle(tier.color, entity.building.completed ? 0.98 : 0.58);
    graphics.fillRect(x + 1, y + 2, width - 2, height);
    graphics.lineStyle(1, 0x22282b, 0.88);
    graphics.strokeRect(x + 1, y + 2, width - 2, height);
    graphics.fillStyle(0x353f45, 0.95);
    graphics.fillRect(x + 2, y + 4, width - 4, 4);
    graphics.lineStyle(1, tier.accentColor, 0.85);
    graphics.lineBetween(x + 3, y + 6, x + width - 3, y + 6);
    graphics.fillStyle(tier.accentColor, 0.9);
    graphics.fillCircle(x + 5, y + 12, 1.3);
    graphics.fillCircle(x + width - 5, y + 12, 1.3);
  }

  if (!entity.building.completed) {
    graphics.fillStyle(0xe3b85c, 0.95);
    graphics.fillRect(x + 2, y + height + 2, (width - 4) * progress, 3);
  }
}

function hitTestEntity(entity: GameEntity, point: Vec2, ownerAge: AgeId | undefined): boolean {
  if (entity.building) {
    const bounds = buildingInteractionBounds(entity, ownerAge ?? "genesis");
    return (
      point.x >= entity.position.x + bounds.x &&
      point.x <= entity.position.x + bounds.x + bounds.width &&
      point.y >= entity.position.y + bounds.y &&
      point.y <= entity.position.y + bounds.y + bounds.height
    );
  }
  if (entity.resourceNode) {
    return Phaser.Math.Distance.Between(entity.position.x, entity.position.y, point.x, point.y) <= resourceHitRadius(entity);
  }
  if (entity.unit) {
    const dx = Math.abs(point.x - entity.position.x);
    const dy = point.y - entity.position.y;
    return dx <= 15 && dy >= -32 && dy <= 10;
  }
  return Phaser.Math.Distance.Between(entity.position.x, entity.position.y, point.x, point.y) <= entity.radius + 8;
}

function buildingInteractionBounds(entity: GameEntity, ownerAge: AgeId): { x: number; y: number; width: number; height: number } {
  if (entity.building?.type === "wall") {
    const visual = wallVisualFor(entity);
    const xPadding = entity.building.footprint.w >= entity.building.footprint.h ? 8 : 12;
    const yPadding = entity.building.footprint.w >= entity.building.footprint.h ? 10 : 8;
    return {
      x: -visual.width / 2 - xPadding,
      y: (visual.y ?? 0) - visual.height / 2 - yPadding,
      width: visual.width + xPadding * 2,
      height: visual.height + yPadding * 2,
    };
  }

  return buildingGroundBoundsForType(entity.building?.type ?? "house", ownerAge);
}

function resourceHitRadius(entity: GameEntity): number {
  switch (entity.resourceNode?.type) {
    case "tree":
      return 30;
    case "stone":
    case "gold":
      return 25;
    case "berries":
      return 22;
    case "farmFood":
      return 18;
    default:
      return entity.radius + 8;
  }
}
