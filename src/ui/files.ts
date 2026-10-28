// Saving to and loading from files on your computer, plus video recording of the map.
import { SIM } from "../sim/params";
import { toSnapshot, type Snapshot } from "../sim/snapshot";
import type { WorldState } from "../core/types";

/** Hands the browser a file to download (the browser asks where to save it). */
export function downloadFile(name: string, data: Blob): void {
  const url = URL.createObjectURL(data);
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.click();
  URL.revokeObjectURL(url);
}

export function saveSnapshot(state: WorldState): void {
  const json = JSON.stringify(toSnapshot(state, SIM));
  downloadFile(`realm-forge-${state.seed}-year-${state.year}.json`, new Blob([json], { type: "application/json" }));
}

/** Opens a file picker and resolves with the chosen save file's contents. */
export function pickSnapshot(): Promise<Snapshot> {
  return new Promise((resolve, reject) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "application/json,.json";
    input.addEventListener("change", async () => {
      const file = input.files?.[0];
      if (!file) return;
      try {
        resolve(JSON.parse(await file.text()) as Snapshot);
      } catch (error) {
        reject(error);
      }
    });
    input.click();
  });
}

/**
 * Records the canvas as a WebM video. Call start(), then stop() to download it.
 * captureStream() turns the canvas into a live video feed; MediaRecorder encodes it.
 */
export function createRecorder(canvas: HTMLCanvasElement, fileName: () => string) {
  let recorder: MediaRecorder | null = null;
  let chunks: Blob[] = [];

  return {
    get recording() {
      return recorder !== null;
    },
    start() {
      const type = MediaRecorder.isTypeSupported("video/webm;codecs=vp9") ? "video/webm;codecs=vp9" : "video/webm";
      recorder = new MediaRecorder(canvas.captureStream(30), { mimeType: type });
      chunks = [];
      recorder.addEventListener("dataavailable", (e) => chunks.push(e.data));
      recorder.addEventListener("stop", () => downloadFile(fileName(), new Blob(chunks, { type: "video/webm" })));
      recorder.start();
    },
    stop() {
      recorder?.stop();
      recorder = null;
    },
  };
}
