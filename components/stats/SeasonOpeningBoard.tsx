/**
 * REMOVED — the start-of-season board.
 *
 * This drew its own smaller layout when a season had no games yet, which
 * meant the shared page changed shape the moment the first night was
 * played. `StatsView` now takes an optional `roster` and renders the
 * normal page with every figure at zero instead, so there's one layout and
 * no chance of the two drifting.
 *
 * This file is intentionally left as a note. Nothing imports it.
 */
export {};
