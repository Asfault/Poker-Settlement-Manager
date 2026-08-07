"use client";

import type { Card, CardDatum } from "@/lib/display/content";
import DisplayAvatar from "./DisplayAvatar";

const TONE: Record<string, string> = {
  win: "#22c55e",
  loss: "#ef4444",
  gold: "#e9c46a",
  neutral: "#f3f4f6",
};

const PIE_COLOURS = [
  "#e9c46a",
  "#22c55e",
  "#3b82f6",
  "#ef4444",
  "#8b5cf6",
  "#f97316",
  "#14b8a6",
  "#ec4899",
  "#84cc16",
  "#06b6d4",
];

export default function ContentCard({ card }: { card: Card }) {
  const accent = TONE[card.tone ?? "gold"] ?? TONE.gold;

  return (
    <div className="h-full flex flex-col justify-center animate-[fadeIn_400ms_ease-out]">
      {card.kind === "alert" && <AlertBody card={card} accent={accent} />}
      {card.kind === "stat" && <StatBody card={card} accent={accent} />}
      {card.kind === "spotlight" && <StatBody card={card} accent={accent} />}
      {card.kind === "fact" && <FactBody card={card} accent={accent} />}
      {card.kind === "leaderboard" && <ListBody card={card} />}
      {card.kind === "bar" && <BarBody card={card} />}
      {card.kind === "pie" && <PieBody card={card} />}
      {card.kind === "headToHead" && <HeadToHeadBody card={card} />}
    </div>
  );
}

function Title({ card }: { card: Card }) {
  return (
    <div className="mb-6">
      <div className="text-[clamp(18px,2vw,26px)] uppercase tracking-[0.28em] text-white/45 font-semibold">
        {card.title}
      </div>
      {card.subtitle && (
        <div className="text-[clamp(16px,1.6vw,22px)] text-white/35 mt-1">
          {card.subtitle}
        </div>
      )}
    </div>
  );
}

function AlertBody({ card, accent }: { card: Card; accent: string }) {
  // With artwork, the alert goes full-bleed: art on the right, text left over
  // a scrim. Same asset the seats use, but readable from across a room.
  if (card.artUrl) {
    return <ArtAlertBody card={card} accent={accent} />;
  }

  return (
    <div className="text-center">
      {card.photoUrl && (
        <div className="flex justify-center mb-8">
          <DisplayAvatar
            name={card.title}
            photoUrl={card.photoUrl}
            size={220}
            ring={accent}
          />
        </div>
      )}
      <div
        className="font-black leading-[0.95] tracking-tight"
        style={{
          color: accent,
          fontSize: "clamp(48px, 7vw, 130px)",
          textShadow: "0 4px 24px rgba(0,0,0,0.6)",
        }}
      >
        {card.title}
      </div>
      {card.body && (
        <div className="text-white/70 mt-8 text-[clamp(20px,2.4vw,40px)]">
          {card.body}
        </div>
      )}
    </div>
  );
}

/**
 * Full-bleed character art with the text laid over it.
 *
 * The scrim is doing real work — artwork varies, and white text over a light
 * image is unreadable. It's opaque on the left where the words are and clears
 * by about 70%, so the art is unobscured where it matters.
 *
 * Rendered outside the padded overlay via negative insets so the art actually
 * reaches the edges of the screen.
 */
