# Asset Source Folders

This folder keeps generated and raw image sources out of the runtime asset roots.

- `aob-buildings/raw`: source PNG sheets used by `scripts/generate-building-atlases.ps1`.
- `aob-buildings/archive`: older building generations kept for reference only.
- `aob-map/atlases`: source map atlases used by `scripts/generate-map-runtime.ps1`.
- `aob-map/legacy-cleaned`: older hand-cleaned loose PNGs kept for reference only.
- `btc-generated/raw`: original BTC generated PNGs. `scripts/promote-btc-assets.ps1` crops and promotes the usable set into `public/assets/aob-map/btc`.
- `solana-generated/batches`: original generated Solana prompt batches.

Runtime assets loaded by the game stay under `public/assets`, `public/last-assets`, and the two Tiny RPG character pack folders.

For future civilizations such as BTC, import raw generated files here first, then promote only selected transparent PNGs into `public/assets/...` once they are named, cropped, and wired into the loader.
