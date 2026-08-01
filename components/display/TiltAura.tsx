"use client";

/**
 * Electric burst behind a player who's on tilt.
 *
 * The source PNG has a black background rather than transparency, so it's
 * composited with `screen` — black drops out, only the bright bolts survive.
 * A hue shift pushes those bolts from yellow into red, and a red radial
 * glow sits underneath so the whole seat reads as danger from across the
 * room rather than as another gold highlight.
 *
 * Two lightning layers pulse slightly out of phase so the crackle reads as
 * alive without being distracting.
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
    // Yellow bolts -> hot red/orange.
    filter: "hue-rotate(-48deg) saturate(1.7)",
  };

  return (
    <>
      {/* Red pool behind the bolts */}
      <div
        aria-hidden="true"
        style={{
          position: "absolute",
          left: "50%",
          top: "50%",
          width: `${200 * scale}%`,
          height: `${200 * scale}%`,
          transform: "translate(-50%, -50%)",
          mixBlendMode: "screen",
          pointerEvents: "none",
          background:
            "radial-gradient(ellipse at 50% 50%, rgba(255,60,50,0.55) 0%, rgba(210,25,25,0.3) 34%, rgba(150,10,10,0.12) 55%, transparent 72%)",
          animation: "tiltPulse 2.4s ease-in-out infinite",
        }}
      />

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
