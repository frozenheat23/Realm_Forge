// Settings panel: edit simulation numbers live, and switch map layers on and off.
import { SIM, SIM_DEFAULTS, type SimParamName } from "../sim/params";

// Which numbers to show, grouped like docs/PARAMS.md.
const GROUPS: { title: string; names: SimParamName[] }[] = [
  { title: "Population", names: ["POP_GROWTH", "NEW_CELL_POP_FRACTION", "STRENGTH_POP_EXP"] },
  {
    title: "Stability",
    names: ["STAB_RECOVERY", "ADMIN_CAP_BASE", "OVEREXT_K", "VIGOR_BONUS", "VIGOR_YEARS", "WEARINESS_STAB_K", "CONTROL_RANGE", "CONTROL_ISLAND", "CONTROL_FREE", "CONTROL_STAB_K", "WEARINESS_GAIN", "WEARINESS_DECAY", "FOREIGN_FREE", "FOREIGN_K"],
  },
  {
    title: "Land",
    names: ["UNREST_CONQUEST", "UNREST_CONTROL_K", "UNREST_FOREIGN_K", "UNREST_KIN_K", "UNREST_FAITH_K", "UNREST_DEVASTATION_K", "UNREST_OCCUPIED", "UNREST_CRISIS_K", "UNREST_DECAY", "CORE_YEARS", "DEVASTATION_CAPTURE", "DEVASTATION_HEAL", "DEVASTATION_CAP_LOSS", "DEV_GROWTH", "DEV_DEVASTATION_LOSS", "SETTLE_VILLAGE", "SETTLE_TOWN", "SETTLE_CITY", "SETTLE_MIN_POP_FRACTION", "SETTLE_DOWN_FACTOR", "CITY_MIN_SPACING", "RESOURCE_SATURATION", "FAVORED_RESOURCE_VALUE"],
  },
  { title: "Culture and faith", names: ["CULTURE_RATE", "ASSIMILATE_MAX_UNREST", "FAITH_RATE", "FAITH_FOREIGN_SPREAD", "OLD_GODS_MIN_UNREST", "OLD_GODS_SPARK", "OLD_GODS_UNREST_REACH", "OLD_GODS_ELF_SPREAD", "FAITH_MAJORITY", "FAITH_ADOPT"] },
  { title: "Expansion", names: ["EXPANSION_RATE"] },
  {
    title: "War",
    names: ["WAR_BASE_PROB", "WAR_STRENGTH_EXP", "WAR_MAX_PROB", "MAX_WARS_PER_NATION", "DEFENDER_BONUS", "PEACE_SCORE", "WIN_SCORE", "WEARINESS_PEACE", "MAX_WAR_YEARS", "TRUCE_YEARS", "WAR_VALUE_K", "CLAIM_YEARS", "CLAIM_WAR_BONUS"],
  },
  { title: "Armies", names: ["LEVY_SHARE", "LEVY_REFILL", "WEARINESS_LOSS_K", "MOBILIZE_SHARE", "REINFORCE_RATE", "MIN_ARMY_SIZE", "CAMPAIGN_STEPS", "ARMY_MOVE", "RAID_RANGE", "ENGAGE_RANGE", "ENGAGE_RATIO", "ENGAGE_INTEL_ERROR", "RETREAT_MORALE", "ARMY_ATTRITION", "SUPPLY_RANGE", "FORAGE_SHARE", "SUPPLY_MORALE_LOSS", "BATTLE_LOSS", "BATTLE_MAX_LOSS", "WINNER_LOSS_SHARE", "FORT_BONUS", "MORALE_LOSS", "MORALE_GAIN", "MORALE_RECOVERY", "ROUT_MORALE", "ROUT_RETURN", "BATTLE_POP_LOSS", "DEVASTATION_BATTLE", "DEVASTATION_MARCH", "SIEGE_STEPS", "SIEGE_SETTLEMENT_K", "CAPITAL_SIEGE_MULT", "SIEGE_GARRISON_SHARE", "SIEGE_RECOVERY", "SIEGE_ASSAULT_RATIO", "SIEGE_ASSAULT_LOSS", "BATTLE_SCORE", "ROUT_SCORE", "SCORE_PER_OCCUPIED", "CAPITAL_SCORE", "GOAL_SCORE_MULT", "RAID_CHANCE", "CONQUEST_MAX_PROVINCES", "SUBJUGATE_RATIO", "PEACE_EXTRA_CELLS", "RAID_TRIBUTE", "REBEL_LEVY", "REBEL_WAR_PROB", "BATTLE_NAME_RANGE"] },
  {
    title: "Diplomacy",
    names: ["OPINION_DRIFT", "BORDER_FRICTION", "SHARED_ENEMY_BONUS","WAR_OPINION_PENALTY", "WAR_OPINION_HIT", "REBEL_OPINION", "FAITH_OPINION", "OPINION_WAR_K", "ALLIANCE_MIN_OPINION", "ALLIANCE_BREAK_OPINION", "ALLIANCE_PROB", "MAX_ALLIES", "ALLY_DEFEND_PROB", "ALLY_ATTACK_PROB"],
  },
  { title: "Rebellion", names: ["REBEL_THRESHOLD", "REBEL_PROB", "REBEL_RESTLESS_CELLS", "REBEL_SPREAD", "REBEL_MAX_SPREAD", "REBEL_MIN_CAPITAL_DIST", "REBEL_MAX_CELLS", "REBEL_START_STABILITY"] },
  { title: "Rulers and dynasties", names: ["GREAT_RULER_CHANCE", "GREAT_AREA", "GREAT_CONQUEROR_POWER", "GREAT_CONQUEROR_WAR", "GREAT_LAWGIVER_CAP", "GREAT_LAWGIVER_CALM", "GREAT_BUILDER_DEV", "GREAT_PROPHET_SPREAD", "GREAT_SCHEMER_STAB", "HEIR_CHANCE", "DYNASTY_STAB_HIT", "CRISIS_BASE", "CRISIS_AREA", "CRISIS_GREAT", "CRISIS_STAB_HIT", "CIVIL_WAR_MIN_AREA", "CIVIL_WAR_CELLS_PER_SPLIT", "CIVIL_WAR_MAX_SPLITS", "CIVIL_WAR_SHARE", "INDEPENDENCE_CHANCE", "ANNEX_CHANCE", "VASSAL_DEMAND_RATIO", "VASSAL_DEMAND_CHANCE"] },
  { title: "Collapse & emergence", names: ["MIN_AREA", "CAPITAL_LOSS_STAB_HIT", "EMERGENCE_PROB", "EMERGENCE_MIN_REGION", "EMERGENCE_CORE_SIZE"] },
];

