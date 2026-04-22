import Phaser from "phaser";
import { assetKeys, type HumanAction } from "../../data/assets";

type SheetAnimation = {
  key: string;
  textureKey: string;
  start?: number;
  frames: number;
  frameRate: number;
  repeat: number;
};

export function registerAnimations(scene: Phaser.Scene): void {
  const humanActions: Record<HumanAction, { frames: number; rate: number; repeat: number }> = {
    idle: { frames: 8, rate: 5, repeat: -1 },
    walk: { frames: 8, rate: 8, repeat: -1 },
    axe: { frames: 10, rate: 10, repeat: -1 },
    mining: { frames: 10, rate: 10, repeat: -1 },
    hammering: { frames: 20, rate: 12, repeat: -1 },
    attack: { frames: 10, rate: 12, repeat: -1 },
    hurt: { frames: 8, rate: 10, repeat: 0 },
    death: { frames: 9, rate: 9, repeat: 0 },
    carry: { frames: 8, rate: 8, repeat: -1 },
  };

  for (const [action, meta] of Object.entries(humanActions) as [HumanAction, (typeof humanActions)[HumanAction]][]) {
    create(scene, {
      key: `human-base-${action}`,
      textureKey: assetKeys.human.base[action],
      frames: meta.frames,
      frameRate: meta.rate,
      repeat: meta.repeat,
    });
    create(scene, {
      key: `human-hair-${action}`,
      textureKey: assetKeys.human.hair[action],
      frames: meta.frames,
      frameRate: meta.rate,
      repeat: meta.repeat,
    });
    create(scene, {
      key: `human-tools-${action}`,
      textureKey: assetKeys.human.tools[action],
      frames: meta.frames,
      frameRate: meta.rate,
      repeat: meta.repeat,
    });
  }

  create(scene, { key: "goblin-idle", textureKey: assetKeys.goblin.idle, frames: 8, frameRate: 5, repeat: -1 });
  create(scene, { key: "goblin-walk", textureKey: assetKeys.goblin.walk, frames: 8, frameRate: 8, repeat: -1 });
  create(scene, { key: "goblin-attack", textureKey: assetKeys.goblin.attack, frames: 9, frameRate: 10, repeat: -1 });
  create(scene, { key: "goblin-hurt", textureKey: assetKeys.goblin.hurt, frames: 8, frameRate: 10, repeat: 0 });
  create(scene, { key: "goblin-death", textureKey: assetKeys.goblin.death, frames: 9, frameRate: 8, repeat: 0 });

  create(scene, { key: "skeleton-idle", textureKey: assetKeys.skeleton.idle, frames: 6, frameRate: 5, repeat: -1 });
  create(scene, { key: "skeleton-walk", textureKey: assetKeys.skeleton.walk, frames: 8, frameRate: 8, repeat: -1 });
  create(scene, { key: "skeleton-attack", textureKey: assetKeys.skeleton.attack, frames: 7, frameRate: 9, repeat: -1 });
  create(scene, { key: "skeleton-hurt", textureKey: assetKeys.skeleton.hurt, frames: 7, frameRate: 10, repeat: 0 });
  create(scene, { key: "skeleton-death", textureKey: assetKeys.skeleton.death, frames: 10, frameRate: 8, repeat: 0 });

  create(scene, { key: "tree-1-sway", textureKey: assetKeys.elements.tree1, frames: 4, frameRate: 4, repeat: -1 });
  create(scene, { key: "tree-2-sway", textureKey: assetKeys.elements.tree2, frames: 4, frameRate: 4, repeat: -1 });
  create(scene, { key: "windmill-turn", textureKey: assetKeys.elements.windmill, frames: 9, frameRate: 6, repeat: -1 });
  create(scene, { key: "fire-loop", textureKey: assetKeys.elements.fire, frames: 4, frameRate: 7, repeat: -1 });
  create(scene, { key: "smoke-loop", textureKey: assetKeys.elements.smoke, frames: 30, frameRate: 10, repeat: -1 });
}

function create(scene: Phaser.Scene, config: SheetAnimation): void {
  if (scene.anims.exists(config.key)) {
    return;
  }
  scene.anims.create({
    key: config.key,
    frames: scene.anims.generateFrameNumbers(config.textureKey, {
      start: config.start ?? 0,
      end: (config.start ?? 0) + Math.max(0, config.frames - 1),
    }),
    frameRate: config.frameRate,
    repeat: config.repeat,
  });
}
