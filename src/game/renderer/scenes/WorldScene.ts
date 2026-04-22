import Phaser from "phaser";
import { PLAYER_ID, TILE_SIZE, type AgeId } from "../../data/constants";
import { assetKeys, type HumanAction } from "../../data/assets";
import { buildingConfigs, wallTierForAge } from "../../data/definitions";
import type { BuildingType, EntityId, GameEntity } from "../../core/entities/types";
import { Simulation } from "../../core/simulation/Simulation";
import type { MapState, TileCoord, TileType, Vec2 } from "../../core/state/types";
import { worldToTile } from "../../core/systems/mapQueries";
import { canPlaceBuildingAt, canPlaceWallLineAt, wallLineTiles } from "../../core/systems/simulationSystems";
import { buildingIdleAnimationKey, registerAnimations } from "../world/AnimationRegistry";
import { HudController } from "../ui/HudController";

type EntityView = {
  container: Phaser.GameObjects.Container;
  sprites: Phaser.GameObjects.Sprite[];
  graphics?: Phaser.GameObjects.Graphics;
  selection: Phaser.GameObjects.Graphics;
  health: Phaser.GameObjects.Graphics;
  animationFamily?: "human" | "goblin" | "skeleton";
  lastAnimation?: string;
  lastBuildingAnimation?: string;
  buildingAtlasType?: BuildingType;
  facingX?: -1 | 1;
};

const TERRAIN_CHUNK_TILES = 4;
const TERRAIN_FRAMES = {
  grass: 0,
  dirt: 1,
  path: 2,
  stone: 3,
  water: 4,
  deepWater: 5,
  rocky: 6,
  cliff: 7,
  crystalDirt: 8,
  techPlaza: 9,
  farmRows: 10,
  plaza: 11,
} as const;

export class WorldScene extends Phaser.Scene {
  private simulation!: Simulation;
  private hud!: HudController;
  private readonly entityViews = new Map<EntityId, EntityView>();
  private dragStartWorld?: Vec2;
  private dragStartScreen?: Vec2;
  private dragGraphics?: Phaser.GameObjects.Graphics;
  private placementGraphics?: Phaser.GameObjects.Graphics;
  private placementType?: BuildingType;
  private wallLineStartTile?: TileCoord;
  private buildMenuOpen = false;
  private previousSelectedIds = new Set<EntityId>();
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
    this.createTerrain();
    this.createMapDecor();
    this.createInput();
    this.createHud();

    this.cameras.main.setBounds(0, 0, this.simulation.state.map.width * TILE_SIZE, this.simulation.state.map.height * TILE_SIZE);
    this.cameras.main.centerOn(60 * TILE_SIZE, 60 * TILE_SIZE);
    this.cameras.main.setZoom(1.25);

