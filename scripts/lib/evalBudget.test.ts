import { describe, expect, it } from 'vitest';
import { addSpend, canAfford, emptyLedger, formatUsd, readLedger } from './evalBudget.ts';

const run = (costUsd: number) => ({
  at: '2026-11-10T12:00:00Z',
  model: 'claude-haiku-5-5',
  effort: 'low',
  costUsd,
});

describe('eval budget ledger', () => {
  it('starts empty when the file is missing or broken', () => {
    expect(readLedger(null)).toEqual(emptyLedger);
    expect(readLedger('{oops')).toEqual(emptyLedger);
  });

  it('totals recorded runs (recomputed from the runs, not trusted from the file)', () => {
    const text = JSON.stringify({ totalUsd: 999, runs: [run(0.1), run(0.25)] });
    expect(readLedger(text).totalUsd).toBeCloseTo(0.35);
  });

  it('adds spend and checks what fits in the budget', () => {
    const ledger = addSpend(addSpend(emptyLedger, run(1.5)), run(2));
    expect(ledger.totalUsd).toBe(3.5);
    expect(canAfford(ledger, 0.5, 4)).toBe(true);
    expect(canAfford(ledger, 0.51, 4)).toBe(false);
  });

  it('formats small amounts with more precision', () => {
    expect(formatUsd(0.0051)).toBe('$0.0051');
    expect(formatUsd(1.234)).toBe('$1.23');
  });
});
