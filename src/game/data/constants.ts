export const TILE_SIZE = 16;
export const TICK_RATE = 20;
export const TICK_MS = 1000 / TICK_RATE;
export const PLAYER_ID = "player";
export const ENEMY_ID = "enemy";

export const RESOURCE_TYPES = ["food", "wood", "stone", "gold"] as const;
export const AGE_IDS = ["genesis", "settlement", "network"] as const;

export type PlayerId = typeof PLAYER_ID | typeof ENEMY_ID;
export type ResourceType = (typeof RESOURCE_TYPES)[number];
export type AgeId = (typeof AGE_IDS)[number];

export function ticksFromSeconds(seconds: number): number {
  return Math.round(seconds * TICK_RATE);
}
