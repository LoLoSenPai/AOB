# Solana Asset Prompt Batches

Use one image per asset. Do not ask GPT Image to create atlases.

## Shared Style Lock

```text
Create a batch of separate PNG assets for the same 2.5D isometric RTS game.
Style lock: Age of Empires inspired hand-painted pixel-art readability, Solana blockchain civilization, medieval fantasy with subtle cyan and purple crystal technology, warm sunlight from upper left, consistent 3/4 top-down RTS camera, transparent background, no text, no UI, no watermark, no scenery, no rectangular background.
Each image must contain exactly one asset, centered on the canvas, with consistent scale for the batch, enough empty transparent padding, and a bottom-center anchor point suitable for game placement.
```

## Batch 1: Ground Decals

Canvas: 1024x1024.

```text
[Shared Style Lock]
Generate these as separate PNG files:
1. solana-ground-plaza-large: irregular village dirt plaza with feathered alpha edges, subtle embedded Solana crystal linework, no building, no shadow.
2. solana-road-straight: dirt road segment, vertical orientation in the image, feathered grassy edges, no hard rectangular border.
3. solana-road-curve-left: single curved dirt road segment, same width as straight road, feathered grassy edges.
4. solana-road-intersection: natural dirt crossing for village paths, same road width.
5. solana-road-end: road ending into grass, feathered alpha.
6. solana-stone-ground-patch: rocky buildable ground patch, feathered alpha.
7. solana-crystal-ground-patch: crystal-tinted rocky ground patch, feathered alpha.
8. solana-water-shore-curve: shallow water shoreline decal with grass/stone transition, feathered alpha.
```

## Batch 2: Resources

Canvas: 512x512.

```text
[Shared Style Lock]
Generate these as separate PNG files:
1. solana-tree-cluster-a: dense green tree cluster, bottom-center anchor, no ground tile.
2. solana-tree-cluster-b: alternate dense tree cluster, same scale.
3. solana-pine-cluster: darker pine tree cluster, same scale.
4. solana-stone-node-large: harvestable grey stone deposit, same scale.
5. solana-stone-node-small: depleted or small grey stone deposit.
6. solana-crystal-node-large: harvestable cyan and purple crystal deposit, same scale.
7. solana-crystal-node-small: small/depleted crystal deposit, same scale.
8. solana-berry-bush: food bush with small bright fruit, same scale.
```

## Batch 3: Village Props

Canvas: 384x384.

```text
[Shared Style Lock]
Generate these as separate PNG files:
1. solana-banner-small: small vertical Solana banner on stone base.
2. solana-banner-tall: tall vertical Solana banner on stone base.
3. solana-lantern-post: wood and brass lantern post with faint cyan/purple crystal light.
4. solana-crate: single wooden crate with small Solana mark, no text.
5. solana-crates-stack: stacked wooden crates, same style.
6. solana-barrels: grouped wooden barrels.
7. solana-sacks: resource sacks with tiny crystal accents, no text.
8. solana-validator-obelisk: small decorative crystal validator obelisk.
9. solana-fence-short: short wooden fence segment.
10. solana-fence-corner: matching wooden fence corner.
```

## Generated Lots 4-7 Audit

Status after visual review on 2026-04-26:

- `public/4` road curves, diagonals, and straight segments are usable as freeform decals. Use them only in their native orientation; do not rotate them in code.
- `public/5` is partly usable. `solana-road-t-north` and `solana-road-t-south` are visually the same, so only the south-facing T was copied into the stable asset folder. Regenerate the T/end-cap correction batch below before relying on junctions.
- `public/6` and `public/7` look good as terrain overlay decals, but not as strict autotiles. They are rounded painterly patches, so place them manually to hide square terrain seams instead of using them as edge tiles.
- Contact shadows are paused for now because generated shadows made buildings feel like they were floating.

Stable copies were placed under:

- `public/assets/aob-map/solana/roads`
- `public/assets/aob-map/solana/terrain-transitions`

Lot 8 correction status:

- Accepted on 2026-04-26.
- The corrected road T-junctions and end caps were copied into `public/assets/aob-map/solana/roads`.
- The missing `solana-shore-corner-nw` and `solana-shore-corner-se` files were copied into `public/assets/aob-map/solana/terrain-transitions`.

## Correction Batch: Road Junctions And Corners

Canvas: 1024x1024. Maximum 10 separate images.

```text
[Shared Style Lock]
Generate these as separate PNG files.
Important orientation rule: north means the top of the image, south means the bottom, east means the right side, west means the left side. Do not rotate, mirror, or duplicate compositions between files. Each asset must visibly match its filename. Keep road width, color, grass fringe, scale, and camera angle consistent with the previous Solana dirt road assets. Transparent background only.

1. solana-road-t-north: T-junction dirt road with the stem pointing north/up and the horizontal road running east-west near the lower half.
2. solana-road-t-south: T-junction dirt road with the stem pointing south/down and the horizontal road running east-west near the upper half.
3. solana-road-t-east: T-junction dirt road with the stem pointing east/right and the vertical road running north-south on the left half.
4. solana-road-t-west: T-junction dirt road with the stem pointing west/left and the vertical road running north-south on the right half.
5. solana-road-end-north: vertical dirt road end cap, road enters from south/bottom and ends with a rounded feathered cap toward north/top.
6. solana-road-end-south: vertical dirt road end cap, road enters from north/top and ends with a rounded feathered cap toward south/bottom.
7. solana-road-end-east: horizontal dirt road end cap, road enters from west/left and ends with a rounded feathered cap toward east/right.
8. solana-road-end-west: horizontal dirt road end cap, road enters from east/right and ends with a rounded feathered cap toward west/left.
9. solana-shore-corner-nw: grass-to-water shoreline corner with water on the north/top and west/left sides, feathered alpha.
10. solana-shore-corner-se: grass-to-water shoreline corner with water on the south/bottom and east/right sides, feathered alpha.
```

## Paused Batch: Building Contact Shadows

Canvas: 1024x1024.

```text
Generate transparent soft contact-shadow PNGs only, no buildings, no props, no terrain, no color except black alpha shadow. RTS 2.5D bottom-ground contact shadows.
Generate separate PNG files:
1. shadow-building-small: for 5x4 tile houses.
2. shadow-building-medium: for 7x5 camps.
3. shadow-building-large: for 10x8 town center.
4. shadow-tower: narrow tower footprint.
5. shadow-wall-horizontal: long low palisade/wall shadow.
6. shadow-wall-vertical: vertical palisade/wall shadow.
```
