// Zoom and pan the map (M19): mouse wheel or pinch zooms toward the pointer, dragging
// moves the map, double-click zooms in (shift: out), + / − / 0 keys zoom and fit.
import { panBy, WHOLE_MAP, zoomAt, type Bounds, type Camera } from "../render/camera";
import { ZOOM_STEP, ZOOM_WHEEL_K } from "./config";
import { canvasPoint, onKey } from "./debugInfo";

/** Pixels a wheel "line" is worth, for mice that scroll by lines rather than pixels. */
const LINE_PIXELS = 16;

export function attachZoom(canvas: HTMLCanvasElement, bounds: Bounds, camera: () => Camera, setCamera: (next: Camera) => void): void {
  canvas.addEventListener(
    "wheel",
    (event) => {
      event.preventDefault(); // don't scroll the page
      const pixels = event.deltaY * (event.deltaMode === 1 ? LINE_PIXELS : 1);
      const [px, py] = canvasPoint(canvas, event);
      setCamera(zoomAt(camera(), Math.exp(-pixels * ZOOM_WHEEL_K), px, py, bounds));
    },
    { passive: false },
  );

  // Dragging: remember where the mouse was, and move the map by as much as it moved.
  let last: [number, number] | null = null;
  canvas.addEventListener("mousedown", (event) => {
    if (event.button !== 0) return;
    last = canvasPoint(canvas, event);
    canvas.classList.add("dragging");
  });
  window.addEventListener("mousemove", (event) => {
    if (!last) return;
    const point = canvasPoint(canvas, event);
    setCamera(panBy(camera(), point[0] - last[0], point[1] - last[1], bounds));
    last = point;
  });
  window.addEventListener("mouseup", () => {
    last = null;
    canvas.classList.remove("dragging");
  });

  canvas.addEventListener("dblclick", (event) => {
    const [px, py] = canvasPoint(canvas, event);
    setCamera(zoomAt(camera(), event.shiftKey ? 1 / ZOOM_STEP : ZOOM_STEP, px, py, bounds));
  });

  const middle = (): [number, number] => [canvas.width / 2, canvas.height / 2];
  const zoomKey = (factor: number) => () => setCamera(zoomAt(camera(), factor, ...middle(), bounds));
  onKey("+", zoomKey(ZOOM_STEP));
  onKey("=", zoomKey(ZOOM_STEP)); // the + key without shift
  onKey("-", zoomKey(1 / ZOOM_STEP));
  onKey("0", () => setCamera(WHOLE_MAP));
}
