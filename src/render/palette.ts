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
/** A vassal's land has a band this many pixels wide inside its borders, in its overlord's color (docs/systems/vassalage.md). */
export const VASSAL_BAND_WIDTH = 3;
/** How solid that band is, 0..1. */
export const VASSAL_BAND_ALPHA = 0.8;
/** Tint per race in the Races map layer (SPEC §5.4b), indexed by RaceId (0 = nobody, unused). */
export const RACE_COLORS: string[] = ["#000000", "#d9a441", "#9fd8e8", "#6a4c93", "#a0522d", "#6b8e23"];
/** Tint per faith in the Faiths map layer (SPEC §5.4i), indexed by FaithId (0 = nobody, unused). */
export const FAITH_COLORS: string[] = ["#000000", "#3b3b4f", "#f2c94c", "#4caf50", "#b0bec5", "#7b1fa2", "#8d5a2b", "#ef6c00", "#c62828", "#d7b899"];
/** Lines between allied capitals (SPEC §5.4c). */
export const ALLIANCE_COLOR = "rgba(255, 248, 225, 0.9)";
export const ALLIANCE_OUTLINE = "rgba(40, 32, 20, 0.6)";
export const ALLIANCE_WIDTH = 2;
/** Dash pattern in pixels: [line, gap]. */
export const ALLIANCE_DASH = [6, 4];
/** Settlements layer (SPEC §5.4f): dots for towns, a square and a name for cities. */
export const TOWN_RADIUS = 1.8;
export const TOWN_FILL = "#3a2f25";
export const CITY_SIZE = 5;
export const CITY_FILL = "#fbf6e9";
export const CITY_FONT = "italic 10px Georgia, serif";
/** Resources layer (SPEC §5.4e): a marker per deposit, colored by type (indexed by ResourceId; 0 unused). */
export const RESOURCE_COLORS: string[] = ["#000000", "#e8c547", "#2e7d32", "#78909c", "#ffb300", "#8d6e63", "#80deea"];
/** One letter drawn on each marker (indexed by ResourceId). */
export const RESOURCE_LETTERS: string[] = ["", "G", "T", "I", "$", "H", "M"];
/** Marker radius in pixels; rich deposits get up to RESOURCE_RICH_GROWTH extra. */
export const RESOURCE_RADIUS = 4;
export const RESOURCE_RICH_GROWTH = 2;
export const RESOURCE_OUTLINE = "rgba(30, 25, 20, 0.85)";
export const RESOURCE_FONT = "bold 7px sans-serif";
/** Heatmap layers (SPEC §5.4d): color ramp from 0 to 1, drawn over the land at HEAT_ALPHA. */
export const HEAT_RAMP: ColorStop[] = [
  { at: 0, color: "#fff7bc" },
  { at: 0.5, color: "#fd8d3c" },
  { at: 1, color: "#99000d" },
];
export const HEAT_ALPHA = 0.75;
export const HEAT_LABEL_FONT = "18px Georgia, serif";
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

// --- Zoom (M19) ---
/** Zoomed in, markers, names and inked lines grow on screen as zoom ^ this: 0.5 makes them twice as big at 4×. 1 = they grow with the map; 0 = they stay the same size. */
export const MARK_ZOOM_GROWTH = 0.5;
export const LABEL_SIZE_PER_SQRT_AREA = 2.2;
/** Gap between letters, as a share of the font size. */
export const LABEL_LETTER_SPACING = 0.18;
export const LABEL_COLOR = "#2b2620";
/** Light outline around label letters so they read over any color. */
export const LABEL_HALO = "rgba(250, 246, 235, 0.85)";
export const CAPITAL_RADIUS = 3;
export const CAPITAL_FILL = "#fbf6e9";
/** Pale fill of the parchment map's castles and compass. */
export const CASTLE_WALL = "#f0e2c0";
/** The crown over the capital of a realm with a great ruler. */
export const CROWN_FILL = "#f2c744";
export const CROWN_WIDTH = 22;
export const CROWN_HEIGHT = 15;
/** Gap between the capital marker and the crown. */
export const CROWN_GAP = 3;

