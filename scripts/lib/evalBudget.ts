/** Spending ledger for eval runs (eval-results/spend.json). Pure helpers. */

export interface SpendRecord {
  readonly at: string;
  readonly model: string;
  readonly effort: string;
  readonly costUsd: number;
}

export interface Ledger {
  readonly totalUsd: number;
  readonly runs: readonly SpendRecord[];
}

export const emptyLedger: Ledger = { totalUsd: 0, runs: [] };

/** Reads the ledger file's text; a missing or broken file counts as nothing spent. */
export function readLedger(text: string | null): Ledger {
  if (!text) return emptyLedger;
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    return emptyLedger;
  }
  const items: unknown[] =
    typeof value === 'object' && value !== null && Array.isArray((value as { runs?: unknown }).runs)
      ? (value as { runs: unknown[] }).runs
      : [];
  const runs = items.filter(isRecord);
  const totalUsd = runs.reduce((sum, run) => sum + run.costUsd, 0);
  return { totalUsd, runs };
}

function isRecord(item: unknown): item is SpendRecord {
  if (typeof item !== 'object' || item === null) return false;
  const record = item as Record<string, unknown>;
  return (
    typeof record.costUsd === 'number' &&
    Number.isFinite(record.costUsd) &&
    typeof record.model === 'string' &&
    typeof record.effort === 'string' &&
    typeof record.at === 'string'
  );
}

export function addSpend(ledger: Ledger, record: SpendRecord): Ledger {
  return { totalUsd: ledger.totalUsd + record.costUsd, runs: [...ledger.runs, record] };
}

/** Whether a run estimated at `estimateUsd` fits in what's left of the budget. */
export function canAfford(ledger: Ledger, estimateUsd: number, budgetUsd: number): boolean {
  return ledger.totalUsd + estimateUsd <= budgetUsd + 1e-9;
}

export function formatUsd(amount: number): string {
  return `$${amount.toFixed(amount < 0.1 ? 4 : 2)}`;
}
