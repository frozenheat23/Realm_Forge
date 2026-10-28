// Colors and drawing settings. See docs/PARAMS.md ("Rendering") for what each one does.
// Look: "painted strategy" — warm greens and ochres, soft relief, blue seas.

/** One stop on a color ramp: at height `at` (0..1) the color is `color`. */
export interface ColorStop {
  at: number;
  color: string;
}

// Land colors from the coast (0) to the highest peak (1).
export const LAND_RAMP: ColorStop[] = [
  { at: 0.0, color: "#86ab52" }, // lush coastal green
  { at: 0.22, color: "#9db45c" }, // meadow
  { at: 0.42, color: "#bdb46c" }, // ochre plains
  { at: 0.58, color: "#b69c66" }, // tan uplands
  { at: 0.72, color: "#917b5e" }, // brown hills
  { at: 0.85, color: "#868079" }, // grey rock
  { at: 0.94, color: "#e9e6df" }, // snow
  { at: 1.0, color: "#f7f6f2" },
];

// Water colors from the coast (0) to the deepest sea (1).
export const WATER_RAMP: ColorStop[] = [
  { at: 0.0, color: "#5fa3c8" }, // shallows
  { at: 0.04, color: "#3f83b5" },
  { at: 0.25, color: "#3170a5" },
  { at: 1.0, color: "#27598f" }, // deep ocean
];

// --- Relief (hillshading) ---
export const HILLSHADE_AZIMUTH = 315;
export const HILLSHADE_ALTITUDE = 45;
export const HILLSHADE_STRENGTH = 0.6;
/** How much to stretch heights before shading. Higher = steeper-looking hills. */
export const HILLSHADE_EXAGGERATION = 60;

// --- Texture and coast ---
export const TERRAIN_GRAIN = 0.03;
export const COAST_LINE_COLOR = "#3d4a3a";
export const COAST_LINE_ALPHA = 0.55;
/** Pale glow in the water right next to land. Width is in heightmap units below sea level. */
export const COAST_GLOW_COLOR = "#a9d6e6";
export const COAST_GLOW_WIDTH = 0.012;

// --- Sea grid (faint latitude/longitude lines over water) ---
export const SEA_GRID_SPACING = 100;
export const SEA_GRID_ALPHA = 0.08;
