import { PLAYER_ID, RESOURCE_TYPES, type AgeId, type ResourceType } from "../../data/constants";
import { ageConfigs, buildingConfigs, canAfford, costForBuilding, hasReachedAge, labelForBuilding, unitConfigs, wallTierForAge } from "../../data/definitions";
import type { BuildingType, GameEntity, UnitType } from "../../core/entities/types";
import { workerTaskCountsForPlayer } from "../../core/selectors/economy";
import { objectiveViewsForState } from "../../core/selectors/objectives";
import type { GameState } from "../../core/state/types";

type HudCallbacks = {
  onBuildRequest: (buildingType: BuildingType) => void;
  onOpenBuildMenu: () => void;
  onOpenBuildCategory: (category: BuildCategoryId) => void;
  onCloseBuildMenu: () => void;
  onCancelPlacement: () => void;
  onClearWallDraft: () => void;
  onToggleWallOrientation: () => void;
  onConfirmPlacement: () => void;
  onTrainRequest: (unitType: UnitType) => void;
  onAdvanceAgeRequest: () => void;
  onReseedFarmRequest: (farmId: string) => void;
  onCancelConstruction: (buildingId: string) => void;
  onDestroyBuilding: (buildingId: string) => void;
  onSelectIdleWorker: () => void;
  onSelectTownCenter: () => void;
};

export type HudRenderContext = {
  placementType?: BuildingType;
  wallLineStarted: boolean;
  wallSegmentCount: number;
  wallPlacementCanConfirm: boolean;
  wallOrientationMode: "auto" | "horizontal" | "vertical";
  buildMenuOpen: boolean;
  buildMenuCategory?: BuildCategoryId;
  camera?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
};

export type BuildCategoryId = "economy" | "military" | "defense";

export const BUILD_GROUPS: {
  id: BuildCategoryId;
  label: string;
  hotkey: string;
  detail: string;
  iconBuilding: BuildingType;
  buildings: BuildingType[];
}[] = [
  { id: "economy", label: "Economy", hotkey: "Q", detail: "Housing, farms, and drop-off camps.", iconBuilding: "mill", buildings: ["house", "farm", "mill", "lumberCamp", "stoneCamp", "goldCamp"] },
  { id: "military", label: "Military", hotkey: "W", detail: "Barracks and cavalry production.", iconBuilding: "stable", buildings: ["barracks", "stable"] },
  { id: "defense", label: "Defense", hotkey: "E", detail: "Towers and palisade walls.", iconBuilding: "watchTower", buildings: ["watchTower", "wall"] },
];

const MAX_VISIBLE_OBJECTIVES = 5;

export const BUILDING_HOTKEYS: Partial<Record<BuildingType, string>> = {
  house: "Q",
  farm: "W",
  mill: "E",
  lumberCamp: "A",
  stoneCamp: "S",
  goldCamp: "D",
  barracks: "Q",
  stable: "W",
  watchTower: "Q",
  wall: "W",
};

export const BUILDING_HOTKEYS_BY_CATEGORY: Record<BuildCategoryId, Partial<Record<BuildingType, string>>> = {
  economy: {
    house: "Q",
    farm: "W",
    mill: "E",
    lumberCamp: "A",
    stoneCamp: "S",
    goldCamp: "D",
  },
  military: {
    barracks: "Q",
    stable: "W",
  },
  defense: {
    watchTower: "Q",
    wall: "W",
  },
};

export const UNIT_HOTKEYS: Partial<Record<UnitType, string>> = {
  worker: "Q",
  soldier: "Q",
  archer: "E",
  scout: "Q",
};

export const ADVANCE_AGE_HOTKEY = "T";

const RESOURCE_ICON_PATHS: Record<ResourceType, string> = {
  food: "/assets/sunnyside/elements/wheat_05.png",
  wood: "/assets/sunnyside/elements/wood.png",
  stone: "/assets/sunnyside/elements/rock.png",
  gold: "/last-assets/runtime/icon-gold.png",
};

const POPULATION_ICON_PATH = "/assets/sunnyside/ui/indicator.png";
const WALL_ICON_PATH = "/last-assets/runtime/wall-palisade-horizontal.png?v=20260424-225617";
const SOLANA_CREST_PATH = "/assets/aob-map/runtime/solana-ui-crest.png";
const SOLANA_STABLE_PATH = "/assets/aob-map/solana/buildings/solana-stable-t1.png";
const UNIT_PORTRAIT_PATHS: Partial<Record<UnitType, string>> = {
  worker: "/assets/ui/portraits/villager.png",
  soldier: "/assets/ui/portraits/knight.png",
  archer: "/assets/ui/portraits/archer.png",
  scout: "/assets/ui/portraits/scout.png",
};