    this.dragGraphics = this.add.graphics().setDepth(10_000);
    this.placementGraphics = this.add.graphics().setDepth(9_999);
  }

  update(_time: number, delta: number): void {
    this.simulation.update(delta);
    this.updateCamera(delta);
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
    const chunkSize = TERRAIN_CHUNK_TILES * TILE_SIZE;
    for (let y = 0; y < state.map.height; y += TERRAIN_CHUNK_TILES) {
      for (let x = 0; x < state.map.width; x += TERRAIN_CHUNK_TILES) {
        const frame = terrainFrameForChunk(state.map, x, y);
        const variation = hash2(x, y);
        const tile = this.add
          .image(x * TILE_SIZE, y * TILE_SIZE, assetKeys.aobMap.terrain, frame)
          .setOrigin(0, 0)
          .setDisplaySize(chunkSize, chunkSize)
          .setDepth(-1000);

        if (frame !== TERRAIN_FRAMES.techPlaza && frame !== TERRAIN_FRAMES.plaza && frame !== TERRAIN_FRAMES.rocky && frame !== TERRAIN_FRAMES.crystalDirt) {
          tile.setFlipX((variation & 1) === 1);
          tile.setFlipY((variation & 2) === 2);
        }
        if (frame === TERRAIN_FRAMES.water || frame === TERRAIN_FRAMES.deepWater) {
          tile.setAlpha(0.95);
        }
      }
    }
  }

  private createMapDecor(): void {
    // Resource-looking props are now reserved for actual resource states.
  }

  private createInput(): void {
    this.keys = this.input.keyboard?.addKeys("W,A,S,D,UP,DOWN,LEFT,RIGHT,ESC,SPACE") as Record<string, Phaser.Input.Keyboard.Key>;
    this.input.mouse?.disableContextMenu();
    this.setCursor(cursorUrl("cursor_01.png", 1, 1, "default"));

    this.input.on(Phaser.Input.Events.POINTER_DOWN, (pointer: Phaser.Input.Pointer) => {
      const button = mouseButton(pointer);
      if (button === 1 || (button === 0 && this.keys.SPACE?.isDown)) {
        this.startMousePan(pointer);
        return;
      }
      if (button !== 0) {
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
        this.handleCommandClick(pointer);
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
  }

  private cancelPlacement(): void {
    this.placementType = undefined;
    this.wallLineStartTile = undefined;
    this.placementGraphics?.clear();
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

  private syncEntityViews(): void {
    const entities = this.simulation.state.entities;
    for (const [id, view] of this.entityViews) {
      if (!entities[id]) {
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
    shadow.fillEllipse(0, -5, 16, 6);
    container.add(shadow);

    const sprites: Phaser.GameObjects.Sprite[] = [];
    let animationFamily: EntityView["animationFamily"] = "human";
    if (entity.unit?.type === "goblin") {
      const sprite = this.add.sprite(0, 0, assetKeys.goblin.idle, 0).setOrigin(0.5, 0.78);
      sprites.push(sprite);
      animationFamily = "goblin";
    } else if (entity.unit?.type === "skeleton") {
      const sprite = this.add.sprite(0, 0, assetKeys.skeleton.idle, 0).setOrigin(0.5, 0.78);
      sprites.push(sprite);
      animationFamily = "skeleton";
    } else {
      const base = this.add.sprite(0, 0, assetKeys.human.base.idle, 0).setOrigin(0.5, 0.78);
      const hair = this.add.sprite(0, 0, assetKeys.human.hair.idle, 0).setOrigin(0.5, 0.78);
      const tools = this.add.sprite(0, 0, assetKeys.human.tools.idle, 0).setOrigin(0.5, 0.78);
      if (entity.unit?.type === "soldier") {
        base.setTint(0xf4d0b5);
        hair.setTint(0xf2e2c7);
        tools.setTint(0xd4e0ee);
      }
      sprites.push(base, hair, tools);
    }

    for (const sprite of sprites) {
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
      const soil = this.add.sprite(0, 2, assetKeys.elements.soil).setOrigin(0.5, 0.5).setScale(1.2);
      const crop = this.add.sprite(0, -2, assetKeys.elements.carrot).setOrigin(0.5, 0.7).setScale(1.1);
      sprites.push(soil, crop);
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
    const graphics = this.add.graphics();
    container.add(graphics);
    const sprites: Phaser.GameObjects.Sprite[] = [];

    const atlasKey = buildingAtlasAssetKey(entity);
    let buildingAtlasType: BuildingType | undefined;
    if (atlasKey) {
      const sprite = this.add.sprite(0, buildingSpriteBaselineY(entity), atlasKey, 0).setOrigin(0.5, 1);
      setMaxDisplaySize(sprite, buildingAtlasVisualSize(entity));
      sprites.push(sprite);
      container.add(sprite);
      buildingAtlasType = entity.building?.type;
    } else if (buildingAssetKey(entity)) {
      const buildingKey = buildingAssetKey(entity);
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
    return { container, sprites, graphics, selection, health, buildingAtlasType };
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
    if (view.buildingAtlasType && entity.building) {
      this.updateAtlasBuildingSprite(entity, view, ownerAge ?? "genesis");
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

  private updateAtlasBuildingSprite(entity: GameEntity, view: EntityView, ownerAge: AgeId): void {
    const sprite = view.sprites[0];
    if (!sprite || !entity.building || !view.buildingAtlasType) {
      return;
    }

    sprite.clearTint();
    sprite.setAlpha(1);
    sprite.setOrigin(0.5, 1);
    sprite.setY(buildingSpriteBaselineY(entity));
    setMaxDisplaySize(sprite, buildingAtlasVisualSize(entity));

    if (!entity.building.completed) {
      const frame = entity.health && entity.health.current <= 0 ? BUILDING_ATLAS_DESTROYED_FRAME : BUILDING_ATLAS_CONSTRUCTION_FRAME;
      if (view.lastBuildingAnimation) {
        sprite.stop();
        view.lastBuildingAnimation = undefined;
      }
      sprite.setFrame(frame);
      sprite.setAlpha(0.9);
      return;
    }

    const animationKey = buildingIdleAnimationKey(view.buildingAtlasType, ownerAge);
    if (view.lastBuildingAnimation !== animationKey) {
      view.lastBuildingAnimation = animationKey;
      sprite.play(animationKey, true);
    }
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
    if (!selected) {
      return;
    }
    const color = entity.kind === "resource" ? 0xf2d36b : entity.ownerId === PLAYER_ID ? 0xb4f36b : 0xe85a4a;
    view.selection.lineStyle(2, color, 0.95);
    if (entity.building) {
      return;
    } else {
      view.selection.strokeEllipse(0, -5, 22, 12);
    }
  }

  private drawHealth(entity: GameEntity, view: EntityView): void {
    view.health.clear();
    if (!entity.health) {
      return;
    }
    const shouldDraw = entity.health.current < entity.health.max || this.simulation.state.selection.selectedIds.includes(entity.id);
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
      if (canPlaceBuildingAt(this.simulation.state, "wall", tile)) {
        this.wallLineStartTile = tile;
      }
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

    const tiles = wallLineTiles(this.wallLineStartTile, end);
    const middle = tiles[Math.floor(tiles.length / 2)] ?? this.wallLineStartTile;
    this.showCommandIndicator({ x: (middle.x + 0.5) * TILE_SIZE, y: (middle.y + 0.5) * TILE_SIZE }, "build");
    this.cancelPlacement();
    this.dragStartWorld = undefined;
    this.dragStartScreen = undefined;
  }

  private updatePlacementPreview(): void {
    this.placementGraphics?.clear();
    if (!this.placementType) {
      return;
    }
    const pointer = this.input.activePointer;
    const tile = worldToTile({ x: pointer.worldX, y: pointer.worldY });
    if (this.placementType === "wall") {
      this.updateWallPlacementPreview(tile);
      return;
    }
    const config = buildingConfigs[this.placementType];
    const valid = canPlaceBuildingAt(this.simulation.state, this.placementType, tile);
    const x = tile.x * TILE_SIZE;
    const y = tile.y * TILE_SIZE;
    const width = config.footprint.w * TILE_SIZE;
    const height = config.footprint.h * TILE_SIZE;
    this.placementGraphics?.fillStyle(valid ? 0x6ee75a : 0xdd5143, 0.28);
    this.placementGraphics?.fillRect(x, y, width, height);
    this.placementGraphics?.lineStyle(2, valid ? 0x9cff70 : 0xff7d68, 0.9);
    this.placementGraphics?.strokeRect(x, y, width, height);
  }

  private updateWallPlacementPreview(hoverTile: TileCoord): void {
    const start = this.wallLineStartTile ?? hoverTile;
    const end = normalizeWallLineEnd(start, hoverTile);
    const tiles = wallLineTiles(start, end);
    const valid = canPlaceWallLineAt(this.simulation.state, start, end);
    for (const tile of tiles) {
      const x = tile.x * TILE_SIZE;
      const y = tile.y * TILE_SIZE;
      this.placementGraphics?.fillStyle(valid ? 0x6ee75a : 0xdd5143, 0.28);
      this.placementGraphics?.fillRect(x, y, TILE_SIZE, TILE_SIZE);
      this.placementGraphics?.lineStyle(1, valid ? 0x9cff70 : 0xff7d68, 0.9);
      this.placementGraphics?.strokeRect(x, y, TILE_SIZE, TILE_SIZE);
    }
  }

  private getEntityAt(point: Vec2): GameEntity | undefined {
    const entities = Object.values(this.simulation.state.entities)
      .filter((entity) => hitTestEntity(entity, point))
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
      this.setCursor(valid ? cursorUrl("hammer.png", 6, 6, "pointer") : cursorUrl("cancel.png", 5, 5, "not-allowed"));
      return;
    }

    if (this.keys.SPACE?.isDown) {
      this.setCursor("grab");
      return;
    }

    const selectedUnits = this.selectedUnitIds();
    if (selectedUnits.length === 0) {
      this.setCursor(cursorUrl("cursor_01.png", 1, 1, "default"));
      return;
    }

    const hover = this.getEntityAt({ x: pointer.worldX, y: pointer.worldY });
    if (hover?.ownerId && hover.ownerId !== PLAYER_ID) {
      this.setCursor(cursorUrl("sword.png", 7, 7, "crosshair"));
      return;
    }
    if (hover && isGatherableEntity(hover) && this.selectedWorkerIds().length > 0) {
      const resourceType = hover.resourceNode?.resourceType ?? hover.farm?.resourceType;
      if (resourceType === "wood") {
        this.setCursor(cursorUrl("axe.png", 6, 6, "pointer"));
      } else if (resourceType === "stone" || resourceType === "gold") {
        this.setCursor(cursorUrl("pickaxe.png", 6, 6, "pointer"));
      } else {
        this.setCursor(cursorUrl("basket.png", 6, 6, "pointer"));
      }
      return;
    }

    this.setCursor(cursorUrl("cursor_03.png", 6, 6, "pointer"));
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

function terrainFrameForChunk(map: MapState, startX: number, startY: number): number {
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

  for (let y = startY; y < Math.min(map.height, startY + TERRAIN_CHUNK_TILES); y += 1) {
    for (let x = startX; x < Math.min(map.width, startX + TERRAIN_CHUNK_TILES); x += 1) {
      const tile = map.tiles[y * map.width + x] ?? "grass";
      counts[tile] += 1;
    }
  }

  if (counts.deepWater >= 3) {
    return TERRAIN_FRAMES.deepWater;
  }
  if (counts.water >= 3) {
    return TERRAIN_FRAMES.water;
  }
  if (counts.crystalGround >= 2) {
    return TERRAIN_FRAMES.crystalDirt;
  }
  if (counts.stoneGround >= 2) {
    return TERRAIN_FRAMES.rocky;
  }
  if (counts.path >= 2) {
    return TERRAIN_FRAMES.dirt;
  }
  if (counts.dirt >= 2) {
    return TERRAIN_FRAMES.dirt;
  }
  if (counts.grassDark > 8 && hash2(startX, startY) % 9 === 0) {
    return TERRAIN_FRAMES.rocky;
  }
  return TERRAIN_FRAMES.grass;
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

function resourceVisualFor(entity: GameEntity): ResourceVisual | undefined {
  const node = entity.resourceNode;
  if (!node) {
    return undefined;
  }

  const depleted = node.amount <= 0;
  switch (node.type) {
    case "tree":
      if (depleted) {
        return {
          key: assetKeys.aobMap.stump,
          maxSize: 30,
          originX: 0.5,
          originY: 0.82,
          x: 0,
          y: 4,
          alpha: 0.95,
        };
      }
      return {
        key: assetKeys.aobMap.trees,
        maxSize: 62 + (numericId(entity.id) % 4) * 3,
        originX: 0.5,
        originY: 0.86,
        x: 0,
        y: 2,
        tint: numericId(entity.id) % 3 === 0 ? 0xe3f2b1 : undefined,
      };
    case "berries":
      if (depleted) {
        return {
          key: assetKeys.aobMap.bush,
          maxSize: 27,
          originX: 0.5,
          originY: 0.78,
          x: 0,
          y: 3,
          alpha: 0.9,
        };
      }
      return {
        key: assetKeys.aobMap.fruitBush,
        maxSize: 39 + (numericId(entity.id) % 3) * 3,
        originX: 0.5,
        originY: 0.77,
        x: 0,
        y: 1,
      };
    case "stone": {
      const depletedStone = {
        key: assetKeys.aobMap.rock,
        maxSize: 22,
        originX: 0.5,
        originY: 0.76,
        x: 0,
        y: 3,
        alpha: 0.65,
      };
      if (depleted) {
        return depletedStone;
      }
      const key = numericId(entity.id) % 2 === 0 ? assetKeys.aobMap.rocks : assetKeys.aobMap.bigRocks;
      return {
        key,
        maxSize: key === assetKeys.aobMap.rocks ? 42 : 50,
        originX: 0.5,
        originY: 0.76,
        x: 0,
        y: 1,
      };
    }
    case "gold":
      return {
        key: assetKeys.aobMap.crystalNode,
        maxSize: depleted ? 28 : 48,
        originX: 0.5,
        originY: 0.78,
        x: 0,
        y: depleted ? 3 : -1,
        alpha: depleted ? 0.55 : 1,
      };
    case "farmFood":
    default:
      return undefined;
  }
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
  switch (entity.building?.type) {
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

function buildingVisualSize(entity: GameEntity): number {
  switch (entity.building?.type) {
    case "townCenter":
      return 94;
    case "barracks":
      return 88;
    case "farm":
      return 76;
    case "house":
      return 52;
    case "lumberCamp":
    case "mill":
    case "stoneCamp":
    case "goldCamp":
      return 70;
    case "watchTower":
      return 66;
    case "wall":
      return 24;
    default:
      return entity.building ? Math.max(entity.building.footprint.w, entity.building.footprint.h) * TILE_SIZE * 1.35 : 48;
  }
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
  return buildingSpriteBaselineY(entity) - buildingVisualSize(entity) - 8;
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
    drawWall(graphics, entity, ownerAge ?? "genesis");
    return;
  }
  const config = buildingConfigs[entity.building.type];
  const width = entity.building.footprint.w * TILE_SIZE;
  const height = entity.building.footprint.h * TILE_SIZE;
  const alpha = entity.building.completed ? 0.96 : 0.52;
  const x = -width / 2;
  const y = -height / 2;
  const progress = entity.building.completed ? 1 : entity.building.buildProgress / Math.max(1, entity.building.buildTimeTicks);

  if (hasSprite) {
    graphics.fillStyle(0x17110c, 0.18);
    graphics.fillEllipse(0, height * 0.42, width * 0.92, Math.max(8, height * 0.22));
    drawAgeFoundation(graphics, ownerAge, width, height);
    if (!entity.building.completed) {
      graphics.fillStyle(0xe3b85c, 0.95);
      graphics.fillRect(x + 3, y + height - 7, (width - 6) * progress, 4);
      graphics.lineStyle(1, 0xf4dc94, 0.7);
      graphics.strokeRect(x, y, width, height);
    }
    if (entity.farm?.depleted) {
      graphics.fillStyle(0x251914, 0.5);
      graphics.fillRect(x + 4, y + 5, width - 8, height - 10);
      graphics.lineStyle(1, 0xd7b56d, 0.8);
      graphics.strokeRect(x + 5, y + 6, width - 10, height - 12);
    }
    return;
  }
  graphics.fillStyle(0x221712, 0.28);
  graphics.fillRect(x + 2, y + 4, width, height);
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

function drawAgeFoundation(graphics: Phaser.GameObjects.Graphics, ownerAge: AgeId | undefined, width: number, height: number): void {
  if (ownerAge === "settlement") {
    graphics.fillStyle(0x5f5a55, 0.42);
    graphics.fillRect(-width * 0.42, height * 0.28, width * 0.84, 5);
    graphics.lineStyle(1, 0xbcb09b, 0.5);
    graphics.lineBetween(-width * 0.38, height * 0.31, width * 0.38, height * 0.31);
    return;
  }
  if (ownerAge === "network") {
    graphics.fillStyle(0x233942, 0.46);
    graphics.fillRect(-width * 0.44, height * 0.27, width * 0.88, 6);
    graphics.lineStyle(1, 0x67d9eb, 0.68);
    graphics.lineBetween(-width * 0.36, height * 0.29, width * 0.36, height * 0.29);
    graphics.fillStyle(0x67d9eb, 0.78);
    graphics.fillCircle(-width * 0.28, height * 0.3, 1.5);
    graphics.fillCircle(width * 0.28, height * 0.3, 1.5);
  }
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

  graphics.fillStyle(0x120e0b, 0.2);
  graphics.fillEllipse(0, 5, width * 0.95, 8);
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

function hitTestEntity(entity: GameEntity, point: Vec2): boolean {
  if (entity.building) {
    const width = entity.building.footprint.w * TILE_SIZE;
    const height = entity.building.footprint.h * TILE_SIZE;
    return point.x >= entity.position.x - width / 2 && point.x <= entity.position.x + width / 2 && point.y >= entity.position.y - height / 2 && point.y <= entity.position.y + height / 2;
  }
  if (entity.resourceNode) {
    return Phaser.Math.Distance.Between(entity.position.x, entity.position.y, point.x, point.y) <= resourceHitRadius(entity);
  }
  return Phaser.Math.Distance.Between(entity.position.x, entity.position.y, point.x, point.y) <= entity.radius + 8;
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

function cursorUrl(fileName: string, hotX: number, hotY: number, fallback: string): string {
  return `url("/assets/sunnyside/ui/${fileName}") ${hotX} ${hotY}, ${fallback}`;
}
