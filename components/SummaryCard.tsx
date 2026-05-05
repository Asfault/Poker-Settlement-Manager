"use client";

import { forwardRef, useEffect, useState } from "react";
import type { PlayerResult, Settlement } from "@/lib/types";
import { formatINR } from "@/lib/format";

const TABLE_FONT_FAMILY =
  'Inter, ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif';
const TABLE_NAME_FONT_WEIGHT = 600;
const TABLE_FONT_MAX = 36;
const TABLE_FONT_MIN = 28;
/**
 * Available pixel width for the player name span at the natural 1080×1920
 * layout. Derived from: card width 1080 - card padding 96 - row inner padding
 * 52 = 932 row content; player column is 1.7/4.75 of that ≈ 332; minus the
 * 44px avatar + 14px gap ≈ 274. We use a slightly conservative value to
 * leave a small safety margin against font/measurement variance.
 */
const NAME_MAX_WIDTH = 264;

// Available widths per column (approx, with a small safety margin).
// Player col ≈ 333 − avatar block 58 ≈ 275; using 264 as conservative cap.
const NUM_MAX_WIDTH = 188;
const PL_MAX_WIDTH = 198;

/**
 * Pick the largest font size in [MIN, MAX] at which every body row fits in
 * its column — checks player name, buy-in, chips left, and P/L together.
 */
function pickBodyFontSize(rows: PlayerResult[]): number {
  if (typeof document === "undefined" || rows.length === 0) return TABLE_FONT_MAX;
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  if (!ctx) return TABLE_FONT_MAX;

  for (let size = TABLE_FONT_MAX; size >= TABLE_FONT_MIN; size -= 1) {
    let allFit = true;
    for (const r of rows) {
      // Player name (semibold)
      ctx.font = `${TABLE_NAME_FONT_WEIGHT} ${size}px ${TABLE_FONT_FAMILY}`;
      if (ctx.measureText(r.name).width > NAME_MAX_WIDTH) {
        allFit = false;
        break;
      }
      // Buy-in / chips left (regular)
      ctx.font = `400 ${size}px ${TABLE_FONT_FAMILY}`;
      if (ctx.measureText(formatINR(r.totalBuyIn)).width > NUM_MAX_WIDTH) {
        allFit = false;
        break;
      }
      if (ctx.measureText(formatINR(r.chipsLeft)).width > NUM_MAX_WIDTH) {
        allFit = false;
        break;
      }
      // P/L (bold)
      ctx.font = `800 ${size}px ${TABLE_FONT_FAMILY}`;
      const pl =
        r.profitLoss > 0
          ? `+${formatINR(r.profitLoss)}`
          : r.profitLoss < 0
            ? formatINR(r.profitLoss)
            : formatINR(0);
      if (ctx.measureText(pl).width > PL_MAX_WIDTH) {
        allFit = false;
        break;
      }
    }
    if (allFit) return size;
  }
  return TABLE_FONT_MIN;
}

interface SummaryCardProps {
  startedAt: number;
  results: PlayerResult[];
  settlements: Settlement[];
  totalPot: number;
  /** Unused — kept for API compatibility. */
  biggestWinner?: PlayerResult | null;
}

const AVATAR_PALETTE = [
  "#ef4444",
  "#f97316",
  "#f59e0b",
  "#84cc16",
  "#10b981",
  "#06b6d4",
  "#3b82f6",
  "#8b5cf6",
  "#ec4899",
  "#14b8a6",
];

function avatarColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i += 1) {
    hash = (hash * 31 + name.charCodeAt(i)) | 0;
  }
  return AVATAR_PALETTE[Math.abs(hash) % AVATAR_PALETTE.length];
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function signedINR(amount: number): string {
  if (amount > 0) return `+${formatINR(amount)}`;
  if (amount < 0) return formatINR(amount); // already prefixed "-"
  return formatINR(0);
}

function SettlementRow({ s }: { s: Settlement }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 14,
        fontSize: 30,
        height: "100%",
        minWidth: 0,
      }}
    >
      <span
        style={{
          color: "#ef4444",
          fontWeight: 700,
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
          maxWidth: 160,
        }}
      >
        {s.from}
      </span>
      <span
        style={{
          color: "rgba(233, 196, 106, 0.9)",
          fontWeight: 700,
          fontSize: 26,
          flexShrink: 0,
          lineHeight: 1,
        }}
      >
        →
      </span>
      <span
        style={{
          color: "#22c55e",
          fontWeight: 700,
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
          maxWidth: 160,
        }}
      >
        {s.to}
      </span>
      <span
        style={{
          marginLeft: "auto",
          color: "#e9c46a",
          fontWeight: 800,
          fontVariantNumeric: "tabular-nums",
          flexShrink: 0,
        }}
      >
        {formatINR(s.amount)}
      </span>
    </div>
  );
}

