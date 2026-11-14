// Playback settings. See docs/PARAMS.md ("Playback").

/** Years-per-second options on the speed buttons. */
export const SPEEDS = [1, 5, 20, 50, 100];
export const DEFAULT_SPEED = 5;
/** From this window width (px) up, the side panel sits beside the map and the map fits the window's height. Must match the @media rule in index.html. */
export const MAP_BESIDE_WIDTH = 900;
/** Playback stops by itself at this year. */
export const SIM_YEARS = 1000;
/** Most lines the event log keeps on screen (older ones drop off the bottom). */
export const EVENT_LOG_MAX = 300;
/** How long nations stay highlighted after clicking an event. */
export const HIGHLIGHT_SECONDS = 4;
/** While following a war, playback goes no faster than this (years per second). */
export const FOLLOW_SPEED = 5;
/** How long a newly risen great ruler's card stays up before hover takes over again. */
export const RULER_CARD_SECONDS = 5;
/** How long a fallen ruler's card takes to burn, and how long it stays up in all (seconds). */
export const RULER_CARD_BURN_SECONDS = 2.2;
export const RULER_CARD_FALL_SECONDS = 4;

// --- Map zoom (M19). See docs/PARAMS.md ("Zoom"). ---
/** Closest zoom: 4 = a quarter of the map across. */
export const MAX_ZOOM = 4;
/** How fast the mouse wheel zooms: each wheel step of 100 zooms by e^(100 × this). */
export const ZOOM_WHEEL_K = 0.002;
/** Zoom per double-click or + / − key. */
export const ZOOM_STEP = 2;
/** After the view stops moving, wait this long (ms) before redrawing it sharp. */
export const ZOOM_SHARP_DELAY = 150;
/** Following a war zooms to its two capitals, but no closer than this. */
export const FOLLOW_ZOOM_MAX = 3;

// --- Playing a nation (M20). See docs/PARAMS.md ("Playback"). ---
/** The "Raise for a new war" choices: shares of the reserve. */
export const PLAYER_MOBILIZE_CHOICES = [0.25, 0.5, 0.8, 1];
/** Most nations listed when choosing one to play (the largest first). */
export const PLAY_LIST_MAX = 40;
/** A press that moves further than this (screen pixels) is a drag, not a click on the map. */
export const CLICK_SLOP = 4;

// --- Headlines on the map (SPEC §5.4o). See docs/PARAMS.md ("Headlines"). ---
/** How long a headline stays on the map (real seconds), and how long its fade at the end takes. */
export const HEADLINE_SECONDS = 4;
export const HEADLINE_FADE_SECONDS = 0.6;
/** A headline's first seconds, in which only bigger news can replace it. After that it gives way more and more easily. */
export const HEADLINE_HOLD_SECONDS = 1.5;
/** News scoring less than this is never a headline, so quiet years show none. */
export const HEADLINE_MIN_SCORE = 0.9;
/** Added to a realm's share of the land when scoring, so news of a small realm still counts for something. */
export const HEADLINE_SIZE_FLOOR = 0.05;
/** How much each kind of news matters. Its score is this × (HEADLINE_SIZE_FLOOR + the biggest realm's share of the land). */
export const HEADLINE_WEIGHTS = {
  conquest: 10,
  collapse: 10,
  civilWar: 9,
  submission: 8,
  independenceWon: 8,
  reborn: 7,
  rebellion: 6,
  peace: 6,
  independenceWar: 6,
  greatDies: 6,
  greatRises: 5,
  war: 5,
  crisis: 5,
  succession: 8,
  faith: 3,
  whitePeace: 3,
  raid: 2,
  joinsWar: 2,
  vassalOther: 2,
  founded: 2,
  alliance: 2,
  minor: 0,
};

// --- Versus screen (SPEC §5.4p). See docs/PARAMS.md ("Versus screen"). ---
/** How long the two rulers face each other before the outcome is told and the loser burns (seconds). */
export const VERSUS_FACE_SECONDS = 1.5;
/** How long the whole screen stays up (seconds). */
export const VERSUS_SECONDS = 5;
/** Only a conquered realm that at its height held at least this share of the land gets a versus screen; smaller ones burn as before. */
export const VERSUS_MIN_SHARE = 0.009;

// --- The band below the map (SPEC §5.4q). See docs/PARAMS.md ("Band below the map"). ---
/** How many of the largest crowns the standings list. */
export const STANDINGS_COUNT = 5;
/** A year's top news goes into the chronicle only if it scores at least this (the same score as headlines). */
export const CHRONICLE_MIN_SCORE = 1.4;
/** Most lines the chronicle keeps (older ones drop off the bottom). */
export const CHRONICLE_MAX = 60;
/** With less height than this (page pixels) left below the map, the band shows nothing. */
export const BAND_MIN_HEIGHT = 96;
