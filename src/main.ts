import Phaser from "phaser";
import "./styles.css";
import { BootScene } from "./game/renderer/scenes/BootScene";
import { MapEditorScene } from "./game/renderer/scenes/MapEditorScene";
import { PreloadScene } from "./game/renderer/scenes/PreloadScene";
import { WorldScene } from "./game/renderer/scenes/WorldScene";

const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: "game-root",
  backgroundColor: "#3f5730",
  pixelArt: true,
  roundPixels: true,
  scale: {
    mode: Phaser.Scale.RESIZE,
    width: window.innerWidth,
    height: window.innerHeight,
  },
  input: {
    mouse: {
      preventDefaultWheel: false,
    },
  },
  scene: [BootScene, PreloadScene, WorldScene, MapEditorScene],
});

window.addEventListener("contextmenu", (event) => event.preventDefault());

export default game;
