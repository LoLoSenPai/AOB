import Phaser from "phaser";
import { assetKeys } from "../../data/assets";

export class PreloadScene extends Phaser.Scene {
  constructor() {
    super("PreloadScene");
  }

  preload(): void {
    this.load.spritesheet(assetKeys.tiles, "/assets/sunnyside/tiles/sunnyside_16.png", {
      frameWidth: 16,
      frameHeight: 16,
      spacing: 0,
      margin: 0,
    });
    this.load.spritesheet(assetKeys.forest, "/assets/sunnyside/tiles/forest_32.png", {
      frameWidth: 32,
      frameHeight: 32,
    });
    this.load.spritesheet(assetKeys.aobMap.terrain, "/assets/aob-map/optimized/terrain-tiles-128-clean.png", {
      frameWidth: 128,
      frameHeight: 128,
    });

    this.loadHumanSheets();
    this.loadEnemySheets();
    this.loadAobMapAssets();
    this.loadAobBuildingAssets();
    this.loadAobBuildingStaticAssets();

    this.load.spritesheet(assetKeys.elements.tree1, "/assets/sunnyside/elements/spr_deco_tree_01_strip4.png", {
      frameWidth: 32,
      frameHeight: 34,
    });
    this.load.spritesheet(assetKeys.elements.tree2, "/assets/sunnyside/elements/spr_deco_tree_02_strip4.png", {
      frameWidth: 28,
      frameHeight: 43,
    });
    this.load.spritesheet(assetKeys.elements.windmill, "/assets/sunnyside/elements/spr_deco_windmill_withshadow_strip9.png", {
      frameWidth: 112,
      frameHeight: 112,
    });
    this.load.spritesheet(assetKeys.elements.fire, "/assets/sunnyside/elements/spr_deco_fire_01_strip4.png", {
      frameWidth: 5,
      frameHeight: 10,
    });
    this.load.spritesheet(assetKeys.elements.smoke, "/assets/sunnyside/elements/chimneysmoke_01_strip30.png", {
      frameWidth: 15,
      frameHeight: 37,
    });

    this.load.image(assetKeys.elements.rock, "/assets/sunnyside/elements/rock.png");
    this.load.image(assetKeys.elements.wood, "/assets/sunnyside/elements/wood.png");
    this.load.image(assetKeys.elements.wheat, "/assets/sunnyside/elements/wheat_05.png");
    this.load.image(assetKeys.elements.carrot, "/assets/sunnyside/elements/carrot_05.png");
    this.load.image(assetKeys.elements.soil, "/assets/sunnyside/elements/soil_00.png");
    this.load.image(assetKeys.ui.indicator, "/assets/sunnyside/ui/indicator.png");
  }

  create(): void {
    this.scene.start("WorldScene");
  }

  private loadHumanSheets(): void {
    const actions = [
      ["idle", "idle"],
      ["walk", "walk"],
      ["axe", "axe"],
      ["mining", "mining"],
      ["hammering", "hamering"],
      ["attack", "attack"],
      ["hurt", "hurt"],
      ["death", "death"],
      ["carry", "carry"],
    ] as const;

    for (const [keyAction, fileAction] of actions) {
      this.load.spritesheet(assetKeys.human.base[keyAction], `/assets/sunnyside/characters/human/base_${fileAction}_strip${stripSuffix(fileAction)}.png`, {
        frameWidth: 96,
        frameHeight: 64,
      });
      this.load.spritesheet(assetKeys.human.hair[keyAction], `/assets/sunnyside/characters/human/shorthair_${fileAction}_strip${stripSuffix(fileAction)}.png`, {
        frameWidth: 96,
        frameHeight: 64,
      });
      this.load.spritesheet(assetKeys.human.tools[keyAction], `/assets/sunnyside/characters/human/tools_${fileAction}_strip${stripSuffix(fileAction)}.png`, {
        frameWidth: 96,
        frameHeight: 64,
      });
    }
  }

