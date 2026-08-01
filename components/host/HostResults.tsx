"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toPng } from "html-to-image";
import { LoadedSession, sumBuyIns } from "@/lib/db/sessions";
import { computeNetRows, settleNet, totalHouseFee } from "@/lib/houseFee";
import { formatDateTime, formatDuration, formatINR } from "@/lib/format";
import Button from "@/components/Button";
import Card from "@/components/Card";
import SummaryCard from "@/components/SummaryCard";
import PlayerAvatar from "./PlayerAvatar";

const W = 1080;
const H = 1920;

export default function HostResults({
  data,
  onReopen,
}: {
  data: LoadedSession;
  onReopen: () => void;
}) {
  const router = useRouter();
  const { session, players } = data;

  const summaryRef = useRef<HTMLDivElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

  const { rows, settlements, pot, feeTotal } = useMemo(() => {
    const r = computeNetRows(
      players.map((p) => ({
        playerId: p.player_id,
        name: p.display_name,
        totalBuyIn: sumBuyIns(p),
        chipsLeft: p.chips_left ?? 0,
        paysHouseFee: p.pays_house_fee,
      })),
      session.house_fee_per_player,
      session.host_player_id,
    );
    return {
      rows: r,
      settlements: settleNet(r),
      pot: r.reduce((s, x) => s + x.totalBuyIn, 0),
      feeTotal: totalHouseFee(r),
    };
  }, [players, session.house_fee_per_player, session.host_player_id]);

  // Scale the export preview to fit its container.
  useEffect(() => {
    const wrap = wrapRef.current;
    const inner = innerRef.current;
    if (!wrap || !inner) return;
    const update = () =>
      inner.style.setProperty("--preview-scale", String(wrap.clientWidth / W));
    update();
    const obs = new ResizeObserver(update);
    obs.observe(wrap);
    return () => obs.disconnect();
  }, []);

  // SummaryCard expects PlayerResult-shaped rows — poker numbers only.
  const summaryResults = rows.map((r) => ({
    id: r.playerId,
    name: r.name,
    totalBuyIn: r.totalBuyIn,
    chipsLeft: r.chipsLeft,
    profitLoss: r.profitLoss,
  }));

  async function exportPng() {
    if (!summaryRef.current) return;
    setExporting(true);
    setExportError(null);
    try {
      const dataUrl = await toPng(summaryRef.current, {
        width: W,
        height: H,
        pixelRatio: 1,
        cacheBust: true,
        style: { transform: "none", width: `${W}px`, height: `${H}px` },
      });
      const date = new Date(session.started_at).toISOString().slice(0, 10);
      const filename = `poker-night-${date}.png`;
      const blob = await (await fetch(dataUrl)).blob();
      const file = new File([blob], filename, { type: "image/png" });

      const canShare =
        typeof navigator !== "undefined" &&
        typeof navigator.canShare === "function" &&
        navigator.canShare({ files: [file] });

      if (canShare) {
        try {
          await navigator.share({ files: [file] });
          return;
        } catch (err) {
          if ((err as DOMException)?.name === "AbortError") return;
        }
      }

      const objectUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.download = filename;
      link.href = objectUrl;
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(objectUrl), 1500);
    } catch (err) {
      setExportError(err instanceof Error ? err.message : "Export failed");
    } finally {
      setExporting(false);
    }
  }

  function copySettlements() {
    const text =
      settlements.length === 0
        ? "Everyone broke even. No payments needed."
        : settlements
            .map((s) => `${s.from} pays ${s.to} ${formatINR(s.amount)}`)
            .join("\n");
    navigator.clipboard?.writeText(text).catch(() => {});
  }

  return (
    <div className="px-4 py-6 pb-32">
      <div className="max-w-2xl mx-auto">
        <header className="mb-4">
          <h1 className="text-xl font-bold">Results</h1>
          <p className="text-white/50 text-sm">
            Pot {formatINR(pot)}
            {feeTotal > 0 && ` · ${formatINR(feeTotal)} house fee`}
          </p>
          <p className="text-white/35 text-xs mt-0.5">
            {formatDateTime(new Date(session.started_at).getTime())}
            {session.ended_at &&
              ` · played for ${formatDuration(
                new Date(session.started_at).getTime(),
                new Date(session.ended_at).getTime(),
              )}`}
          </p>
        </header>

        {/* Poker-only P/L */}
        <Card className="overflow-hidden mb-2">
          <div className="px-4 py-2.5 bg-felt-700/60 text-xs uppercase tracking-wide text-white/60">
            Poker profit / loss
          </div>
          <table className="w-full">
            <thead>
              <tr className="text-xs uppercase tracking-wide text-white/45 border-b border-white/5">
                <th className="text-left py-2 px-4 font-medium">Player</th>
                <th className="text-right py-2 px-3 font-medium">Buy-ins</th>
                <th className="text-right py-2 px-3 font-medium">Chips</th>
                <th className="text-right py-2 px-4 font-medium">P/L</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.playerId} className="border-t border-white/5">
                  <td className="py-3 px-4 font-medium truncate">{r.name}</td>
                  <td className="py-3 px-3 text-right tabular-nums text-gold-400">
                    {formatINR(r.totalBuyIn)}
                  </td>
                  <td className="py-3 px-3 text-right tabular-nums">
                    {formatINR(r.chipsLeft)}
                  </td>
                  <td
                    className={`py-3 px-4 text-right tabular-nums font-bold ${
                      r.profitLoss > 0
                        ? "text-win"
                        : r.profitLoss < 0
                          ? "text-loss"
                          : "text-white/60"
                    }`}
                  >
                    {r.profitLoss > 0 ? "+" : ""}
                    {formatINR(r.profitLoss)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
        <p className="text-white/35 text-xs mb-5 px-1">
          Cards only. This is what lifetime stats are built from.
        </p>

        {/* Net breakdown, only when a fee applies */}
        {feeTotal > 0 && (
          <Card className="overflow-hidden mb-5">
            <div className="px-4 py-2.5 bg-felt-700/60 text-xs uppercase tracking-wide text-white/60">
              With house fee
            </div>
            <table className="w-full">
              <thead>
                <tr className="text-xs uppercase tracking-wide text-white/45 border-b border-white/5">
                  <th className="text-left py-2 px-4 font-medium">Player</th>
                  <th className="text-right py-2 px-3 font-medium">P/L</th>
                  <th className="text-right py-2 px-3 font-medium">Fee</th>
                  <th className="text-right py-2 px-4 font-medium">Net</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const feeDelta = r.houseFeeReceived - r.houseFeeOwed;
                  return (
                    <tr key={r.playerId} className="border-t border-white/5">
                      <td className="py-3 px-4 font-medium truncate">
                        {r.name}
                      </td>
                      <td className="py-3 px-3 text-right tabular-nums text-white/70">
                        {r.profitLoss > 0 ? "+" : ""}
                        {formatINR(r.profitLoss)}
                      </td>
                      <td
                        className={`py-3 px-3 text-right tabular-nums ${
                          feeDelta > 0
                            ? "text-win"
                            : feeDelta < 0
                              ? "text-loss/80"
                              : "text-white/40"
                        }`}
                      >
                        {feeDelta > 0 ? "+" : ""}
                        {formatINR(feeDelta)}
                      </td>
                      <td
                        className={`py-3 px-4 text-right tabular-nums font-bold ${
                          r.net > 0
                            ? "text-win"
                            : r.net < 0
                              ? "text-loss"
                              : "text-white/60"
                        }`}
                      >
                        {r.net > 0 ? "+" : ""}
                        {formatINR(r.net)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </Card>
        )}

        {/* Settlements */}
        <Card className="p-5 mb-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm uppercase tracking-wide text-white/50">
              Settlements
            </h2>
            {settlements.length > 0 && (
              <button
                onClick={copySettlements}
                className="text-xs text-white/60 hover:text-white"
              >
                Copy
              </button>
            )}
          </div>
          {settlements.length === 0 ? (
            <p className="text-white/60 text-sm">
              Everyone broke even. No payments needed.
            </p>
          ) : (
            <ul className="space-y-2">
              {settlements.map((s, i) => (
                <li
                  key={i}
                  className="flex items-center gap-3 py-2 border-b border-white/5 last:border-b-0"
                >
                  <span className="text-loss font-semibold truncate">
                    {s.from}
                  </span>
                  <span className="text-white/40 text-sm shrink-0">pays</span>
                  <span className="text-win font-semibold truncate">
                    {s.to}
                  </span>
                  <span className="ml-auto text-gold-400 font-bold tabular-nums shrink-0">
                    {formatINR(s.amount)}
                  </span>
                </li>
              ))}
            </ul>
          )}
          {feeTotal > 0 && (
            <p className="text-white/35 text-xs mt-3">
              Includes the {formatINR(session.house_fee_per_player)} house fee.
            </p>
          )}
        </Card>

        {/* Export */}
        <Card className="p-5 mb-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm uppercase tracking-wide text-white/50">
              Summary image
            </h2>
            <Button size="sm" onClick={exportPng} disabled={exporting}>
              {exporting ? "Preparing…" : "Save / Share PNG"}
            </Button>
          </div>
          <div
            ref={wrapRef}
            style={{
              width: "100%",
              maxWidth: 360,
              margin: "0 auto",
              aspectRatio: "1080 / 1920",
              overflow: "hidden",
              borderRadius: 16,
              border: "1px solid rgba(255,255,255,0.08)",
              position: "relative",
            }}
          >
            <div
              ref={innerRef}
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                width: W,
                height: H,
                transform: "scale(var(--preview-scale, 0.33))",
                transformOrigin: "top left",
              }}
            >
              <SummaryCard
                ref={summaryRef}
                startedAt={new Date(session.started_at).getTime()}
                results={summaryResults}
                settlements={settlements}
                totalPot={pot}
              />
            </div>
          </div>
          {exportError && (
            <div className="mt-3 rounded-lg border border-loss/40 bg-loss/10 px-3 py-2 text-loss text-xs">
              {exportError}
            </div>
          )}
        </Card>
      </div>

      <div className="fixed bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-felt-900 via-felt-900/95 to-transparent">
        <div className="max-w-2xl mx-auto flex gap-2">
          <Button size="lg" variant="secondary" onClick={onReopen}>
            Edit chips
          </Button>
          <Button
            size="lg"
            className="flex-1"
            onClick={() => router.push("/host")}
          >
            Done
          </Button>
        </div>
      </div>
    </div>
  );
}