const BUILDING_ICON_PATHS: Partial<Record<BuildingType, Record<AgeId, string>>> = {
  townCenter: {
    genesis: "/last-assets/hdv-t1.png",
    settlement: "/last-assets/hdv-t2.png",
    network: "/last-assets/hdv-t3.png",
  },
  house: {
    genesis: "/assets/aob-buildings/static-runtime/house-t1.png",
    settlement: "/assets/aob-buildings/static-runtime/house-t2.png",
    network: "/assets/aob-buildings/static-runtime/house-t3.png",
  },
  farm: {
    genesis: "/assets/aob-buildings/static-runtime/farm-t1.png",
    settlement: "/assets/aob-buildings/static-runtime/farm-t2.png",
    network: "/assets/aob-buildings/static-runtime/farm-t3.png",
  },
  mill: {
    genesis: "/assets/aob-buildings/static-runtime/mill-t1.png",
    settlement: "/assets/aob-buildings/static-runtime/mill-t2.png",
    network: "/assets/aob-buildings/static-runtime/mill-t3.png",
  },
  lumberCamp: {
    genesis: "/assets/aob-buildings/static-runtime/lumber-camp-t1.png",
    settlement: "/assets/aob-buildings/static-runtime/lumber-camp-t2.png",
    network: "/assets/aob-buildings/static-runtime/lumber-camp-t3.png",
  },
  stoneCamp: {
    genesis: "/assets/aob-buildings/static-runtime/stone-camp-t1.png",
    settlement: "/assets/aob-buildings/static-runtime/stone-camp-t2.png",
    network: "/assets/aob-buildings/static-runtime/stone-camp-t3.png",
  },
  goldCamp: {
    genesis: "/assets/aob-buildings/static-runtime/gold-camp-t1.png",
    settlement: "/assets/aob-buildings/static-runtime/gold-camp-t2.png",
    network: "/assets/aob-buildings/static-runtime/gold-camp-t3.png",
  },
  barracks: {
    genesis: "/assets/aob-buildings/static-runtime/barracks-t1.png",
    settlement: "/assets/aob-buildings/static-runtime/barracks-t2.png",
    network: "/assets/aob-buildings/static-runtime/barracks-t3.png",
  },
  stable: {
    genesis: SOLANA_STABLE_PATH,
    settlement: SOLANA_STABLE_PATH,
    network: SOLANA_STABLE_PATH,
  },
  watchTower: {
    genesis: "/assets/aob-buildings/static-runtime/watch-tower-t1.png",
    settlement: "/assets/aob-buildings/static-runtime/watch-tower-t2.png",
    network: "/assets/aob-buildings/static-runtime/watch-tower-t3.png",
  },
  wall: {
    genesis: WALL_ICON_PATH,
    settlement: WALL_ICON_PATH,
    network: WALL_ICON_PATH,
  },
};

export class HudController {
  private lastMarkup = "";

  constructor(
    private readonly root: HTMLElement,
    private readonly callbacks: HudCallbacks,
  ) {}

  render(state: GameState, context: HudRenderContext): void {
    const markup = this.createMarkup(state, context);
    if (markup === this.lastMarkup) {
      return;
    }

    this.root.innerHTML = markup;
    this.lastMarkup = markup;
    this.bindEvents();
  }

  destroy(): void {
    this.root.innerHTML = "";
  }

  private createMarkup(state: GameState, context: HudRenderContext): string {
    const player = state.players[PLAYER_ID];
    const selected = state.selection.selectedIds.map((id) => state.entities[id]).filter(Boolean);
    const primary = selected[0];
    const resourceMarkup = RESOURCE_TYPES.map((type) => resourcePill(type, player.resources[type])).join("");
    const queuedPopulation = queuedPopulationForPlayer(state);
    const population = populationStatus(state);
    const age = ageConfigs[player.age];
    const workerTasks = workerTaskCountsForPlayer(state);
    const ageProgress = player.ageProgress
      ? `<span class="status-pill age-pill"><span>${ageConfigs[player.ageProgress.targetAge].label}</span><span class="age-progress"><span style="width:${Math.round((1 - player.ageProgress.remainingTicks / player.ageProgress.totalTicks) * 100)}%"></span></span></span>`
      : `<span class="status-pill age-pill">${age.label}</span>`;

    return `
      <div class="hud-topbar">
        <div class="hud-brand">
          <span class="hud-crest"><img class="hud-crest-img" src="${SOLANA_CREST_PATH}" alt=""></span>
          <span class="hud-title">Age of Blockchains</span>
        </div>
        <div class="resource-strip">${resourceMarkup}</div>
        <div class="status-strip">
          ${ageProgress}
          <button class="status-pill status-action" data-select-town-center="true">H</button>
          <button class="status-pill status-action ${workerTasks.idle > 0 ? "" : "status-action--quiet"}" data-select-idle="true">Idle <strong>${workerTasks.idle}</strong></button>
          <span class="status-pill ${population.pillClass}">
            <img class="resource-icon-img" src="${POPULATION_ICON_PATH}" alt="">
            <strong>${player.population}/${player.populationCap}</strong>${queuedPopulation > 0 ? `<span class="queued-pop">+${queuedPopulation}</span>` : ""}
          </span>
        </div>
      </div>
      ${population.banner}
      ${workerSummaryMarkup(workerTasks)}
      ${objectivesMarkup(state)}
      ${minimapMarkup(state, context)}
      ${primary ? panelMarkup(primary, selected, state) : ""}
      ${commandDockMarkup(state, primary, context)}
      ${messagesMarkup(state)}
    `;
  }

