/**
 * Measures the image parser's accuracy and cost on the sample puzzle (or any
 * image with a hand-made transcription). Calls the real Claude API: it costs
 * money, so it shows an estimate and needs --yes.
 *
 * Start with the cheapest settings and step up only if accuracy needs it:
 *   npm run eval:parse -- --yes                                      (Haiku 5.5, low)
 *   npm run eval:parse -- --yes --model claude-sonnet-5-5 --effort medium
 *   npm run eval:parse -- --yes --model claude-opus-5-5 --effort high --runs 2
 *
 * Every run's actual cost (from token usage) goes into eval-results/spend.json;
 * a run that could take the total past --budget is refused.
 *
 * Options:
 *   --runs N        repeat N times (default 1)
 *   --model M       claude-haiku-5-5 (default) | claude-sonnet-5-5 | claude-opus-5-5
 *   --effort E      low (default) | medium | high
 *   --budget USD    total allowed across all eval runs so far (default 4.00)
 *   --max-edge PX   shrink the image so its long edge is at most PX first (default: as is)
 *   --image PATH    default samples/puzzles/diplo-crostic-37.jpg
 *   --truth PATH    puzzle file to compare against (default: that sample, as printed)
 *   --yes           actually call the API
 *
 * Reads ANTHROPIC_API_KEY from the environment or apps/worker/.dev.vars.
 * Writes full results to eval-results/ (git-ignored). Run through npm: it's
 * bundled with esbuild first so the workspace packages resolve.
 */
import {
  anthropicSender,
  estimateParseCostUsd,
  isEffort,
  MODELS,
  parsePuzzleImage,
  type ImageMediaType,
} from '@acrosticle/parser';
import { PuzzleFile, validateWith } from '@acrosticle/protocol';
import Anthropic from '@anthropic-ai/sdk';
import { chromium } from '@playwright/test';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { extname, resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { addSpend, canAfford, formatUsd, readLedger } from './lib/evalBudget.ts';
import { scoreParse, type Score } from './lib/evalScore.ts';
import { parseDevVars } from './lib/signinConfig.ts';

// npm runs scripts from the repo root (the bundled copy of this file lives elsewhere).
const ROOT = process.cwd();
const SAMPLE = resolve(ROOT, 'samples/puzzles/diplo-crostic-37');
const RESULTS = resolve(ROOT, 'eval-results');
const LEDGER = resolve(RESULTS, 'spend.json');
const EFFORTS = ['low', 'medium', 'high'];

const MEDIA_TYPES: Record<string, ImageMediaType> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
};

const { values } = parseArgs({
  options: {
    runs: { type: 'string', default: '1' },
    model: { type: 'string', default: 'claude-haiku-5-5' },
    effort: { type: 'string', default: 'low' },
    budget: { type: 'string', default: '4.00' },
    'max-edge': { type: 'string' },
    image: { type: 'string', default: `${SAMPLE}.jpg` },
    truth: { type: 'string' },
    yes: { type: 'boolean', default: false },
  },
});

/** The sample as printed (with its misprint put back): the parser should transcribe exactly. */
function samplePrinted(): PuzzleFile {
  const sample = JSON.parse(readFileSync(`${SAMPLE}.json`, 'utf8')) as PuzzleFile & {
    errata?: { corrected: string; printed: string }[];
  };
  const rows = sample.grid.rows.map((row) =>
    (sample.errata ?? []).reduce(
      (r, e) => r.replace(new RegExp(`\\b${e.corrected}\\b`), e.printed),
      row,
    ),
  );
  return { ...sample, grid: { ...sample.grid, rows } };
}

function loadTruth(): PuzzleFile {
  if (!values.truth) return samplePrinted();
  const parsed = validateWith(PuzzleFile, JSON.parse(readFileSync(values.truth, 'utf8')));
  if (!parsed.ok) throw new Error(`--truth isn't a puzzle file: ${parsed.error}`);
  return parsed.value;
}

function apiKey(): string {
  if (process.env.ANTHROPIC_API_KEY) return process.env.ANTHROPIC_API_KEY;
  const devVars = resolve(ROOT, 'apps/worker/.dev.vars');
  const key = existsSync(devVars)
    ? parseDevVars(readFileSync(devVars, 'utf8')).get('ANTHROPIC_API_KEY')
    : undefined;
  if (!key) throw new Error('No ANTHROPIC_API_KEY. Run: npm run setup:claude');
  return key;
}

/** Shrinks an image in headless Chromium (no extra image libraries needed). */
async function shrink(bytes: Buffer, mediaType: ImageMediaType, maxEdge: number): Promise<Buffer> {
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    const dataUrl = await page.evaluate(
      async ({ src, max }) => {
        const image = new Image();
        image.src = src;
        await image.decode();
        const scale = Math.min(1, max / Math.max(image.width, image.height));
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(image.width * scale);
        canvas.height = Math.round(image.height * scale);
        canvas.getContext('2d')?.drawImage(image, 0, 0, canvas.width, canvas.height);
        return canvas.toDataURL('image/jpeg', 0.9);
      },
      { src: `data:${mediaType};base64,${bytes.toString('base64')}`, max: maxEdge },
    );
    return Buffer.from(dataUrl.split(',')[1] ?? '', 'base64');
  } finally {
    await browser.close();
  }
}

const pct = (n: number) => `${(n * 100).toFixed(1)}%`;

