"use client";

/**
 * "TILTING" struck diagonally across a player's portrait.
 *
 * Sits above the character art and below nothing else — it's meant to be
 * the loudest thing on that seat. Sized off the same depth scale as the
 * artwork so front and back seats stay proportional.
 */
export default function TiltStamp({ scale = 1 }: { scale?: number }) {
  return (
    <div
      aria-hidden="true"
      className="absolute pointer-events-none select-none"
      style={{
        left: "50%",
        top: "48%",
        transform: "translate(-50%, -50%) rotate(-24deg)",
        zIndex: 5,
        animation: "tiltStamp 2.4s ease-in-out infinite",
      }}
    >
      <div
        className="font-black leading-none whitespace-nowrap"
        style={{
          fontSize: `${2.15 * scale}vw`,
          letterSpacing: `${0.12 * scale}vw`,
          color: "#ff5c5c",
          padding: `${0.32 * scale}vw ${0.7 * scale}vw`,
          border: `${0.22 * scale}vw solid #ff5c5c`,
          borderRadius: `${0.25 * scale}vw`,
          background: "rgba(30,0,0,0.42)",
          textShadow:
            "0 0 0.5vw rgba(255,60,60,0.9), 0 0.15vw 0.3vw rgba(0,0,0,0.9)",
          boxShadow:
            "0 0 0.9vw rgba(255,60,60,0.55), inset 0 0 0.6vw rgba(255,60,60,0.3)",
        }}
      >
        TILTING
      </div>
    </div>
  );
}