  private bindEvents(): void {
    this.root.querySelectorAll<HTMLButtonElement>("[data-build]").forEach((button) => {
      button.addEventListener("click", () => {
        const buildingType = button.dataset.build as BuildingType | undefined;
        if (buildingType) {
          this.callbacks.onBuildRequest(buildingType);
        }
      });
    });
    this.root.querySelectorAll<HTMLButtonElement>("[data-open-build]").forEach((button) => {
      button.addEventListener("click", () => this.callbacks.onOpenBuildMenu());
    });
    this.root.querySelectorAll<HTMLButtonElement>("[data-build-category]").forEach((button) => {
      button.addEventListener("click", () => {
        const category = button.dataset.buildCategory as BuildCategoryId | undefined;
        if (category) {
          this.callbacks.onOpenBuildCategory(category);
        }
      });
    });
    this.root.querySelectorAll<HTMLButtonElement>("[data-close-build]").forEach((button) => {
      button.addEventListener("click", () => this.callbacks.onCloseBuildMenu());
    });
    this.root.querySelectorAll<HTMLButtonElement>("[data-train]").forEach((button) => {
      button.addEventListener("click", () => {
        const unitType = button.dataset.train as UnitType | undefined;
        if (unitType) {
          this.callbacks.onTrainRequest(unitType);
        }
      });
    });
    this.root.querySelectorAll<HTMLButtonElement>("[data-advance]").forEach((button) => {
      button.addEventListener("click", () => this.callbacks.onAdvanceAgeRequest());
    });
    this.root.querySelectorAll<HTMLButtonElement>("[data-reseed]").forEach((button) => {
      button.addEventListener("click", () => {
        const farmId = button.dataset.reseed;
        if (farmId) {
          this.callbacks.onReseedFarmRequest(farmId);
        }
      });
    });
    this.root.querySelectorAll<HTMLButtonElement>("[data-cancel-construction]").forEach((button) => {
      button.addEventListener("click", () => {
        const buildingId = button.dataset.cancelConstruction;
        if (buildingId) {
          this.callbacks.onCancelConstruction(buildingId);
        }
      });
    });
    this.root.querySelectorAll<HTMLButtonElement>("[data-destroy-building]").forEach((button) => {
      button.addEventListener("click", () => {
        const buildingId = button.dataset.destroyBuilding;
        if (buildingId) {
          this.callbacks.onDestroyBuilding(buildingId);
        }
      });
    });
    this.root.querySelectorAll<HTMLButtonElement>("[data-cancel-placement]").forEach((button) => {
      button.addEventListener("click", () => this.callbacks.onCancelPlacement());
    });
    this.root.querySelectorAll<HTMLButtonElement>("[data-clear-wall-draft]").forEach((button) => {
      button.addEventListener("click", () => this.callbacks.onClearWallDraft());
    });
    this.root.querySelectorAll<HTMLButtonElement>("[data-toggle-wall-orientation]").forEach((button) => {
      button.addEventListener("click", () => this.callbacks.onToggleWallOrientation());
    });
    this.root.querySelectorAll<HTMLButtonElement>("[data-confirm-placement]").forEach((button) => {
      button.addEventListener("click", () => this.callbacks.onConfirmPlacement());
    });
    this.root.querySelectorAll<HTMLButtonElement>("[data-select-idle]").forEach((button) => {
      button.addEventListener("click", () => this.callbacks.onSelectIdleWorker());
    });
    this.root.querySelectorAll<HTMLButtonElement>("[data-select-town-center]").forEach((button) => {
      button.addEventListener("click", () => this.callbacks.onSelectTownCenter());
    });
  }
}

function resourcePill(type: ResourceType, value: number): string {
  return `
    <span class="resource-pill">
      <img class="resource-icon-img" src="${RESOURCE_ICON_PATHS[type]}" alt="">
      <span class="resource-label">${label(type)}</span>
      <strong>${Math.floor(value)}</strong>
    </span>
  `;
}

function workerSummaryMarkup(workerTasks: ReturnType<typeof workerTaskCountsForPlayer>): string {
  return `
    <div class="worker-summary">
      <span><strong>${workerTasks.total}</strong> villagers</span>
      <span>Gather ${workerTasks.gathering}</span>
      <span>Build ${workerTasks.building}</span>
      <span>Repair ${workerTasks.repairing}</span>
      <span>Carry ${workerTasks.carrying}</span>
    </div>
  `;
}

function objectivesMarkup(state: GameState): string {
  const { hiddenAfter, hiddenBefore, visibleObjectives } = visibleObjectivesForPanel(state);
  return `
    <div class="objective-panel">
      <div class="objective-title">Objectives</div>
      <div class="objective-list">
        ${visibleObjectives
          .map(
            (objective) => `
              <div class="objective-row objective-row--${objective.status}">
                <span class="objective-marker">${objective.status === "done" ? "OK" : objective.status === "active" ? "!" : ""}</span>
                <span class="objective-copy">
                  <span class="objective-name">${objective.title}</span>
                  <span class="objective-detail">${objective.detail}</span>
                </span>
                <span class="objective-progress">${objective.current}/${objective.target}</span>
              </div>
            `,
          )
          .join("")}
        ${objectiveMoreMarkup(hiddenBefore, hiddenAfter)}
      </div>
    </div>
  `;
}

function visibleObjectivesForPanel(state: GameState): {
  hiddenAfter: number;
  hiddenBefore: number;
  visibleObjectives: ReturnType<typeof objectiveViewsForState>;
} {
  const objectives = objectiveViewsForState(state);
  if (objectives.length <= MAX_VISIBLE_OBJECTIVES) {
    return { hiddenAfter: 0, hiddenBefore: 0, visibleObjectives: objectives };
  }

  const activeIndex = Math.max(
    0,
    objectives.findIndex((objective) => objective.status === "active"),
  );
  const maxStart = Math.max(0, objectives.length - MAX_VISIBLE_OBJECTIVES);
  const start = Math.min(maxStart, Math.max(0, activeIndex - 2));
  const visibleObjectives = objectives.slice(start, start + MAX_VISIBLE_OBJECTIVES);
  return {
    hiddenAfter: Math.max(0, objectives.length - start - visibleObjectives.length),
    hiddenBefore: start,
    visibleObjectives,
  };
}

function objectiveMoreMarkup(hiddenBefore: number, hiddenAfter: number): string {
  if (hiddenBefore === 0 && hiddenAfter === 0) {
    return "";
  }
  const parts = [
    hiddenBefore > 0 ? `${hiddenBefore} earlier` : "",
    hiddenAfter > 0 ? `${hiddenAfter} later` : "",
  ].filter(Boolean);
  return `<div class="objective-more">${parts.join(" / ")}</div>`;
}

function panelMarkup(primary: GameEntity | undefined, selected: GameEntity[], state: GameState): string {
  const title = panelTitle(primary, selected);
  const details = primary ? detailsFor(primary, selected, state) : "No selection";
  const meta = primary ? panelMeta(primary, selected, state) : "";
  const stats = primary ? selectionStatsMarkup(primary, selected) : "";
  const extra = primary ? panelExtraMarkup(primary, state) : "";
  return `
    <div class="hud-bottom-panel">
      <div class="hud-panel-header">
        ${selectionPortrait(primary, selected, state)}
        <div class="hud-panel-heading">
          <div class="hud-panel-title">${title}</div>
          ${meta}
          ${stats}
        </div>
      </div>
      <div class="hud-panel-grid">
        <div class="hud-info-list">${details}</div>
        <div class="hud-info-list hud-info-help">${selectionHelp(primary, state)}</div>
        ${extra}
      </div>
    </div>
  `;
}

