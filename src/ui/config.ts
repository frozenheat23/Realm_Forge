// Playback settings. See docs/PARAMS.md ("Playback").

/** Years-per-second options on the speed buttons. */
export const SPEEDS = [1, 5, 20, 50, 100];
export const DEFAULT_SPEED = 5;
/** Playback stops by itself at this year. */
export const SIM_YEARS = 1000;
/** Most lines the event log keeps on screen (older ones drop off the bottom). */
export const EVENT_LOG_MAX = 300;
/** How long nations stay highlighted after clicking an event. */
export const HIGHLIGHT_SECONDS = 4;
/** While following a war, playback goes no faster than this (years per second). */
export const FOLLOW_SPEED = 5;