export interface Layers {
  nations: boolean;
  /** Tint land by race instead of by nation (SPEC §5.4b). */
  races: boolean;
  /** Tint land by culture instead of by nation (SPEC §5.4i). */
  cultures: boolean;
  /** Tint land by faith instead of by nation (SPEC §5.4i). */
  faiths: boolean;
  /** Lines between allied capitals (SPEC §5.4c). */
  alliances: boolean;
  /** Resource deposit markers (SPEC §5.4e). */
  resources: boolean;
  /** Towns and named cities (SPEC §5.4f). */
  settlements: boolean;
  labels: boolean;
  /** Animated war fronts, battles, smoke and unrest (SPEC §5.4g). */
  effects: boolean;
  /** Army banners and marches (SPEC §5.4h). */
  armies: boolean;
  cells: boolean;
  /** A fallen realm's last ruler is shown, burning (SPEC §5.4k). Not a map layer, but switched here with them. */
  falls: boolean;
}

/**
 * Builds the panel inside `container`. `onLayersChange` runs when a layer
 * checkbox flips. Number changes write straight into SIM, so the very next
 * simulated year uses them.
 */
export function createSettings(container: HTMLElement, layers: Layers, onLayersChange: () => void): void {
  // --- Layer toggles ---
  const layerRow = document.createElement("div");
  layerRow.className = "settings-row";
  const layerNames: [keyof Layers, string][] = [
    ["nations", "Nations"],
    ["races", "Races"],
    ["cultures", "Cultures"],
    ["faiths", "Faiths"],
    ["alliances", "Alliances"],
    ["resources", "Resources"],
    ["settlements", "Towns & cities"],
    ["labels", "Labels"],
    ["effects", "Effects"],
    ["armies", "Armies"],
    ["cells", "Cell outlines"],
    ["falls", "Burn fallen rulers"],
  ];
  for (const [key, label] of layerNames) {
    const box = document.createElement("input");
    box.type = "checkbox";
    box.checked = layers[key];
    box.addEventListener("change", () => {
      layers[key] = box.checked;
      onLayersChange();
    });
    const wrap = document.createElement("label");
    wrap.append(box, ` ${label}`);
    layerRow.append(wrap);
  }
  container.append(layerRow);

  // --- Parameter inputs ---
  const inputs = new Map<SimParamName, HTMLInputElement>();
  const grid = document.createElement("div");
  grid.className = "settings-grid";
  for (const group of GROUPS) {
    const box = document.createElement("fieldset");
    const legend = document.createElement("legend");
    legend.textContent = group.title;
    box.append(legend);
    for (const name of group.names) {
      const input = document.createElement("input");
      input.type = "number";
      input.step = "any";
      input.value = String(SIM[name]);
      input.addEventListener("input", () => {
        const value = Number(input.value);
        if (Number.isFinite(value)) SIM[name] = value;
        input.classList.toggle("changed", SIM[name] !== SIM_DEFAULTS[name]);
      });
      inputs.set(name, input);
      const row = document.createElement("label");
      row.className = "param";
      row.title = "See docs/PARAMS.md for what this does";
      row.append(name, input);
      box.append(row);
    }
    grid.append(box);
  }
  container.append(grid);

  const reset = document.createElement("button");
  reset.textContent = "Reset to defaults";
  reset.addEventListener("click", () => {
    for (const [name, input] of inputs) {
      SIM[name] = SIM_DEFAULTS[name];
      input.value = String(SIM[name]);
      input.classList.remove("changed");
    }
  });
  container.append(reset);
}

/** Puts the values from a save file into SIM (and the panel, if it's built afterwards). */
export function applyParams(values: Partial<Record<SimParamName, number>>): void {
  for (const name of Object.keys(SIM) as SimParamName[]) {
    const v = values[name];
    if (typeof v === "number") SIM[name] = v;
  }
}