function panelExtraMarkup(primary: GameEntity, state: GameState): string {
  const queue = productionQueueMarkup(primary);
  const age = ageProgressMarkup(primary, state);
  if (!queue && !age) {
    return "";
  }
  return `<div class="hud-panel-extra">${queue}${age}</div>`;
}

function productionQueueMarkup(entity: GameEntity): string {
  if (!entity.producer) {
    return "";
  }
  if (entity.producer.queue.length === 0) {
    return `
      <div class="queue-box">
        <div class="queue-title">Production Queue</div>
        <div class="queue-empty">No units queued.</div>
      </div>
    `;
  }
  return `
    <div class="queue-box">
      <div class="queue-title">Production Queue</div>
      <div class="queue-list">
        ${entity.producer.queue
          .map((item, index) => {
            const progress = Math.round((1 - item.remainingTicks / Math.max(1, item.totalTicks)) * 100);
            return `
              <div class="queue-item ${index === 0 ? "queue-item--active" : ""}">
                ${unitPortraitMarkup(item.unitType, "queue-unit-icon")}
                <span>${unitConfigs[item.unitType].label}</span>
                <strong>${index === 0 ? `${progress}%` : "Queued"}</strong>
                ${index === 0 ? `<span class="queue-progress"><span style="width:${progress}%"></span></span>` : ""}
              </div>
            `;
          })
          .join("")}
      </div>
    </div>
  `;
}

function ageProgressMarkup(entity: GameEntity, state: GameState): string {
  const progress = state.players[PLAYER_ID].ageProgress;
  if (!progress || entity.building?.type !== "townCenter") {
    return "";
  }
  const ratio = Math.round((1 - progress.remainingTicks / Math.max(1, progress.totalTicks)) * 100);
  return `
    <div class="queue-box">
      <div class="queue-title">Age Progress</div>
      <div class="queue-item queue-item--active">
        <span>${ageConfigs[progress.targetAge].label}</span>
        <strong>${ratio}%</strong>
        <span class="queue-progress"><span style="width:${ratio}%"></span></span>
      </div>
    </div>
  `;
}

function commandDockMarkup(state: GameState, primary: GameEntity | undefined, context: HudRenderContext): string {
  if (context.placementType) {
    if (context.placementType === "wall") {
      const labelText = context.wallLineStarted
        ? `${context.wallSegmentCount} wall segment${context.wallSegmentCount === 1 ? "" : "s"} preview`
        : "Drag wall line";
      return `
        <div class="command-dock">
          <div class="command-section">
          <div class="command-label">${labelText}</div>
          <div class="hud-inline-note">Hold left click, drag the line, release to build.</div>
            <button class="command-button command-wide" data-toggle-wall-orientation="true"><span class="command-title">Direction: ${wallOrientationLabel(context.wallOrientationMode)}</span></button>
            <button class="command-button command-wide" data-clear-wall-draft="true" ${context.wallLineStarted ? "" : "disabled"}><span class="command-title">Clear Preview</span></button>
            <button class="command-button command-wide" data-cancel-placement="true"><span class="command-hotkey">Esc</span><span class="command-title">Exit Wall Mode</span></button>
          </div>
        </div>
      `;
    }
    const labelText = `Placing ${labelForBuilding(context.placementType, state.players[PLAYER_ID].age)}`;
    return `
      <div class="command-dock">
        <div class="command-section">
          <div class="command-label">${labelText}</div>
          <button class="command-button command-wide" data-cancel-placement="true"><span class="command-hotkey">Esc</span><span class="command-title">Cancel</span></button>
        </div>
      </div>
    `;
  }

  if (!primary) {
    return "";
  }

  const hasWorker = state.selection.selectedIds.some((id) => Boolean(state.entities[id]?.worker && state.entities[id]?.ownerId === PLAYER_ID));
  if (context.buildMenuOpen && hasWorker) {
    const population = populationStatus(state);
    const title = context.buildMenuCategory ? buildGroupForId(context.buildMenuCategory).label : "Build";
    return `
      <div class="command-dock">
        <div class="command-section">
          <button class="command-button command-wide" data-close-build="true"><span class="command-hotkey">Esc</span><span class="command-title">Back</span></button>
          <div class="command-label command-label--group">
            <span>${title}</span>
            <span class="command-label-meta">${context.buildMenuCategory ? "Buildings" : "Categories"}</span>
          </div>
          ${population.buildHint}
          ${buildMenuMarkup(state, context.buildMenuCategory)}
        </div>
      </div>
    `;
  }

  const trainButtons = primary?.building?.completed && primary.producer ? producerButtons(primary, state) : "";
  const currentAge = state.players[PLAYER_ID].age;
  const nextAge = ageConfigs[currentAge].nextAge;
  const ageButton =
    primary?.building?.type === "townCenter" && nextAge
      ? `<button class="command-button" data-advance="true" ${state.players[PLAYER_ID].ageProgress ? "disabled" : ""}>${hotkeyBadge(ADVANCE_AGE_HOTKEY)}<span class="command-title">Advance</span><span class="command-subtitle">${ageConfigs[nextAge].label}</span>${costLabel(ageConfigs[currentAge].advanceCost)}</button>`
      : "";
  const reseedButton =
    primary?.farm && primary.farm.depleted
      ? `<button class="command-button" data-reseed="${primary.id}">Reseed<br>${costLabel(primary.farm.reseedCost)}</button>`
      : "";
  const workerCommands = hasWorker ? `<div class="command-label">Villager</div><div class="command-grid"><button class="command-button" data-open-build="true">${hotkeyBadge("B")}<span class="command-title">Build</span></button></div>` : "";
  const townCenterUtilityButtons = townCenterUtilityMarkup(primary, state);
  const lifecycleButtons = buildingLifecycleButtons(primary);
  const buildingCommands =
    trainButtons || ageButton || reseedButton || lifecycleButtons || townCenterUtilityButtons
      ? `${trainButtons ? `<div class="command-label">Produce</div><div class="command-grid">${trainButtons}${ageButton}</div>` : ""}${!trainButtons && ageButton ? `<div class="command-label">Town Center</div><div class="command-grid">${ageButton}</div>` : ""}${townCenterUtilityButtons}${reseedButton ? `<div class="command-label">Farm</div><div class="command-grid">${reseedButton}</div>` : ""}${lifecycleButtons ? `<div class="command-label">Structure</div><div class="command-grid">${lifecycleButtons}</div>` : ""}`
      : "";

  if (!workerCommands && !buildingCommands) {
    return "";
  }

  return `
    <div class="command-dock">
      <div class="command-section">
        ${workerCommands}
        ${buildingCommands}
      </div>
    </div>
  `;
}

