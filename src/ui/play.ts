// The Play tab (M20, docs/systems/play.md): choose a nation to play, then see your realm
// and set its policies. It never changes the world itself: taking over a nation and
// changing a policy are orders handed to the rules (`giveCommand`), and logged.
import { RulerType, type Nation, type Policies, type PlayerCommand, type SimEvent, type WorldState } from "../core/types";
import { faithInfo } from "../gen/faiths";
import { PLAYABLE_RACES, traits } from "../gen/races";
import { rulerName } from "../gen/rulers";
import { POLICY_CHOICES } from "../sim/ai/player";
import { allianceRefusal, alliesOf, opinion } from "../sim/diplomacy";
import { menText } from "../sim/events";
import { livingNations, neighborPairs } from "../sim/helpers";
import { soldiers } from "../sim/manpower";
import { SIM } from "../sim/params";
import { offeredFaith } from "../sim/faith";
import { heirsOf, playerWarRefusals, WAR_GOALS } from "../sim/play";
import { giveCommand } from "../sim/sandbox";
import { suePeaceRefusal } from "../sim/war";
import { independenceRefusal } from "../sim/independence";
import { overlordOf, vassalsOf } from "../sim/vassals";
import { PLAY_LIST_MAX, PLAYER_MOBILIZE_CHOICES } from "./config";
import { rivalOf } from "./debugInfo";
import { DISPATCH_DEFAULT_OFF, DISPATCH_KINDS, DISPATCH_NAMES, type Dispatch, type DispatchKind } from "./dispatches";
import { fallbackPath, portraitPath } from "./portraits";
import { summaryLines } from "./summary";
import { fill } from "./sandbox";
import { scoreBar, sides } from "./warRoom";
import { realmSizes } from "./realmStats";

export interface PlayHooks {
  /** The world as it is now. */
  state(): WorldState;
  /** Stops playback, so nothing moves while you choose. */
  pause(): void;
  /** Called after an order, with its events, so the map, log and lists catch up. */
  changed(events: SimEvent[]): void;
  /** Follow a war in the War Room. */
  follow(war: number): void;
  /** Starts playback again. */
  resume(): void;
}

export interface PlayTab {
  /** Brings the tab up to date (after each year, or an order). */
  update(state: WorldState): void;
  /** A realm clicked on the map: picked as the war target, if it borders yours. */
  pickTarget(nation: number): void;
  /** Should playback pause for dispatches of this kind? (Each can be switched off.) */
  wants(kind: DispatchKind): boolean;
  /** Shows the dispatches of `year` at the top of the tab. */
  showDispatches(year: number, dispatches: Dispatch[]): void;
  /** Shows what became of your realms and people, at the end of the run. */
  showSummary(state: WorldState): void;
}

/** Where the dispatch kinds switched off are remembered, in this browser only. */
const DISPATCH_OFF_KEY = "realm-forge-dispatches-off";

/** The kinds switched off: as last chosen in this browser, or the defaults. */
function loadDispatchesOff(): Set<string> {
  try {
    const saved = localStorage.getItem(DISPATCH_OFF_KEY);
    if (saved !== null) return new Set(JSON.parse(saved) as string[]);
  } catch {
    // Can't read it (private window): use the defaults.
  }
  return new Set(DISPATCH_DEFAULT_OFF);
}

const GOAL_NAMES: Record<(typeof WAR_GOALS)[number], string> = { conquer: "Conquer", reclaim: "Reclaim", raid: "Raid" };

