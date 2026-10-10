export interface BudgetStore {
  /** Atomically reserve tokens for today. Returns false when the cap would be exceeded. */
  reserve(userId: string, day: string, tokens: number, cap: number): Promise<boolean>;
  /** Replace a reservation with what was really used. Content-free. */
  settle(userId: string, day: string, task: string, reserved: number, usage: { tokensIn: number; tokensOut: number; cacheHit: boolean; fallback: boolean }): Promise<void>;
}

export const DEFAULT_DAILY_TOKEN_CAP = 60_000;

export function dailyCap(env: Record<string, string | undefined> = process.env): number {
  const n = Number(env.AI_DAILY_TOKENS_PER_USER);
  return Number.isFinite(n) && n > 0 ? n : DEFAULT_DAILY_TOKEN_CAP;
}

export function dayKey(now: Date, timeZone = 'Africa/Lagos'): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
}

export class MemoryBudget implements BudgetStore {
  used = new Map<string, number>();
  settled: Array<{ task: string; tokensIn: number; tokensOut: number; cacheHit: boolean; fallback: boolean }> = [];
  async reserve(userId: string, day: string, tokens: number, cap: number) {
    const k = `${userId}|${day}`;
    const cur = this.used.get(k) ?? 0;
    if (cur + tokens > cap) return false;
    this.used.set(k, cur + tokens);
    return true;
  }
  async settle(userId: string, day: string, task: string, reserved: number, u: { tokensIn: number; tokensOut: number; cacheHit: boolean; fallback: boolean }) {
    const k = `${userId}|${day}`;
    this.used.set(k, Math.max(0, (this.used.get(k) ?? 0) - reserved + u.tokensIn + u.tokensOut));
    this.settled.push({ task, ...u });
  }
}
