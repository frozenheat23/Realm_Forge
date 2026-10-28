// Tunable numbers for the yearly simulation. See docs/PARAMS.md for what each one does.
// They live in one object (not separate constants) so the settings panel can change them live.

export const SIM = {
  // --- Population ---
  POP_GROWTH: 0.02,
  WAR_ATTRITION: 0.05,
  /** Population a newly claimed cell starts with, as a share of its capacity. */
  NEW_CELL_POP_FRACTION: 0.05,

  // --- Totals ---
  STRENGTH_POP_EXP: 0.8,

  // --- Stability ---
  STAB_RECOVERY: 0.01,
  ADMIN_CAP_BASE: 120,
  OVEREXT_K: 0.002,
  WEARINESS_STAB_K: 0.02,
  CAPITAL_DIST_FREE: 8,
  CAPITAL_DIST_K: 0.001,
  WEARINESS_GAIN: 0.03,
  WEARINESS_DECAY: 0.05,

  // --- Expansion ---
  EXPANSION_RATE: 0.1,

  // --- War ---
  WAR_BASE_PROB: 0.004,
  WAR_STRENGTH_EXP: 1.0,
  /** Ceiling on the yearly chance a pair goes to war, however lopsided they are. */
  WAR_MAX_PROB: 0.1,
  MAX_WARS_PER_NATION: 2,
  DEFENDER_BONUS: 1.2,
  FRONT_FLIPS_PER_YEAR: 3,
  SCORE_PER_FLIP: 5,
  PEACE_SCORE: 60,
  WEARINESS_PEACE: 0.9,
  MAX_WAR_YEARS: 25,
  TRUCE_YEARS: 10,

  // --- Rebellion ---
  REBEL_THRESHOLD: 0.25,
  REBEL_PROB: 0.03,
  REBEL_MIN_CAPITAL_DIST: 5,
  REBEL_MAX_CELLS: 40,
  REBEL_START_STABILITY: 0.6,

  // --- Collapse ---
  MIN_AREA: 6,
  CAPITAL_LOSS_STAB_HIT: 0.3,

  // --- Emergence ---
  EMERGENCE_PROB: 0.01,
  EMERGENCE_MIN_REGION: 30,
  /** Cells a newly emerged nation starts with (keep it at least MIN_AREA so it survives). */
  EMERGENCE_CORE_SIZE: 8,
};

export type SimParams = typeof SIM;
export type SimParamName = keyof SimParams;

/** The starting values, kept so the settings panel can reset. */
export const SIM_DEFAULTS: Readonly<SimParams> = { ...SIM };
