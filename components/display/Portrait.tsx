"use client";

import DisplayAvatar from "./DisplayAvatar";

/**
 * A big portrait for the TV: the player's character artwork when they have
 * one — a cut-out reads far better than a disc at this size — otherwise their
 * photo (or initials) inside a glowing ring.
 *
 * Used for the season leader on the idle board and recap slide 2, and for
 * the milestone cards on slide 3. `size` is a CSS length, in vh, so it scales
 * with the screen like everything else on the board.
 */
export default function Portrait({
  name,
  photoUrl,
  characterUrl,
  size,
  color,
  crown = false,
}: {
  name: string;
  photoUrl: string | null;
  characterUrl: string | null;
  size: string;
  /** Ring and glow colour. */
  color: string;
  /** Only on the photo version — art is its own headline. */
  crown?: boolean;
}) {
  if (characterUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={characterUrl}
        alt=""
        aria-hidden="true"
        className="object-contain max-w-full"
        style={{
          height: `calc(${size} * 1.6)`,
          filter: `drop-shadow(0 0 3vh ${color}73)`,
        }}
      />
    );
  }

  return (
    <div className={`relative ${crown ? "mt-[6vh]" : ""}`}>
      {crown && (
        // Level, not tilted — the summary image's crown sits at an angle,
        // but here it's a heading over a portrait. The host asked for it
        // straight.
        <svg
          viewBox="0 0 64 40"
          aria-hidden="true"
          className="absolute left-1/2 -translate-x-1/2"
          style={{ top: `calc(${size} * -0.27)`, width: `calc(${size} * 0.42)` }}
        >
          <path
            d="M4 36 L8 10 L22 24 L32 4 L42 24 L56 10 L60 36 Z"
            fill="#e9c46a"
            stroke="#b8902f"
            strokeWidth="2"
            strokeLinejoin="round"
          />
        </svg>
      )}
      <span
        className="block rounded-full"
        style={{
          boxShadow: `0 0 0 calc(${size} * 0.03) ${color}, 0 0 calc(${size} * 0.25) ${color}40`,
        }}
      >
        <DisplayAvatar name={name} photoUrl={photoUrl} size={size} />
      </span>
    </div>
  );
}