  private loadEnemySheets(): void {
    this.load.spritesheet(assetKeys.goblin.idle, "/assets/sunnyside/characters/goblin/spr_idle_strip9.png", {
      frameWidth: 96,
      frameHeight: 64,
    });
    this.load.spritesheet(assetKeys.goblin.walk, "/assets/sunnyside/characters/goblin/spr_walk_strip8.png", {
      frameWidth: 96,
      frameHeight: 64,
    });
    this.load.spritesheet(assetKeys.goblin.attack, "/assets/sunnyside/characters/goblin/spr_attack_strip10.png", {
      frameWidth: 96,
      frameHeight: 64,
    });
    this.load.spritesheet(assetKeys.goblin.hurt, "/assets/sunnyside/characters/goblin/spr_hurt_strip8.png", {
      frameWidth: 96,
      frameHeight: 64,
    });
    this.load.spritesheet(assetKeys.goblin.death, "/assets/sunnyside/characters/goblin/spr_death_strip13.png", {
      frameWidth: 96,
      frameHeight: 64,
    });

    this.load.spritesheet(assetKeys.skeleton.idle, "/assets/sunnyside/characters/skeleton/skeleton_idle_strip6.png", {
      frameWidth: 96,
      frameHeight: 64,
    });
    this.load.spritesheet(assetKeys.skeleton.walk, "/assets/sunnyside/characters/skeleton/skeleton_walk_strip8.png", {
      frameWidth: 96,
      frameHeight: 64,
    });
    this.load.spritesheet(assetKeys.skeleton.attack, "/assets/sunnyside/characters/skeleton/skeleton_attack_strip7.png", {
      frameWidth: 96,
      frameHeight: 64,
    });
    this.load.spritesheet(assetKeys.skeleton.hurt, "/assets/sunnyside/characters/skeleton/skeleton_hurt_strip7.png", {
      frameWidth: 96,
      frameHeight: 64,
    });
    this.load.spritesheet(assetKeys.skeleton.death, "/assets/sunnyside/characters/skeleton/skeleton_death_strip10.png", {
      frameWidth: 96,
      frameHeight: 64,
    });
  }

  private loadAobMapAssets(): void {
    const root = "/assets/aob-map/optimized";
    this.load.image(assetKeys.aobMap.trees, `${root}/trees.png`);
    this.load.image(assetKeys.aobMap.bush, `${root}/bush.png`);
    this.load.image(assetKeys.aobMap.fruitBush, `${root}/fruit-bush.png`);
    this.load.image(assetKeys.aobMap.bigRocks, `${root}/big-rocks.png`);
    this.load.image(assetKeys.aobMap.rocks, `${root}/rocks.png`);
    this.load.image(assetKeys.aobMap.rock, `${root}/rock.png`);
    this.load.image(assetKeys.aobMap.woodPile, `${root}/wood-pile.png`);
    this.load.image(assetKeys.aobMap.stump, `${root}/stump.png`);
    this.load.image(assetKeys.aobMap.campfire, `${root}/campfire.png`);
    this.load.image(assetKeys.aobMap.flag, `${root}/flag.png`);
    this.load.image(assetKeys.aobMap.crystalNode, `${root}/crystal-node.png`);
  }

  private loadAobBuildingAssets(): void {
    const root = "/assets/aob-buildings/optimized";
    this.load.image(assetKeys.aobBuildings.townCenter, `${root}/town-center.png`);
    this.load.image(assetKeys.aobBuildings.house, `${root}/house.png`);
    this.load.image(assetKeys.aobBuildings.barracks, `${root}/barracks.png`);
    this.load.image(assetKeys.aobBuildings.lumberCamp, `${root}/lumber-camp.png`);
    this.load.image(assetKeys.aobBuildings.mill, `${root}/mill.png`);
    this.load.image(assetKeys.aobBuildings.stoneCamp, `${root}/stone-camp.png`);
    this.load.image(assetKeys.aobBuildings.goldCamp, `${root}/gold-camp.png`);
    this.load.image(assetKeys.aobBuildings.farm, `${root}/farm.png`);
    this.load.image(assetKeys.aobBuildings.watchTower, `${root}/watch-tower.png`);
    this.load.image(assetKeys.aobBuildings.wall, `${root}/wall.png`);
  }

