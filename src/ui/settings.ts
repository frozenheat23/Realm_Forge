// Settings panel: edit simulation numbers live, and switch map layers on and off.
import { SIM, SIM_DEFAULTS, type SimParamName } from "../sim/params";

// Which numbers to show, grouped like docs/PARAMS.md.
const GROUPS: { title: string; names: SimParamName[] }[] = [
  { title: "Population", names: ["POP_GROWTH", "WAR_ATTRITION", "NEW_CELL_POP_FRACTION", "STRENGTH_POP_EXP"] },
  {
    title: "Stability",
    names: ["STAB_RECOVERY", "ADMIN_CAP_BASE", "OVEREXT_K", "WEARINESS_STAB_K", "CONTROL_RANGE", "CONTROL_ISLAND", "CONTROL_FREE", "CONTROL_STAB_K", "WEARINESS_GAIN", "WEARINESS_DECAY", "FOREIGN_FREE", "FOREIGN_K"],
  },
  {
    title: "Land",
    names: ["UNREST_CONQUEST", "UNREST_CONTROL_K", "UNREST_FOREIGN_K", "UNREST_DEVASTATION_K", "UNREST_DECAY", "CORE_YEARS", "DEVASTATION_FRONT", "DEVASTATION_CAPTURE", "DEVASTATION_HEAL", "DEVASTATION_CAP_LOSS", "DEV_GROWTH", "DEV_DEVASTATION_LOSS", "SETTLE_VILLAGE", "SETTLE_TOWN", "SETTLE_CITY", "SETTLE_MIN_POP_FRACTION", "SETTLE_DOWN_FACTOR", "CITY_MIN_SPACING", "RESOURCE_SATURATION", "FAVORED_RESOURCE_VALUE"],
  },
  { title: "Expansion", names: ["EXPANSION_RATE"] },
  {
    title: "War",
    names: ["WAR_BASE_PROB", "WAR_STRENGTH_EXP", "WAR_MAX_PROB", "MAX_WARS_PER_NATION", "DEFENDER_BONUS", "FRONT_FLIPS_PER_YEAR", "SCORE_PER_FLIP", "PEACE_SCORE", "WEARINESS_PEACE", "MAX_WAR_YEARS", "TRUCE_YEARS", "WAR_VALUE_K", "CLAIM_YEARS", "CLAIM_WAR_BONUS"],
  },
  {
    title: "Diplomacy",
    names: ["OPINION_DRIFT", "BORDER_FRICTION", "SHARED_ENEMY_BONUS","WAR_OPINION_PENALTY", "WAR_OPINION_HIT", "REBEL_OPINION", "OPINION_WAR_K", "ALLIANCE_MIN_OPINION", "ALLIANCE_BREAK_OPINION", "ALLIANCE_PROB", "MAX_ALLIES", "ALLY_DEFEND_PROB", "ALLY_ATTACK_PROB"],
  },
  { title: "Rebellion", names: ["REBEL_THRESHOLD", "REBEL_PROB", "REBEL_MIN_CAPITAL_DIST", "REBEL_MAX_CELLS", "REBEL_START_STABILITY"] },
  { title: "Collapse & emergence", names: ["MIN_AREA", "CAPITAL_LOSS_STAB_HIT", "EMERGENCE_PROB", "EMERGENCE_MIN_REGION", "EMERGENCE_CORE_SIZE"] },
];

export interface Layers {
  nations: boolean;
  /** Tint land by race instead of by nation (SPEC §5.4b). */
  races: boolean;
  /** Lines between allied capitals (SPEC §5.4c). */
  alliances: boolean;
  /** Resource deposit markers (SPEC §5.4e). */
  resources: boolean;
  /** Towns and named cities (SPEC §5.4f). */
  settlements: boolean;
  labels: boolean;
  cells: boolean;
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
    ["alliances", "Alliances"],
    ["resources", "Resources"],
    ["settlements", "Towns & cities"],
    ["labels", "Labels"],
    ["cells", "Cell outlines"],
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
