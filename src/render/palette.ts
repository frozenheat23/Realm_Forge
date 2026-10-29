import { Biome, type BiomeId } from "../core/types";

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

// =====================================================================
// Cel-shaded ("illustrated") style: flat color bands, stepped shading, ink lines.
// Kept light and muted so nation colors read clearly on top.
// =====================================================================

/** One flat land band: used for heights up to `upTo` (0 = coast, 1 = highest peak). */
export interface ColorBand {
  upTo: number;
  color: string;
}

export const CEL_LAND_BANDS: ColorBand[] = [
  { upTo: 0.22, color: "#a9c77c" }, // lowlands
  { upTo: 0.45, color: "#c1c987" }, // hills
  { upTo: 0.65, color: "#d4c393" }, // highlands
  { upTo: 0.85, color: "#ad977c" }, // mountains
  { upTo: 1.0, color: "#f3f1eb" }, // snow
];

/** Bands from this one up keep their own color; lower bands are colored by biome instead. */
export const CEL_FIRST_ROCK_BAND = 3;
/** Each band above the lowlands darkens the biome color by this much, so height still reads. */
export const CEL_BAND_DARKEN = 0.06;
/** How far (pixels) biome edges wave, so they don't show straight cell edges. */
export const CEL_BIOME_EDGE_WOBBLE = 5;

/** Flat, muted color per biome (indexed by the Biome number in core/types.ts). */
export const BIOME_COLORS: Record<BiomeId, string> = {
  [Biome.Water]: "#5795c4",
  [Biome.Grassland]: "#b3cc7e",
  [Biome.TemperateForest]: "#8fb46e",
  [Biome.Savanna]: "#d2c983",
  [Biome.TropicalForest]: "#7fae69",
  [Biome.Shrubland]: "#c9bf8a",
  [Biome.Taiga]: "#97ac80",
  [Biome.Wetland]: "#9dbb8f",
  [Biome.Desert]: "#e6d39c",
  [Biome.Tundra]: "#c9cbb8",
  [Biome.Ice]: "#f1f3f2",
};

// --- Rivers ---
export const RIVER_COLOR = "#3d7db3";
/** River line width at its source, in pixels. */
export const RIVER_MIN_WIDTH = 1.2;
/** Extra width per square-root of flow (big rivers get wider, but not endlessly). */
export const RIVER_WIDTH_PER_FLOW = 0.6;

// --- Nations (SPEC §5.2–5.4) ---
export const OVERLAY_ALPHA = 0.5;
export const BORDER_ALPHA = 0.85;
export const BORDER_DARKEN = 0.4;
/** Border color where two nations are at war (SPEC §5.3: highlight war fronts). */
export const WAR_FRONT_COLOR = "#c8312b";
/** When nations are highlighted (click an event), others keep this share of their opacity. */
export const HIGHLIGHT_DIM = 0.2;
/** Tint per race in the Races map layer (SPEC §5.4b), indexed by RaceId (0 = nobody, unused). */
export const RACE_COLORS: string[] = ["#000000", "#d9a441", "#9fd8e8", "#6a4c93", "#a0522d", "#6b8e23"];
/** Year counter drawn on the map (so it shows up in recorded videos). */
export const YEAR_FONT = "34px Georgia, serif";
export const YEAR_COLOR = "#fbf6e9";
export const YEAR_SHADOW = "rgba(0, 0, 0, 0.7)";
/** Smallest nation (in cells) that gets a name label. */
export const LABEL_MIN_AREA = 10;
export const LABEL_FONT = "Georgia, 'Times New Roman', serif";
/** Label size in pixels: grows with the square root of the nation's area, within these limits. */
export const LABEL_MIN_SIZE = 11;
export const LABEL_MAX_SIZE = 40;
export const LABEL_SIZE_PER_SQRT_AREA = 2.2;
/** Gap between letters, as a share of the font size. */
export const LABEL_LETTER_SPACING = 0.18;
export const LABEL_COLOR = "#2b2620";
/** Light outline around label letters so they read over any color. */
export const LABEL_HALO = "rgba(250, 246, 235, 0.85)";
export const CAPITAL_RADIUS = 3;
export const CAPITAL_FILL = "#fbf6e9";

// --- Debug view (press C) ---
export const DEBUG_CELL_LINE = "rgba(30, 30, 30, 0.25)";

export const CEL_SHALLOW_COLOR = "#86bcd8";
export const CEL_DEEP_COLOR = "#5795c4";
export const CEL_RIPPLE_COLOR = "#a9d2e7";
export const CEL_INK_COLOR = "#2e3a33";

/** Thickness of the inked coastline, in pixels. */
export const CEL_COAST_WIDTH = 2;
/** How dark the thin lines between elevation bands are (0 = none, 1 = full ink). */
export const CEL_BAND_LINE_ALPHA = 0.3;
/** Width of the shallow-water strip along coasts, in pixels. */
export const CEL_SHALLOW_WIDTH = 12;
/** Distances from the coast (pixels) where ripple lines are drawn. */
export const CEL_RIPPLES = [20, 32];
/** Blur radius (pixels) used to smooth the terrain before banding and shading. */
export const CEL_SMOOTH_RADIUS = 6;
/** Slopes lit more/less than this (−1..1) snap to the highlight/shadow tone. */
export const CEL_SHADE_THRESHOLD = 0.3;
/** Bands below this (0 = lowlands) are never shaded. */
export const CEL_FIRST_SHADED_BAND = 1;
export const CEL_HIGHLIGHT = 1.08;
export const CEL_SHADOW = 0.8;
