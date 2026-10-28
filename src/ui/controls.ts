// Playback controls: play/pause, step one year, speed buttons and the year counter.
import { DEFAULT_SPEED, SPEEDS } from "./config";

export interface Controls {
  /** True while history is playing. */
  readonly playing: boolean;
  /** Current speed in years per second. */
  readonly speed: number;
  /** Stops playback (e.g. at the final year). */
  pause(): void;
  /** Updates the big year counter. */
  showYear(year: number): void;
}

/** Builds the controls inside `bar`. `onStep` runs when the user asks for exactly one year. */
export function createControls(bar: HTMLElement, yearLabel: HTMLElement, onStep: () => void): Controls {
  let playing = false;
  let speed = DEFAULT_SPEED;

  const playButton = document.createElement("button");
  const stepButton = document.createElement("button");
  stepButton.textContent = "Step";
  stepButton.title = "Advance one year (→)";

  const updatePlay = () => {
    playButton.textContent = playing ? "Pause" : "Play";
    playButton.title = "Play / pause (Space)";
  };
  const togglePlay = () => {
    playing = !playing;
    updatePlay();
  };
  playButton.addEventListener("click", togglePlay);
  stepButton.addEventListener("click", () => {
    playing = false;
    updatePlay();
    onStep();
  });

  const speedButtons = SPEEDS.map((s) => {
    const b = document.createElement("button");
    b.textContent = `${s}×`;
    b.title = `${s} years per second`;
    b.addEventListener("click", () => {
      speed = s;
      speedButtons.forEach((other) => other.classList.toggle("active", other === b));
    });
    b.classList.toggle("active", s === speed);
    return b;
  });

  window.addEventListener("keydown", (event) => {
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
    showYear(year: number) {
      yearLabel.textContent = `Year ${year}`;
    },
  };
}