// What each policy and its answers are called on screen.
type ChoicePolicy = keyof typeof POLICY_CHOICES;
const POLICY_LABELS: Record<ChoicePolicy, string> = {
  joinWar: "Join allies' wars",
  acceptAlliance: "Accept alliances offered",
  wonWar: "When a war is won",
  suePeace: "Sue for peace when losing",
  enemySues: "When the enemy sues",
  rebels: "When rebels break away",
  takenCapital: "Holding a beaten realm's capital",
  demandSubmission: "Demand submission",
};
const ANSWER_LABELS: { [K in ChoicePolicy]: Record<Policies[K], string> } = {
  joinWar: { always: "Always", defending: "Only when an ally is attacked", kin: "Only allies of my race", never: "Never" },
  acceptAlliance: { opinion: "When on good terms", always: "Always", never: "Never" },
  wonWar: { peace: "Make peace", fightOn: "Fight on for more" },
  suePeace: { never: "Never by ourselves", weary: "Once war-weary" },
  enemySues: { accept: "Accept", weary: "Accept once war-weary", refuse: "Refuse" },
  rebels: { fight: "Go to war on them", letGo: "Let them go" },
  takenCapital: { vassal: "Make it a vassal", annex: "Take the whole realm" },
  demandSubmission: { stronger: "When far stronger (as the AI)", never: "Never: only take land" },
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
function peopleShare(nation: Nation, foreignShare: number): string {
  const plural = traits(nation.race).plural;
  if (Math.round(foreignShare * 100) === 0) return `all ${plural}`;
  if (Math.round(foreignShare * 100) === 100) return `none of them ${plural}`;
  return `${percent(foreignShare)} of them not ${plural}`;
}

/** "Conqueror" for a great ruler's type. */
function greatName(nation: Nation): string | null {
  const type = nation.ruler.great;
  return type === undefined ? null : (Object.entries(RulerType).find(([, id]) => id === type)?.[0] ?? null);
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
  const PICK_HINT = "Pick a people, then one of their realms. You can take over now or at any later year.";
  const chooseHint = el("p", "play-hint", PICK_HINT);
  choose.append(chooseHint, raceButtons, nationList, chooseNote);

  // --- Your realm ---
  const realm = el("div");
  const head = el("div", "room-head");
  const stop = el("button", "", "Stop playing");
  stop.addEventListener("click", () => {
    news.hidden = true;
    give({ kind: "play", nation: null }, chooseNote);
  });
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
  // --- Orders: each one goes to the rules, which may refuse it (and say why) ---
  const ordersPart = part("Orders");
  const ordersNote = el("div", "sandbox-note");
  const targetPick = el("select");
  const goalButtons = WAR_GOALS.map((goal) => {
    const b = el("button", "", GOAL_NAMES[goal]);
    b.addEventListener("click", () => give({ kind: "declareWar", target: Number(targetPick.value), goal }, ordersNote));
    return b;
  });
  const goalRow = el("div", "sandbox-row");
  goalRow.append(el("span", "", "Go to war to:"), ...goalButtons);
  const goalWhy = el("div", "sandbox-note");
  const friendPick = el("select");
  const propose = el("button", "", "Propose alliance");
  propose.addEventListener("click", () => give({ kind: "proposeAlliance", other: Number(friendPick.value) }, ordersNote));
  const proposeRow = el("div", "sandbox-row");
  proposeRow.append(propose);
  const proposeWhy = el("div", "sandbox-note");
  const allyRows = el("div");
  const faithRow = el("div", "sandbox-row");
  // A vassal's one way out: only in the year its overlord's new ruler is crowned.
  const freeRow = el("div", "sandbox-row");
  ordersPart.append(
    freeRow,
    labelled("War on", targetPick),
    goalRow,
    goalWhy,
    labelled("Alliance with", friendPick),
    proposeRow,
    proposeWhy,
    allyRows,
    faithRow,
    ordersNote,
  );
  targetPick.addEventListener("change", () => drawGoals(hooks.state()));
  friendPick.addEventListener("change", () => drawPropose(hooks.state()));
  // Choosing stops time, so the lists don't change under you.
  for (const select of [targetPick, friendPick]) select.addEventListener("focus", () => hooks.pause());

  // --- Dispatches: what happened to your realm, with time paused ---
  const news = el("div", "play-dispatches");
  news.hidden = true;
  const newsList = el("ul");
  const newsHead = el("div", "room-head");
  const carryOn = el("button", "", "Carry on");
  carryOn.addEventListener("click", () => {
    news.hidden = true;
    hooks.resume();
  });
  news.append(newsHead, newsList);

  const off = loadDispatchesOff();
  const pauseFor = el("details", "sandbox-part");
  pauseFor.append(el("summary", "", "Pause for…"));
  for (const kind of DISPATCH_KINDS) {
    const row = el("label", "play-check");
    const box = el("input");
    box.type = "checkbox";
    box.checked = !off.has(kind);
    box.addEventListener("change", () => {
      if (box.checked) off.delete(kind);
      else off.add(kind);
      try {
        localStorage.setItem(DISPATCH_OFF_KEY, JSON.stringify([...off]));
      } catch {
        // Not remembered (private window): it still applies until the page is closed.
      }
    });
    row.append(box, document.createTextNode(` ${DISPATCH_NAMES[kind]}`));
    pauseFor.append(row);
  }

  const policiesPart = part("Policies");
  const policyNote = el("div", "sandbox-note");
  realm.append(head, news, fallen, ruler, stats, warsPart, ordersPart, policiesPart, pauseFor);
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
    // A refusal by the rules, or by the other side ("Lirelor turns the offer down").
    note.textContent = result.ok ? (result.events.at(-1)?.text.replace(/^Year -?\d+: /, "") ?? "") : `Refused: ${result.reason}.`;
    if (result.ok) hooks.changed(result.events);
    if (result.ok && command.kind === "play") news.hidden = true; // old news belongs to the realm you left
    update(state);
  }

  // --- Drawing ---
  /** A clickable list of realms to play, with their land and ruler. */
  function listRealms(state: WorldState, realms: Nation[], verb: string): void {
    const sizes = realmSizes(state);
    nationList.replaceChildren();
    for (const nation of realms.slice(0, PLAY_LIST_MAX)) {
      const row = el("div", "war-row");
      row.title = `${verb} ${nation.name}`;
      const name = el("div", "war-sides");
      const sw = el("span", "sw");
      sw.style.background = nation.color;
      name.append(sw, document.createTextNode(nation.name));
      row.append(name, el("div", "war-meta", `${sizes.get(nation.id)?.cells ?? 0} provinces · ${rulerName(nation.ruler, nation.race)} of ${nation.ruler.dynasty}`));
      row.addEventListener("click", () => give({ kind: "play", nation: nation.id }, chooseNote));
      nationList.append(row);
    }
    if (realms.length > PLAY_LIST_MAX) nationList.append(el("div", "room-note", `${realms.length - PLAY_LIST_MAX} smaller realms not shown.`));
  }

  /** Not playing: pick a race, then one of its realms. */
  function drawChooser(state: WorldState): void {
    choose.querySelector("h4")!.textContent = "Play as a nation";
    chooseHint.textContent = PICK_HINT;
    raceButtons.hidden = false;
    for (const b of raceButtons.querySelectorAll("button")) b.classList.toggle("active", Number(b.dataset.race) === race);
    const sizes = realmSizes(state);
    const cellsOf = (n: Nation) => sizes.get(n.id)?.cells ?? 0;
    const realms = livingNations(state)
      .filter((n) => n.race === race)
      .sort((a, b) => cellsOf(b) - cellsOf(a));
    listRealms(state, realms, "Play as");
    if (realms.length === 0) nationList.append(el("div", "room-note", `No realm of ${traits(race).plural} stands now.`));
  }

  /** Your realm has fallen: carry on as a realm of your people, or else of your race. */
  function drawHeirs(state: WorldState, me: Nation): void {
    choose.querySelector("h4")!.textContent = "Carry on";
    raceButtons.hidden = true;
    const heirs = heirsOf(state);
    const people = state.nations.get(state.player!.culture)?.name ?? me.name;
    chooseHint.textContent =
      heirs.by === "people" ? `Your people, the folk of ${people}, still rule here. Choose a realm to carry on as; your policies come with you.`
      : heirs.by === "race" ? `Your people, the folk of ${people}, rule nowhere now, but these realms of ${traits(me.race).plural} stand. Choose one to carry on as.`
      : `No realm of your people or of the ${traits(me.race).plural} stands. Stop playing to watch the rest of history.`;
    listRealms(state, heirs.nations, "Carry on as");
  }

  function drawRealm(state: WorldState, me: Nation): void {
    head.replaceChildren();
    const title = el("span", "war-sides");
    const sw = el("span", "sw");
    sw.style.background = me.color;
    title.append(sw, document.createTextNode(me.name));
    head.append(title, stop);

    fallen.hidden = me.alive;
    fallen.textContent = me.alive ? "" : `${me.name} fell in year ${me.fell ?? state.year}.`;
    ruler.hidden = !me.alive;
    stats.hidden = !me.alive;
    warsPart.hidden = !me.alive;
    ordersPart.hidden = !me.alive;
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

    const size = realmSizes(state).get(me.id) ?? { cells: 0, pop: 0, unrest: 0, foreignShare: 0 };
    const name = (id: number) => state.nations.get(id)?.name ?? "?";
    const allies = alliesOf(state, me.id);
    const rival = rivalOf(state, me.id);
    const field = soldiers(state, me) - me.reserve;
    const rows: [string, string][] = [
      ["Land", `${size.cells} provinces`],
      ["People", `${menText(size.pop)}, ${peopleShare(me, size.foreignShare)}`],
      ["Faith", faithInfo(me.faith).name],
      ["Soldiers", `${menText(field)} in the field · ${menText(me.reserve)} in reserve${state.year === 0 ? " · recruitment starts in year 1" : ` (of ${menText(me.manpowerCap)})`}`],
      ["Stability", percent(me.stability)],
      ["War weariness", percent(me.warWeariness)],
      ["Unrest", percent(size.unrest)],
      ["Allies", allies.length ? allies.map(name).join(", ") : "none"],
      ...(overlordOf(state, me.id) ? [["Overlord", `${overlordOf(state, me.id)!.name}: you serve it, fight in its wars and start none of your own`] as [string, string]] : []),
      ...(vassalsOf(state, me.id).length ? [["Vassals", vassalsOf(state, me.id).map((v) => v.name).join(", ")] as [string, string]] : []),
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
      // Only a side clearly losing its own war can offer terms.
      if (war.joined === undefined && suePeaceRefusal(state, war.id, me.id) === null) {
        const sue = el("button", "", "Sue for peace");
        sue.title = "Offer the winner the goal land it holds; it may refuse";
        sue.addEventListener("click", (event) => {
          event.stopPropagation(); // not a click to follow the war
          give({ kind: "suePeace", war: war.id }, ordersNote);
        });
        const sueRow = el("div", "sandbox-row");
        sueRow.append(sue);
        row.append(sueRow);
      }
      warList.append(row);
    }
  }

  /** Greys out the goals the rules wouldn't allow, and says why. */
  function drawGoals(state: WorldState): void {
    const refusals = targetPick.value ? playerWarRefusals(state, Number(targetPick.value)) : null;
    const reasons: string[] = [];
    WAR_GOALS.forEach((goal, i) => {
      const why = refusals ? refusals[goal] : "no neighbor to fight";
      goalButtons[i]!.disabled = why !== null;
      goalButtons[i]!.title = why ?? `Go to war to ${goal}`;
      if (why !== null) reasons.push(`${GOAL_NAMES[goal]}: ${why}`);
    });
    // The same reason for every goal is said once.
    const unique = !refusals || (new Set(WAR_GOALS.map((g) => refusals[g])).size === 1 && refusals.raid !== null);
    goalWhy.textContent = unique ? `Not now: ${refusals?.raid ?? "no neighbor to fight"}.` : reasons.join(" · ");
  }

  function drawPropose(state: WorldState): void {
    const me = state.player!.nation;
    const why = friendPick.value ? allianceRefusal(state, me, Number(friendPick.value)) : "no neighbor to ally with";
    propose.disabled = why !== null;
    proposeWhy.textContent = why === null ? "They decide at once: on good terms, they usually accept." : `Not now: ${why}.`;
  }

  function drawOrders(state: WorldState, me: Nation): void {
    const neighbors = neighborPairs(state)
      .filter(([a, b]) => a === me.id || b === me.id)
      .map(([a, b]) => state.nations.get(a === me.id ? b : a)!)
      .sort((a, b) => a.name.localeCompare(b.name));
    const feeling = (n: Nation) => `${n.name} (opinion ${opinion(state, me.id, n.id).toFixed(2)})`;
    fill(targetPick, neighbors.map((n) => [String(n.id), feeling(n)]));
    drawGoals(state);
    const allies = alliesOf(state, me.id);
    fill(friendPick, neighbors.filter((n) => !allies.includes(n.id)).map((n) => [String(n.id), feeling(n)]));
    drawPropose(state);

    allyRows.replaceChildren();
    for (const id of allies) {
      const ally = state.nations.get(id)!;
      const row = el("div", "sandbox-row");
      const leave = el("button", "", "Break");
      leave.title = `End the alliance with ${ally.name}`;
      leave.addEventListener("click", () => give({ kind: "breakAlliance", other: id }, ordersNote));
      row.append(leave, el("span", "", `the alliance with ${ally.name}`));
      allyRows.append(row);
    }

    freeRow.replaceChildren();
    const overlord = overlordOf(state, me.id);
    if (overlord) {
      const why = independenceRefusal(state, me);
      const rise = el("button", "", "Declare independence");
      rise.disabled = why !== null;
      rise.title = why ?? `Go to war with ${overlord.name} to be free; if you don't win, you stay its vassal`;
      rise.addEventListener("click", () => give({ kind: "declareIndependence" }, ordersNote));
      freeRow.append(rise, el("span", "war-meta", why === null ? `${overlord.name} has a new ruler: now or not until the next` : `Not now: ${why}.`));
    }

    // A faith is offered while most of the realm holds it.
    faithRow.replaceChildren();
    const faith = offeredFaith(state, me);
    if (faith !== null) {
      const adopt = el("button", "", `Adopt ${faithInfo(faith).name}`);
      adopt.addEventListener("click", () => give({ kind: "adoptFaith", faith }, ordersNote));
      faithRow.append(adopt, el("span", "war-meta", "most of your people hold it"));
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
      if (me.alive) drawOrders(state, me);
      drawPolicies(state.player!.policies);
    }
    if (!me) drawChooser(state);
    else if (!me.alive) drawHeirs(state, me);
    // Choosing who to carry on as comes first, right under the news of the fall.
    if (me && !me.alive) fallen.after(choose);
    else if (choose.parentElement !== box || box.lastElementChild !== choose) box.append(choose);
  }

  function pickTarget(id: number): void {
    const state = hooks.state();
    const me = state.player ? state.nations.get(state.player.nation) : undefined;
    if (!me?.alive || id === me.id) return;
    const name = state.nations.get(id)?.name ?? "That land";
    if (![...targetPick.options].some((o) => o.value === String(id))) {
      ordersNote.textContent = `${name} doesn't border your realm.`;
      return;
    }
    targetPick.value = String(id);
    drawGoals(state);
    ordersNote.textContent = `${name} picked as the war target.`;
  }

  function showDispatches(year: number, dispatches: Dispatch[]): void {
    newsHead.replaceChildren(el("span", "", `Dispatches, year ${year}`), carryOn);
    newsList.replaceChildren(...dispatches.map((d) => el("li", `dispatch-${d.kind}`, d.text)));
    news.hidden = false;
    box.scrollTop = 0;
  }

  function showSummary(state: WorldState): void {
    const close = el("button", "", "Close");
    close.addEventListener("click", () => (news.hidden = true));
    newsHead.replaceChildren(el("span", "", `The end of history, year ${state.year}`), close);
    newsList.replaceChildren(...summaryLines(state).map((line) => el("li", "", line)));
    news.hidden = false;
    box.scrollTop = 0;
  }

  update(hooks.state());
  return { update, pickTarget, wants: (kind) => !off.has(kind), showDispatches, showSummary };
}
