// Tunable numbers for the yearly simulation. See docs/PARAMS.md for what each one does.

// --- Population ---
export const POP_GROWTH = 0.02;
export const WAR_ATTRITION = 0.05;
/** Population a newly claimed cell starts with, as a share of its capacity. */
export const NEW_CELL_POP_FRACTION = 0.05;

// --- Totals ---
export const STRENGTH_POP_EXP = 0.8;

// --- Stability ---
export const STAB_RECOVERY = 0.01;
export const ADMIN_CAP_BASE = 120;
export const OVEREXT_K = 0.002;
export const WEARINESS_STAB_K = 0.02;
export const CAPITAL_DIST_FREE = 8;
export const CAPITAL_DIST_K = 0.001;
export const WEARINESS_GAIN = 0.03;
export const WEARINESS_DECAY = 0.05;

// --- Expansion ---
export const EXPANSION_RATE = 0.1;

// --- War ---
export const WAR_BASE_PROB = 0.004;
export const WAR_STRENGTH_EXP = 1.0;
/** Ceiling on the yearly chance a pair goes to war, however lopsided they are. */
export const WAR_MAX_PROB = 0.1;
export const MAX_WARS_PER_NATION = 2;
export const DEFENDER_BONUS = 1.2;
export const FRONT_FLIPS_PER_YEAR = 3;
export const SCORE_PER_FLIP = 5;
export const PEACE_SCORE = 60;
export const WEARINESS_PEACE = 0.9;
export const MAX_WAR_YEARS = 25;
export const TRUCE_YEARS = 10;

// --- Rebellion ---
export const REBEL_THRESHOLD = 0.25;
export const REBEL_PROB = 0.03;
export const REBEL_MIN_CAPITAL_DIST = 5;
export const REBEL_MAX_CELLS = 40;
export const REBEL_START_STABILITY = 0.6;

// --- Collapse ---
export const MIN_AREA = 6;
export const CAPITAL_LOSS_STAB_HIT = 0.3;

// --- Emergence ---
export const EMERGENCE_PROB = 0.01;
export const EMERGENCE_MIN_REGION = 30;
/** Cells a newly emerged nation starts with (keep it at least MIN_AREA so it survives). */
export const EMERGENCE_CORE_SIZE = 8;
