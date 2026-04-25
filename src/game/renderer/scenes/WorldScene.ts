import Phaser from "phaser";
import { PLAYER_ID, TILE_SIZE, type AgeId } from "../../data/constants";
import { assetKeys, type HumanAction } from "../../data/assets";
import { buildingConfigs, wallTierForAge } from "../../data/definitions";
import {
  buildingFallbackVisualSizeForType,
  buildingGroundBoundsForType,
  buildingStaticAssetKeyForType,
  buildingStaticVisualSizeForType,
  constructionVisualSizeForType,
  resourceVisuals,
  terrainVisualFor,
  TERRAIN_STAMP_TILES,
} from "../../data/visuals";
import type { BuildingType, EntityId, GameEntity } from "../../core/entities/types";
import { Simulation } from "../../core/simulation/Simulation";
import type { MapState, TileCoord, TileType, Vec2 } from "../../core/state/types";
import { worldToTile } from "../../core/systems/mapQueries";
import { canPlaceBuildingAt, canPlaceWallLineAt } from "../../core/systems/simulationSystems";
import { wallLineSegments, type WallLineSegment } from "../../core/systems/wallPlacement";
import { registerAnimations } from "../world/AnimationRegistry";
import { HudController } from "../ui/HudController";

type EntityView = {
  container: Phaser.GameObjects.Container;
  ground?: Phaser.GameObjects.TileSprite;
  sprites: Phaser.GameObjects.Sprite[];
  graphics?: Phaser.GameObjects.Graphics;
  selection: Phaser.GameObjects.Graphics;
  health: Phaser.GameObjects.Graphics;
  animationFamily?: "human" | "goblin" | "skeleton";
  lastAnimation?: string;
  lastBuildingTexture?: string;
  staticBuildingType?: BuildingType;
  facingX?: -1 | 1;
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

const TERRAIN_BASE_DEPTH = -1000;
const TERRAIN_TRANSITION_DEPTH = -950;
const UNIT_SPRITE_SCALE = 1.28;
const UNIT_SPRITE_ORIGIN_Y = 0.61;
const GROUND_PAD_DEPTH = -500;

export class WorldScene extends Phaser.Scene {
  private simulation!: Simulation;
  private hud!: HudController;
  private readonly entityViews = new Map<EntityId, EntityView>();
  private dragStartWorld?: Vec2;
  private dragStartScreen?: Vec2;
  private dragGraphics?: Phaser.GameObjects.Graphics;
  private placementGraphics?: Phaser.GameObjects.Graphics;
  private placementPreviewGround?: Phaser.GameObjects.TileSprite;
  private placementPreviewSprite?: Phaser.GameObjects.Sprite;
  private readonly wallPreviewSprites: Phaser.GameObjects.Sprite[] = [];
  private placementType?: BuildingType;
  private wallLineStartTile?: TileCoord;
  private buildMenuOpen = false;
  private previousSelectedIds = new Set<EntityId>();
  private hoveredEntityId?: EntityId;
  private keys!: Record<string, Phaser.Input.Keyboard.Key>;
  private isPanning = false;
  private panLastScreen?: Vec2;
  private currentCursor = "";

  constructor() {
    super("WorldScene");
  }

  create(): void {
    registerAnimations(this);
    this.simulation = new Simulation();
    this.configureTerrainTextureFilters();
    this.createTerrain();
    this.createMapDecor();
    this.createInput();
    this.createHud();
    this.installDebugHooks();

    this.cameras.main.setBounds(0, 0, this.simulation.state.map.width * TILE_SIZE, this.simulation.state.map.height * TILE_SIZE);
    this.cameras.main.centerOn(62 * TILE_SIZE, 64 * TILE_SIZE);
    this.cameras.main.setZoom(1.22);

    this.dragGraphics = this.add.graphics().setDepth(10_000);
    this.placementGraphics = this.add.graphics().setDepth(9_999);
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
    ]) {
      this.textures.get(key).setFilter(Phaser.Textures.FilterMode.LINEAR);
    }
  }

  update(_time: number, delta: number): void {
    this.simulation.update(delta);
    this.updateCamera(delta);
    this.updateHoverTarget();
    this.syncEntityViews();
    this.updateSelectionPulse();
    this.updatePlacementPreview();
    this.updateCursor();
    if (this.buildMenuOpen && this.selectedWorkerIds().length === 0) {
      this.buildMenuOpen = false;
    }
    this.hud.render(this.simulation.state, {
      placementType: this.placementType,
      wallLineStarted: Boolean(this.wallLineStartTile),
      buildMenuOpen: this.buildMenuOpen,
    });
  }

  private createTerrain(): void {
    const state = this.simulation.state;
    const chunkSize = TERRAIN_STAMP_TILES * TILE_SIZE;
    for (let y = 0; y < state.map.height; y += TERRAIN_STAMP_TILES) {
      for (let x = 0; x < state.map.width; x += TERRAIN_STAMP_TILES) {
        const kind = terrainKindForChunk(state.map, x, y);
        const visual = terrainVisualFor(kind);
        const variation = hash2(x, y);
        const tile = this.add
          .image(x * TILE_SIZE, y * TILE_SIZE, visual.key)
          .setOrigin(0, 0)
          .setDisplaySize(chunkSize, chunkSize)
          .setDepth(TERRAIN_BASE_DEPTH)
          .setAlpha(visual.alpha ?? 1);

        if (visual.canMirror) {
          tile.setFlipX((variation & 1) === 1);
          tile.setFlipY((variation & 2) === 2);
        }
      }
    }

    this.createTerrainTransitions(state, chunkSize);
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
    const sprite = this.add
      .image(worldX, worldY, decor.key)
      .setOrigin(decor.originX ?? 0.5, decor.originY ?? 0.86)
      .setDepth(worldY + (decor.depthOffset ?? -2))
      .setAlpha(decor.alpha ?? 1);

    setMaxDisplaySize(sprite, decor.maxSize);
  }

  private createInput(): void {
    this.keys = this.input.keyboard?.addKeys("W,A,S,D,UP,DOWN,LEFT,RIGHT,ESC,SPACE,F") as Record<string, Phaser.Input.Keyboard.Key>;
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
        this.beginWallPlacementDrag(pointer);
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
      this.drawDragRect(pointer);
    });

    this.input.on(Phaser.Input.Events.POINTER_UP, (pointer: Phaser.Input.Pointer) => {
      if (this.isPanning) {
        this.stopMousePan();
        return;
      }
      const button = mouseButton(pointer);
      if (button === 2) {
        if (this.placementType) {
          this.cancelPlacement();
          return;
        }
        this.handleCommandClick(pointer);
        return;
      }
      if (button === 0 && this.placementType === "wall") {
        this.confirmPlacement(pointer);
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
        this.wallLineStartTile = undefined;
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
    });
  }

  private installDebugHooks(): void {
    const debugWindow = window as typeof window & {
      render_game_to_text?: () => string;
      advanceTime?: (milliseconds: number) => void;
      setCameraTile?: (x: number, y: number, zoom?: number) => void;
    };
    debugWindow.render_game_to_text = () => {
      const state = this.simulation.state;
      const entities = Object.values(state.entities);
      const player = state.players[PLAYER_ID];
      const selected = state.selection.selectedIds.map((id) => state.entities[id]?.label ?? id);
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
        counts: {
          units: entities.filter((entity) => entity.kind === "unit").length,
          buildings: entities.filter((entity) => entity.kind === "building").length,
          resources: entities.filter((entity) => entity.kind === "resource").length,
          walls: entities.filter((entity) => entity.building?.type === "wall").length,
          completedWalls: entities.filter((entity) => entity.building?.type === "wall" && entity.building.completed).length,
        },
        messages: state.messages.slice(-3).map((message) => message.text),
      });
    };
    debugWindow.advanceTime = (milliseconds: number) => {
      this.simulation.update(milliseconds);
      this.syncEntityViews();
      this.hud.render(this.simulation.state, {
        placementType: this.placementType,
        wallLineStarted: Boolean(this.wallLineStartTile),
        buildMenuOpen: this.buildMenuOpen,
      });
    };
    debugWindow.setCameraTile = (x: number, y: number, zoom?: number) => {
      this.cameras.main.centerOn(x * TILE_SIZE, y * TILE_SIZE);
      if (zoom !== undefined) {
        this.cameras.main.setZoom(Phaser.Math.Clamp(zoom, 0.8, 1.7));
      }
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
      this.cancelPlacement();
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
    this.wallLineStartTile = undefined;
    this.placementGraphics?.clear();
    this.hidePlacementPreviewGround();
    this.hidePlacementPreviewSprite();
    this.hideWallPlacementPreview();
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

  private beginWallPlacementDrag(pointer: Phaser.Input.Pointer): void {
    this.wallLineStartTile = worldToTile({ x: pointer.worldX, y: pointer.worldY });
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
      this.tweens.killTweensOf(view.container);
      view.container.setScale(1);
      this.tweens.add({
        targets: view.container,
        scale: 1.08,
        duration: 95,
        yoyo: true,
        ease: "Sine.easeOut",
      });
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
    } else {
      const base = this.add.sprite(0, 0, assetKeys.human.base.idle, 0).setOrigin(0.5, UNIT_SPRITE_ORIGIN_Y);
      const hair = this.add.sprite(0, 0, assetKeys.human.hair.idle, 0).setOrigin(0.5, UNIT_SPRITE_ORIGIN_Y);
      const tools = this.add.sprite(0, 0, assetKeys.human.tools.idle, 0).setOrigin(0.5, UNIT_SPRITE_ORIGIN_Y);
      if (entity.unit?.type === "soldier") {
        base.setTint(0xf4d0b5);
        hair.setTint(0xf2e2c7);
        tools.setTint(0xd4e0ee);
      }
      sprites.push(base, hair, tools);
    }

    for (const sprite of sprites) {
      sprite.setScale(UNIT_SPRITE_SCALE);
      container.add(sprite);
    }

    const selection = this.add.graphics();
    const health = this.add.graphics();
    container.add(selection);
    container.add(health);
    return { container, sprites, selection, health, animationFamily };
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
      const sprite = this.add.sprite(visual.x, visual.y, visual.key).setOrigin(visual.originX, visual.originY);
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
    container.add(health);
    return { container, sprites, selection, health };
  }

  private createBuildingView(entity: GameEntity): EntityView {
    const container = this.add.container(entity.position.x, entity.position.y);
    const ground = createGroundPad(this, entity.building?.type);
    const graphics = this.add.graphics();
    container.add(graphics);
    const sprites: Phaser.GameObjects.Sprite[] = [];

    const ownerAge = entity.ownerId ? this.simulation.state.players[entity.ownerId]?.age : undefined;
    const staticKey = buildingStaticAssetKey(entity, ownerAge ?? "genesis");
    const buildingKey = buildingAssetKey(entity);
    let staticBuildingType: BuildingType | undefined;
    if (staticKey) {
      const sprite = this.add.sprite(0, buildingSpriteBaselineY(entity), staticKey).setOrigin(0.5, 1);
      setMaxDisplaySize(sprite, buildingStaticVisualSize(entity, ownerAge));
      sprites.push(sprite);
      container.add(sprite);
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

    const selection = this.add.graphics();
    const health = this.add.graphics();
    container.add(selection);
    container.add(health);
    return { container, ground, sprites, graphics, selection, health, staticBuildingType, lastBuildingTexture: staticKey };
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
    ground.setAlpha(entity.building.completed ? 0.82 : 0.62);
  }

  private updateStaticBuildingSprite(entity: GameEntity, view: EntityView, ownerAge: AgeId): void {
    const sprite = view.sprites[0];
    if (!sprite || !entity.building || !view.staticBuildingType) {
      return;
    }

    const textureKey = buildingStaticAssetKey(entity, ownerAge);
    if (!textureKey) {
      return;
    }
    if (view.lastBuildingTexture !== textureKey) {
      sprite.setTexture(textureKey);
      view.lastBuildingTexture = textureKey;
    }

    sprite.clearTint();
    sprite.setAlpha(entity.building.completed ? 1 : 0.92);
    sprite.setOrigin(0.5, 1);
    sprite.setY(buildingSpriteBaselineY(entity));
    setMaxDisplaySize(sprite, buildingStaticVisualSize(entity, ownerAge));

    if (entity.farm?.depleted) {
      sprite.setTint(0x8d8276);
      sprite.setAlpha(0.78);
    }
  }

  private updateWallSprite(entity: GameEntity, view: EntityView, ownerAge: AgeId): void {
    const sprite = view.sprites[0];
    if (!sprite || !entity.building) {
      return;
    }

    if (wallTierForAge(ownerAge).id !== "palisade") {
      sprite.setVisible(false);
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
    if (sprite.texture.key !== visual.key) {
      sprite.setTexture(visual.key);
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
    const selected = this.simulation.state.selection.selectedIds.includes(entity.id);
    const hovered = this.hoveredEntityId === entity.id;
    if (!selected && !hovered) {
      return;
    }
    const color = entity.kind === "resource" ? 0xe7c86b : entity.ownerId === PLAYER_ID ? 0xd8d2b4 : 0xe85a4a;
    const alpha = selected ? 0.78 : 0.38;
    if (entity.building) {
      const ownerAge = entity.ownerId ? this.simulation.state.players[entity.ownerId]?.age ?? "genesis" : "genesis";
      const bounds = buildingInteractionBounds(entity, ownerAge);
      drawLocalCornerBrackets(view.selection, bounds.x, bounds.y, bounds.width, bounds.height, color, alpha, selected ? 2 : 1);
      return;
    }
    if (selected) {
      view.selection.fillStyle(color, entity.resourceNode ? 0.08 : 0.1);
      view.selection.fillEllipse(0, 2, entity.resourceNode ? 28 : 20, entity.resourceNode ? 11 : 8);
    }
    view.selection.lineStyle(selected ? 2 : 1, color, alpha);
    view.selection.strokeEllipse(0, 2, entity.resourceNode ? 30 : 21, entity.resourceNode ? 12 : 9);
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
      this.confirmWallPlacement(tile);
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

  private confirmWallPlacement(tile: TileCoord): void {
    if (!this.wallLineStartTile) {
      this.wallLineStartTile = tile;
      return;
    }

    const end = normalizeWallLineEnd(this.wallLineStartTile, tile);
    if (!canPlaceWallLineAt(this.simulation.state, this.wallLineStartTile, end)) {
      return;
    }

    this.simulation.dispatch({
      type: "buildWallLine",
      playerId: PLAYER_ID,
      start: this.wallLineStartTile,
      end,
      builderIds: this.selectedWorkerIds(),
    });

    const segments = wallLineSegments(this.wallLineStartTile, end);
    const middle = segments[Math.floor(segments.length / 2)];
    const middleX = middle ? (middle.tile.x + middle.footprint.w / 2) * TILE_SIZE : (this.wallLineStartTile.x + 0.5) * TILE_SIZE;
    const middleY = middle ? (middle.tile.y + middle.footprint.h / 2) * TILE_SIZE : (this.wallLineStartTile.y + 0.5) * TILE_SIZE;
    this.showCommandIndicator({ x: middleX, y: middleY }, "build");
    this.wallLineStartTile = undefined;
    this.hideWallPlacementPreview();
    this.dragStartWorld = undefined;
    this.dragStartScreen = undefined;
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

  private updatePlacementPreviewSprite(type: BuildingType, tile: TileCoord, valid: boolean): void {
    const textureKey = buildingStaticAssetKeyForType(type, true, this.simulation.state.players[PLAYER_ID].age);
    if (!textureKey) {
      this.hidePlacementPreviewSprite();
      return;
    }

    const config = buildingConfigs[type];
    const x = (tile.x + config.footprint.w / 2) * TILE_SIZE;
    const y = (tile.y + config.footprint.h) * TILE_SIZE + 2;
    if (!this.placementPreviewSprite) {
      this.placementPreviewSprite = this.add.sprite(x, y, textureKey).setOrigin(0.5, 1).setDepth(10_000);
    } else if (this.placementPreviewSprite.texture.key !== textureKey) {
      this.placementPreviewSprite.setTexture(textureKey);
    }

    this.placementPreviewSprite.setVisible(true);
    this.placementPreviewSprite.setPosition(x, y);
    this.placementPreviewSprite.setAlpha(valid ? 0.72 : 0.5);
    this.placementPreviewSprite.clearTint();
    if (!valid) {
      this.placementPreviewSprite.setTint(0xff9b8a);
    }
    setMaxDisplaySize(this.placementPreviewSprite, buildingStaticVisualSizeForType(type, this.simulation.state.players[PLAYER_ID].age));
  }

  private hidePlacementPreviewSprite(): void {
    this.placementPreviewSprite?.setVisible(false);
  }

  private updatePlacementPreviewGround(type: BuildingType, centerX: number, centerY: number, valid: boolean): void {
    const age = this.simulation.state.players[PLAYER_ID].age;
    const bounds = buildingGroundBoundsForType(type, age);
    if (!this.placementPreviewGround) {
      this.placementPreviewGround = this.add
        .tileSprite(centerX, centerY + bounds.y + bounds.height / 2, bounds.width, bounds.height, assetKeys.aobMap.baseDirt)
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
    const start = this.wallLineStartTile ?? hoverTile;
    const end = normalizeWallLineEnd(start, hoverTile);
    const segments = wallLineSegments(start, end);
    const valid = canPlaceWallLineAt(this.simulation.state, start, end);
    this.updateWallPreviewSprites(segments, valid);
  }

  private updateWallPreviewSprites(segments: WallLineSegment[], valid: boolean): void {
    for (let index = 0; index < segments.length; index += 1) {
      const segment = segments[index];
      let sprite = this.wallPreviewSprites[index];
      const textureKey = segment.direction === "horizontal" ? assetKeys.aobWalls.palisadeHorizontal : assetKeys.aobWalls.palisadeVertical;
      const x = (segment.tile.x + segment.footprint.w / 2) * TILE_SIZE;
      const y = (segment.tile.y + segment.footprint.h / 2) * TILE_SIZE + wallPreviewYOffset(segment);
      if (!sprite) {
        sprite = this.add.sprite(x, y, textureKey).setOrigin(0.5, 0.5).setDepth(10_000);
        this.wallPreviewSprites[index] = sprite;
      } else if (sprite.texture.key !== textureKey) {
        sprite.setTexture(textureKey);
      }
      sprite.setVisible(true);
      sprite.setPosition(x, y);
      sprite.setAlpha(valid ? 0.58 : 0.44);
      sprite.clearTint();
      if (!valid) {
        sprite.setTint(0xff7567);
      }
      const size = wallDisplaySizeForSegment(segment);
      sprite.setDisplaySize(size.width, size.height);
    }

    for (let index = segments.length; index < this.wallPreviewSprites.length; index += 1) {
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

  private updateCursor(): void {
    if (this.isPanning) {
      this.setCursor("grabbing");
      return;
    }

    const pointer = this.input.activePointer;
    if (this.placementType) {
      const tile = worldToTile({ x: pointer.worldX, y: pointer.worldY });
      const valid =
        this.placementType === "wall" && this.wallLineStartTile
          ? canPlaceWallLineAt(this.simulation.state, this.wallLineStartTile, normalizeWallLineEnd(this.wallLineStartTile, tile))
          : canPlaceBuildingAt(this.simulation.state, this.placementType, tile);
      this.setCursor(valid ? "copy" : "not-allowed");
      return;
    }

    if (this.keys.SPACE?.isDown) {
      this.setCursor("grab");
      return;
    }

    const selectedUnits = this.selectedUnitIds();
    if (selectedUnits.length === 0) {
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
    this.input.setDefaultCursor(cursor);
  }

  private showCommandIndicator(point: Vec2, kind: "move" | "attack" | "gather" | "build"): void {
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

function isGrassLike(tile: TileType): boolean {
  return tile === "grass" || tile === "grassDark";
}

function isDirtLike(tile: TileType): boolean {
  return tile === "dirt" || tile === "path";
}

function isStoneLike(tile: TileType): boolean {
  return tile === "stoneGround";
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
    maxSize: visual.maxSize,
    originX: visual.originX,
    originY: visual.originY,
    x: visual.x ?? 0,
    y: visual.y ?? 0,
    tint: visual.tint,
    alpha: visual.alpha,
  };
}

function normalizeWallLineEnd(start: TileCoord, hover: TileCoord): TileCoord {
  return Math.abs(hover.x - start.x) >= Math.abs(hover.y - start.y) ? { x: hover.x, y: start.y } : { x: start.x, y: hover.y };
}

function isGatherableEntity(entity: GameEntity): boolean {
  if (entity.resourceNode) {
    return entity.resourceNode.amount > 0;
  }
  return Boolean(entity.farm && entity.building?.completed && !entity.farm.depleted && entity.farm.food > 0);
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
    if (hasSprite && wallTierForAge(ownerAge ?? "genesis").id === "palisade") {
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

function drawLocalCornerBrackets(
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
  if (!type || type === "wall" || type === "enemyCamp") {
    return undefined;
  }

  return scene.add
    .tileSprite(0, 0, 64, 64, assetKeys.aobMap.baseDirt)
    .setOrigin(0.5, 0.5);
}

function isWaterChunk(tile: TileType): boolean {
  return tile === "water" || tile === "deepWater";
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
    { tileX: 44, tileY: 52, key: assetKeys.aobMap.sign, maxSize: 28, originY: 0.92 },
    { tileX: 45, tileY: 61, key: assetKeys.aobMap.fence, maxSize: 34, originY: 0.9 },
    { tileX: 44, tileY: 62, key: assetKeys.aobMap.fenceCorner, maxSize: 34, originY: 0.9 },
    { tileX: 47, tileY: 64, key: assetKeys.aobMap.bench, maxSize: 32, originY: 0.9 },
    { tileX: 50, tileY: 49, key: assetKeys.aobMap.sacks, maxSize: 30, originY: 0.9 },
    { tileX: 50, tileY: 60, key: assetKeys.aobMap.crates, maxSize: 30, originY: 0.9 },
    { tileX: 58, tileY: 66, key: assetKeys.aobMap.trough, maxSize: 34, originY: 0.9 },
    { tileX: 63, tileY: 49, key: assetKeys.aobMap.torch, maxSize: 32, originY: 0.93 },
    { tileX: 64, tileY: 60, key: assetKeys.aobMap.barrels, maxSize: 30, originY: 0.9 },
    { tileX: 42, tileY: 55, key: assetKeys.aobMap.woodPile, maxSize: 38, originY: 0.9 },
    { tileX: 83, tileY: 44, key: assetKeys.aobMap.cart, maxSize: 34, originY: 0.9 },
    { tileX: 88, tileY: 46, key: assetKeys.aobMap.flag, maxSize: 30, originY: 0.94 },
    { tileX: 89, tileY: 79, key: assetKeys.aobMap.well, maxSize: 34, originY: 0.9 },
    { tileX: 95, tileY: 80, key: assetKeys.aobMap.anvil, maxSize: 30, originY: 0.9 },
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
