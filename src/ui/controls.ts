// Playback controls: play/pause, step one year and speed buttons.
import { DEFAULT_SPEED, SPEEDS } from "./config";

export interface Controls {
  /** True while history is playing. */
  readonly playing: boolean;
  /** Current speed in years per second. */
  readonly speed: number;
  /** Stops playback (e.g. at the final year). */
  pause(): void;
}

/** A toolbar button. */
export function makeButton(label: string, title: string, onClick: () => void): HTMLButtonElement {
  const b = document.createElement("button");
  b.textContent = label;
  b.title = title;
  b.addEventListener("click", onClick);
  return b;
}

/** True if the user is typing in a text box (so keyboard shortcuts should stay out of the way). */
function typing(event: KeyboardEvent): boolean {
  const el = event.target as HTMLElement;
  return el.tagName === "INPUT" || el.tagName === "TEXTAREA";
}

/** Builds the controls inside `bar`. `onStep` runs when the user asks for exactly one year. */
export function createControls(bar: HTMLElement, onStep: () => void): Controls {
  let playing = false;
  let speed = DEFAULT_SPEED;

  const updatePlay = () => {
    playButton.textContent = playing ? "Pause" : "Play";
  };
  const togglePlay = () => {
    playing = !playing;
    updatePlay();
  };
  const playButton = makeButton("Play", "Play / pause (Space)", togglePlay);
  const stepButton = makeButton("Step", "Advance one year (→)", () => {
    playing = false;
    updatePlay();
    onStep();
  });

  const speedButtons = SPEEDS.map((s) => {
    const b = makeButton(`${s}×`, `${s} years per second`, () => {
      speed = s;
      speedButtons.forEach((other) => other.classList.toggle("active", other === b));
    });
    b.classList.toggle("active", s === speed);
    return b;
  });

  window.addEventListener("keydown", (event) => {
    if (typing(event)) return;
    if (event.key === " ") {
      event.preventDefault(); // stop the page scrolling
      togglePlay();
    } else if (event.key === "ArrowRight") {
      stepButton.click();
    }
  });

  updatePlay();
  bar.append(playButton, stepButton, ...speedButtons);

  return {
    get playing() {
      return playing;
    },
    get speed() {
      return speed;
    },
    pause() {
      playing = false;
      updatePlay();
    },
  };
}
