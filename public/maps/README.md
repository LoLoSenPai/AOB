# Age of Blockchains Tiled Authoring

Open `solana-village.tmj` in Tiled. This is an authoring map, not final rendered art.

## Layers

- `biome-mask`: paint gameplay terrain categories: grass, dark grass, road/path, dirt, water, deep water, stone ground, crystal ground.
- `roads-guide`: polyline guides for roads. Use these to shape village flow before we generate proper road decals/autotiles.
- `resource-spawns`: point objects for trees, stone, gold/crystals, and berries.
- `starting-village`: starting Town Center, starter House, and worker spawn points.

## Rules

- Do not try to make the final image pretty in this file. Make composition readable: clear village center, roads, resource clusters, forest edges, waterline, cliffs/stone/crystal zones.
- Keep buildings and resources in object layers. Terrain layers should describe ground only.
- Keep one gameplay tile equal to 16x16 pixels.
- Use Tiled as the source of truth for composition once the runtime importer is wired.
- For the final look, keep the gameplay terrain broad and simple, then use image object layers for painterly decals: plaza, road pieces, shoreline patches, grass-to-dirt/stone/crystal overlays, props, and resource clusters.
- Do not build roads tile by tile from square terrain. Place the road PNGs at their native orientation and use transition decals to hide remaining square seams.

## Asset Direction

For GPT image, generate one PNG per asset. Avoid generated atlases.

Base prompt:

```text
Single 2.5D isometric RTS game asset, Age of Empires inspired, Solana blockchain civilization, medieval fantasy architecture with subtle cyan and purple crystal technology, transparent background, no terrain, no UI, no text, no watermark, centered on a 512x512 canvas, bottom-center anchor point, consistent 3/4 top-down camera angle, warm sunlight from upper left, readable at 128px in game.
Asset: [asset name].
```

For ground decals:

```text
Single 2.5D RTS ground decal, transparent background, no buildings, no units, no UI, feathered alpha edges, designed to overlay grass naturally without a rectangular border, centered on a 1024x1024 canvas, consistent top-down RTS camera angle.
Decal: [decal name].
```