function ArtAlertBody({ card, accent }: { card: Card; accent: string }) {
  return (
    <div className="absolute inset-0 overflow-hidden">
      <div
        className="absolute inset-0"
        style={{
          background: `radial-gradient(ellipse at 72% 60%, ${accent}26 0%, transparent 62%)`,
        }}
      />

      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={card.artUrl ?? ""}
        alt=""
        aria-hidden="true"
        className="absolute object-contain animate-[fadeIn_500ms_ease-out]"
        style={{
          right: "4%",
          bottom: 0,
          height: "94%",
          filter: `drop-shadow(0 0 3vw ${accent}80)`,
        }}
      />

      <div
        className="absolute inset-0"
        style={{
          background:
            "linear-gradient(90deg, rgba(5,25,17,0.97) 0%, rgba(5,25,17,0.9) 40%, rgba(5,25,17,0.35) 62%, transparent 78%)",
        }}
      />

      <div className="absolute inset-y-0 left-0 flex flex-col justify-center px-[6vw] max-w-[62%]">
        <div
          className="font-black leading-[0.92] tracking-tight"
          style={{
            color: accent,
            fontSize: "clamp(44px, 6.4vw, 118px)",
            textShadow: "0 4px 24px rgba(0,0,0,0.75)",
          }}
        >
          {card.title}
        </div>
        {card.body && (
          <div className="text-white/75 mt-[3vh] text-[clamp(18px,2.2vw,38px)] leading-snug">
            {card.body}
          </div>
        )}
      </div>
    </div>
  );
}

function StatBody({ card, accent }: { card: Card; accent: string }) {
  return (
    <div className="text-center">
      {card.photoUrl && (
        <div className="flex justify-center mb-8">
          <DisplayAvatar
            name={card.title}
            photoUrl={card.photoUrl}
            size={180}
            ring={accent}
          />
        </div>
      )}
      <div className="text-[clamp(18px,2.2vw,34px)] uppercase tracking-[0.24em] text-white/50 font-semibold mb-4">
        {card.title}
      </div>
      <div
        className="font-black tabular-nums leading-none"
        style={{
          color: accent,
          fontSize: "clamp(64px, 11vw, 200px)",
          textShadow: "0 4px 24px rgba(0,0,0,0.6)",
        }}
      >
        {card.value}
      </div>
      {card.subtitle && (
        <div className="text-white/45 mt-6 text-[clamp(18px,2vw,32px)]">
          {card.subtitle}
        </div>
      )}
    </div>
  );
}

function FactBody({ card, accent }: { card: Card; accent: string }) {
  return (
    <div className="text-center max-w-[85%] mx-auto">
      {card.photoUrl && (
        <div className="flex justify-center mb-8">
          <DisplayAvatar
            name={card.title}
            photoUrl={card.photoUrl}
            size={160}
            ring={accent}
          />
        </div>
      )}
      <div
        className="uppercase tracking-[0.3em] font-bold mb-6 text-[clamp(18px,2vw,30px)]"
        style={{ color: accent }}
      >
        {card.title}
      </div>
      <div className="text-white/90 leading-snug text-[clamp(28px,3.6vw,64px)] font-semibold">
        {card.body}
      </div>
    </div>
  );
}