  private loadAobBuildingStaticAssets(): void {
    const root = "/assets/aob-buildings/static-runtime";
    this.load.image(assetKeys.aobBuildingStatic.construction, `${root}/construction.png`);
    this.load.image(assetKeys.aobBuildingStatic.townCenter.genesis, `${root}/town-center-t1.png`);
    this.load.image(assetKeys.aobBuildingStatic.townCenter.settlement, `${root}/town-center-t2.png`);
    this.load.image(assetKeys.aobBuildingStatic.townCenter.network, `${root}/town-center-t3.png`);
    this.load.image(assetKeys.aobBuildingStatic.house.genesis, `${root}/house-t1.png`);
    this.load.image(assetKeys.aobBuildingStatic.house.settlement, `${root}/house-t2.png`);
    this.load.image(assetKeys.aobBuildingStatic.house.network, `${root}/house-t3.png`);
    this.load.image(assetKeys.aobBuildingStatic.lumberCamp.genesis, `${root}/lumber-camp-t1.png`);
    this.load.image(assetKeys.aobBuildingStatic.lumberCamp.settlement, `${root}/lumber-camp-t2.png`);
    this.load.image(assetKeys.aobBuildingStatic.lumberCamp.network, `${root}/lumber-camp-t3.png`);
    this.load.image(assetKeys.aobBuildingStatic.mill.genesis, `${root}/mill-t1.png`);
    this.load.image(assetKeys.aobBuildingStatic.mill.settlement, `${root}/mill-t2.png`);
    this.load.image(assetKeys.aobBuildingStatic.mill.network, `${root}/mill-t3.png`);
    this.load.image(assetKeys.aobBuildingStatic.stoneCamp.genesis, `${root}/stone-camp-t1.png`);
    this.load.image(assetKeys.aobBuildingStatic.stoneCamp.settlement, `${root}/stone-camp-t2.png`);
    this.load.image(assetKeys.aobBuildingStatic.stoneCamp.network, `${root}/stone-camp-t3.png`);
    this.load.image(assetKeys.aobBuildingStatic.goldCamp.genesis, `${root}/gold-camp-t1.png`);
    this.load.image(assetKeys.aobBuildingStatic.goldCamp.settlement, `${root}/gold-camp-t2.png`);
    this.load.image(assetKeys.aobBuildingStatic.goldCamp.network, `${root}/gold-camp-t3.png`);
    this.load.image(assetKeys.aobBuildingStatic.farm.genesis, `${root}/farm-t1.png`);
    this.load.image(assetKeys.aobBuildingStatic.farm.settlement, `${root}/farm-t2.png`);
    this.load.image(assetKeys.aobBuildingStatic.farm.network, `${root}/farm-t3.png`);
    this.load.image(assetKeys.aobBuildingStatic.barracks.genesis, `${root}/barracks-t1.png`);
    this.load.image(assetKeys.aobBuildingStatic.barracks.settlement, `${root}/barracks-t2.png`);
    this.load.image(assetKeys.aobBuildingStatic.barracks.network, `${root}/barracks-t3.png`);
    this.load.image(assetKeys.aobBuildingStatic.watchTower.genesis, `${root}/watch-tower-t1.png`);
    this.load.image(assetKeys.aobBuildingStatic.watchTower.settlement, `${root}/watch-tower-t2.png`);
    this.load.image(assetKeys.aobBuildingStatic.watchTower.network, `${root}/watch-tower-t3.png`);
  }
}

function stripSuffix(action: string): string {
  switch (action) {
    case "attack":
    case "axe":
    case "mining":
      return "10";
    case "carry":
    case "hurt":
    case "walk":
      return "8";
    case "death":
      return "13";
    case "hamering":
      return "23";
    case "idle":
      return "9";
    default:
      return "8";
  }
}