function townCenterUtilityMarkup(primary: GameEntity | undefined, state: GameState): string {
  if (primary?.building?.type !== "townCenter" || !primary.building.completed || primary.ownerId !== PLAYER_ID) {
    return "";
  }
  const idle = workerTaskCountsForPlayer(state).idle;
  return `
    <div class="command-label">Town Center</div>
    <div class="command-grid">
      <button class="command-button" data-select-idle="true">
        ${hotkeyBadge(".")}
        ${unitPortraitMarkup("worker", "command-unit-icon")}
        <span class="command-title">Idle Villager</span>
        <span class="command-subtitle">${idle} available</span>
      </button>
    </div>
  `;
}

function buildingLifecycleButtons(primary: GameEntity | undefined): string {
  if (!primary?.building || primary.ownerId !== PLAYER_ID) {
    return "";
  }
  if (!primary.building.completed) {
    return `<button class="command-button command-button--danger" data-cancel-construction="${primary.id}">${hotkeyBadge("Del")}<span class="command-title">Cancel</span><span class="command-subtitle">Refund</span></button>`;
  }
  if (primary.building.type === "townCenter") {
    return "";
  }
  return `<button class="command-button command-button--danger" data-destroy-building="${primary.id}">${hotkeyBadge("Del")}<span class="command-title">Destroy</span><span class="command-subtitle">Delete</span></button>`;
}

function wallOrientationLabel(mode: HudRenderContext["wallOrientationMode"]): string {
  switch (mode) {
    case "horizontal":
      return "Horizontal";
    case "vertical":
      return "Vertical";
    case "auto":
      return "Auto";
  }
}

function buildMenuMarkup(state: GameState, category: BuildCategoryId | undefined): string {
  if (!category) {
    return buildCategoryMenuMarkup(state);
  }

  const group = buildGroupForId(category);
  const buttons = group.buildings.map((type) => buildButton(state, type, category)).join("");
  return `
    <div class="command-group command-group--active">
      <div class="command-label command-label--group">
        <span>${group.label}</span>
        <span class="command-label-meta">${group.buildings.length} options</span>
      </div>
      <div class="command-grid command-grid--build">${buttons}</div>
    </div>
  `;
}

function buildCategoryMenuMarkup(state: GameState): string {
  return `
    <div class="command-category-grid">
      ${BUILD_GROUPS.map((group) => buildCategoryButton(state, group)).join("")}
    </div>
  `;
}

function buildCategoryButton(state: GameState, group: (typeof BUILD_GROUPS)[number]): string {
  const playerAge = state.players[PLAYER_ID].age;
  const unlocked = group.buildings.filter((type) => hasReachedAge(playerAge, buildingConfigs[type].unlockedAge)).length;
  const iconPath = buildingIconPath(group.iconBuilding, playerAge);
  const icon = iconPath ? commandIconMarkup(iconPath, "command-icon-frame--category") : "";
  return `
    <button class="command-button command-category-button" data-build-category="${group.id}">
      ${hotkeyBadge(group.hotkey)}
      ${icon}
      <span class="command-category-copy">
        <span class="command-title">${group.label}</span>
        <span class="command-category-detail">${group.detail}</span>
        <span class="command-subtitle">${unlocked}/${group.buildings.length} unlocked</span>
      </span>
    </button>
  `;
}

function buildButton(state: GameState, type: BuildingType, category: BuildCategoryId): string {
  const player = state.players[PLAYER_ID];
  const config = buildingConfigs[type];
  const cost = costForBuilding(type, player.age);
  const locked = !hasReachedAge(player.age, config.unlockedAge);
  const affordable = canAfford(player.resources, cost);
  const disabled = locked;
  const labelText = shortLabel(labelForBuilding(type, player.age));
  const population = populationStatus(state);
  const suggested = type === "house" && population.blocked;
  const subtitle = locked ? ageConfigs[config.unlockedAge].label : undefined;
  const body = subtitle ? `<span class="lock-label">${subtitle}</span>` : costLabel(cost);
  const iconPath = buildingIconPath(type, player.age);
  const icon = iconPath ? commandIconMarkup(iconPath) : "";
  const classes = ["command-button", suggested ? "command-button--suggested" : "", !affordable ? "command-button--blocked" : ""].filter(Boolean).join(" ");
  return `<button class="${classes}" data-build="${type}" ${disabled ? "disabled" : ""}>${hotkeyBadge(BUILDING_HOTKEYS_BY_CATEGORY[category][type])}${icon}<span class="command-title">${labelText}</span>${body}</button>`;
}

