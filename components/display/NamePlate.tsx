"use client";

/**
 * Ornate gold nameplate that hangs under each seat.
 *
 * The artwork is a fixed 3:2 PNG with two panels — a narrow band on top for
 * the name and a deeper one below for the buy-in. Text is positioned as a
 * percentage of the image so it stays registered to the frame at any size.
 */

// Vertical centres of the two panels, as a fraction of the image height.
const NAME_Y = 32;
const AMOUNT_Y = 60;
/**
 * The buy-in chain sits in the gap between the two panels, just above the
 * amount. It's the one place with room to spare, and putting it here keeps
 * the whole plate reading as a single block rather than trailing text
 * underneath it.
 */
const HISTORY_Y = 46;

export default function NamePlate({
  name,
  amount,
  history,
  /** Multiplier applied to width and type size. */
  scale = 1,
  highlight = false,
  /**
   * False when the plate is placed beside the artwork rather than under it.
   * The negative top margin exists to ride up over the bottom of a character
   * standing above it, and makes no sense off to one side.
   */
  attached = true,
}: {
  name: string;
  amount: string;
  /** Compact buy-in chain, e.g. "5+2.5+5". Omitted on a single buy-in. */
  history?: string;
  scale?: number;
  highlight?: boolean;
  attached?: boolean;
}) {
  return (
    <div
      className="relative mx-auto"
      style={{
        width: `${16.5 * scale}vw`,
        aspectRatio: "3 / 2",
        // Rides up over the bottom of the character art.
        marginTop: attached ? `${-2.4 * scale}vw` : 0,
        filter: highlight
          ? "drop-shadow(0 0 0.9vw rgba(255,214,140,0.55)) drop-shadow(0 0.5vh 1.2vh rgba(0,0,0,0.7))"
          : "drop-shadow(0 0.5vh 1.2vh rgba(0,0,0,0.7))",
      }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/nameplate.png"
        alt=""
        aria-hidden="true"
        className="absolute inset-0 w-full h-full object-contain"
      />

      {/* Name */}
      <div
        className="absolute left-[12%] right-[12%] text-center"
        style={{
          top: `${NAME_Y}%`,
          transform: "translateY(-50%)",
        }}
      >
        <div
          className="text-white font-bold truncate leading-none"
          style={{
            fontSize: `${1.3 * scale}vw`,
            textShadow: "0 0.15vw 0.3vw rgba(0,0,0,0.8)",
          }}
        >
          {name}
        </div>
      </div>

      {/* Buy-in history, in the same gold as the amount below it */}
      {history && (
        <div
          className="absolute left-[8%] right-[8%] text-center"
          style={{
            top: `${HISTORY_Y}%`,
            transform: "translateY(-50%)",
          }}
        >
          <div
            className="text-[#ffd95a]/70 font-bold tabular-nums truncate leading-none"
            style={{
              fontSize: `${0.92 * scale}vw`,
              textShadow: "0 0.15vw 0.3vw rgba(0,0,0,0.85)",
            }}
          >
            {history}
          </div>
        </div>
      )}

      {/* Buy-in */}
      <div
        className="absolute left-[10%] right-[10%] text-center"
        style={{
          top: `${AMOUNT_Y}%`,
          transform: "translateY(-50%)",
        }}
      >
        <div
          className="text-[#ffd95a] font-black tabular-nums leading-none"
          style={{
            fontSize: `${2.6 * scale}vw`,
            textShadow:
              "0 0.2vw 0.45vw rgba(0,0,0,0.85), 0 0 1.2vw rgba(255,200,90,0.35)",
          }}
        >
          {amount}
        </div>
      </div>
    </div>
  );
}
