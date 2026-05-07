# Poker Settlement Manager

A clean, browser-only web app for managing poker night settlements. Track
buy-ins, validate the final chip count, calculate minimal-transaction
settlements, and export a WhatsApp-friendly summary card along with settlement instructions as PNG.

## Features

- New / resume session flow with live state persistence (localStorage — your
  data is never lost if you close the tab)
- Add players, track multiple buy-ins with quick + custom amounts
- Final chip-count tally with strict equality validation
- Profit/loss calculation
- Greedy minimal settlement instructions
- Exportable 1080×1350 dark-themed summary card (PNG)
- Indian rupee formatting throughout

## Stack

- Next.js 14 (App Router) + React 18 + TypeScript
- Tailwind CSS
- `html-to-image` for PNG export
- No backend, no database, no login

## Running locally

```bash
npm install
npm run dev
```

Open http://localhost:3000.

## Project structure

```
app/
  layout.tsx          # Root layout
  page.tsx            # Screen orchestrator (state machine)
  globals.css         # Tailwind + base styles
components/
  StartScreen.tsx
  AddPlayersScreen.tsx
  LiveSessionScreen.tsx
  SessionOverScreen.tsx
  ResultsScreen.tsx
  SummaryCard.tsx     # The 1080x1350 exportable card
  Button.tsx
  Card.tsx
lib/
  types.ts
  settlement.ts       # P/L + minimal settlement algorithm
  format.ts           # INR + date formatter
  storage.ts          # usePersistentState hook
  id.ts
```

## Settlement algorithm

The minimal-settlement function in `lib/settlement.ts`:

1. Build a list of payers (negative P/L) and receivers (positive P/L).
2. Sort both by amount, descending.
3. Repeatedly settle `min(top payer, top receiver)` until both queues are
   empty.

This produces at most `max(payers, receivers)` transactions.
