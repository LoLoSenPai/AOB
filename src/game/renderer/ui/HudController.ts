import { PLAYER_ID, RESOURCE_TYPES, type ResourceType } from "../../data/constants";
import { ageConfigs, buildingConfigs, canAfford, costForBuilding, hasReachedAge, labelForBuilding, unitConfigs, wallTierForAge } from "../../data/definitions";
import type { BuildingType, GameEntity, UnitType } from "../../core/entities/types";
import type { GameState } from "../../core/state/types";

type HudCallbacks = {
  onBuildRequest: (buildingType: BuildingType) => void;
  onOpenBuildMenu: () => void;
  onCloseBuildMenu: () => void;
  onCancelPlacement: () => void;
  onTrainRequest: (unitType: UnitType) => void;
  onAdvanceAgeRequest: () => void;
  onReseedFarmRequest: (farmId: string) => void;
};

export type HudRenderContext = {
  placementType?: BuildingType;
  wallLineStarted: boolean;
  buildMenuOpen: boolean;
};

const BUILD_GROUPS: { label: string; buildings: BuildingType[] }[] = [
  { label: "Economy", buildings: ["house", "farm", "mill", "lumberCamp", "stoneCamp", "goldCamp"] },
  { label: "Military", buildings: ["barracks"] },
  { label: "Defense", buildings: ["watchTower", "wall"] },
];

const RESOURCE_ICON_PATHS: Record<ResourceType, string> = {
  food: "/assets/aob-map/optimized/fruit-bush.png",
  wood: "/assets/aob-map/optimized/wood-pile.png",
  stone: "/assets/aob-map/optimized/rocks.png",
  gold: "/assets/aob-map/optimized/crystal-node.png",
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
    const ageProgress = player.ageProgress
      ? `<span class="status-pill age-pill"><span>${ageConfigs[player.ageProgress.targetAge].label}</span><span class="age-progress"><span style="width:${Math.round((1 - player.ageProgress.remainingTicks / player.ageProgress.totalTicks) * 100)}%"></span></span></span>`
      : `<span class="status-pill age-pill">${age.label}</span>`;

    return `
      <div class="hud-topbar">
        <div class="resource-strip">${resourceMarkup}</div>
        ${ageProgress}
        <span class="status-pill ${population.pillClass}">Pop ${player.population}/${player.populationCap}${queuedPopulation > 0 ? ` (+${queuedPopulation} queued)` : ""}</span>
      </div>
      ${population.banner}
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
    this.root.querySelectorAll<HTMLButtonElement>("[data-cancel-placement]").forEach((button) => {
      button.addEventListener("click", () => this.callbacks.onCancelPlacement());
    });
  }
}

function resourcePill(type: ResourceType, value: number): string {
  return `
    <span class="resource-pill">
      <img class="resource-icon-img" src="${RESOURCE_ICON_PATHS[type]}" alt="">
      <span>${label(type)}</span>
      <strong>${Math.floor(value)}</strong>
    </span>
  `;
}

function panelMarkup(primary: GameEntity | undefined, selected: GameEntity[], state: GameState): string {
  const title = panelTitle(primary, selected);
  const details = primary ? detailsFor(primary, selected, state) : "No selection";
  return `
    <div class="hud-bottom-panel">
      <div class="hud-panel-title">${title}</div>
      <div class="hud-panel-grid">
        <div class="hud-info-list">${details}</div>
        <div class="hud-info-list">${selectionHelp(primary, state)}</div>
      </div>
    </div>
  `;
}

function commandDockMarkup(state: GameState, primary: GameEntity | undefined, context: HudRenderContext): string {
  if (context.placementType) {
    const labelText = context.placementType === "wall" && context.wallLineStarted ? "Choose wall end" : `Placing ${labelForBuilding(context.placementType, state.players[PLAYER_ID].age)}`;
    return `
      <div class="command-dock">
        <div class="command-section">
          <div class="command-label">${labelText}</div>
          <button class="command-button command-wide" data-cancel-placement="true">Cancel</button>
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
    return `
      <div class="command-dock">
        <div class="command-section">
          <button class="command-button command-wide" data-close-build="true">Back</button>
          ${population.buildHint}
          ${buildMenuMarkup(state)}
        </div>
      </div>
    `;
  }

  const trainButtons = primary?.building?.completed && primary.producer ? producerButtons(primary, state) : "";
  const currentAge = state.players[PLAYER_ID].age;
  const nextAge = ageConfigs[currentAge].nextAge;
  const ageButton =
    primary?.building?.type === "townCenter" && nextAge
      ? `<button class="command-button" data-advance="true" ${state.players[PLAYER_ID].ageProgress ? "disabled" : ""}><span class="command-title">Advance</span><span class="command-subtitle">${ageConfigs[nextAge].label}</span>${costLabel(ageConfigs[currentAge].advanceCost)}</button>`
      : "";
  const reseedButton =
    primary?.farm && primary.farm.depleted
      ? `<button class="command-button" data-reseed="${primary.id}">Reseed<br>${costLabel(primary.farm.reseedCost)}</button>`
      : "";
  const workerCommands = hasWorker ? `<div class="command-label">Villager</div><div class="command-grid"><button class="command-button" data-open-build="true">Build</button></div>` : "";
  const buildingCommands =
    trainButtons || ageButton || reseedButton
      ? `${trainButtons ? `<div class="command-label">Produce</div><div class="command-grid">${trainButtons}${ageButton}</div>` : ""}${!trainButtons && ageButton ? `<div class="command-label">Town Center</div><div class="command-grid">${ageButton}</div>` : ""}${reseedButton ? `<div class="command-label">Farm</div><div class="command-grid">${reseedButton}</div>` : ""}`
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