/**
 * Exportable summary card — fixed 1080×1920 with proportional flex-grow
 * sections that always fill the canvas top-to-bottom.
 *
 * Layout proportions (by `flex` value; sums to 100):
 *   Header 10  · Summary 12  · Table 40  · Settlements 33  · Footer 5
 *
 * Internally:
 *   - Table rows share the table's allocated height equally.
 *   - Settlements are ALWAYS in a 2-column grid with rows that share height.
 */
const SummaryCard = forwardRef<HTMLDivElement, SummaryCardProps>(
  function SummaryCard({ results, settlements, totalPot }, ref) {
    const topWinner =
      [...results]
        .filter((r) => r.profitLoss > 0)
        .sort((a, b) => b.profitLoss - a.profitLoss)[0] ?? null;

    // Dynamic body font size — start with the max so the SSR'd HTML matches
    // what a fast capture would expect, then refine on the client.
    const [bodyFontSize, setBodyFontSize] = useState<number>(TABLE_FONT_MAX);
    useEffect(() => {
      const compute = () => setBodyFontSize(pickBodyFontSize(results));
      // Wait for fonts so canvas measurements use the right metrics.
      if (
        typeof document !== "undefined" &&
        document.fonts &&
        document.fonts.ready
      ) {
        document.fonts.ready.then(compute).catch(compute);
      } else {
        compute();
      }
    }, [results]);

    // 1 column when ≤4 settlements; 2 columns when more.
    const useTwoCol = settlements.length > 4;
    const half = useTwoCol
      ? Math.ceil(settlements.length / 2)
      : settlements.length;
    const colA = settlements.slice(0, half);
    const colB = useTwoCol ? settlements.slice(half) : [];
    const rowsCount = Math.max(colA.length, colB.length, 1);

    return (
      <div
        ref={ref}
        style={{
          width: 1080,
          height: 1920,
          padding: 48,
          boxSizing: "border-box",
          background:
            "radial-gradient(ellipse at top, #173a2c 0%, #0c1b15 55%, #060d0a 100%)",
          color: "#f3f4f6",
          fontFamily:
            'Inter, ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
          display: "flex",
          flexDirection: "column",
          gap: 16,
          position: "relative",
          overflow: "hidden",
        }}
      >
        {/* Subtle decorative glows */}
        <div
          style={{
            position: "absolute",
            top: -260,
            right: -260,
            width: 600,
            height: 600,
            borderRadius: "50%",
            background:
              "radial-gradient(circle, rgba(212, 167, 44, 0.18), transparent 70%)",
            pointerEvents: "none",
          }}
        />
        <div
          style={{
            position: "absolute",
            bottom: -260,
            left: -260,
            width: 540,
            height: 540,
            borderRadius: "50%",
            background:
              "radial-gradient(circle, rgba(34, 197, 94, 0.12), transparent 70%)",
            pointerEvents: "none",
          }}
        />

        {/* 1. HEADER (10%) */}
        <div
          style={{
            flex: 10,
            minHeight: 0,
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            alignItems: "center",
            textAlign: "center",
          }}
        >
          <div
            style={{
              fontSize: 18,
              letterSpacing: "0.45em",
              color: "rgba(233, 196, 106, 0.9)",
              fontWeight: 700,
              marginBottom: 6,
            }}
          >
            ♠ ♥ ♦ ♣
          </div>
          <h1
            style={{
              fontSize: 64,
              fontWeight: 900,
              letterSpacing: "0.18em",
              margin: 0,
              lineHeight: 1,
              background:
                "linear-gradient(135deg, #fff8e1 0%, #e9c46a 50%, #c69423 100%)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              backgroundClip: "text",
            }}
          >
            GAME SUMMARY
          </h1>
          <div
            style={{
              fontSize: 18,
              letterSpacing: "0.5em",
              color: "rgba(255, 255, 255, 0.5)",
              marginTop: 8,
              fontWeight: 600,
            }}
          >
            SESSION CLOSED
          </div>
        </div>

        {/* 2. SUMMARY CARDS (12%) */}
        <div
          style={{
            flex: 12,
            minHeight: 0,
            display: "grid",
            gridTemplateColumns: topWinner ? "1.15fr 1fr" : "1fr",
            gap: 18,
          }}
        >
          {/* Total Pot */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              justifyContent: "center",
              gap: 4,
              padding: "18px 26px",
              borderRadius: 22,
              background:
                "linear-gradient(135deg, rgba(212, 167, 44, 0.22) 0%, rgba(212, 167, 44, 0.05) 100%)",
              border: "1.5px solid rgba(233, 196, 106, 0.45)",
              boxShadow:
                "0 0 40px rgba(233, 196, 106, 0.12), inset 0 1px 0 rgba(255, 255, 255, 0.08)",
              minWidth: 0,
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
              }}
            >
              <div
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: "50%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 22,
                  fontWeight: 900,
                  color: "#0a0f0c",
                  background:
                    "linear-gradient(135deg, #f5d27e 0%, #c69423 100%)",
                  boxShadow: "0 4px 12px rgba(0, 0, 0, 0.3)",
                  flexShrink: 0,
                }}
              >
                ₹
              </div>
              <div
                style={{
                  fontSize: 18,
                  letterSpacing: "0.28em",
                  color: "rgba(255, 255, 255, 0.6)",
                  fontWeight: 600,
                }}
              >
                TOTAL POT
              </div>
            </div>
            <div
              style={{
                fontSize: 60,
                fontWeight: 900,
                color: "#e9c46a",
                fontVariantNumeric: "tabular-nums",
                lineHeight: 1.05,
                letterSpacing: "-0.01em",
              }}
            >
              {formatINR(totalPot)}
            </div>
          </div>

          {/* Biggest Winner */}
          {topWinner && (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                justifyContent: "center",
                gap: 2,
                padding: "18px 26px",
                borderRadius: 22,
                background:
                  "linear-gradient(135deg, rgba(34, 197, 94, 0.18) 0%, rgba(34, 197, 94, 0.04) 100%)",
                border: "1.5px solid rgba(34, 197, 94, 0.45)",
                boxShadow:
                  "0 0 40px rgba(34, 197, 94, 0.12), inset 0 1px 0 rgba(255, 255, 255, 0.06)",
                minWidth: 0,
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                }}
              >
                <div style={{ fontSize: 32, lineHeight: 1, flexShrink: 0 }}>
                  🏆
                </div>
                <div
                  style={{
                    fontSize: 18,
                    letterSpacing: "0.28em",
                    color: "rgba(255, 255, 255, 0.6)",
                    fontWeight: 600,
                  }}
                >
                  BIGGEST WINNER
                </div>
              </div>
              <div
                style={{
                  fontSize: 36,
                  fontWeight: 800,
                  color: "#f3f4f6",
                  lineHeight: 1.1,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {topWinner.name}
              </div>
              <div
                style={{
                  fontSize: 36,
                  fontWeight: 900,
                  color: "#22c55e",
                  fontVariantNumeric: "tabular-nums",
                  lineHeight: 1.05,
                }}
              >
                +{formatINR(topWinner.profitLoss)}
              </div>
            </div>
          )}
        </div>

        {/* 3. PLAYER TABLE (40%) */}
        <div
          style={{
            flex: 40,
            minHeight: 0,
            background: "rgba(10, 19, 15, 0.65)",
            border: "1px solid rgba(255, 255, 255, 0.06)",
            borderRadius: 22,
            overflow: "hidden",
            display: "grid",
            gridTemplateRows: "auto 1fr",
          }}
        >
          {/* Table header */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1.7fr 1fr 1fr 1.05fr",
              padding: "14px 26px",
              background: "rgba(23, 58, 44, 0.7)",
              fontSize: 18,
              textTransform: "uppercase",
              letterSpacing: "0.14em",
              color: "rgba(255, 255, 255, 0.65)",
              fontWeight: 700,
            }}
          >
            <div>Player</div>
            <div style={{ textAlign: "right" }}>Buy-in</div>
            <div style={{ textAlign: "right" }}>Chips Left</div>
            <div style={{ textAlign: "right" }}>P / L</div>
          </div>

          {/* Body — every player row gets equal share of remaining height */}
          <div
            style={{
              display: "grid",
              gridTemplateRows: `repeat(${results.length}, 1fr)`,
              minHeight: 0,
            }}
          >
            {results.map((r, idx) => (
              <div
                key={r.id}
                style={{
                  display: "grid",
                  gridTemplateColumns: "1.7fr 1fr 1fr 1.05fr",
                  padding: "0 26px",
                  fontSize: bodyFontSize,
                  background:
                    idx % 2 === 1
                      ? "rgba(255, 255, 255, 0.025)"
                      : "transparent",
                  alignItems: "center",
                  borderTop:
                    idx === 0 ? "none" : "1px solid rgba(255, 255, 255, 0.04)",
                  minWidth: 0,
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 14,
                    minWidth: 0,
                  }}
                >
                  <div
                    style={{
                      width: 44,
                      height: 44,
                      borderRadius: "50%",
                      background: avatarColor(r.name),
                      color: "#0a0f0c",
                      fontSize: 18,
                      fontWeight: 800,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0,
                      boxShadow: "0 2px 6px rgba(0, 0, 0, 0.25)",
                    }}
                  >
                    {initials(r.name)}
                  </div>
                  <span
                    style={{
                      fontWeight: 600,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {r.name}
                  </span>
                </div>
                <div
                  style={{
                    textAlign: "right",
                    fontVariantNumeric: "tabular-nums",
                    color: "rgba(255, 255, 255, 0.85)",
                  }}
                >
                  {formatINR(r.totalBuyIn)}
                </div>
                <div
                  style={{
                    textAlign: "right",
                    fontVariantNumeric: "tabular-nums",
                    color: "rgba(255, 255, 255, 0.85)",
                  }}
                >
                  {formatINR(r.chipsLeft)}
                </div>
                <div
                  style={{
                    textAlign: "right",
                    fontVariantNumeric: "tabular-nums",
                    fontWeight: 800,
                    color:
                      r.profitLoss > 0
                        ? "#22c55e"
                        : r.profitLoss < 0
                          ? "#ef4444"
                          : "rgba(255, 255, 255, 0.6)",
                  }}
                >
                  {signedINR(r.profitLoss)}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 4. SETTLEMENTS (33%) — 2-column grid, every settlement visible */}
        <div
          style={{
            flex: 33,
            minHeight: 0,
            background: "rgba(10, 19, 15, 0.65)",
            border: "1px solid rgba(255, 255, 255, 0.06)",
            borderRadius: 22,
            padding: "18px 28px",
            display: "grid",
            gridTemplateRows: "auto 1fr",
          }}
        >
          <div
            style={{
              fontSize: 26,
              letterSpacing: "0.32em",
              color: "rgba(255, 255, 255, 0.65)",
              fontWeight: 700,
              marginBottom: 10,
            }}
          >
            SETTLEMENTS
          </div>

          {settlements.length === 0 ? (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                fontSize: 30,
                color: "rgba(255, 255, 255, 0.55)",
              }}
            >
              Everyone broke even. No payments needed.
            </div>
          ) : (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: useTwoCol ? "1fr 1fr" : "1fr",
                gridTemplateRows: `repeat(${rowsCount}, 1fr)`,
                columnGap: 36,
                minHeight: 0,
              }}
            >
              {Array.from({ length: rowsCount }).flatMap((_, i) => {
                const cells = [
                  <div
                    key={`a-${i}`}
                    style={{
                      borderTop:
                        i === 0
                          ? "none"
                          : "1px solid rgba(255, 255, 255, 0.05)",
                      display: "flex",
                      alignItems: "center",
                      minWidth: 0,
                    }}
                  >
                    {colA[i] && <SettlementRow s={colA[i]} />}
                  </div>,
                ];
                if (useTwoCol) {
                  cells.push(
                    <div
                      key={`b-${i}`}
                      style={{
                        borderTop:
                          i === 0
                            ? "none"
                            : "1px solid rgba(255, 255, 255, 0.05)",
                        display: "flex",
                        alignItems: "center",
                        minWidth: 0,
                      }}
                    >
                      {colB[i] && <SettlementRow s={colB[i]} />}
                    </div>,
                  );
                }
                return cells;
              })}
            </div>
          )}
        </div>

        {/* 5. FOOTER (5%) */}
        <div
          style={{
            flex: 5,
            minHeight: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            textAlign: "center",
            fontSize: 18,
            letterSpacing: "0.18em",
            color: "rgba(255, 255, 255, 0.6)",
            fontWeight: 600,
          }}
        >
          SETTLE UP — ENJOYED THE GAME!  SEE YOU NEXT TIME! — Dhermesh
        </div>
      </div>
    );
  },
);

export default SummaryCard;
