"use client";

import { useEffect, useState } from "react";
import type { Season, SeasonResult } from "@/lib/stats/season";
import { seasonRangeLabel } from "@/lib/stats/season";
import {
  addSeasonExclusion,
  removeSeasonExclusion,
  saveSeasonMeta,
} from "@/lib/db/seasons";
import Button from "@/components/Button";
import Card from "@/components/Card";
import PlayerAvatar from "@/components/host/PlayerAvatar";

/**
 * Host-only controls for one season.
 *
 * A season that turns out too thin to crown a champion isn't fixed by
 * moving its dates — that erases what happened. It's recorded: a note
 * saying why, and the no-winner switch.
 */
export default function SeasonAdmin({
  season,
  result,
  customName,
  note,
  noWinner,
  excludedPlayerIds,
  onChanged,
}: {
  season: Season;
  result: SeasonResult;
  customName: string | null;
  note: string | null;
  noWinner: boolean;
  excludedPlayerIds: string[];
  onChanged: () => Promise<void> | void;
}) {
  const [open, setOpen] = useState(false);
  const [nameDraft, setNameDraft] = useState(customName ?? "");
  const [noteDraft, setNoteDraft] = useState(note ?? "");
  const [noWinnerDraft, setNoWinnerDraft] = useState(noWinner);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Re-sync when the selected season changes underneath us.
  useEffect(() => {
    setNameDraft(customName ?? "");
    setNoteDraft(note ?? "");
    setNoWinnerDraft(noWinner);
    setSaved(false);
  }, [season.id, customName, note, noWinner]);

  const excluded = new Set(excludedPlayerIds);
  const dirty =
    nameDraft !== (customName ?? "") ||
    noteDraft !== (note ?? "") ||
    noWinnerDraft !== noWinner;

  async function save() {
    setBusy(true);
    setError(null);
    try {
      await saveSeasonMeta({
        seasonId: season.id,
        customName: nameDraft,
        note: noteDraft,
        noWinner: noWinnerDraft,
      });
      await onChanged();
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save");
    } finally {
      setBusy(false);
    }
  }

  async function toggleExclusion(playerId: string) {
    setBusy(true);
    setError(null);
    try {
      if (excluded.has(playerId)) {
        await removeSeasonExclusion(season.id, playerId);
      } else {
        await addSeasonExclusion(season.id, playerId);
      }
      await onChanged();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not update");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mb-5">
      <button
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="w-full flex items-center justify-between gap-3 min-h-[44px] text-left text-white/45 hover:text-white/70 transition-colors"
      >
        <span className="text-sm">
          Season settings
          <span className="text-white/25"> · {seasonRangeLabel(season)}</span>
        </span>
        <span className="text-xs">{open ? "Hide" : "Edit"}</span>
      </button>

      {open && (
        <Card className="p-5 mt-3">
          {error && (
            <div className="mb-4 rounded-xl border border-loss/40 bg-loss/10 px-4 py-3 text-loss text-sm">
              {error}
            </div>
          )}

          <label className="block mb-4">
            <span className="text-white/45 text-xs">Name</span>
            <input
              type="text"
              value={nameDraft}
              onChange={(e) => setNameDraft(e.target.value)}
              placeholder="Autumn 2026"
              className="w-full mt-1.5 bg-felt-900 border border-white/10 rounded-xl px-3 py-2.5 text-white placeholder:text-white/25 focus:outline-none focus:border-gold-500"
            />
            <span className="block text-white/30 text-xs mt-1.5">
              Leave blank for the default.
            </span>
          </label>

          <label className="block mb-4">
            <span className="text-white/45 text-xs">Note</span>
            <textarea
              value={noteDraft}
              onChange={(e) => setNoteDraft(e.target.value)}
              rows={2}
              placeholder="Only five games — half the table was away."
              className="w-full mt-1.5 bg-felt-900 border border-white/10 rounded-xl px-3 py-2.5 text-white placeholder:text-white/25 focus:outline-none focus:border-gold-500 resize-none"
            />
            <span className="block text-white/30 text-xs mt-1.5">
              Shown on the shared page and in the hall of fame.
            </span>
          </label>

          <button
            onClick={() => setNoWinnerDraft((v) => !v)}
            aria-pressed={noWinnerDraft}
            className={`w-full flex items-center justify-between gap-3 min-h-[48px] px-4 rounded-xl border mb-4 transition-colors ${
              noWinnerDraft
                ? "border-loss/50 bg-loss/10 text-white"
                : "border-white/10 text-white/60"
            }`}
          >
            <span className="text-sm text-left">
              No champion this season
              <span className="block text-white/35 text-xs">
                Suppresses the award whatever the standings say
              </span>
            </span>
            <span
              className={`shrink-0 w-10 h-6 rounded-full relative transition-colors ${
                noWinnerDraft ? "bg-loss" : "bg-white/15"
              }`}
            >
              <span
                className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all ${
                  noWinnerDraft ? "left-5" : "left-1"
                }`}
              />
            </span>
          </button>

          <Button onClick={save} disabled={busy || !dirty} className="w-full">
            {busy ? "Saving…" : saved ? "Saved ✓" : "Save"}
          </Button>

          {/* Disqualification. Excluded players stay in the standings —
              their results are part of everyone else's season — they're
              just barred from the award. */}
          {result.standings.length > 0 && (
            <div className="mt-5 pt-5 border-t border-white/5">
              <div className="text-white/45 text-xs mb-2">
                Eligibility
                <span className="text-white/25">
                  {" "}
                  · tap to disqualify from the award
                </span>
              </div>
              <div className="flex flex-col gap-1.5">
                {result.standings.map((s) => {
                  const isExcluded = excluded.has(s.playerId);
                  const belowBar = !isExcluded && !s.eligible;
                  return (
                    <button
                      key={s.playerId}
                      onClick={() => toggleExclusion(s.playerId)}
                      disabled={busy}
                      className={`flex items-center gap-3 px-3 min-h-[48px] rounded-xl border text-left transition-colors ${
                        isExcluded
                          ? "border-loss/40 bg-loss/10"
                          : "border-white/10"
                      }`}
                    >
                      <PlayerAvatar
                        name={s.name}
                        photoUrl={s.photoUrl}
                        size={28}
                      />
                      <span className="flex-1 min-w-0 truncate text-sm">
                        {s.name}
                      </span>
                      <span className="text-white/35 text-xs shrink-0 tabular-nums">
                        {Math.round(s.attendance * 100)}%
                      </span>
                      <span
                        className={`text-xs shrink-0 w-20 text-right ${
                          isExcluded
                            ? "text-loss"
                            : belowBar
                              ? "text-white/30"
                              : "text-win/70"
                        }`}
                      >
                        {isExcluded
                          ? "Disqualified"
                          : belowBar
                            ? "Below 65%"
                            : "Eligible"}
                      </span>
                    </button>
                  );
                })}
              </div>
              <p className="text-white/30 text-xs mt-3">
                The shared page shows only that someone isn&apos;t eligible,
                never which of these it was.
              </p>
            </div>
          )}
        </Card>
      )}
    </div>
  );
}
