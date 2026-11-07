// The camera (M19): which part of the map is on screen, and how close.
// Canvas pixels and map (world) pixels are the same at zoom 1. Zoomed in, canvas
// pixel (px, py) shows map point (x + px / zoom, y + py / zoom).
// Only math here, no drawing, so it can be tested on its own.

export interface Camera {
  /** 1 = the whole map; 4 = a quarter of it across. */
  zoom: number;
  /** The map point at the canvas's top-left corner. */
  x: number;
  y: number;
}

export const WHOLE_MAP: Camera = { zoom: 1, x: 0, y: 0 };

/** The map is `width` × `height`; the camera may zoom from 1 up to `maxZoom`. */
export interface Bounds {
  width: number;
  height: number;
  maxZoom: number;
}

/** Keeps the zoom in range and the view inside the map. */
export function clampCamera(camera: Camera, bounds: Bounds): Camera {
  const zoom = Math.min(bounds.maxZoom, Math.max(1, camera.zoom));
  const maxX = bounds.width - bounds.width / zoom;
  const maxY = bounds.height - bounds.height / zoom;
  return { zoom, x: Math.min(maxX, Math.max(0, camera.x)), y: Math.min(maxY, Math.max(0, camera.y)) };
}

/** The map point shown at canvas pixel (px, py). */
export function toWorld(camera: Camera, px: number, py: number): [number, number] {
  return [camera.x + px / camera.zoom, camera.y + py / camera.zoom];
}

/** Zooms by `factor` (2 = twice as close), keeping the map point under canvas pixel (px, py) where it is. */
export function zoomAt(camera: Camera, factor: number, px: number, py: number, bounds: Bounds): Camera {
  const [wx, wy] = toWorld(camera, px, py);
  const zoom = Math.min(bounds.maxZoom, Math.max(1, camera.zoom * factor));
  return clampCamera({ zoom, x: wx - px / zoom, y: wy - py / zoom }, bounds);
}

/** Drags the map by (dx, dy) canvas pixels: the map moves with the mouse. */
export function panBy(camera: Camera, dx: number, dy: number, bounds: Bounds): Camera {
  return clampCamera({ ...camera, x: camera.x - dx / camera.zoom, y: camera.y - dy / camera.zoom }, bounds);
}

/** Centres the view on map point (wx, wy) at `zoom`. */
export function lookAt(wx: number, wy: number, zoom: number, bounds: Bounds): Camera {
  const z = Math.min(bounds.maxZoom, Math.max(1, zoom));
  return clampCamera({ zoom: z, x: wx - bounds.width / z / 2, y: wy - bounds.height / z / 2 }, bounds);
}

export function sameCamera(a: Camera, b: Camera): boolean {
  return a.zoom === b.zoom && a.x === b.x && a.y === b.y;
}

/** The canvas transform that draws map coordinates where this camera shows them. */
export function setView(ctx: CanvasRenderingContext2D, camera: Camera): void {
  ctx.setTransform(camera.zoom, 0, 0, camera.zoom, -camera.x * camera.zoom, -camera.y * camera.zoom);
}
