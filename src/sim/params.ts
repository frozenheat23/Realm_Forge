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
  /** Travel cost from the capital at which control falls to ~37%. */
  CONTROL_RANGE: 12,
  /** Control of cells the capital can't reach over its own land. */
  CONTROL_ISLAND: 0.2,
  /** Average control below which stability suffers. */
  CONTROL_FREE: 0.5,
  /** Stability lost per year per point of average control below CONTROL_FREE. */
  CONTROL_STAB_K: 0.02,
  WEARINESS_GAIN: 0.03,
  WEARINESS_DECAY: 0.05,
  /** Share of foreign-race population a nation can hold before it hurts stability. */
  FOREIGN_FREE: 0.2,
  /** Stability lost per year at 100% foreign population (divided by the ruler's tolerance). */
  FOREIGN_K: 0.02,

  // --- Land (unrest, devastation, ownership) ---
  /** Unrest a cell jumps to (at least) when captured. */
  UNREST_CONQUEST: 0.6,
  /** Unrest gained per year × (1 − control). Must beat UNREST_DECAY for weak control to matter. */
  UNREST_CONTROL_K: 0.05,
  /** Unrest gained per year when ruled by another race (÷ ruler's tolerance). */
  UNREST_FOREIGN_K: 0.01,
  /** Unrest gained per year × devastation. */
  UNREST_DEVASTATION_K: 0.02,
  /** Unrest lost per year (doubled in core land). */
  UNREST_DECAY: 0.02,
  /** Years of ownership before a cell counts as core land. */
  CORE_YEARS: 50,
  /** Devastation gained per year on a war front. */
  DEVASTATION_FRONT: 0.1,
  /** Devastation added when a cell changes hands in war. */
  DEVASTATION_CAPTURE: 0.5,
  /** Share of devastation healed per year. */
  DEVASTATION_HEAL: 0.05,
  /** Capacity lost at full devastation. */
  DEVASTATION_CAP_LOSS: 0.5,
  /** Yearly development gain in ideal conditions (full, fully controlled, undamaged land). */
  DEV_GROWTH: 0.005,
  /** Development lost per year × devastation. */
  DEV_DEVASTATION_LOSS: 0.05,
  /** Development a cell needs to become a village, town and city. */
  SETTLE_VILLAGE: 0.15,
  SETTLE_TOWN: 0.4,
  SETTLE_CITY: 0.7,
  /** Pop / capacity a town or city also needs. */
  SETTLE_MIN_POP_FRACTION: 0.6,
  /** A settlement only shrinks once development falls below its threshold × this (stops flicker). */
  SETTLE_DOWN_FACTOR: 0.8,
  /** Fewest cell-steps between two cities. */
  CITY_MIN_SPACING: 6,
  /** Total richness of one resource a nation needs for its full bonus. */
  RESOURCE_SATURATION: 2.0,
  /** How much more a race values a deposit of a resource it favors. */
  FAVORED_RESOURCE_VALUE: 2,

  // --- Expansion ---
  EXPANSION_RATE: 0.1,

  // --- War ---
  WAR_BASE_PROB: 0.002,
  WAR_STRENGTH_EXP: 0.7,
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
  /** War chance × (1 + this × value of the best enemy cell on the border). */
  WAR_VALUE_K: 0.5,
  /** How long land lost to another nation can be claimed back. */
  CLAIM_YEARS: 100,
  /** × war chance against a nation holding land you lost within CLAIM_YEARS. */
  CLAIM_WAR_BONUS: 2.0,

  // --- Armies (SPEC §4.13) ---
  /** Most soldiers a nation can keep, as a share of its militaryPop. */
  LEVY_SHARE: 0.08,
  /** Share of the gap to the cap refilled per year (× 0.5 + stability). */
  LEVY_REFILL: 0.1,
  /** War weariness gained per share of the cap lost in battle. */
  WEARINESS_LOSS_K: 0.25,
  /** Base share of the loser's soldiers lost in a battle (× power ratio). */
  BATTLE_LOSS: 0.25,
  /** Most of an army one battle can kill. */
  BATTLE_MAX_LOSS: 0.6,
  /** Winner's losses relative to the loser's (÷ power ratio). */
  WINNER_LOSS_SHARE: 0.4,

  // --- Diplomacy ---
  /** Share of the gap to its target that opinion closes each year. */
  OPINION_DRIFT: 0.05,
  /** Opinion lost for sharing a border. */
  BORDER_FRICTION: 0.1,
  /** Opinion gained while both fight the same enemy. */
  SHARED_ENEMY_BONUS: 0.5,
  /** Opinion lost while at war with each other. */
  WAR_OPINION_PENALTY: 0.5,
  /** Instant opinion drop when war is declared (a grudge that fades). */
  WAR_OPINION_HIT: 0.3,
  /** Opinion between rebels and the nation they broke from. */
  REBEL_OPINION: -0.6,
  /** War chance × (1 − opinion × this): hatred raises it, friendship lowers it. */
  OPINION_WAR_K: 1.0,
  ALLIANCE_MIN_OPINION: 0.15,
  ALLIANCE_BREAK_OPINION: 0.05,
  ALLIANCE_PROB: 0.05,
  MAX_ALLIES: 2,
  /** Chance an ally bordering the attacker joins to defend its partner. */
  ALLY_DEFEND_PROB: 0.8,
  /** Chance an ally bordering the target joins its partner's attack. */
  ALLY_ATTACK_PROB: 0.4,

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
