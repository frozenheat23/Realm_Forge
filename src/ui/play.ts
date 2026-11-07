// The Play tab (M20, docs/systems/play.md): choose a nation to play, then see your realm
// and set its policies. It never changes the world itself: taking over a nation and
// changing a policy are orders handed to the rules (`giveCommand`), and logged.
import { RulerType, type Nation, type Policies, type PlayerCommand, type SimEvent, type WorldState } from "../core/types";
import { faithInfo } from "../gen/faiths";
import { PLAYABLE_RACES, traits } from "../gen/races";
import { rulerName } from "../gen/rulers";
import { POLICY_CHOICES } from "../sim/ai/player";
import { alliesOf } from "../sim/diplomacy";
import { menText } from "../sim/events";
import { livingNations } from "../sim/helpers";
import { soldiers } from "../sim/manpower";
import { SIM } from "../sim/params";
import { giveCommand } from "../sim/sandbox";
import { PLAY_LIST_MAX, PLAYER_MOBILIZE_CHOICES } from "./config";
import { rivalOf } from "./debugInfo";
import { fallbackPath, portraitPath } from "./portraits";
import { scoreBar, sides } from "./warRoom";

export interface PlayHooks {
  /** The world as it is now. */
  state(): WorldState;
  /** Stops playback, so nothing moves while you choose. */
  pause(): void;
  /** Called after an order, with its events, so the map, log and lists catch up. */
  changed(events: SimEvent[]): void;
  /** Follow a war in the War Room. */
  follow(war: number): void;
}

export interface PlayTab {
  /** Brings the tab up to date (after each year, or an order). */
  update(state: WorldState): void;
}

// What each policy and its answers are called on screen.
type ChoicePolicy = keyof typeof POLICY_CHOICES;
const POLICY_LABELS: Record<ChoicePolicy, string> = {
  joinWar: "Join allies' wars",
  acceptAlliance: "Accept alliances offered",
  wonWar: "When a war is won",
  suePeace: "Sue for peace when losing",
  enemySues: "When the enemy sues",
  rebels: "When rebels break away",
};
const ANSWER_LABELS: { [K in ChoicePolicy]: Record<Policies[K], string> } = {
  joinWar: { always: "Always", defending: "Only when an ally is attacked", kin: "Only allies of my race", never: "Never" },
  acceptAlliance: { opinion: "When on good terms", always: "Always", never: "Never" },
  wonWar: { peace: "Make peace", fightOn: "Fight on for more" },
  suePeace: { never: "Never by ourselves", weary: "Once war-weary" },
  enemySues: { accept: "Accept", weary: "Accept once war-weary", refuse: "Refuse" },
  rebels: { fight: "Go to war on them", letGo: "Let them go" },
};

/** A new element with a class and some text. */
function el<K extends keyof HTMLElementTagNameMap>(tag: K, className = "", text = ""): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text) node.textContent = text;
  return node;
}

const percent = (share: number) => `${Math.round(share * 100)}%`;

/** "all Humans", "none of them Humans" or "40% of them not Humans". */
function peopleShare(nation: Nation): string {
  const plural = traits(nation.race).plural;
  if (Math.round(nation.foreignShare * 100) === 0) return `all ${plural}`;
  if (Math.round(nation.foreignShare * 100) === 100) return `none of them ${plural}`;
  return `${percent(nation.foreignShare)} of them not ${plural}`;
}

/** "Conqueror" for a great ruler's type. */
function greatName(nation: Nation): string | null {
  const type = nation.ruler.great;
  return type === undefined ? null : (Object.entries(RulerType).find(([, id]) => id === type)?.[0] ?? null);
}

/** Each realm's land, people and average unrest, counted from the map (a nation's own totals are only filled in after its first year). */
function realmSizes(state: WorldState): Map<number, { cells: number; pop: number; unrest: number }> {
  const { owner, pop, unrest } = state.state;
  const sizes = new Map<number, { cells: number; pop: number; unrest: number }>();
  for (let c = 0; c < owner.length; c++) {
    if (owner[c] === 0) continue;
    const size = sizes.get(owner[c]!) ?? { cells: 0, pop: 0, unrest: 0 };
    size.cells++;
    size.pop += pop[c]!;
    size.unrest += unrest[c]!;
    sizes.set(owner[c]!, size);
  }
  for (const size of sizes.values()) size.unrest /= size.cells;
  return sizes;
}

