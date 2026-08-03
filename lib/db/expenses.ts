"use client";

import { supabase } from "@/lib/supabase";
import type { ExpenseShare, SessionExpense } from "@/lib/expenses";

/**
 * Session expenses. Host-only, like every other table here — expenses never
 * reach the display board or the shared stats link.
 *
 * An expense is written as a row plus its shares. There's no total to keep in
 * sync, so the only way to change an amount is to change a share.
 */

interface RawShare {
  player_id: string;
  amount: number;
}

interface RawExpense {
  id: string;
  label: string;
  payer_player_id: string;
  created_at: string;
  session_expense_shares: RawShare[] | null;
}

function mapExpense(raw: RawExpense): SessionExpense {
  return {
    id: raw.id,
    label: raw.label,
    payerPlayerId: raw.payer_player_id,
    shares: (raw.session_expense_shares ?? []).map((s) => ({
      playerId: s.player_id,
      amount: s.amount,
    })),
  };
}

export async function listExpenses(
  sessionId: string,
): Promise<SessionExpense[]> {
  const { data, error } = await supabase
    .from("session_expenses")
    .select("*, session_expense_shares(player_id, amount)")
    .eq("session_id", sessionId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return ((data ?? []) as RawExpense[]).map(mapExpense);
}

export async function createExpense(input: {
  sessionId: string;
  label: string;
  payerPlayerId: string;
  shares: ExpenseShare[];
}): Promise<string> {
  const shares = input.shares.filter((s) => s.amount > 0);
  if (shares.length === 0) {
    throw new Error("An expense needs at least one person to owe something.");
  }

  const { data, error } = await supabase
    .from("session_expenses")
    .insert({
      session_id: input.sessionId,
      label: input.label.trim() || "Expense",
      payer_player_id: input.payerPlayerId,
    })
    .select()
    .single();
  if (error) throw error;

  const expenseId = (data as { id: string }).id;

  const { error: shareErr } = await supabase
    .from("session_expense_shares")
    .insert(
      shares.map((s) => ({
        expense_id: expenseId,
        player_id: s.playerId,
        amount: Math.round(s.amount),
      })),
    );
  if (shareErr) {
    // Don't leave a headless expense behind if the shares failed.
    await supabase.from("session_expenses").delete().eq("id", expenseId);
    throw shareErr;
  }

  return expenseId;
}

export async function updateExpense(input: {
  expenseId: string;
  label: string;
  payerPlayerId: string;
  shares: ExpenseShare[];
}): Promise<void> {
  const shares = input.shares.filter((s) => s.amount > 0);
  if (shares.length === 0) {
    throw new Error("An expense needs at least one person to owe something.");
  }

  const { error } = await supabase
    .from("session_expenses")
    .update({
      label: input.label.trim() || "Expense",
      payer_player_id: input.payerPlayerId,
    })
    .eq("id", input.expenseId);
  if (error) throw error;

  // Replace the shares wholesale — simpler than diffing, and the set is tiny.
  const { error: delErr } = await supabase
    .from("session_expense_shares")
    .delete()
    .eq("expense_id", input.expenseId);
  if (delErr) throw delErr;

  const { error: insErr } = await supabase
    .from("session_expense_shares")
    .insert(
      shares.map((s) => ({
        expense_id: input.expenseId,
        player_id: s.playerId,
        amount: Math.round(s.amount),
      })),
    );
  if (insErr) throw insErr;
}

export async function deleteExpense(expenseId: string): Promise<void> {
  // Shares cascade.
  const { error } = await supabase
    .from("session_expenses")
    .delete()
    .eq("id", expenseId);
  if (error) throw error;
}
