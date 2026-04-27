import Phaser from "phaser";
import { assetKeys } from "../../data/assets";

export class PreloadScene extends Phaser.Scene {
  constructor() {
    super("PreloadScene");
  }

  preload(): void {
    this.loadHumanSheets();
    this.loadSunnysideWorldAssets();
    this.loadTinyRpgAssets();
    this.loadAobMapAssets();
    this.loadAobBuildingStaticAssets();
    this.loadAobWallAssets();
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

  private loadSunnysideWorldAssets(): void {
    this.load.spritesheet(assetKeys.tiles, "/assets/sunnyside/tiles/sunnyside_16.png", {
      frameWidth: 16,
      frameHeight: 16,
    });
    this.load.image(assetKeys.forest, "/assets/sunnyside/tiles/forest_32.png");
    this.load.spritesheet(assetKeys.elements.tree1, "/assets/sunnyside/elements/spr_deco_tree_01_strip4.png", {
      frameWidth: 32,
      frameHeight: 34,
    });
    this.load.spritesheet(assetKeys.elements.tree2, "/assets/sunnyside/elements/spr_deco_tree_02_strip4.png", {
      frameWidth: 28,
      frameHeight: 43,
    });
    this.load.image(assetKeys.elements.rock, "/assets/sunnyside/elements/rock.png");
    this.load.image(assetKeys.elements.wood, "/assets/sunnyside/elements/wood.png");
    this.load.image(assetKeys.elements.wheat, "/assets/sunnyside/elements/wheat_05.png");
    this.load.image(assetKeys.elements.carrot, "/assets/sunnyside/elements/carrot_05.png");
    this.load.image(assetKeys.elements.soil, "/assets/sunnyside/elements/soil_00.png");
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
    this.load.image(assetKeys.ui.selectBoxTl, "/assets/sunnyside/ui/selectbox_tl.png");
    this.load.image(assetKeys.ui.selectBoxTr, "/assets/sunnyside/ui/selectbox_tr.png");
    this.load.image(assetKeys.ui.selectBoxBl, "/assets/sunnyside/ui/selectbox_bl.png");
    this.load.image(assetKeys.ui.selectBoxBr, "/assets/sunnyside/ui/selectbox_br.png");
  }

  private loadTinyRpgAssets(): void {
    const fullPackRoot = "/Tiny RPG Character Asset Pack v1.03 -Full 20 Characters";
    const knightRoot = encodeURI(`${fullPackRoot}/Characters(100x100)/Knight Templar/Knight Templar`);
    const archerRoot = encodeURI(`${fullPackRoot}/Characters(100x100)/Archer/Archer`);
    const lancerRoot = encodeURI(`${fullPackRoot}/Characters(100x100)/Lancer/Lancer`);
    this.load.spritesheet(assetKeys.tinyRpg.soldier.idle, `${knightRoot}/Knight%20Templar-Idle.png`, {
      frameWidth: 100,
      frameHeight: 100,
    });
    this.load.spritesheet(assetKeys.tinyRpg.soldier.walk, `${knightRoot}/Knight%20Templar-Walk01.png`, {
      frameWidth: 100,
      frameHeight: 100,
    });
    this.load.spritesheet(assetKeys.tinyRpg.soldier.attack, `${knightRoot}/Knight%20Templar-Attack01.png`, {
      frameWidth: 100,
      frameHeight: 100,
    });
    this.load.spritesheet(assetKeys.tinyRpg.soldier.hurt, `${knightRoot}/Knight%20Templar-Hurt.png`, {
      frameWidth: 100,
      frameHeight: 100,
    });
    this.load.spritesheet(assetKeys.tinyRpg.soldier.death, `${knightRoot}/Knight%20Templar-Death.png`, {
      frameWidth: 100,
      frameHeight: 100,
    });
    this.load.spritesheet(assetKeys.tinyRpg.archer.idle, `${archerRoot}/Archer-Idle.png`, {
      frameWidth: 100,
      frameHeight: 100,
    });
    this.load.spritesheet(assetKeys.tinyRpg.archer.walk, `${archerRoot}/Archer-Walk.png`, {
      frameWidth: 100,
      frameHeight: 100,
    });
    this.load.spritesheet(assetKeys.tinyRpg.archer.attack, `${archerRoot}/Archer-Attack01.png`, {
      frameWidth: 100,
      frameHeight: 100,
    });
    this.load.spritesheet(assetKeys.tinyRpg.archer.hurt, `${archerRoot}/Archer-Hurt.png`, {
      frameWidth: 100,
      frameHeight: 100,
    });
    this.load.spritesheet(assetKeys.tinyRpg.archer.death, `${archerRoot}/Archer-Death.png`, {
      frameWidth: 100,
      frameHeight: 100,
    });
    this.load.spritesheet(assetKeys.tinyRpg.scout.idle, `${lancerRoot}/Lancer-Idle.png`, {
      frameWidth: 100,
      frameHeight: 100,
    });
    this.load.spritesheet(assetKeys.tinyRpg.scout.walk, `${lancerRoot}/Lancer-Walk01.png`, {
      frameWidth: 100,
      frameHeight: 100,
    });
    this.load.spritesheet(assetKeys.tinyRpg.scout.attack, `${lancerRoot}/Lancer-Attack01.png`, {
      frameWidth: 100,
      frameHeight: 100,
    });
    this.load.spritesheet(assetKeys.tinyRpg.scout.hurt, `${lancerRoot}/Lancer-Hurt.png`, {
      frameWidth: 100,
      frameHeight: 100,
    });
    this.load.spritesheet(assetKeys.tinyRpg.scout.death, `${lancerRoot}/Lancer-Death.png`, {
      frameWidth: 100,
      frameHeight: 100,
    });
    this.load.image(assetKeys.tinyRpg.arrow, encodeURI(`${fullPackRoot}/Arrow(Projectile)/Arrow02(32x32).png`));
  }

  private loadAobMapAssets(): void {
    const root = "/assets/aob-map/runtime";
    const legacyRoot = "/assets/aob-map/optimized";
    const newMapRoot = "/new-map";
    this.load.image(assetKeys.aobMap.baseGrass, "/last-assets/grass-256x256.png");
    this.load.image(assetKeys.aobMap.baseDirt, `${newMapRoot}/base-dirt.png`);
    this.load.image(assetKeys.aobMap.baseRocky, `${newMapRoot}/base-rocky.png`);
    this.load.image(assetKeys.aobMap.baseShallowWater, `${newMapRoot}/base-shallow-water.png`);
    this.load.image(assetKeys.aobMap.deepWater, `${newMapRoot}/deep-water.png`);
    this.load.image(assetKeys.aobMap.grassDirtEdge, `${newMapRoot}/grass-to-dirt-v.png`);
    this.load.image(assetKeys.aobMap.grassDirtCornerOuter, `${newMapRoot}/grass-dirt-corner-outer.png`);
    this.load.image(assetKeys.aobMap.grassDirtCornerInner, `${newMapRoot}/grass-dirt-corner-inner.png`);
    this.load.image(assetKeys.aobMap.grassStoneEdge, `${newMapRoot}/grass-stone-edge-vertical.png`);
    this.load.image(assetKeys.aobMap.grassStoneCornerOuter, `${newMapRoot}/grass-stone-corner-outer.png`);
    this.load.image(assetKeys.aobMap.grassStoneCornerInner, `${newMapRoot}/grass-stone-corner-inner.png`);
    this.load.image(assetKeys.aobMap.dirtStoneEdge, `${newMapRoot}/dirt-stone-edge.png`);
    this.load.image(assetKeys.aobMap.dirtStoneCornerOuter, `${newMapRoot}/dirt-stone-corner-outer.png`);
    this.load.image(assetKeys.aobMap.dirtStoneCornerInner, `${newMapRoot}/dirt-stone-corner-inner.png`);
    this.load.image(assetKeys.aobMap.cliffCornerOuter, `${newMapRoot}/cliff-corner-outer.png`);
    this.load.image(assetKeys.aobMap.crystalGround, `${newMapRoot}/crystal-ground.png`);
    this.load.image(assetKeys.aobMap.trees, `${root}/trees.png`);
    this.load.image(assetKeys.aobMap.treesAlt, `${root}/trees-alt.png`);
    this.load.image(assetKeys.aobMap.pineTree, `${root}/pine-tree.png`);
    this.load.image(assetKeys.aobMap.bush, `${root}/bush.png`);
    this.load.image(assetKeys.aobMap.fruitBush, `${root}/fruit-bush.png`);
    this.load.image(assetKeys.aobMap.flowerPatch, `${root}/flower-patch.png`);
    this.load.image(assetKeys.aobMap.grassPatch, `${root}/grass-patch.png`);
    this.load.image(assetKeys.aobMap.bigRocks, `${root}/big-rocks.png`);
    this.load.image(assetKeys.aobMap.rocks, `${root}/rocks.png`);
    this.load.image(assetKeys.aobMap.rock, `${root}/rock.png`);
    this.load.image(assetKeys.aobMap.woodPile, `${root}/wood-pile.png`);
    this.load.image(assetKeys.aobMap.stump, `${root}/stump.png`);
    this.load.image(assetKeys.aobMap.flag, `${root}/flag.png`);
    this.load.image(assetKeys.aobMap.crystalNode, `${root}/crystal-node.png`);
    this.load.image(assetKeys.aobMap.crystalNodeAlt, `${root}/crystal-node-alt.png`);
    this.load.image(assetKeys.aobMap.crystalSprout, `${root}/crystal-sprout.png`);
    this.load.image(assetKeys.aobMap.crates, `${root}/crates.png`);
    this.load.image(assetKeys.aobMap.barrels, `${root}/barrels.png`);
    this.load.image(assetKeys.aobMap.sacks, `${root}/sacks.png`);
    this.load.image(assetKeys.aobMap.fence, `${root}/fence.png`);
    this.load.image(assetKeys.aobMap.fenceCorner, `${root}/fence-corner.png`);
    this.load.image(assetKeys.aobMap.sign, `${root}/sign.png`);
    this.load.image(assetKeys.aobMap.torch, `${root}/torch.png`);
    this.load.image(assetKeys.aobMap.cart, `${root}/cart.png`);
    this.load.image(assetKeys.aobMap.well, `${root}/well.png`);
    this.load.image(assetKeys.aobMap.anvil, `${root}/anvil.png`);
    this.load.image(assetKeys.aobMap.logStack, `${root}/log-stack.png`);
    this.load.image(assetKeys.aobMap.trough, `${root}/trough.png`);
    this.load.image(assetKeys.aobMap.bench, `${root}/bench.png`);
    this.load.image(assetKeys.aobMap.shoreEdge, `${newMapRoot}/shore-edge.png`);
    this.load.image(assetKeys.aobMap.shoreCorner, `${newMapRoot}/shore-corner.png`);
    this.load.image(assetKeys.aobMap.cliffEdge, `${newMapRoot}/cliff-edge.png`);
    this.load.image(assetKeys.aobMap.crystalCliffEdge, `${newMapRoot}/crystal-cliff-edge.png`);
    this.load.image(assetKeys.aobMap.campfire, `${legacyRoot}/campfire.png`);
    this.load.image(assetKeys.aobMap.solanaVillageGround, `/assets/aob-map/solana/terrain/solana-ground-plaza-large.png`);
    this.load.image(assetKeys.aobMap.solanaPathDecal, `${root}/solana-path-decal.png`);
    this.load.image(assetKeys.aobMap.solanaGrassDetailAtlas, `${root}/solana-grass-detail-atlas.png`);
    this.load.image(assetKeys.aobMap.solanaCrystalClusterLarge, `${root}/solana-crystal-cluster-large.png`);
    this.load.image(assetKeys.aobMap.solanaVillagePropsAtlas, `${root}/solana-village-props-atlas.png`);
    this.load.image(assetKeys.aobMap.solanaUiCrest, `${root}/solana-ui-crest.png`);
    this.load.image(assetKeys.aobMap.solanaRoadStraight, `/assets/aob-map/solana/terrain/solana-road-straight.png`);
    this.load.image(assetKeys.aobMap.solanaRoadCurveLeft, `/assets/aob-map/solana/terrain/solana-road-curve-left.png`);
    this.load.image(assetKeys.aobMap.solanaRoadIntersection, `/assets/aob-map/solana/terrain/solana-road-intersection.png`);
    this.load.image(assetKeys.aobMap.solanaRoadEnd, `/assets/aob-map/solana/terrain/solana-road-end.png`);
    this.load.image(assetKeys.aobMap.solanaRoadCross, `/assets/aob-map/solana/roads/solana-road-cross.png`);
    this.load.image(assetKeys.aobMap.solanaRoadCurveEastSouth, `/assets/aob-map/solana/roads/solana-road-curve-east-south.png`);
    this.load.image(assetKeys.aobMap.solanaRoadCurveNorthEast, `/assets/aob-map/solana/roads/solana-road-curve-north-east.png`);
    this.load.image(assetKeys.aobMap.solanaRoadCurveSouthWest, `/assets/aob-map/solana/roads/solana-road-curve-south-west.png`);
    this.load.image(assetKeys.aobMap.solanaRoadCurveWestNorth, `/assets/aob-map/solana/roads/solana-road-curve-west-north.png`);
    this.load.image(assetKeys.aobMap.solanaRoadDiagonalNeSw, `/assets/aob-map/solana/roads/solana-road-diagonal-ne-sw.png`);
    this.load.image(assetKeys.aobMap.solanaRoadDiagonalNwSe, `/assets/aob-map/solana/roads/solana-road-diagonal-nw-se.png`);
    this.load.image(assetKeys.aobMap.solanaRoadEndEast, `/assets/aob-map/solana/roads/solana-road-end-east.png`);
    this.load.image(assetKeys.aobMap.solanaRoadEndNorth, `/assets/aob-map/solana/roads/solana-road-end-north.png`);
    this.load.image(assetKeys.aobMap.solanaRoadEndSouth, `/assets/aob-map/solana/roads/solana-road-end-south.png`);
    this.load.image(assetKeys.aobMap.solanaRoadEndWest, `/assets/aob-map/solana/roads/solana-road-end-west.png`);
    this.load.image(assetKeys.aobMap.solanaRoadStraightHorizontal, `/assets/aob-map/solana/roads/solana-road-straight-horizontal.png`);
    this.load.image(assetKeys.aobMap.solanaRoadStraightVertical, `/assets/aob-map/solana/roads/solana-road-straight-vertical.png`);
    this.load.image(assetKeys.aobMap.solanaRoadTEast, `/assets/aob-map/solana/roads/solana-road-t-east.png`);
    this.load.image(assetKeys.aobMap.solanaRoadTNorth, `/assets/aob-map/solana/roads/solana-road-t-north.png`);
    this.load.image(assetKeys.aobMap.solanaRoadTSouth, `/assets/aob-map/solana/roads/solana-road-t-south.png`);
    this.load.image(assetKeys.aobMap.solanaRoadTWest, `/assets/aob-map/solana/roads/solana-road-t-west.png`);
    this.load.image(assetKeys.aobMap.solanaStoneGroundPatch, `/assets/aob-map/solana/terrain/solana-stone-ground-patch.png`);
    this.load.image(assetKeys.aobMap.solanaCrystalGroundPatch, `/assets/aob-map/solana/terrain/solana-crystal-ground-patch.png`);
    this.load.image(assetKeys.aobMap.solanaWaterShoreCurve, `/assets/aob-map/solana/terrain/solana-water-shore-curve.png`);
    this.load.image(assetKeys.aobMap.solanaGrassToCrystalEdgeEast, `/assets/aob-map/solana/terrain-transitions/solana-grass-to-crystal-edge-east.png`);
    this.load.image(assetKeys.aobMap.solanaGrassToCrystalEdgeNorth, `/assets/aob-map/solana/terrain-transitions/solana-grass-to-crystal-edge-north.png`);
    this.load.image(assetKeys.aobMap.solanaGrassToCrystalEdgeSouth, `/assets/aob-map/solana/terrain-transitions/solana-grass-to-crystal-edge-south.png`);
    this.load.image(assetKeys.aobMap.solanaGrassToCrystalEdgeWest, `/assets/aob-map/solana/terrain-transitions/solana-grass-to-crystal-edge-west.png`);
    this.load.image(assetKeys.aobMap.solanaGrassToDirtEdgeEast, `/assets/aob-map/solana/terrain-transitions/solana-grass-to-dirt-edge-east.png`);
    this.load.image(assetKeys.aobMap.solanaGrassToDirtEdgeNorth, `/assets/aob-map/solana/terrain-transitions/solana-grass-to-dirt-edge-north.png`);
    this.load.image(assetKeys.aobMap.solanaGrassToDirtEdgeSouth, `/assets/aob-map/solana/terrain-transitions/solana-grass-to-dirt-edge-south.png`);
    this.load.image(assetKeys.aobMap.solanaGrassToDirtEdgeWest, `/assets/aob-map/solana/terrain-transitions/solana-grass-to-dirt-edge-west.png`);
    this.load.image(assetKeys.aobMap.solanaGrassToStoneEdgeEast, `/assets/aob-map/solana/terrain-transitions/solana-grass-to-stone-edge-east.png`);
    this.load.image(assetKeys.aobMap.solanaGrassToStoneEdgeNorth, `/assets/aob-map/solana/terrain-transitions/solana-grass-to-stone-edge-north.png`);
    this.load.image(assetKeys.aobMap.solanaGrassToStoneEdgeSouth, `/assets/aob-map/solana/terrain-transitions/solana-grass-to-stone-edge-south.png`);
    this.load.image(assetKeys.aobMap.solanaGrassToStoneEdgeWest, `/assets/aob-map/solana/terrain-transitions/solana-grass-to-stone-edge-west.png`);
    this.load.image(assetKeys.aobMap.solanaShoreCornerNe, `/assets/aob-map/solana/terrain-transitions/solana-shore-corner-ne.png`);
    this.load.image(assetKeys.aobMap.solanaShoreCornerNw, `/assets/aob-map/solana/terrain-transitions/solana-shore-corner-nw.png`);
    this.load.image(assetKeys.aobMap.solanaShoreCornerSe, `/assets/aob-map/solana/terrain-transitions/solana-shore-corner-se.png`);
    this.load.image(assetKeys.aobMap.solanaShoreCornerSw, `/assets/aob-map/solana/terrain-transitions/solana-shore-corner-sw.png`);
    this.load.image(assetKeys.aobMap.solanaShoreEdgeEast, `/assets/aob-map/solana/terrain-transitions/solana-shore-edge-east.png`);
    this.load.image(assetKeys.aobMap.solanaShoreEdgeNorth, `/assets/aob-map/solana/terrain-transitions/solana-shore-edge-north.png`);
    this.load.image(assetKeys.aobMap.solanaShoreEdgeSouth, `/assets/aob-map/solana/terrain-transitions/solana-shore-edge-south.png`);
    this.load.image(assetKeys.aobMap.solanaShoreEdgeWest, `/assets/aob-map/solana/terrain-transitions/solana-shore-edge-west.png`);
    this.load.image(assetKeys.aobMap.solanaTreeClusterA, `/assets/aob-map/solana/resources/solana-tree-cluster-a.png`);
    this.load.image(assetKeys.aobMap.solanaTreeClusterB, `/assets/aob-map/solana/resources/solana-tree-cluster-b.png`);
    this.load.image(assetKeys.aobMap.solanaPineCluster, `/assets/aob-map/solana/resources/solana-pine-cluster.png`);
    this.load.image(assetKeys.aobMap.solanaStoneNodeLarge, `/assets/aob-map/solana/resources/solana-stone-node-large.png`);
    this.load.image(assetKeys.aobMap.solanaStoneNodeSmall, `/assets/aob-map/solana/resources/solana-stone-node-small.png`);
    this.load.image(assetKeys.aobMap.solanaCrystalNodeLarge, `/assets/aob-map/solana/resources/solana-crystal-node-large.png`);
    this.load.image(assetKeys.aobMap.solanaCrystalNodeSmall, `/assets/aob-map/solana/resources/solana-crystal-node-small.png`);
    this.load.image(assetKeys.aobMap.solanaBerryBush, `/assets/aob-map/solana/resources/solana-berry-bush.png`);
    this.load.image(assetKeys.aobMap.solanaBannerSmall, `/assets/aob-map/solana/props/solana-banner-small.png`);
    this.load.image(assetKeys.aobMap.solanaBannerTall, `/assets/aob-map/solana/props/solana-banner-tall.png`);
    this.load.image(assetKeys.aobMap.solanaLanternPost, `/assets/aob-map/solana/props/solana-lantern-post.png`);
    this.load.image(assetKeys.aobMap.solanaCrate, `/assets/aob-map/solana/props/solana-crate.png`);
    this.load.image(assetKeys.aobMap.solanaCratesStack, `/assets/aob-map/solana/props/solana-crates-stack.png`);
    this.load.image(assetKeys.aobMap.solanaBarrels, `/assets/aob-map/solana/props/solana-barrels.png`);
    this.load.image(assetKeys.aobMap.solanaFenceShort, `/assets/aob-map/solana/props/solana-fence-short.png`);
    this.load.image(assetKeys.aobMap.solanaSacks, `/assets/aob-map/solana/props/solana-sacks.png`);
    this.load.image(assetKeys.aobMap.solanaValidatorObelisk, `/assets/aob-map/solana/props/solana-validator-obelisk.png`);
    this.load.image(assetKeys.aobMap.solanaFenceCorner, `/assets/aob-map/solana/props/solana-fence-corner.png`);
  }

  private loadAobBuildingStaticAssets(): void {
    const root = "/assets/aob-buildings/static-runtime";
    const ruinsRoot = "/assets/aob-buildings/ruins";
    this.load.image(assetKeys.aobBuildingStatic.construction, `${root}/construction.png`);
    this.load.image(assetKeys.aobBuildingStatic.townCenter.genesis, "/last-assets/hdv-t1.png");
    this.load.image(assetKeys.aobBuildingStatic.townCenter.settlement, "/last-assets/hdv-t2.png");
    this.load.image(assetKeys.aobBuildingStatic.townCenter.network, "/last-assets/hdv-t3.png");
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
    this.load.image(assetKeys.aobBuildingStatic.stable.genesis, `${root}/barracks-t1.png`);
    this.load.image(assetKeys.aobBuildingStatic.stable.settlement, `${root}/barracks-t2.png`);
    this.load.image(assetKeys.aobBuildingStatic.stable.network, `${root}/barracks-t3.png`);
    this.load.image(assetKeys.aobBuildingStatic.watchTower.genesis, `${root}/watch-tower-t1.png`);
    this.load.image(assetKeys.aobBuildingStatic.watchTower.settlement, `${root}/watch-tower-t2.png`);
    this.load.image(assetKeys.aobBuildingStatic.watchTower.network, `${root}/watch-tower-t3.png`);
    this.load.image(assetKeys.aobBuildingRuins.small, `${ruinsRoot}/ruins-small.png`);
    this.load.image(assetKeys.aobBuildingRuins.medium, `${ruinsRoot}/ruins-medium.png`);
    this.load.image(assetKeys.aobBuildingRuins.large, `${ruinsRoot}/ruins-large.png`);
  }

  private loadAobWallAssets(): void {
    const version = "20260424-225617";
    this.load.image(assetKeys.aobWalls.palisadeHorizontal, `/last-assets/runtime/wall-palisade-horizontal.png?v=${version}`);
    this.load.image(assetKeys.aobWalls.palisadeVertical, `/last-assets/runtime/wall-palisade-vertical.png?v=${version}`);
    this.load.image(assetKeys.aobWalls.palisadeCornerLeft, `/last-assets/runtime/wall-palisade-corner-left.png?v=${version}`);
    this.load.image(assetKeys.aobWalls.palisadeCornerRight, `/last-assets/runtime/wall-palisade-corner-right.png?v=${version}`);
    this.load.image(assetKeys.aobWalls.palisadeGate, `/last-assets/runtime/gate-palisade.png?v=${version}`);
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