/** Builds the tab inside `box`. */
export function createPlayTab(box: HTMLElement, hooks: PlayHooks): PlayTab {
  box.replaceChildren();
  const part = (title: string) => {
    const s = el("div", "sandbox-part");
    s.append(el("h4", "", title));
    return s;
  };

  // --- Choosing a nation (shown when not playing, or when your realm has fallen) ---
  const choose = part("Play as a nation");
  const raceButtons = el("div", "sandbox-row");
  let race: number = PLAYABLE_RACES[0]!;
  for (const r of PLAYABLE_RACES) {
    const b = el("button", "", traits(r).plural);
    b.dataset.race = String(r);
    b.addEventListener("click", () => {
      race = r;
      update(hooks.state());
    });
    raceButtons.append(b);
  }
  const chooseNote = el("div", "sandbox-note");
  const nationList = el("div");
  choose.append(el("p", "play-hint", "Pick a people, then one of their realms. You can take over now or at any later year."), raceButtons, nationList, chooseNote);

  // --- Your realm ---
  const realm = el("div");
  const head = el("div", "room-head");
  const stop = el("button", "", "Stop playing");
  stop.addEventListener("click", () => give({ kind: "play", nation: null }, chooseNote));
  const fallen = el("div", "play-fallen");
  const ruler = el("div", "play-ruler");
  const portrait = el("img");
  portrait.width = 72;
  portrait.alt = "";
  const rulerText = el("div");
  ruler.append(portrait, rulerText);
  const stats = el("dl", "play-stats");
  const warsPart = part("Your wars");
  const warList = el("div");
  warsPart.append(warList);
  const policiesPart = part("Policies");
  const policyNote = el("div", "sandbox-note");
  realm.append(head, fallen, ruler, stats, warsPart, policiesPart);
  box.append(realm, choose);

  // One drop-down per policy, built once; `update` keeps their values in step with the world.
  const policySelects = new Map<keyof Policies, HTMLSelectElement>();
  for (const policy of Object.keys(POLICY_CHOICES) as ChoicePolicy[]) {
    const select = el("select");
    for (const answer of POLICY_CHOICES[policy]) select.append(new Option((ANSWER_LABELS[policy] as Record<string, string>)[answer]!, answer));
    select.addEventListener("change", () => give({ kind: "setPolicy", policies: { [policy]: select.value } }, policyNote));
    policySelects.set(policy, select);
    policiesPart.append(labelled(POLICY_LABELS[policy], select));
  }
  const mobilize = el("select");
  mobilize.addEventListener("change", () => give({ kind: "setPolicy", policies: { mobilize: Number(mobilize.value) } }, policyNote));
  policySelects.set("mobilize", mobilize);
  policiesPart.append(labelled("Raise for a new war", mobilize), policyNote);

  function labelled(text: string, input: HTMLElement): HTMLElement {
    const row = el("label", "sandbox-field");
    row.append(el("span", "", text), input);
    return row;
  }

  // --- Acting ---
  function give(command: PlayerCommand, note: HTMLElement): void {
    hooks.pause();
    const state = hooks.state();
    const result = giveCommand(state, command);
    note.textContent = result.ok ? "" : `The rules refuse: ${result.reason}.`;
    if (result.ok) hooks.changed(result.events);
    update(state);
  }

  // --- Drawing ---
  function drawChooser(state: WorldState): void {
    for (const b of raceButtons.querySelectorAll("button")) b.classList.toggle("active", Number(b.dataset.race) === race);
    const sizes = realmSizes(state);
    const cellsOf = (n: Nation) => sizes.get(n.id)?.cells ?? 0;
    const realms = livingNations(state)
      .filter((n) => n.race === race)
      .sort((a, b) => cellsOf(b) - cellsOf(a));
    nationList.replaceChildren();
    if (realms.length === 0) nationList.append(el("div", "room-note", `No realm of ${traits(race).plural} stands now.`));
    for (const nation of realms.slice(0, PLAY_LIST_MAX)) {
      const row = el("div", "war-row");
      row.title = `Play as ${nation.name}`;
      const name = el("div", "war-sides");
      const sw = el("span", "sw");
      sw.style.background = nation.color;
      name.append(sw, document.createTextNode(nation.name));
      row.append(name, el("div", "war-meta", `${cellsOf(nation)} provinces · ${rulerName(nation.ruler, nation.race)} of ${nation.ruler.dynasty}`));
      row.addEventListener("click", () => give({ kind: "play", nation: nation.id }, chooseNote));
      nationList.append(row);
    }
    if (realms.length > PLAY_LIST_MAX) nationList.append(el("div", "room-note", `${realms.length - PLAY_LIST_MAX} smaller realms not shown.`));
  }

  function drawRealm(state: WorldState, me: Nation): void {
    head.replaceChildren();
    const title = el("span", "war-sides");
    const sw = el("span", "sw");
    sw.style.background = me.color;
    title.append(sw, document.createTextNode(me.name));
    head.append(title, stop);

    fallen.hidden = me.alive;
    fallen.textContent = me.alive ? "" : `${me.name} fell in year ${me.fell ?? state.year}. Choose another realm below, or stop playing.`;
    ruler.hidden = !me.alive;
    stats.hidden = !me.alive;
    warsPart.hidden = !me.alive;
    if (!me.alive) return;

    const path = portraitPath(me.race, me.ruler);
    if (!portrait.src.endsWith(path)) {
      portrait.onerror = () => (portrait.src = fallbackPath(me.race, me.ruler));
      portrait.src = path;
    }
    const great = greatName(me);
    rulerText.replaceChildren(
      el("div", "play-ruler-name", rulerName(me.ruler, me.race)),
      el("div", "war-meta", `${me.ruler.dynasty} · reigning since year ${me.ruler.crowned}${great ? ` · a great ${great}` : ""}`),
    );

    const size = realmSizes(state).get(me.id) ?? { cells: 0, pop: 0, unrest: 0 };
    const name = (id: number) => state.nations.get(id)?.name ?? "?";
    const allies = alliesOf(state, me.id);
    const rival = rivalOf(state, me.id);
    const field = soldiers(state, me) - me.reserve;
    const rows: [string, string][] = [
      ["Land", `${size.cells} provinces`],
      ["People", `${menText(size.pop)}, ${peopleShare(me)}`],
      ["Faith", faithInfo(me.faith).name],
      ["Soldiers", `${menText(field)} in the field · ${menText(me.reserve)} in reserve (of ${menText(me.manpowerCap)})`],
      ["Stability", percent(me.stability)],
      ["War weariness", percent(me.warWeariness)],
      ["Unrest", percent(size.unrest)],
      ["Allies", allies.length ? allies.map(name).join(", ") : "none"],
      ["Worst rival", rival ? `${name(rival.id)} (opinion ${rival.opinion.toFixed(2)})` : "none"],
    ];
    stats.replaceChildren();
    for (const [term, value] of rows) stats.append(el("dt", "", term), el("dd", "", value));

    // Your wars, your own and the ones you joined: click one to follow it.
    warList.replaceChildren();
    const mine = state.wars.filter((w) => w.attacker === me.id || w.defender === me.id);
    if (mine.length === 0) warList.append(el("div", "room-note", "At peace."));
    for (const war of mine) {
      const mainId = war.joined ?? war.id;
      const record = state.warRecords.find((r) => r.id === mainId);
      const main = state.wars.find((w) => w.id === mainId);
      if (!record || !main) continue;
      const row = el("div", "war-row");
      row.title = "Follow this war";
      row.addEventListener("click", () => hooks.follow(mainId));
      const onAttack = record.attacker === me.id || record.allies.some((a) => a.nation === me.id && a.side === "attack");
      const ahead = onAttack ? main.score : -main.score;
      const standing = Math.abs(main.score) < SIM.WIN_SCORE ? "even" : ahead > 0 ? "winning" : "losing";
      const role = war.joined !== undefined ? "as an ally" : onAttack ? "you attacked" : "you were attacked";
      row.append(sides(record, state), el("div", "war-meta", `${role} · year ${state.year - record.start + 1} · ${standing}`), scoreBar(state, record, main.score));
      warList.append(row);
    }
  }

  function drawPolicies(policies: Policies): void {
    for (const [policy, select] of policySelects) {
      if (policy === "mobilize") continue;
      select.value = policies[policy] as string;
    }
    // The reserve shares on offer, plus the current one if it's something else (a save, or a changed setting).
    const shares = [...new Set([...PLAYER_MOBILIZE_CHOICES, policies.mobilize])].sort((a, b) => a - b);
    mobilize.replaceChildren(...shares.map((share) => new Option(`${percent(share)} of the reserve${share === SIM.MOBILIZE_SHARE ? " (as the AI)" : ""}`, String(share))));
    mobilize.value = String(policies.mobilize);
  }

  function update(state: WorldState): void {
    const me = state.player ? state.nations.get(state.player.nation) : undefined;
    realm.hidden = !me;
    choose.hidden = !!me?.alive;
    if (me) {
      drawRealm(state, me);
      drawPolicies(state.player!.policies);
    }
    if (!me?.alive) drawChooser(state);
  }

  update(hooks.state());
  return { update };
}
