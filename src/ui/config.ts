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