// --- War and unrest effects (SPEC §5.4g, key E). Times are real seconds. ---
/** Sliding stripes in the occupier's color over occupied land. */
export const OCCUPIED_HATCH_ALPHA = 0.45;
export const OCCUPIED_HATCH_SPACING = 8;
export const OCCUPIED_HATCH_WIDTH = 2.5;
/** Pixels per second the stripes slide. */
export const OCCUPIED_HATCH_SPEED = 10;
/** Battle flash: a ring in the winner's color plus crossed swords. */
export const BATTLE_SECONDS = 1.4;
export const BATTLE_RADIUS = 16;
export const BATTLE_SWORD_SIZE = 7;
export const BATTLE_SWORD_COLOR = "#fbf6e9";
/** Ring line width (pixels) at the start; it thins as it fades. */
export const BATTLE_RING_WIDTH = 3;
/** Ring at a capital when a nation rebels, is founded, collapses or is annexed. */
export const EVENT_BURST_SECONDS = 2.5;
export const EVENT_BURST_RADIUS = 45;
export const EVENT_RING_WIDTH = 4;
export const COLLAPSE_COLOR = "#2b2620";
/** Most battle and event flashes at once; the oldest give way. */
export const MAX_BURSTS = 80;
/** Smoke rising from devastated land. Colors are "R, G, B" so alpha can be added. */
export const SMOKE_MIN_DEVASTATION = 0.25;
export const SMOKE_ALPHA = 0.8;
export const SMOKE_SIZE = 7;
export const SMOKE_RISE = 14;
export const SMOKE_SECONDS = 3;
export const SMOKE_COLOR = "70, 62, 56";
/** Flickering glow on restless land in nations unstable enough to rebel (stability < REBEL_THRESHOLD). */
export const EMBER_MIN_UNREST = 0.9;
/** Share of those cells that glow, so a whole empire doesn't turn orange. */
export const EMBER_DENSITY = 0.3;
export const EMBER_SIZE = 5;
/** Flicker speed, in radians per second. */
export const EMBER_FLICKER = 5;
export const EMBER_COLOR = "255, 122, 26";

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

// --- Armies (SPEC §5.4h) ---
/** Banner half-height (pixels) for the smallest army and for one of ARMY_BANNER_FULL soldiers or more. */
export const ARMY_BANNER_MIN = 7;
export const ARMY_BANNER_MAX = 16;
export const ARMY_BANNER_FULL = 1;
/** Opacity of the dashed line to an army's target. */
export const ARMY_TARGET_ALPHA = 0.5;
export const ARMY_LABEL_COLOR = "#fbf6e9";
/** Ring closing around a besieged cell as the siege progresses. */
export const SIEGE_RING_RADIUS = 7;
export const SIEGE_RING_WIDTH = 2;
export const SIEGE_RING_COLOR = "#fbf6e9";

// =====================================================================
// How a map style changes the shared layers (nations, labels, settlements).
// =====================================================================

export interface MapLook {
  /** Opacity of realm color inside a realm, and in a thin band along its borders (0 = no band). */
  overlayAlpha: number;
  overlayEdgeAlpha: number;
  overlayEdgeWidth: number;
  /** Realm colors are pulled this far toward `tintToward`, so they sit on the map. */
  tintToward: string;
  tintShare: number;
  /** One color for every border, or null to use a darker shade of each realm's color. */
  borderInk: string | null;
  borderAlpha: number;
  /** The played realm's border (M20): drawn this many pixels wide, in this color. */
  playedBorderWidth: number;
  playedBorder: string;
  labelFont: string;
  labelWeight: number;
  /** Capital letters for realm names, or the name as it's spelled (for small-caps fonts). */
  labelUpper: boolean;
  labelSpacing: number;
  labelColor: string;
  labelHalo: string;
  capital: "dot" | "castle";
  /** Height of the capital marker above its cell center, so the crown clears it. */
  capitalHeight: number;
  crownFill: string;
  townDots: boolean;
  cityMarker: "square" | "spire";
  cityFont: string;
  /** How far a capital's city name sits from the middle of its marker. */
  capitalNameGap: number;
  resourceMarker: "letter" | "icon";
  warColor: string;
  allianceColor: string;
  allianceOutline: string;
  allianceWidth: number;
  allianceDash: number[];
  armyOutline: string;
  armyFont: string;
  armyLabelColor: string;
  armyLabelHalo: string;
  siegeColor: string;
  /** "R, G, B", so alpha can be added. */
  emberColor: string;
}

/** The look of the cel-shaded and painted styles. */
export const LOOK_STANDARD: MapLook = {
  overlayAlpha: OVERLAY_ALPHA,
  overlayEdgeAlpha: OVERLAY_ALPHA,
  overlayEdgeWidth: 0,
  tintToward: "#000000",
  tintShare: 0,
  borderInk: null,
  borderAlpha: BORDER_ALPHA,
  playedBorderWidth: 3,
  playedBorder: "#f3dd90",
  labelFont: LABEL_FONT,
  labelWeight: 600,
  labelUpper: true,
  labelSpacing: LABEL_LETTER_SPACING,
  labelColor: LABEL_COLOR,
  labelHalo: LABEL_HALO,
  capital: "dot",
  capitalHeight: CAPITAL_RADIUS,
  crownFill: CROWN_FILL,
  townDots: true,
  cityMarker: "square",
  cityFont: CITY_FONT,
  capitalNameGap: CITY_SIZE,
  resourceMarker: "letter",
  warColor: WAR_FRONT_COLOR,
  allianceColor: ALLIANCE_COLOR,
  allianceOutline: ALLIANCE_OUTLINE,
  allianceWidth: ALLIANCE_WIDTH,
  allianceDash: ALLIANCE_DASH,
  armyOutline: CEL_INK_COLOR,
  armyFont: "bold 10px Georgia, serif",
  armyLabelColor: ARMY_LABEL_COLOR,
  armyLabelHalo: CEL_INK_COLOR,
  siegeColor: SIEGE_RING_COLOR,
  emberColor: EMBER_COLOR,
};