function producerButtons(entity: GameEntity, state: GameState): string {
  const producerTypes = entity.building ? buildingConfigs[entity.building.type].producer ?? [] : [];
  const population = populationStatus(state);
  return producerTypes
    .map((type) => {
      const config = unitConfigs[type];
      const locked = !hasReachedAge(state.players[PLAYER_ID].age, config.unlockedAge);
      const affordable = canAfford(state.players[PLAYER_ID].resources, config.cost);
      const blockedByPopulation = population.usedWithQueue + config.population > population.cap;
      const disabled = locked;
      const reason = locked ? ageConfigs[config.unlockedAge].label : undefined;
      const body = reason ? `<span class="lock-label">${reason}</span>` : costLabel(config.cost);
      const classes = ["command-button", blockedByPopulation || !affordable ? "command-button--blocked" : ""].filter(Boolean).join(" ");
      return `<button class="${classes}" data-train="${type}" ${disabled ? "disabled" : ""}>${hotkeyBadge(UNIT_HOTKEYS[type])}${unitPortraitMarkup(type, "command-unit-icon")}<span class="command-title">${shortLabel(config.label)}</span>${body}</button>`;
    })
    .join("");
}

function commandIconMarkup(path: string, extraClass = ""): string {
  return `<span class="command-icon-frame ${extraClass}"><img class="command-icon" src="${path}" alt=""></span>`;
}

function hotkeyBadge(hotkey: string | undefined): string {
  return hotkey ? `<span class="command-hotkey">${hotkey}</span>` : "";
}

function buildGroupForId(id: BuildCategoryId): (typeof BUILD_GROUPS)[number] {
  return BUILD_GROUPS.find((group) => group.id === id) ?? BUILD_GROUPS[0];
}

function messagesMarkup(state: GameState): string {
  if (state.messages.length === 0) {
    return "";
  }
  return `
    <div class="message-log">
      ${state.messages
        .slice(-3)
        .map((message) => `<div class="message-line ${messageToneClass(message.text)}">${escapeHtml(message.text)}</div>`)
        .join("")}
    </div>
  `;
}

function minimapMarkup(state: GameState, context: HudRenderContext): string {
  const mapWidth = state.map.width * state.map.tileSize;
  const mapHeight = state.map.height * state.map.tileSize;
  const camera = context.camera;
  const cameraStyle = camera
    ? `left:${percent(camera.x, mapWidth)}%;top:${percent(camera.y, mapHeight)}%;width:${percent(camera.width, mapWidth)}%;height:${percent(camera.height, mapHeight)}%;`
    : "left:0%;top:0%;width:36%;height:28%;";
  const dots = Object.values(state.entities).map((entity) => minimapDot(entity, state)).join("");

  return `
    <div class="hud-minimap">
      <div class="minimap-frame">
        <div class="minimap-map">
          <div class="minimap-water"></div>
          <div class="minimap-rock"></div>
          <div class="minimap-crystal"></div>
          ${dots}
          <div class="minimap-camera" style="${cameraStyle}"></div>
        </div>
      </div>
    </div>
  `;
}

function minimapDot(entity: GameEntity, state: GameState): string {
  if (entity.ownerId !== PLAYER_ID && !isEntityExplored(state, entity)) {
    return "";
  }
  const left = percent(entity.position.x, state.map.width * state.map.tileSize);
  const top = percent(entity.position.y, state.map.height * state.map.tileSize);
  let className = "minimap-dot";
  if (entity.resourceNode) {
    className += ` minimap-dot--${entity.resourceNode.resourceType}`;
  } else if (entity.ownerId === PLAYER_ID && entity.kind === "building") {
    className += " minimap-dot--player-building";
  } else if (entity.ownerId === PLAYER_ID) {
    className += " minimap-dot--player-unit";
  } else if (entity.ownerId) {
    className += " minimap-dot--enemy";
  } else {
    className += " minimap-dot--neutral";
  }
  return `<span class="${className}" style="left:${left}%;top:${top}%;"></span>`;
}

function isEntityExplored(state: GameState, entity: GameEntity): boolean {
  const x = Math.floor(entity.position.x / state.map.tileSize);
  const y = Math.floor(entity.position.y / state.map.tileSize);
  if (x < 0 || y < 0 || x >= state.map.width || y >= state.map.height) {
    return false;
  }
  return Boolean(state.visibility.exploredTiles[y * state.map.width + x]);
}

function percent(value: number, total: number): number {
  if (total <= 0) {
    return 0;
  }
  return Math.round(Math.max(0, Math.min(100, (value / total) * 1000)) / 10);
}

function panelTitle(primary: GameEntity | undefined, selected: GameEntity[]): string {
  if (!primary) {
    return "Age Of Blockchains";
  }
  if (selected.length > 1) {
    return `${selected.length} selected`;
  }
  return primary.label;
}

