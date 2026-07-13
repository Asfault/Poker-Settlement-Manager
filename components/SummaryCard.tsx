"use client";

import { forwardRef } from "react";
import type { PlayerResult, Settlement } from "@/lib/types";
import { formatINR } from "@/lib/format";

interface SummaryCardProps {
  startedAt: number;
  results: PlayerResult[];
  settlements: Settlement[];
  totalPot: number;
  /** Unused — kept for API compatibility. */
  biggestWinner?: PlayerResult | null;
}

const CARD_WIDTH = 1080;
const CARD_HEIGHT = 1920;
const GOLD = "#ffd95a";
const PANEL = "rgba(0, 28, 20, 0.78)";
const PANEL_DARK = "rgba(2, 14, 13, 0.92)";
const LINE = "rgba(255, 217, 90, 0.38)";
const WHITE = "#fffaf0";
const MUTED = "rgba(255, 250, 240, 0.78)";
const GREEN = "#5cf16f";
const RED = "#ff5f65";

const AVATAR_PALETTE = [
  "#2f80ed",
  "#d92d35",
  "#27ae60",
  "#8e44ad",
  "#e67e22",
  "#2bb6a8",
  "#1f8fe5",
  "#b96b2c",
  "#7c5cff",
  "#e84393",
];

function avatarColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i += 1) {
    hash = (hash * 31 + name.charCodeAt(i)) | 0;
  }
  return AVATAR_PALETTE[Math.abs(hash) % AVATAR_PALETTE.length];
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

function signedINR(amount: number): string {
  if (amount > 0) return `+${formatINR(amount)}`;
  if (amount < 0) return formatINR(amount);
  return formatINR(0);
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function SectionTitle({ children }: { children: string }) {
  return (
    <div
      style={{
        alignSelf: "center",
        justifySelf: "center",
        minWidth: 265,
        height: 48,
        padding: "0 28px",
        borderRadius: 18,
        border: `2px solid ${LINE}`,
        background:
          "linear-gradient(180deg, rgba(12, 96, 62, 0.98), rgba(2, 52, 39, 0.98))",
        boxShadow:
          "0 8px 18px rgba(0, 0, 0, 0.42), inset 0 1px 0 rgba(255, 255, 255, 0.16)",
        color: WHITE,
        fontSize: 31,
        fontWeight: 900,
        letterSpacing: "0",
        lineHeight: "44px",
        textAlign: "center",
        textShadow: "0 3px 0 rgba(0, 0, 0, 0.45)",
        zIndex: 2,
        whiteSpace: "nowrap",
      }}
    >
      {children}
    </div>
  );
}

function ChipStack({
  left,
  right,
  top,
  bottom,
  scale = 1,
}: {
  left?: number;
  right?: number;
  top?: number;
  bottom?: number;
  scale?: number;
}) {
  const chip = (
    color: string,
    x: number,
    y: number,
    size: number,
    layers: number,
  ) => (
    <div
      style={{
        position: "absolute",
        left: x * scale,
        top: y * scale,
        width: size * scale,
        height: size * scale,
      }}
    >
      {Array.from({ length: layers }).map((_, i) => (
        <div
          key={i}
          style={{
            position: "absolute",
            left: 0,
            top: i * 9 * scale,
            width: size * scale,
            height: size * 0.42 * scale,
            borderRadius: "50%",
            background: `linear-gradient(90deg, ${color}, #ffffff 18%, ${color} 34%, ${color} 66%, #ffffff 82%, ${color})`,
            border: `${2 * scale}px solid rgba(255, 255, 255, 0.45)`,
            boxShadow: "0 5px 9px rgba(0, 0, 0, 0.35)",
          }}
        />
      ))}
    </div>
  );

  return (
    <div
      style={{
        position: "absolute",
        left,
        right,
        top,
        bottom,
        width: 205 * scale,
        height: 160 * scale,
        pointerEvents: "none",
        zIndex: 1,
      }}
    >
      {chip("#1f9d55", 0, 28, 68, 7)}
      {chip("#d73535", 70, 0, 74, 6)}
      {chip("#2676c9", 128, 42, 76, 7)}
    </div>
  );
}

function CornerCards() {
  const card = (
    label: string,
    suit: string,
    color: string,
    rotate: number,
    x: number,
    y: number,
  ) => (
    <div
      style={{
        position: "absolute",
        right: x,
        top: y,
        width: 70,
        height: 100,
        borderRadius: 9,
        background: "#f8f8f4",
        color,
        transform: `rotate(${rotate}deg)`,
        boxShadow: "0 8px 16px rgba(0, 0, 0, 0.42)",
        border: "1px solid rgba(0, 0, 0, 0.12)",
        fontWeight: 900,
        fontSize: 25,
        lineHeight: 1,
        padding: "10px 9px",
        boxSizing: "border-box",
      }}
    >
      <div>{label}</div>
      <div style={{ marginTop: 4 }}>{suit}</div>
    </div>
  );

  return (
    <div style={{ position: "absolute", right: 26, top: 24, zIndex: 1 }}>
      {card("A", "♥", "#c5162f", 8, 48, 0)}
      {card("A", "♠", "#111827", 15, 0, 6)}
    </div>
  );
}

function MiniAvatar({ name, size }: { name: string; size: number }) {
  return (
    <span
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        background: avatarColor(name),
        border: "2px solid rgba(255, 255, 255, 0.38)",
        boxShadow: "0 3px 8px rgba(0, 0, 0, 0.42)",
        color: WHITE,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
        fontSize: Math.round(size * 0.34),
        fontWeight: 900,
        textShadow: "0 1px 2px rgba(0, 0, 0, 0.6)",
      }}
    >
      {initials(name)}
    </span>
  );
}