function buildMenuMarkup(state: GameState): string {
  return BUILD_GROUPS.map((group) => {
    const buttons = group.buildings.map((type) => buildButton(state, type)).join("");
    return `<div class="command-label">${group.label}</div><div class="command-grid">${buttons}</div>`;
  }).join("");
}

function buildButton(state: GameState, type: BuildingType): string {
  const player = state.players[PLAYER_ID];
  const config = buildingConfigs[type];
  const cost = costForBuilding(type, player.age);
  const locked = !hasReachedAge(player.age, config.unlockedAge);
  const affordable = canAfford(player.resources, cost);
  const disabled = locked || !affordable;
  const labelText = shortLabel(labelForBuilding(type, player.age));
  const population = populationStatus(state);
  const suggested = type === "house" && population.blocked;
  const subtitle = locked
    ? ageConfigs[config.unlockedAge].label
    : suggested
      ? "Need cap"
      : affordable
        ? undefined
        : "Need res.";
  const body = subtitle ? `<span class="lock-label">${subtitle}</span>` : costLabel(cost);
  return `<button class="command-button ${suggested ? "command-button--suggested" : ""}" data-build="${type}" ${disabled ? "disabled" : ""}><span class="command-title">${labelText}</span>${body}</button>`;
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
      const disabled = locked || !affordable || blockedByPopulation;
      const reason = locked ? ageConfigs[config.unlockedAge].label : blockedByPopulation ? "Need House" : !affordable ? "Need res." : undefined;
      const body = reason ? `<span class="lock-label">${reason}</span>` : costLabel(config.cost);
      return `<button class="command-button ${blockedByPopulation ? "command-button--blocked" : ""}" data-train="${type}" ${disabled ? "disabled" : ""}><span class="command-title">${shortLabel(config.label)}</span>${body}</button>`;
    })
    .join("");
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

function panelTitle(primary: GameEntity | undefined, selected: GameEntity[]): string {
  if (!primary) {
    return "Age Of Blockchains";
  }
  if (selected.length > 1) {
    return `${selected.length} selected`;
  }
  return primary.label;
}

function detailsFor(primary: GameEntity, selected: GameEntity[], state: GameState): string {
  if (selected.length > 1) {
    const workers = selected.filter((entity) => entity.worker).length;
    const fighters = selected.filter((entity) => entity.combat).length;
    return `<span><strong>Villagers:</strong> ${workers}</span><span><strong>Infantry:</strong> ${fighters}</span>`;
  }

  const health = primary.health ? `<span><strong>Health:</strong> ${Math.max(0, Math.ceil(primary.health.current))}/${primary.health.max}</span>` : "";
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
  const queue = primary.producer?.queue[0]
    ? `<span><strong>Queue:</strong> ${unitConfigs[primary.producer.queue[0].unitType].label} ${Math.round((1 - primary.producer.queue[0].remainingTicks / primary.producer.queue[0].totalTicks) * 100)}%</span>`
    : "";

  return `${health}${build}${wall}${farm}${storage}${populationCap}${carried}${task}${resource}${queue}` || `<span><strong>Type:</strong> ${primary.kind}</span>`;
}

function selectionHelp(primary: GameEntity | undefined, state: GameState): string {
  if (!primary) {
    return "<span>Select villagers with click or drag rectangle.</span><span>Right click resources, farms, or terrain.</span>";
  }
  if (primary.worker) {
    return "<span>Villagers gather, build, and deposit at the nearest valid camp.</span>";
  }
  if (primary.building && buildingConfigs[primary.building.type].providesPopulation) {
    return `<span>This building increases max population by ${buildingConfigs[primary.building.type].providesPopulation} when completed.</span>`;
  }
  if (primary.building?.type === "townCenter") {
    const player = state.players[PLAYER_ID];
    const nextAge = ageConfigs[player.age].nextAge;
    return nextAge
      ? `<span>Advance to ${ageConfigs[nextAge].label} to unlock stronger walls and new buildings.</span>`
      : "<span>Your village has reached the current highest age.</span>";
  }
  if (primary.farm) {
    return primary.farm.depleted ? "<span>Use Reseed to restore this farm with wood.</span>" : "<span>Right click with villagers selected to harvest this farm.</span>";
  }
  if (primary.building?.completed) {
    return "<span>Use the command dock for production, age-up, or village expansion.</span>";
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
  if (text.includes("completed") || text.includes("Age advanced")) {
    return "message-line--good";
  }
  return "";
}