interface RunResult {
  readonly run: number;
  readonly ok: boolean;
  readonly message?: string;
  readonly score?: Score;
  readonly issues?: number;
  readonly notes?: readonly string[];
  readonly costUsd: number | null;
  readonly durationMs: number | null;
  readonly usage: unknown;
}

async function main(): Promise<void> {
  const runs = Math.max(1, Number(values.runs) || 1);
  const budget = Number(values.budget);
  const { model, effort } = values;
  if (!(MODELS as readonly string[]).includes(model)) {
    throw new Error(`--model must be one of: ${MODELS.join(', ')}`);
  }
  if (!isEffort(effort) || !EFFORTS.includes(effort)) {
    throw new Error(`--effort must be one of: ${EFFORTS.join(', ')}`);
  }
  if (!Number.isFinite(budget) || budget <= 0)
    throw new Error('--budget must be a positive number');
  const estimate = estimateParseCostUsd(model, effort);
  if (estimate === null) throw new Error(`No price for ${model} in the parser's pricing table`);

  const truth = loadTruth();
  const mediaType = MEDIA_TYPES[extname(values.image).toLowerCase()];
  if (!mediaType) throw new Error(`Unsupported image type: ${values.image}`);
  const original = readFileSync(values.image);
  const bytes = values['max-edge']
    ? await shrink(original, mediaType, Number(values['max-edge']))
    : original;
  const sentType: ImageMediaType = values['max-edge'] ? 'image/jpeg' : mediaType;

  let ledger = readLedger(existsSync(LEDGER) ? readFileSync(LEDGER, 'utf8') : null);
  const left = () => formatUsd(Math.max(0, budget - ledger.totalUsd));
  console.log(
    `Image:  ${values.image} (${(bytes.length / 1024).toFixed(0)} KB${values['max-edge'] ? `, max edge ${values['max-edge']} px` : ''})`,
  );
  console.log(`Model:  ${model}, effort ${effort}, ${runs} run(s)`);
  console.log(
    `Estimated cost: up to about ${formatUsd(estimate)} per run (${formatUsd(estimate * runs)} for ${runs}).`,
  );
  console.log(
    `Budget: ${formatUsd(ledger.totalUsd)} spent of ${formatUsd(budget)} (${left()} left).`,
  );
  if (!values.yes) {
    console.log('\nNothing sent. Add --yes to call the API.');
    return;
  }

  const send = anthropicSender(new Anthropic({ apiKey: apiKey() }));
  const results: RunResult[] = [];
  mkdirSync(RESULTS, { recursive: true });

  for (let run = 1; run <= runs; run++) {
    if (!canAfford(ledger, estimate, budget)) {
      console.log(
        `\nStopping: another run (up to ${formatUsd(estimate)}) could pass the ${formatUsd(budget)} budget.`,
      );
      break;
    }
    process.stdout.write(`\nRun ${run}/${runs}… `);
    const outcome = await parsePuzzleImage(
      send,
      { data: bytes.toString('base64'), mediaType: sentType },
      { model, effort },
    );
    // Record the actual spend right away (the estimate if the price is unknown), so
    // it counts even if a later run crashes.
    ledger = addSpend(ledger, {
      at: new Date().toISOString(),
      model,
      effort,
      costUsd: outcome.costUsd ?? (outcome.usage ? estimate : 0),
    });
    writeFileSync(LEDGER, JSON.stringify(ledger, null, 2));
    const spent = `Spent ${formatUsd(ledger.totalUsd)} of ${formatUsd(budget)} (${left()} left).`;

    const common = {
      run,
      costUsd: outcome.costUsd ?? null,
      durationMs: outcome.durationMs ?? null,
      usage: outcome.usage,
    };
    if (!outcome.ok) {
      console.log(`failed (${outcome.reason}): ${outcome.message} ${spent}`);
      results.push({ ...common, ok: false, message: outcome.message });
      continue;
    }
    console.log(`done. ${spent}`);
    results.push({
      ...common,
      ok: true,
      score: scoreParse(outcome.file, truth),
      issues: outcome.issues.length,
      notes: outcome.notes,
    });
  }

  console.log(
    '\nrun | square #s | labels | blanks | clue text | issues | tokens in/out | cost   | time',
  );
  for (const r of results) {
    const usage = r.usage as { inputTokens?: number; outputTokens?: number } | undefined;
    const tokens = `${usage?.inputTokens ?? '-'}/${usage?.outputTokens ?? '-'}`;
    const cost = r.costUsd === null ? '-' : formatUsd(r.costUsd);
    const time = r.durationMs === null ? '-' : `${(r.durationMs / 1000).toFixed(0)}s`;
    if (!r.score) {
      console.log(`${r.run}   | failed: ${r.message ?? ''} | ${tokens} | ${cost} | ${time}`);
      continue;
    }
    console.log(
      `${r.run}   | ${pct(r.score.squareNumbers)}     | ${pct(r.score.squareLabels)} | ${pct(r.score.clueBlanks)} | ${pct(r.score.clueText)}    | ${r.issues ?? 0}      | ${tokens} | ${cost} | ${time}`,
    );
  }
  console.log(
    `\nBudget: ${formatUsd(ledger.totalUsd)} spent of ${formatUsd(budget)} (${left()} left).`,
  );

  const file = resolve(RESULTS, `parse-${new Date().toISOString().replace(/[:.]/g, '-')}.json`);
  writeFileSync(file, JSON.stringify({ options: { ...values, runs }, results }, null, 2));
  console.log(`Details: ${file}`);
}

main().catch((error: unknown) => {
  console.error(`\n✖ ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});