// =====================================================================
// Parchment ("atlas") style, ?style=atlas: an old chart with thin ink outlines.
// =====================================================================

export const ATLAS_INK = "#2a1c10";
export const ATLAS_PAPER = "#ecdcb6";
/** Open sea, and the darker wash near the shore. */
export const ATLAS_SEA = "#d3d3b4";
export const ATLAS_SEA_NEAR = "#9fb8ad";
/** How strong the wash is at the coast, and how many pixels out it fades over. */
export const ATLAS_SEA_NEAR_SHARE = 0.75;
export const ATLAS_SEA_NEAR_FADE = 28;
/** Engraved lines following the shore: [pixels from the coast, ink strength]. */
export const ATLAS_WATERLINES: [number, number][] = [[4, 0.6], [8, 0.46], [13, 0.34], [19, 0.24], [26, 0.15], [34, 0.09]];
export const ATLAS_COAST_WIDTH = 1.7;
/** How much stains lighten or darken the paper, and how dark the sheet's edge gets. */
export const ATLAS_STAIN = 0.07;
export const ATLAS_EDGE_DARKEN = 0.2;
/** Lines radiating from the compass rose and a second point at sea. */
export const ATLAS_SAILING_INK = "rgba(42, 28, 16, 0.45)";
export const ATLAS_SAILING_RED = "rgba(122, 52, 36, 0.4)";
export const ATLAS_SAILING_RAYS = 16;
/** Faint latitude and longitude lines. */
export const ATLAS_GRID_COLOR = "rgba(58, 42, 26, 0.13)";
export const ATLAS_GRID_X = 200;
export const ATLAS_GRID_Y = 150;
export const ATLAS_RIVER_COLOR = "rgba(52, 74, 84, 0.9)";
export const ATLAS_RIVER_MIN_WIDTH = 1;
export const ATLAS_RIVER_WIDTH_PER_FLOW = 0.35;
/** Mountain symbol height: base pixels, plus this much per unit of elevation above MOUNTAIN_H. */
export const ATLAS_PEAK_SIZE = 13;
export const ATLAS_PEAK_GROWTH = 42;
export const ATLAS_PEAK_FILL = "#e6d3a8";
/** Share of hill and forest cells that get a symbol. */
export const ATLAS_HILL_CHANCE = 0.3;
export const ATLAS_FOREST_CHANCE = 0.3;
export const ATLAS_TREE_FILL = "rgba(226, 212, 170, 0.4)";
export const ATLAS_TREE_SIZE = 5.5;
/** Symbols stay this many pixels clear of the coast. */
export const ATLAS_SYMBOL_COAST_GAP = 7;
export const ATLAS_ROSE_RADIUS = 76;
export const ATLAS_PANEL_FILL = "#efe0bd";
export const ATLAS_PANEL_WIDTH = 330;
export const ATLAS_PANEL_HEIGHT = 150;
export const ATLAS_PANEL_MARGIN = 44;
/** Checkered edge of the sheet. */
export const ATLAS_FRAME_WIDTH = 12;
export const ATLAS_FRAME_CHECK = 50;
export const ATLAS_TITLE_FONT = "34px 'IM Fell English SC', Georgia, serif";
export const ATLAS_NOTE_FONT = "italic 16px 'IM Fell English', Georgia, serif";
/** Bundled with the game; the map redraws once they've loaded. */
export const ATLAS_FONTS = [ATLAS_TITLE_FONT, ATLAS_NOTE_FONT, "italic 13px 'IM Fell English'"];
/** Size of the castle on capitals and the spire on cities (1 = as drawn). */
export const ATLAS_CASTLE_SCALE = 1;
export const ATLAS_CITY_SCALE = 1;
/** Resource discs: how far their fill leans toward paper, and how much bigger than the classic markers. */
export const ATLAS_RESOURCE_PAPER = 0.55;
export const ATLAS_RESOURCE_GROWTH = 1.6;

