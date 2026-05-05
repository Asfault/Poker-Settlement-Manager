export type SessionStatus = "setup" | "live" | "tally" | "results";

export interface BuyIn {
  id: string;
  amount: number;
  at: number;
}

export interface Player {
  id: string;
  name: string;
  buyIns: BuyIn[];
  /** Final chips left at the end of the session. `null` while not yet entered. */
  chipsLeft: number | null;
}

export interface Session {
  id: string;
  startedAt: number;
  status: SessionStatus;
  players: Player[];
}

export interface Settlement {
  from: string;
  to: string;
  amount: number;
}

export interface PlayerResult {
  id: string;
  name: string;
  totalBuyIn: number;
  chipsLeft: number;
  profitLoss: number;
}
