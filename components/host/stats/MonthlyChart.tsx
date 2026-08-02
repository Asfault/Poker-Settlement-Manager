"use client";

import type { MonthBucket } from "@/lib/stats/extra";
import { formatINR } from "@/lib/format";

/**
 * Sessions per month, as bars. Hand-rolled SVG — no chart dependency, matching
 * how the display board draws its own charts.
 *
 * Bar height encodes session count; the tooltip carries the pot. Months with
 * no games are filled in as gaps so a quiet summer actually looks quiet.
 */
export default function MonthlyChart({ data }: { data: MonthBucket[] }) {
  if (data.length === 0) return null;

  const filled = fillGaps(data);
  const max = Math.max(...filled.map((d) => d.sessions), 1);

  // Show at most the last 18 months so the bars stay tappable on a phone.
  const shown = filled.slice(-18);

  return (
    <div>
      <div className="flex items-end gap-1 h-28">
        {shown.map((d) => {
          const pct = (d.sessions / max) * 100;
          return (
            <div
              key={d.key}
              className="flex-1 flex flex-col justify-end items-center h-full group"
              title={
                d.sessions === 0
                  ? `${d.label}: no games`
                  : `${d.label}: ${d.sessions} session${d.sessions === 1 ? "" : "s"} · ${formatINR(d.pot)}`
              }
            >
              <span className="text-[9px] text-white/40 mb-0.5 tabular-nums">
                {d.sessions > 0 ? d.sessions : ""}
              </span>
              <div
                className={`w-full rounded-t transition-colors ${
                  d.sessions > 0
                    ? "bg-gold-500/70 group-hover:bg-gold-400"
                    : "bg-white/5"
                }`}
                style={{ height: `${Math.max(pct, d.sessions > 0 ? 6 : 2)}%` }}
              />
            </div>
          );
        })}
      </div>
      <div className="flex gap-1 mt-1.5">
        {shown.map((d, i) => (
          <div
            key={d.key}
            className="flex-1 text-center text-[9px] text-white/35 truncate"
          >
            {/* Only label every other bar once it gets crowded. */}
            {shown.length > 9 && i % 2 === 1 ? "" : d.label.split(" ")[0]}
          </div>
        ))}
      </div>
    </div>
  );
}

/** Insert empty buckets for months with no sessions, so time reads linearly. */
function fillGaps(data: MonthBucket[]): MonthBucket[] {
  if (data.length < 2) return data;

  const MONTHS = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ];

  const out: MonthBucket[] = [];
  const [firstY, firstM] = data[0].key.split("-").map(Number);
  const [lastY, lastM] = data[data.length - 1].key.split("-").map(Number);

  let y = firstY;
  let m = firstM;
  // Guard against a runaway loop on malformed keys.
  for (let guard = 0; guard < 600; guard += 1) {
    const key = `${y}-${String(m).padStart(2, "0")}`;
    const found = data.find((d) => d.key === key);
    out.push(
      found ?? {
        key,
        label: `${MONTHS[m - 1]} ${String(y).slice(2)}`,
        sessions: 0,
        pot: 0,
      },
    );
    if (y === lastY && m === lastM) break;
    m += 1;
    if (m > 12) {
      m = 1;
      y += 1;
    }
  }

  return out;
}