function ListBody({ card }: { card: Card }) {
  const rows = card.data ?? [];
  return (
    <div>
      <Title card={card} />
      <div className="flex flex-col gap-3">
        {rows.map((r, i) => (
          <div key={i} className="flex items-center gap-5">
            <span className="text-white/25 tabular-nums w-10 shrink-0 text-[clamp(18px,2vw,32px)]">
              {i + 1}
            </span>
            <DisplayAvatar name={r.label} photoUrl={r.photoUrl} size={64} />
            <span className="flex-1 min-w-0 truncate font-semibold text-[clamp(22px,2.6vw,44px)]">
              {r.label}
            </span>
            <span
              className="font-black tabular-nums shrink-0 text-[clamp(22px,2.6vw,44px)]"
              style={{ color: TONE[r.tone ?? "gold"] }}
            >
              {r.display ?? r.value}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function BarBody({ card }: { card: Card }) {
  const rows = card.data ?? [];
  const max = Math.max(1, ...rows.map((r) => Math.abs(r.value)));
  return (
    <div>
      <Title card={card} />
      <div className="flex flex-col gap-4">
        {rows.map((r, i) => (
          <div key={i} className="flex items-center gap-4">
            <span className="w-[22%] shrink-0 truncate font-semibold text-[clamp(18px,2.2vw,36px)]">
              {r.label}
            </span>
            <div className="flex-1 h-[clamp(28px,3.4vw,54px)] bg-white/5 rounded-lg overflow-hidden">
              <div
                className="h-full rounded-lg transition-[width] duration-700"
                style={{
                  width: `${(Math.abs(r.value) / max) * 100}%`,
                  background: `linear-gradient(90deg, ${TONE[r.tone ?? "gold"]}, ${TONE[r.tone ?? "gold"]}88)`,
                }}
              />
            </div>
            <span
              className="w-[18%] shrink-0 text-right font-black tabular-nums text-[clamp(18px,2.2vw,36px)]"
              style={{ color: TONE[r.tone ?? "gold"] }}
            >
              {r.display ?? r.value}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function PieBody({ card }: { card: Card }) {
  const rows = card.data ?? [];
  const total = rows.reduce((s, r) => s + r.value, 0) || 1;

  let angle = -90;
  const slices = rows.map((r, i) => {
    const sweep = (r.value / total) * 360;
    const seg = { ...r, start: angle, sweep, colour: PIE_COLOURS[i % PIE_COLOURS.length] };
    angle += sweep;
    return seg;
  });

  const R = 46;
  const arc = (start: number, sweep: number) => {
    // A full circle can't be drawn as a single arc — nudge it.
    const s = (start * Math.PI) / 180;
    const e = ((start + Math.min(sweep, 359.99)) * Math.PI) / 180;
    const x1 = 50 + R * Math.cos(s);
    const y1 = 50 + R * Math.sin(s);
    const x2 = 50 + R * Math.cos(e);
    const y2 = 50 + R * Math.sin(e);
    const large = sweep > 180 ? 1 : 0;
    return `M 50 50 L ${x1} ${y1} A ${R} ${R} 0 ${large} 1 ${x2} ${y2} Z`;
  };

  return (
    <div>
      <Title card={card} />
      <div className="flex items-center gap-10">
        <svg viewBox="0 0 100 100" className="w-[34%] shrink-0">
          {slices.map((s, i) => (
            <path
              key={i}
              d={arc(s.start, s.sweep)}
              fill={s.colour}
              stroke="rgba(0,0,0,0.35)"
              strokeWidth="0.6"
            />
          ))}
          <circle cx="50" cy="50" r="20" fill="#08150f" />
        </svg>
        <div className="flex-1 min-w-0 flex flex-col gap-2.5">
          {slices.map((s, i) => (
            <div key={i} className="flex items-center gap-4">
              <span
                className="w-5 h-5 rounded shrink-0"
                style={{ background: s.colour }}
              />
              <span className="flex-1 min-w-0 truncate font-semibold text-[clamp(18px,2.2vw,36px)]">
                {s.label}
              </span>
              <span className="tabular-nums font-bold text-white/80 shrink-0 text-[clamp(18px,2.2vw,36px)]">
                {s.display ?? s.value}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function HeadToHeadBody({ card }: { card: Card }) {
  const [a, b] = card.data ?? [];
  if (!a || !b) return null;
  const side = (d: CardDatum) => (
    <div className="flex-1 text-center">
      <div className="flex justify-center mb-5">
        <DisplayAvatar
          name={d.label}
          photoUrl={d.photoUrl}
          size={150}
          ring={TONE[d.tone ?? "neutral"]}
        />
      </div>
      <div className="font-bold truncate text-[clamp(22px,2.6vw,44px)]">
        {d.label}
      </div>
      <div
        className="font-black tabular-nums mt-2 text-[clamp(30px,4vw,72px)]"
        style={{ color: TONE[d.tone ?? "neutral"] }}
      >
        {d.display ?? d.value}
      </div>
    </div>
  );
  return (
    <div>
      <Title card={card} />
      <div className="flex items-center gap-8">
        {side(a)}
        <div className="text-white/20 font-black text-[clamp(28px,3.4vw,64px)]">
          vs
        </div>
        {side(b)}
      </div>
    </div>
  );
}
