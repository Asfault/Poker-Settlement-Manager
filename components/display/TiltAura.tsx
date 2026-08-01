"use client";

/**
 * Electric burst behind a player who's on tilt.
 *
 * The source PNG has a black background rather than transparency, so it's
 * composited with `screen` — black drops out, only the bright yellow and
 * cyan survive. Works because the display sits on dark felt.
 *
 * Two layers pulse slightly out of phase so the crackle reads as alive
 * without being distracting from across the room.
 */
export default function TiltAura({ scale = 1 }: { scale?: number }) {
  const common: React.CSSProperties = {
    position: "absolute",
    left: "50%",
    top: "50%",
    width: `${190 * scale}%`,
    transform: "translate(-50%, -50%)",
    mixBlendMode: "screen",
    pointerEvents: "none",
    userSelect: "none",
  };

  return (
    <>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/tilt-lightning.png"
        alt=""
        aria-hidden="true"
        style={{ ...common, animation: "tiltPulse 2.4s ease-in-out infinite" }}
      />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/tilt-lightning.png"
        alt=""
        aria-hidden="true"
        style={{
          ...common,
          width: `${165 * scale}%`,
          opacity: 0.55,
          animation: "tiltPulseAlt 3.1s ease-in-out infinite",
        }}
      />
    </>
  );
}
