/**
 * REMOVED — the permanent bottom crawl.
 *
 * It was tried and rolled back. Reserving a strip at the bottom meant the
 * board lost height, and `/table-room.jpg` is `object-cover` against a fixed
 * ellipse tuned to that image — so a shorter board changed the crop, pushed
 * the room out of frame and left the table looking wrong.
 *
 * Anything permanent along the bottom has the same problem. If a crawl is
 * ever wanted again, it has to overlay the board like `BuyInTicker` does
 * rather than take space from it, and the seat ellipse in `PokerTable`
 * (`CX/CY/RX/RY`) would need retuning to the new crop.
 *
 * This file is intentionally left as a note. Nothing imports it.
 */
export {};
