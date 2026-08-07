"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { toPng } from "html-to-image";
import type { Session } from "@/lib/types";
import { formatINR } from "@/lib/format";
import {
  biggestWinner as biggestWinnerOf,
  calculateSettlements,
  computeResults,
} from "@/lib/settlement";
import { shareCompletedSession } from "@/lib/db/shared";
import Button from "./Button";
import Card from "./Card";
import SummaryCard from "./SummaryCard";

export default function ResultsScreen({
  session,
  onNewSession,
}: {
  session: Session;
  onNewSession: () => void;
}) {
  const summaryRef = useRef<HTMLDivElement>(null);
  const previewWrapperRef = useRef<HTMLDivElement>(null);
  const previewInnerRef = useRef<HTMLDivElement>(null);
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

  // Copy the finished session up so the app's author can see how it's
  // being used. Fire-and-forget — never blocks or interrupts anything.
  useEffect(() => {
    shareCompletedSession(session);
    // Only once per session.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session.id]);

  // Keep the scaled preview fitting its wrapper width.
  useEffect(() => {
    const wrapper = previewWrapperRef.current;
    const inner = previewInnerRef.current;
    if (!wrapper || !inner) return;
    const update = () => {
      const scale = wrapper.clientWidth / 1080;
      inner.style.setProperty("--preview-scale", String(scale));
    };
    update();
    const obs = new ResizeObserver(update);
    obs.observe(wrapper);
    return () => obs.disconnect();
  }, []);

  const SUMMARY_WIDTH = 1080;
  const SUMMARY_HEIGHT = 1920;

  const { results, settlements, totalPot, winner } = useMemo(() => {
    const r = computeResults(session.players);
    const s = calculateSettlements(r);
    const pot = r.reduce((sum, x) => sum + x.totalBuyIn, 0);
    return {
      results: r,
      settlements: s,
      totalPot: pot,
      winner: biggestWinnerOf(r),
    };
  }, [session.players]);

  async function exportPng() {
    if (!summaryRef.current) return;
    setExporting(true);
    setExportError(null);
    try {
      const dataUrl = await toPng(summaryRef.current, {
        width: SUMMARY_WIDTH,
        height: SUMMARY_HEIGHT,
        pixelRatio: 1,
        cacheBust: true,
        // Override any display-time transforms applied by the preview wrapper.
        style: {
          transform: "none",
          width: `${SUMMARY_WIDTH}px`,
          height: `${SUMMARY_HEIGHT}px`,
        },
      });

      const date = new Date(session.startedAt).toISOString().slice(0, 10);
      const filename = `poker-night-${date}.png`;

      // Turn the data URL into a real File so it can either be shared via
      // the iOS/Android system share sheet or downloaded on desktop.
      const blob = await (await fetch(dataUrl)).blob();
      const file = new File([blob], filename, { type: "image/png" });

      // Prefer Web Share API on mobile — iOS Safari blocks `<a download>` for
      // data URLs post iOS 17, but supports navigator.share with files.
      const canShareFiles =
        typeof navigator !== "undefined" &&
        typeof navigator.canShare === "function" &&
        navigator.canShare({ files: [file] });

      if (canShareFiles) {
        try {
          // Only pass `files` — omitting `title` / `text` avoids WhatsApp
          // pre-filling the message caption with the app title.
          await navigator.share({ files: [file] });
          return;
        } catch (err) {
          // User cancelled the share sheet — don't fall through to download.
          if ((err as DOMException)?.name === "AbortError") return;
          // Any other share failure: fall through to the download fallback.
        }
      }

      // Fallback: object URL + <a download>. Works on desktop browsers.
      const objectUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.download = filename;
      link.href = objectUrl;
      link.rel = "noopener";
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(objectUrl), 1500);
    } catch (err) {
      setExportError(
        err instanceof Error ? err.message : "Failed to export image",
      );
    } finally {
      setExporting(false);
    }
  }

  function copySettlements() {
    const lines = settlements.map(
      (s) => `${s.from} pays ${s.to} ${formatINR(s.amount)}`,
    );
    const text =
      lines.length === 0
        ? "Everyone broke even. No payments needed."
        : lines.join("\n");
    navigator.clipboard?.writeText(text).catch(() => {
      // ignore clipboard failures
    });
  }

  return (
    <div className="min-h-screen px-4 py-6 sm:py-10 pb-32">
      <div className="max-w-2xl mx-auto">
        <header className="mb-5">
          <h1 className="text-xl font-bold">Results</h1>
          <p className="text-white/50 text-sm">
            Total pot: {formatINR(totalPot)}
          </p>
        </header>

        {/* Results table */}
        <Card className="overflow-hidden mb-5">
          <table className="w-full">
            <thead>
              <tr className="bg-felt-700/60 text-xs uppercase tracking-wide text-white/60">
                <th className="text-left py-3 px-4">Player</th>
                <th className="text-right py-3 px-3">Buy-ins</th>
                <th className="text-right py-3 px-3">Chips Left</th>
                <th className="text-right py-3 px-4">P/L</th>
              </tr>
            </thead>
            <tbody>
              {results.map((r) => (
                <tr key={r.id} className="border-t border-white/5">
                  <td className="py-3 px-4 font-medium">{r.name}</td>
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

        {/* Settlement instructions */}
        <Card className="p-5 mb-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm uppercase tracking-wide text-white/50">
              Settlement Instructions
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
              {settlements.map((s, idx) => (
                <li
                  key={idx}
                  className="flex items-center gap-3 py-2 border-b border-white/5 last:border-b-0"
                >
                  <span className="text-loss font-semibold">{s.from}</span>
                  <span className="text-white/40 text-sm">pays</span>
                  <span className="text-win font-semibold">{s.to}</span>
                  <span className="ml-auto text-gold-400 font-bold tabular-nums">
                    {formatINR(s.amount)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>

        {/* Export preview */}
        <Card className="p-5 mb-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm uppercase tracking-wide text-white/50">
              Game Summary Image
            </h2>
            <Button
              size="sm"
              onClick={exportPng}
              disabled={exporting}
            >
              {exporting ? "Preparing…" : "Save / Share PNG"}
            </Button>
          </div>
          <p className="text-white/50 text-xs mb-3">
            1080 × 1920 — preview is scaled to fit.
          </p>

          {/* Scaled preview wrapper. The inner card stays at its natural
              1080x1920 size for export. */}
          <div
            ref={previewWrapperRef}
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
              ref={previewInnerRef}
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                width: SUMMARY_WIDTH,
                height: SUMMARY_HEIGHT,
                transform: "scale(var(--preview-scale, 0.33))",
                transformOrigin: "top left",
              }}
            >
              <SummaryCard
                ref={summaryRef}
                startedAt={session.startedAt}
                results={results}
                settlements={settlements}
                totalPot={totalPot}
                biggestWinner={winner}
                buyInsByPlayer={Object.fromEntries(
                  session.players.map((p) => [
                    p.id,
                    p.buyIns.map((b) => b.amount),
                  ]),
                )}
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

      <div className="fixed bottom-0 left-0 right-0 p-4 pb-safe-4 bg-gradient-to-t from-felt-900 via-felt-900/95 to-transparent">
        <div className="max-w-2xl mx-auto">
          <Button
            size="lg"
            variant="secondary"
            onClick={onNewSession}
            className="w-full"
          >
            Start New Session
          </Button>
        </div>
      </div>
    </div>
  );
}