function selectionStatsMarkup(primary: GameEntity, selected: GameEntity[]): string {
  if (selected.length > 1) {
    const workers = selected.filter((entity) => entity.worker).length;
    const fighters = selected.filter((entity) => entity.combat).length;
    const idle = selected.filter((entity) => entity.worker && !entity.worker.task && !entity.worker.carrying && !entity.mobile?.target && (entity.mobile?.path.length ?? 0) === 0).length;
    return `<div class="hud-stat-row">${statBadge("Units", selected.length)}${statBadge("Villagers", workers)}${statBadge("Combat", fighters)}${statBadge("Idle", idle)}</div>`;
  }

  if (primary.unit) {
    const config = unitConfigs[primary.unit.type];
    const combat = config.combat;
    const stats = [
      statBadge("HP", primary.health ? `${Math.ceil(primary.health.current)}/${primary.health.max}` : "-"),
      statBadge("Speed", Math.round(config.speed)),
      combat ? statBadge("Damage", combat.damage) : "",
      combat ? statBadge("Range", combat.range) : "",
      config.population > 0 ? statBadge("Pop", config.population) : "",
    ].filter(Boolean);
    return `<div class="hud-stat-row">${stats.join("")}</div>`;
  }

  if (primary.building) {
    const config = buildingConfigs[primary.building.type];
    const status = primary.building.completed ? "Ready" : `${Math.round((primary.building.buildProgress / Math.max(1, primary.building.buildTimeTicks)) * 100)}%`;
    const stats = [
      statBadge("HP", primary.health ? `${Math.ceil(primary.health.current)}/${primary.health.max}` : "-"),
      statBadge("Status", status),
      primary.producer ? statBadge("Queue", primary.producer.queue.length) : "",
      config.providesPopulation ? statBadge("Pop", `+${config.providesPopulation}`) : "",
      primary.farm ? statBadge("Food", `${Math.ceil(primary.farm.food)}/${primary.farm.maxFood}`) : "",
      primary.storage ? statBadge("Stores", primary.storage.accepts.map(label).join("/")) : "",
    ].filter(Boolean);
    return `<div class="hud-stat-row">${stats.join("")}</div>`;
  }

  if (primary.farm) {
    return `<div class="hud-stat-row">${statBadge("Food", `${Math.ceil(primary.farm.food)}/${primary.farm.maxFood}`)}</div>`;
  }

  if (primary.resourceNode) {
    return `<div class="hud-stat-row">${statBadge("Amount", Math.ceil(primary.resourceNode.amount))}${statBadge("Type", label(primary.resourceNode.resourceType))}</div>`;
  }

  return "";
}

function statBadge(labelText: string, value: string | number): string {
  return `<span class="hud-stat"><span class="hud-stat-label">${labelText}</span><strong>${value}</strong></span>`;
}

function selectionPortrait(primary: GameEntity | undefined, selected: GameEntity[], state: GameState): string {
  if (!primary) {
    return "";
  }
  if (selected.length > 1) {
    return `<div class="selection-portrait selection-portrait--group"><span>${selected.length}</span></div>`;
  }
  if (primary.unit) {
    return `<div class="selection-portrait selection-portrait--unit">${unitPortraitMarkup(primary.unit.type, "selection-portrait-sprite")}</div>`;
  }
  const image = portraitPath(primary, state);
  if (image) {
    return `<div class="selection-portrait"><img src="${image}" alt=""></div>`;
  }
  const glyph = primary.worker ? "V" : "?";
  return `<div class="selection-portrait selection-portrait--glyph"><span>${glyph}</span></div>`;
}

function unitPortraitMarkup(type: UnitType, className: string): string {
  const path = UNIT_PORTRAIT_PATHS[type];
  if (!path) {
    return `<span class="${className} unit-sprite unit-sprite--fallback"><span>${type.slice(0, 1).toUpperCase()}</span></span>`;
  }
  return `<span class="${className} unit-sprite unit-sprite--${type}" style="background-image:url('${path}')"></span>`;
}

function portraitPath(entity: GameEntity, state: GameState): string | undefined {
  if (entity.resourceNode) {
    return RESOURCE_ICON_PATHS[entity.resourceNode.resourceType];
  }
  if (entity.farm) {
    return RESOURCE_ICON_PATHS.food;
  }
  if (entity.building) {
    const ownerAge = entity.ownerId ? state.players[entity.ownerId]?.age : state.players[PLAYER_ID].age;
    return buildingIconPath(entity.building.type, ownerAge ?? state.players[PLAYER_ID].age);
  }
  return undefined;
}

function panelMeta(primary: GameEntity, selected: GameEntity[], state: GameState): string {
  if (selected.length > 1) {
    const workers = selected.filter((entity) => entity.worker).length;
    const buildings = selected.filter((entity) => entity.building).length;
    return `<div class="hud-panel-meta">${workers} villagers${buildings > 0 ? `, ${buildings} buildings` : ""}</div>`;
  }

  const health = primary.health ? healthBarMarkup(primary.health.current, primary.health.max) : "";
  const ownerAge = primary.ownerId ? state.players[primary.ownerId]?.age : undefined;
  const type = primary.building ? labelForBuilding(primary.building.type, ownerAge ?? state.players[PLAYER_ID].age) : primary.unit ? unitConfigs[primary.unit.type].label : primary.resourceNode ? label(primary.resourceNode.resourceType) : primary.kind;
  return `<div class="hud-panel-meta">${type}</div>${health}`;
}

function healthBarMarkup(current: number, max: number): string {
  const ratio = Math.round((Math.max(0, Math.min(current, max)) / Math.max(1, max)) * 100);
  return `
    <div class="hud-healthbar">
      <span style="width:${ratio}%"></span>
      <strong>${Math.ceil(current)} / ${max}</strong>
    </div>
  `;
}