const SummaryCard = forwardRef<HTMLDivElement, SummaryCardProps>(
  function SummaryCard({ results, settlements, totalPot }, ref) {
    const playerCount = Math.max(results.length, 1);
    const settlementCount = Math.max(settlements.length, 1);
    const topWinner =
      [...results]
        .filter((r) => r.profitLoss > 0)
        .sort((a, b) => b.profitLoss - a.profitLoss)[0] ?? null;
    const pressure = Math.max(playerCount - 8, settlementCount - 8, 0);
    const outerPadding = clamp(42 - pressure * 4, 32, 42);
    const gap = clamp(18 - pressure * 2, 14, 18);
    const headerHeight = clamp(170 - pressure * 10, 136, 170);
    const topWinnerBannerHeight = topWinner
      ? clamp(150 - pressure * 8, 128, 150)
      : 0;
    const totalPotPanelHeight = clamp(158 - pressure * 8, 128, 158);
    const sectionTitleHeight = 62;
    const tableHeaderHeight = clamp(64 - pressure * 2, 58, 64);
    const tableTopOffset = 22;
    const tableRowHeight = clamp(
      68 - Math.max(0, playerCount - 8) * 5 - pressure * 2,
      52,
      68,
    );
    const tableHeight =
      sectionTitleHeight + tableHeaderHeight + tableRowHeight * playerCount;
    const visiblePanels = topWinner ? 5 : 4;
    const remainingHeight =
      CARD_HEIGHT -
      outerPadding * 2 -
      headerHeight -
      topWinnerBannerHeight -
      tableTopOffset -
      tableHeight -
      totalPotPanelHeight -
      gap * (visiblePanels - 1);
    const settlementsHeight = Math.max(360, remainingHeight);
    const rowFont = clamp(tableRowHeight * 0.48, 26, 34);
    const headerFont = clamp(rowFont - 7, 19, 25);
    const settlementRowHeight = Math.max(
      44,
      (settlementsHeight - sectionTitleHeight - 14) / settlementCount,
    );
    const settlementFont = clamp(settlementRowHeight * 0.46, 23, 34);
    const titleFont = clamp(headerHeight * 0.42, 56, 70);
    const subtitleFont = clamp(headerHeight * 0.2, 27, 34);
    const winnerAmountFont = clamp(topWinnerBannerHeight * 0.5, 58, 78);

    return (
      <div
        ref={ref}
        style={{
          width: CARD_WIDTH,
          height: CARD_HEIGHT,
          padding: outerPadding,
          boxSizing: "border-box",
          color: WHITE,
          fontFamily:
            'Inter, ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
          background:
            "radial-gradient(circle at 50% -12%, rgba(33, 138, 92, 0.45), transparent 34%), radial-gradient(circle at 50% 110%, rgba(8, 63, 47, 0.8), transparent 36%), linear-gradient(180deg, #093b2b 0%, #03251d 45%, #001711 100%)",
          position: "relative",
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
          gap,
          textShadow: "0 3px 0 rgba(0, 0, 0, 0.5)",
        }}
      >
        <div
          style={{
            position: "absolute",
            inset: 0,
            backgroundImage:
              "linear-gradient(45deg, rgba(255,255,255,0.025) 25%, transparent 25%, transparent 50%, rgba(255,255,255,0.025) 50%, rgba(255,255,255,0.025) 75%, transparent 75%, transparent), radial-gradient(circle at 20% 20%, rgba(255,255,255,0.035), transparent 18%)",
            backgroundSize: "18px 18px, 360px 360px",
            opacity: 0.65,
            pointerEvents: "none",
          }}
        />
        <div
          style={{
            position: "absolute",
            inset: 16,
            border: `2px solid rgba(255, 217, 90, 0.28)`,
            borderRadius: 26,
            pointerEvents: "none",
          }}
        />
        <ChipStack left={24} top={26} scale={pressure > 0 ? 0.75 : 0.9} />
        <CornerCards />

        <div
          style={{
            height: headerHeight,
            border: `2px solid ${LINE}`,
            borderRadius: 22,
            background:
              "linear-gradient(180deg, rgba(4, 58, 41, 0.82), rgba(1, 36, 29, 0.82))",
            boxShadow:
              "inset 0 1px 0 rgba(255, 255, 255, 0.11), 0 8px 18px rgba(0, 0, 0, 0.3)",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            position: "relative",
            zIndex: 2,
            marginLeft: pressure > 0 ? 132 : 170,
            marginRight: pressure > 0 ? 126 : 150,
          }}
        >
          <div
            style={{
              fontSize: titleFont,
              lineHeight: 0.95,
              fontWeight: 1000,
              letterSpacing: "0",
              color: WHITE,
              textShadow:
                "0 4px 0 rgba(0, 0, 0, 0.55), 0 0 18px rgba(255, 255, 255, 0.12)",
              whiteSpace: "nowrap",
            }}
          >
            GAME SUMMARY
          </div>
          <div
            style={{
              marginTop: pressure > 0 ? 4 : 8,
              color: GOLD,
              fontSize: subtitleFont,
              fontWeight: 900,
              letterSpacing: "0",
              whiteSpace: "nowrap",
            }}
          >
            — SESSION CLOSED —
          </div>
        </div>

        {topWinner && (
          <div
            style={{
              height: topWinnerBannerHeight,
              border: `2px solid ${LINE}`,
              borderRadius: 20,
              background:
                "linear-gradient(90deg, rgba(0, 33, 27, 0.92), rgba(9, 74, 50, 0.82), rgba(0, 33, 27, 0.92))",
              boxShadow:
                "0 8px 18px rgba(0, 0, 0, 0.32), inset 0 1px 0 rgba(255, 255, 255, 0.12)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: pressure > 0 ? 24 : 34,
              position: "relative",
              zIndex: 2,
            }}
          >
            <div
              style={{
                width: clamp(topWinnerBannerHeight * 0.64, 72, 88),
                height: clamp(topWinnerBannerHeight * 0.64, 72, 88),
                borderRadius: "50%",
                border: `4px solid ${GOLD}`,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                background:
                  "radial-gradient(circle at 35% 25%, #fff5a8, #d39a2c 58%, #7a4d10)",
                color: "#3b2706",
                fontSize: clamp(topWinnerBannerHeight * 0.34, 42, 52),
                fontWeight: 1000,
                boxShadow:
                  "0 0 18px rgba(255, 217, 90, 0.4), inset 0 4px 8px rgba(255, 255, 255, 0.36)",
                textShadow: "0 1px 0 rgba(255, 255, 255, 0.5)",
              }}
            >
              🏆
            </div>
            <div
              style={{
                minWidth: 0,
                maxWidth: 360,
              }}
            >
              <div
                style={{
                  color: WHITE,
                  fontSize: clamp(topWinnerBannerHeight * 0.23, 30, 38),
                  fontWeight: 1000,
                  letterSpacing: "0",
                  whiteSpace: "nowrap",
                }}
              >
                TOP WINNER
              </div>
              <div
                style={{
                  color: WHITE,
                  fontSize: clamp(topWinnerBannerHeight * 0.27, 34, 44),
                  fontWeight: 1000,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {topWinner.name}
              </div>
            </div>
            <div
              style={{
                color: GREEN,
                fontSize: winnerAmountFont,
                lineHeight: 1,
                fontWeight: 1000,
                fontVariantNumeric: "tabular-nums",
                textShadow:
                  "0 4px 0 rgba(0, 0, 0, 0.48), 0 0 18px rgba(92, 241, 111, 0.22)",
                whiteSpace: "nowrap",
              }}
            >
              +{formatINR(topWinner.profitLoss)}
            </div>
          </div>
        )}

        <div
          style={{
            height: tableHeight,
            border: `2px solid ${LINE}`,
            borderRadius: 16,
            background: PANEL,
            boxShadow:
              "0 8px 18px rgba(0, 0, 0, 0.34), inset 0 1px 0 rgba(255, 255, 255, 0.08)",
            display: "grid",
            gridTemplateRows: `${sectionTitleHeight}px ${tableHeaderHeight}px 1fr`,
            overflow: "hidden",
            position: "relative",
            zIndex: 2,
            marginTop: tableTopOffset,
          }}
        >
          <SectionTitle>PROFIT / LOSS</SectionTitle>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1.25fr 1fr 1.12fr 1.2fr",
              alignItems: "center",
              padding: "0 26px",
              background: PANEL_DARK,
              borderBottom: "1px solid rgba(255, 255, 255, 0.2)",
              color: WHITE,
              fontSize: headerFont,
              fontWeight: 1000,
              textTransform: "uppercase",
            }}
          >
            <div style={{ textAlign: "center" }}>Player</div>
            <div style={{ textAlign: "center" }}>Buy-In</div>
            <div style={{ textAlign: "center" }}>Chips Left</div>
            <div style={{ textAlign: "center" }}>Profit / Loss</div>
          </div>
          <div
            style={{
              display: "grid",
              gridTemplateRows: `repeat(${playerCount}, 1fr)`,
              minHeight: 0,
            }}
          >
            {results.length === 0 ? (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: MUTED,
                  fontSize: 30,
                  fontWeight: 800,
                }}
              >
                No player results yet.
              </div>
            ) : (
              results.map((r, idx) => (
                <div
                  key={r.id}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1.25fr 1fr 1.12fr 1.2fr",
                    alignItems: "center",
                    minWidth: 0,
                    padding: "0 26px",
                    borderTop:
                      idx === 0 ? "none" : "1px solid rgba(255, 255, 255, 0.14)",
                    background:
                      idx % 2 === 1
                        ? "rgba(255, 255, 255, 0.035)"
                        : "rgba(0, 0, 0, 0.05)",
                    fontSize: rowFont,
                    fontWeight: 900,
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 12,
                      minWidth: 0,
                    }}
                  >
                    <MiniAvatar name={r.name} size={clamp(rowFont + 14, 38, 50)} />
                    <span
                      style={{
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
                      textAlign: "center",
                      fontVariantNumeric: "tabular-nums",
                      color: WHITE,
                    }}
                  >
                    {formatINR(r.totalBuyIn)}
                  </div>
                  <div
                    style={{
                      textAlign: "center",
                      fontVariantNumeric: "tabular-nums",
                      color: WHITE,
                    }}
                  >
                    {formatINR(r.chipsLeft)}
                  </div>
                  <div
                    style={{
                      textAlign: "center",
                      fontVariantNumeric: "tabular-nums",
                      color:
                        r.profitLoss > 0
                          ? GREEN
                          : r.profitLoss < 0
                            ? RED
                            : MUTED,
                    }}
                  >
                    {signedINR(r.profitLoss)}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div
          style={{
            height: settlementsHeight,
            border: `2px solid ${LINE}`,
            borderRadius: 16,
            background: PANEL,
            boxShadow:
              "0 8px 18px rgba(0, 0, 0, 0.34), inset 0 1px 0 rgba(255, 255, 255, 0.08)",
            display: "grid",
            gridTemplateRows: `${sectionTitleHeight}px 1fr`,
            overflow: "hidden",
            position: "relative",
            zIndex: 2,
          }}
        >
          <SectionTitle>SETTLEMENTS</SectionTitle>
          {settlements.length === 0 ? (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: MUTED,
                fontSize: 30,
                fontWeight: 900,
              }}
            >
              Everyone broke even. No payments needed.
            </div>
          ) : (
            <div
              style={{
                display: "grid",
                gridTemplateRows: `repeat(${settlements.length}, 1fr)`,
                minHeight: 0,
                padding: "0 34px 14px",
              }}
            >
              {settlements.map((s, idx) => (
                <div
                  key={`${s.from}-${s.to}-${s.amount}-${idx}`}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "36px minmax(0, 1fr) 66px minmax(0, 1fr) auto",
                    alignItems: "center",
                    columnGap: 16,
                    borderTop:
                      idx === 0 ? "none" : "1px solid rgba(255, 255, 255, 0.13)",
                    color: WHITE,
                    fontSize: settlementFont,
                    fontWeight: 900,
                    minWidth: 0,
                  }}
                >
                  <div
                    style={{
                      color: GOLD,
                      textAlign: "center",
                      fontSize: settlementFont + 2,
                    }}
                  >
                    •
                  </div>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                      minWidth: 0,
                    }}
                  >
                    <MiniAvatar name={s.from} size={clamp(settlementFont + 8, 30, 42)} />
                    <span
                      style={{
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {s.from}
                    </span>
                  </div>
                  <div
                    style={{
                      color: "#8ef49b",
                      fontSize: settlementFont + 12,
                      fontWeight: 1000,
                      textAlign: "center",
                      lineHeight: 1,
                    }}
                  >
                    →
                  </div>
                  <div
                    style={{
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {s.to}
                  </div>
                  <div
                    style={{
                      marginLeft: 12,
                      color: GOLD,
                      fontVariantNumeric: "tabular-nums",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {formatINR(s.amount)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div
          style={{
            height: totalPotPanelHeight,
            border: `2px solid ${LINE}`,
            borderRadius: 18,
            background:
              "linear-gradient(135deg, rgba(2, 45, 33, 0.95), rgba(8, 32, 43, 0.96), rgba(43, 20, 56, 0.9))",
            boxShadow:
              "0 8px 20px rgba(0, 0, 0, 0.38), inset 0 1px 0 rgba(255, 255, 255, 0.1)",
            display: "grid",
            gridTemplateColumns: "120px minmax(0, 1fr) auto",
            alignItems: "center",
            gap: 20,
            padding: "14px 32px",
            boxSizing: "border-box",
            position: "relative",
            zIndex: 2,
          }}
        >
          <ChipStack right={-8} bottom={-38} scale={0.55} />
          <div
            style={{
              width: clamp(totalPotPanelHeight * 0.56, 74, 90),
              height: clamp(totalPotPanelHeight * 0.56, 74, 90),
              borderRadius: "50%",
              border: `3px solid ${GOLD}`,
              background:
                "radial-gradient(circle at 35% 25%, #fff2a2, #c78d28 60%, #4b2f08)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#372405",
              fontSize: clamp(totalPotPanelHeight * 0.28, 38, 48),
              fontWeight: 1000,
              textShadow: "0 1px 0 rgba(255, 255, 255, 0.55)",
              boxShadow: "0 0 18px rgba(255, 217, 90, 0.34)",
            }}
          >
            ₹
          </div>
          <div style={{ minWidth: 0 }}>
            <div
              style={{
                color: GOLD,
                fontSize: clamp(totalPotPanelHeight * 0.2, 26, 32),
                fontWeight: 1000,
                letterSpacing: "0",
              }}
            >
              TOTAL POT
            </div>
            <div
              style={{
                marginTop: 2,
                color: WHITE,
                fontSize: clamp(totalPotPanelHeight * 0.2, 26, 32),
                fontWeight: 1000,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              SESSION TOTAL
            </div>
          </div>
          <div
            style={{
              color: GOLD,
              fontSize: clamp(totalPotPanelHeight * 0.34, 44, 56),
              fontWeight: 1000,
              fontVariantNumeric: "tabular-nums",
              whiteSpace: "nowrap",
              paddingRight: 178,
            }}
          >
            {formatINR(totalPot)}
          </div>
        </div>

        {/* Watermark — absolutely positioned so it never disturbs the layout math */}
        <div
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            bottom: 14,
            textAlign: "center",
            fontSize: 18,
            letterSpacing: "0.32em",
            color: "rgba(255, 217, 90, 0.7)",
            fontWeight: 700,
            zIndex: 3,
            pointerEvents: "none",
            textShadow: "0 1px 2px rgba(0, 0, 0, 0.5)",
          }}
        >
          pokeresh.com
        </div>
      </div>
    );
  },
);

export default SummaryCard;
