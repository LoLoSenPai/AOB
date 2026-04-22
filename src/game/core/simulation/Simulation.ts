import type { CommandDraft, GameCommand } from "../commands/types";
import { createInitialState } from "../state/createInitialState";
import type { GameState } from "../state/types";
import { applyCommand } from "../systems/commandProcessor";
import { runSimulationSystems } from "../systems/simulationSystems";
import { TICK_MS } from "../../data/constants";

export class Simulation {
  readonly state: GameState;
  private readonly commandQueue: GameCommand[] = [];
  private accumulatorMs = 0;

  constructor(initialState = createInitialState()) {
    this.state = initialState;
  }

  dispatch(command: CommandDraft): void {
    this.commandQueue.push({
      ...command,
      issuedTick: this.state.tick,
    } as GameCommand);
  }

  update(deltaMs: number): void {
    this.accumulatorMs += Math.min(deltaMs, 250);
    while (this.accumulatorMs >= TICK_MS) {
      this.step();
      this.accumulatorMs -= TICK_MS;
    }
  }

  step(): void {
    while (this.commandQueue.length > 0) {
      const command = this.commandQueue.shift();
      if (command) {
        applyCommand(this.state, command);
      }
    }
    runSimulationSystems(this.state);
    this.state.tick += 1;
  }

  snapshot(): GameState {
    return this.state;
  }
}