export const LOOK_ATLAS: MapLook = {
  overlayAlpha: 0.38,
  overlayEdgeAlpha: 0.54,
  overlayEdgeWidth: 3,
  tintToward: "#8a6a3f",
  tintShare: 0.32,
  borderInk: ATLAS_INK,
  borderAlpha: 0.88,
  playedBorderWidth: 3,
  playedBorder: ATLAS_INK,
  labelFont: "'IM Fell English SC', Georgia, serif",
  labelWeight: 400,
  labelUpper: false,
  labelSpacing: 0.16,
  labelColor: ATLAS_INK,
  labelHalo: "rgba(236, 220, 182, 0.8)",
  capital: "castle",
  capitalHeight: 21 * ATLAS_CASTLE_SCALE,
  crownFill: "#c9a14a",
  townDots: false,
  cityMarker: "spire",
  cityFont: "italic 13px 'IM Fell English', Georgia, serif",
  capitalNameGap: 13,
  resourceMarker: "icon",
  warColor: "#a32a1e",
  allianceColor: "rgba(42, 28, 16, 0.75)",
  allianceOutline: "rgba(236, 220, 182, 0.55)",
  allianceWidth: 1.3,
  allianceDash: [7, 4],
  armyOutline: ATLAS_INK,
  armyFont: "13px 'IM Fell English SC', Georgia, serif",
  armyLabelColor: ATLAS_INK,
  armyLabelHalo: "rgba(236, 220, 182, 0.85)",
  siegeColor: "#a32a1e",
  emberColor: "196, 92, 32",
};

// --- Following a war (M16, docs/systems/warroom.md) ---
/** Ring around goal land the attacker hasn't taken yet. */
export const FOCUS_GOAL_COLOR = "#e0b84a";
export const FOCUS_GOAL_RADIUS = 4;
/** Mark on land a side occupies, in the occupier's color, with a dark edge. */
export const FOCUS_HELD_SIZE = 5;
export const FOCUS_EDGE = "rgba(30, 24, 18, 0.85)";
// --- Ruler card (SPEC §5.4k): portrait in a parchment frame, its wax seal in the nation's color ---
/** Card width on the page, in CSS pixels. It is drawn at 512 × 768 and shrunk, so it stays sharp. */
export const RULER_CARD_WIDTH = 180;
/** Where the portrait shows through each frame, as shares of the frame: [left, top, right, bottom]. Measured by scripts/portraits.py. */
export const RULER_CARD_OPENINGS = { ordinary: [0.076, 0.092, 0.926, 0.887], great: [0.119, 0.105, 0.881, 0.822] } as const;
/** Each frame's nameplate (the great frame's is the scroll between its rolls), in the same shares. */
export const RULER_CARD_PLATES = { ordinary: [0.06, 0.893, 0.94, 0.96], great: [0.22, 0.845, 0.8, 0.925] } as const;
/** Ruler's title and name, then dynasty and realm, in the map's old-print fonts. Sizes are in the 512-pixel-wide drawing. */
export const RULER_CARD_NAME_FONT = "28px 'IM Fell English SC', Georgia, serif";
export const RULER_CARD_SUB_FONT = "italic 20px 'IM Fell English', Georgia, serif";
/** Ink on the nameplate. */
export const RULER_CARD_TEXT = "#1d150d";

// --- 3D relief view (SPEC §5.4n): the flat map laid over raised terrain ---
/** How tall the highest peak stands, in map pixels (the map is 1600 across). */
export const RELIEF_HEIGHT = 120;
/** Above 1 keeps lowlands flat and lets mountains rise steeply; 1 = height straight from elevation. */
export const RELIEF_CURVE = 1.5;
/** Map pixels between neighbouring points of the 3D surface. Smaller = finer hills, more work to draw. */
export const RELIEF_STEP = 4;
/** Soft light from everywhere: keeps the parchment's own colors. */
export const RELIEF_AMBIENT = 2.1;
/** The sun, from the north-west like the map's own shading: makes slopes light and dark. */
export const RELIEF_SUN = 1.5;
/** The table the map lies on. */
export const RELIEF_BACKGROUND = "#17120c";
/** Camera angle of view, in degrees. */
export const RELIEF_FOV = 40;
/** How close and how far the camera may go, as shares of the map's width. */
export const RELIEF_NEAR_FAR = [0.12, 1.6] as const;

// --- A fallen ruler's card burns (SPEC §5.4k) ---
/** How far in the fire eats before it dies: 0 = not at all, 1 = the whole card. */
export const RULER_CARD_BURN_REACH = 0.42;
/** How much harder the bottom edge (the nameplate) is to burn than the top and sides. */
export const RULER_CARD_BURN_BOTTOM = 6;
/** How brown the heat leaves what survives, 0..1. */
export const RULER_CARD_BURN_SCORCH = 0.45;
/** The glowing line at the fire's front, and the black it leaves behind. */
export const RULER_CARD_BURN_EMBER = "#ff8a2a";
export const RULER_CARD_BURN_CHAR = "#120b07";