function detailsFor(primary: GameEntity, selected: GameEntity[], state: GameState): string {
  if (selected.length > 1) {
    const workers = selected.filter((entity) => entity.worker).length;
    const fighters = selected.filter((entity) => entity.combat).length;
    const building = selected.filter((entity) => entity.worker?.task?.kind === "build").length;
    const repairing = selected.filter((entity) => entity.worker?.task?.kind === "repair").length;
    const gathering = selected.filter((entity) => entity.worker?.task?.kind === "gather").length;
    const idle = selected.filter((entity) => entity.worker && !entity.worker.task && !entity.worker.carrying && !entity.mobile?.target && (entity.mobile?.path.length ?? 0) === 0).length;
    return `<span><strong>Villagers:</strong> ${workers}</span><span><strong>Infantry:</strong> ${fighters}</span><span><strong>Idle:</strong> ${idle}</span><span><strong>Gathering:</strong> ${gathering}</span><span><strong>Building:</strong> ${building}</span><span><strong>Repairing:</strong> ${repairing}</span>`;
  }

  const build = primary.building
    ? `<span><strong>Status:</strong> ${primary.building.completed ? "Built" : `${Math.round((primary.building.buildProgress / primary.building.buildTimeTicks) * 100)}%`}</span>`
    : "";
  const farm = primary.farm ? `<span><strong>Food:</strong> ${Math.max(0, Math.ceil(primary.farm.food))}/${primary.farm.maxFood}${primary.farm.depleted ? " depleted" : ""}</span>` : "";
  const carried = primary.worker?.carrying ? `<span><strong>Carrying:</strong> ${primary.worker.carrying.amount} ${label(primary.worker.carrying.type)}</span>` : "";
  const task = primary.worker?.task ? `<span><strong>Task:</strong> ${primary.worker.task.kind}</span>` : "";
  const storage = primary.storage ? `<span><strong>Stores:</strong> ${primary.storage.accepts.map(label).join(", ")}</span>` : "";
  const populationCap = primary.building && buildingConfigs[primary.building.type].providesPopulation ? `<span><strong>Population:</strong> +${buildingConfigs[primary.building.type].providesPopulation}</span>` : "";
  const resource = primary.resourceNode ? `<span><strong>Contains:</strong> ${Math.max(0, Math.ceil(primary.resourceNode.amount))} ${label(primary.resourceNode.resourceType)}</span>` : "";
  const ownerAge = primary.ownerId ? state.players[primary.ownerId]?.age : undefined;
  const wall = primary.building?.type === "wall" && ownerAge ? `<span><strong>Tier:</strong> ${wallTierForAge(ownerAge).label}</span>` : "";

  return `${build}${wall}${farm}${storage}${populationCap}${carried}${task}${resource}` || `<span><strong>Type:</strong> ${primary.kind}</span>`;
}

function selectionHelp(primary: GameEntity | undefined, state: GameState): string {
  if (!primary) {
    return "<span>Select villagers with click or drag rectangle.</span><span>Right click resources, farms, or terrain.</span>";
  }
  if (primary.worker) {
    return "<span>Villagers gather, build, repair damaged allied buildings, and deposit at the nearest valid camp.</span>";
  }
  if (primary.building && buildingConfigs[primary.building.type].providesPopulation) {
    return `<span>This building increases max population by ${buildingConfigs[primary.building.type].providesPopulation} when completed.</span>`;
  }
  if (primary.building?.type === "townCenter") {
    const player = state.players[PLAYER_ID];
    const nextAge = ageConfigs[player.age].nextAge;
    return nextAge
      ? `<span>Advance to ${ageConfigs[nextAge].label} to unlock stronger walls and new buildings.</span><span>Right click terrain to set a rally point.</span>`
      : "<span>Your village has reached the current highest age.</span>";
  }
  if (primary.farm) {
    return primary.farm.depleted ? "<span>Use Reseed to restore this farm with wood.</span>" : "<span>Right click with villagers selected to harvest this farm.</span>";
  }
  if (primary.building?.completed) {
    return primary.producer
      ? "<span>Use the command dock for production.</span><span>Right click terrain to set a rally point.</span>"
      : "<span>Right click with villagers selected to repair this building if damaged.</span>";
  }
  if (primary.resourceNode) {
    return "<span>Right click with villagers selected to gather this resource.</span>";
  }
  return "<span>This object is ready for later combat systems.</span>";
}

function costLabel(cost: Partial<Record<ResourceType, number>>): string {
  const parts = RESOURCE_TYPES.filter((type) => cost[type]).map(
    (type) => `<span class="cost-item"><img class="cost-icon" src="${RESOURCE_ICON_PATHS[type]}" alt="">${cost[type]}</span>`,
  );
  return parts.length > 0 ? `<span class="cost-list">${parts.join("")}</span>` : `<span class="free-cost">Free</span>`;
}

function buildingIconPath(type: BuildingType, age: AgeId): string | undefined {
  return BUILDING_ICON_PATHS[type]?.[age] ?? BUILDING_ICON_PATHS[type]?.genesis;
}

function shortLabel(value: string): string {
  return value.replace("Town ", "").replace(" Camp", " C.");
}

function label(type: ResourceType): string {
  switch (type) {
    case "food":
      return "Food";
    case "wood":
      return "Wood";
    case "stone":
      return "Stone";
    case "gold":
      return "Gold";
  }
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

function queuedPopulationForPlayer(state: GameState): number {
  return Object.values(state.entities).reduce((total, entity) => {
    if (entity.ownerId !== PLAYER_ID || !entity.producer) {
      return total;
    }
    return total + entity.producer.queue.reduce((queueTotal, item) => queueTotal + unitConfigs[item.unitType].population, 0);
  }, 0);
}

function populationStatus(state: GameState): {
  cap: number;
  used: number;
  queued: number;
  usedWithQueue: number;
  blocked: boolean;
  nearCap: boolean;
  pillClass: string;
  banner: string;
  buildHint: string;
} {
  const player = state.players[PLAYER_ID];
  const queued = queuedPopulationForPlayer(state);
  const used = player.population;
  const usedWithQueue = used + queued;
  const cap = player.populationCap;
  const blocked = usedWithQueue >= cap;
  const nearCap = !blocked && cap - usedWithQueue <= 2;

  return {
    cap,
    used,
    queued,
    usedWithQueue,
    blocked,
    nearCap,
    pillClass: blocked ? "status-pill--danger" : nearCap ? "status-pill--warn" : "",
    banner: blocked
      ? `<div class="hud-alert hud-alert--danger">Population full. Build House to increase cap.</div>`
      : nearCap
        ? `<div class="hud-alert hud-alert--warn">Population almost full. Build House soon.</div>`
        : "",
    buildHint: blocked
      ? `<div class="hud-inline-note hud-inline-note--danger">Population full. Build House to train more units.</div>`
      : nearCap
        ? `<div class="hud-inline-note">Only ${cap - usedWithQueue} population left.</div>`
        : "",
  };
}

function messageToneClass(text: string): string {
  if (text.includes("Population cap reached")) {
    return "message-line--danger";
  }
  if (text.includes("completed") || text.includes("Age advanced") || text.includes("Objective complete")) {
    return "message-line--good";
  }
  return "";
}
