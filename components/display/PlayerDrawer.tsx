"use client";

import type { PlayerCard, PlayerCardChart } from "@/lib/display/playerCard";
import { formatINR } from "@/lib/format";
import DisplayAvatar from "./DisplayAvatar";

const TONE: Record<string, string> = {
  win: "#22c55e",
  loss: "#ef4444",
  gold: "#e9c46a",
  neutral: "#f3f4f6",
};

/** Slide-in panel spotlighting one player currently at the table. */
export default function PlayerDrawer({
  card,
  visible,
}: {
  card: PlayerCard;
  visible: boolean;
}) {
  return (
    <div
      className="absolute inset-y-0 left-0 z-30 flex flex-col"
      style={{
        width: "31%",
        background: "#020e0a",
        borderRight: "0.25vw solid rgba(233,196,106,0.5)",
        boxShadow: "2vw 0 5vw rgba(0,0,0,0.65)",
        transform: visible ? "translateX(0)" : "translateX(-102%)",
        transition: "transform 700ms cubic-bezier(0.22, 1, 0.36, 1)",
      }}
    >
      {/* Portrait */}
      <div
        className="relative shrink-0 flex items-start justify-center overflow-hidden"
        style={{
          height: "34%",
          background:
            "radial-gradient(ellipse at 50% 42%, rgba(16,185,129,0.28), transparent 70%)",
        }}
      >
        {card.characterUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={card.characterUrl}
            alt={card.name}
            className="h-full object-contain mt-[3%]"
            style={{ filter: "drop-shadow(0 0.6vw 1.4vw rgba(0,0,0,0.6))" }}
          />
        ) : (
          <div className="mt-[4%]">
            <DisplayAvatar
              name={card.name}
              photoUrl={card.photoUrl}
              size={150}
            />
          </div>
        )}
        <div
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(to bottom, transparent 48%, #020e0a 96%)",
          }}
        />
        <div className="absolute left-[6%] right-[6%] bottom-[1%]">
          <div className="text-[#e9c46a]/85 font-extrabold tracking-[0.28em] text-[clamp(9px,1vw,17px)]">
            AT THE TABLE
          </div>
          <div className="text-white font-black leading-none truncate text-[clamp(26px,3.1vw,58px)]">
            {card.name}
          </div>
        </div>
      </div>

      {/* Tonight */}
      <div
        className="shrink-0 mx-[6%] mt-[2%] flex items-center justify-between rounded-xl"
        style={{
          padding: "1.1vw 1.4vw",
          background: "rgba(233,196,106,0.1)",
          border: "1px solid rgba(233,196,106,0.3)",
        }}
      >
        <span className="text-white/55 font-bold tracking-[0.14em] text-[clamp(11px,1.2vw,20px)]">
          TONIGHT
        </span>
        <span className="text-[#e9c46a] font-black leading-none text-[clamp(20px,2.3vw,42px)]">
          {formatINR(card.tonightBuyIn)}
        </span>
      </div>

      {/* Stat tiles */}
      <div className="shrink-0 mx-[6%] mt-[4%] grid grid-cols-2 gap-[0.9vw]">
        {card.tiles.map((t) => (
          <div
            key={t.id}
            className="rounded-lg"
            style={{
              background: "rgba(255,255,255,0.04)",
              padding: "0.9vw 1vw",
            }}
          >
            <div className="text-white/40 font-bold tracking-[0.16em] uppercase text-[clamp(8px,0.95vw,15px)]">
              {t.label}
            </div>
            <div
              className="font-black leading-tight text-[clamp(16px,2.05vw,38px)]"
              style={{ color: TONE[t.tone ?? "neutral"] }}
            >
              {t.value}
              {t.suffix && (
                <span className="text-white/35 font-semibold text-[clamp(9px,1.2vw,20px)]">
                  {" "}
                  {t.suffix}
                </span>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Chart */}
      {card.chart && (
        <div className="flex-1 min-h-0 mx-[6%] mt-[4%] flex flex-col">
          <div className="shrink-0 text-white/40 font-bold tracking-[0.18em] uppercase text-[clamp(8px,0.95vw,15px)]">
            {card.chart.title}
          </div>
          <div className="flex-1 min-h-0 mt-[2%]">
            <Chart chart={card.chart} />
          </div>
          {card.chart.footnote && (
            <div className="shrink-0 text-white/30 pb-[6%] pt-[2%] text-[clamp(10px,1.05vw,18px)]">
              {card.chart.footnote}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Chart({ chart }: { chart: PlayerCardChart }) {
  if (chart.kind === "cumulative") return <LineChart chart={chart} />;
  return <BarChart chart={chart} />;
}

/** Bars above/below a zero line — form and weekday both use this. */
function BarChart({ chart }: { chart: PlayerCardChart }) {
  const max = Math.max(1, ...chart.series.map((v) => Math.abs(v)));
  return (
    <div className="w-full h-full flex items-stretch gap-[0.55vw]">
      {chart.series.map((v, i) => {
        const pct = (Math.abs(v) / max) * 45;
        const positive = v >= 0;
        return (
          <div key={i} className="flex-1 flex flex-col justify-center">
            <div className="h-1/2 flex items-end">
              {positive && (
                <div
                  className="w-full rounded-t"
                  style={{
                    height: `${pct * 2}%`,
                    background: "linear-gradient(180deg,#22c55e,#15803d)",
                  }}
                />
              )}
            </div>
            <div
              className="w-full shrink-0"
              style={{ height: 1, background: "rgba(255,255,255,0.18)" }}
            />
            <div className="h-1/2 flex items-start">
              {!positive && (
                <div
                  className="w-full rounded-b"
                  style={{
                    height: `${pct * 2}%`,
                    background: "linear-gradient(0deg,#ef4444,#b91c1c)",
                  }}
                />
              )}
            </div>
            {chart.labels?.[i] && (
              <div className="text-center text-white/30 text-[clamp(7px,0.8vw,13px)] mt-1">
                {chart.labels[i]}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

/** Running profit total. */
function LineChart({ chart }: { chart: PlayerCardChart }) {
  const s = chart.series;
  const min = Math.min(0, ...s);
  const max = Math.max(0, ...s);
  const span = max - min || 1;
  const up = s[s.length - 1] >= 0;
  const colour = up ? "#22c55e" : "#ef4444";

  const pts = s.map((v, i) => {
    const x = s.length === 1 ? 100 : (i / (s.length - 1)) * 100;
    const y = 38 - ((v - min) / span) * 34;
    return `${x},${y}`;
  });
  const zeroY = 38 - ((0 - min) / span) * 34;
  const last = pts[pts.length - 1].split(",");

  return (
    <svg viewBox="0 0 100 40" preserveAspectRatio="none" className="w-full h-full">
      <defs>
        <linearGradient id="pcFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={colour} stopOpacity="0.35" />
          <stop offset="100%" stopColor={colour} stopOpacity="0" />
        </linearGradient>
      </defs>
      <line
        x1="0"
        y1={zeroY}
        x2="100"
        y2={zeroY}
        stroke="rgba(255,255,255,0.15)"
        strokeWidth="0.3"
      />
      <polygon
        points={`0,40 ${pts.join(" ")} 100,40`}
        fill="url(#pcFill)"
      />
      <polyline
        points={pts.join(" ")}
        fill="none"
        stroke={colour}
        strokeWidth="1.1"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      <circle cx={last[0]} cy={last[1]} r="1.6" fill={colour} />
    </svg>
  );
}
