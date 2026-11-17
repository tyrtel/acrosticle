/**
 * Measures how well Claude reads crossword photos, against local answer keys.
 *
 *   npm run eval:crossword                       # shows the plan and cost, sends nothing
 *   npm run eval:crossword -- --yes              # reads every sample once
 *   npm run eval:crossword -- --yes --model claude-sonnet-5-5 --effort medium --only crossword1
 *
 * Samples are images in samples/crosswords/ with an answer key beside each
 * (`<name>.truth.json`, see scripts/lib/crosswordScore.ts). That folder is
 * git-ignored: published puzzles are copyrighted, so they stay local.
 *
 * Reads ANTHROPIC_API_KEY from the environment or apps/worker/.dev.vars, and
 * keeps total spend under --budget (shared ledger in eval-results/spend.json).
 */
import { clueNumberFit, crosswordFromFile } from '@gridicles/crossword';
import {
  anthropicSender,
  estimateParseCostUsd,
  isEffort,
  MODELS,
  parseCrosswordImage,
  type ImageMediaType,
} from '@gridicles/parser';
import Anthropic from '@anthropic-ai/sdk';
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, extname, resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { scoreCrossword, type CrosswordScore, type CrosswordTruth } from './lib/crosswordScore.ts';
import { addSpend, canAfford, formatUsd, readLedger } from './lib/evalBudget.ts';
import { parseDevVars } from './lib/signinConfig.ts';

const ROOT = process.cwd();
const SAMPLES = resolve(ROOT, 'samples/crosswords');
const RESULTS = resolve(ROOT, 'eval-results');
const LEDGER = resolve(RESULTS, 'spend.json');
const MEDIA_TYPES: Record<string, ImageMediaType> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
};

const { values } = parseArgs({
  options: {
    model: { type: 'string', default: 'claude-haiku-5-5' },
    effort: { type: 'string', default: 'medium' },
    budget: { type: 'string', default: '4.00' },
    only: { type: 'string' },
    // Like the server: read again with this model when the grid doesn't fit the clue numbers.
    'second-look': { type: 'string', default: 'claude-opus-5-5' },
    yes: { type: 'boolean', default: false },
  },
});

function apiKey(): string {
  if (process.env.ANTHROPIC_API_KEY) return process.env.ANTHROPIC_API_KEY;
  const devVars = resolve(ROOT, 'apps/worker/.dev.vars');
  const key = existsSync(devVars)
    ? parseDevVars(readFileSync(devVars, 'utf8')).get('ANTHROPIC_API_KEY')
    : undefined;
  if (!key) throw new Error('No ANTHROPIC_API_KEY. Run: npm run setup:claude');
  return key;
}

interface Sample {
  readonly name: string;
  readonly image: string;
  readonly mediaType: ImageMediaType;
  readonly truth: CrosswordTruth;
}

function samples(): Sample[] {
  if (!existsSync(SAMPLES)) return [];
  return readdirSync(SAMPLES).flatMap((file) => {
    const mediaType = MEDIA_TYPES[extname(file).toLowerCase()];
    const name = basename(file, extname(file));
    const truthFile = resolve(SAMPLES, `${name}.truth.json`);
    if (!mediaType || !existsSync(truthFile)) return [];
    if (values.only && values.only !== name) return [];
    return [
      {
        name,
        image: resolve(SAMPLES, file),
        mediaType,
        truth: JSON.parse(readFileSync(truthFile, 'utf8')) as CrosswordTruth,
      },
    ];
  });
}

const pct = (n: number | null) => (n === null ? '   –  ' : `${(n * 100).toFixed(1).padStart(5)}%`);

async function main(): Promise<void> {
  const { model, effort } = values;
  const budget = Number(values.budget);
  if (!(MODELS as readonly string[]).includes(model)) {
    throw new Error(`--model must be one of: ${MODELS.join(', ')}`);
  }
  if (!isEffort(effort)) throw new Error('--effort must be low, medium, high, xhigh or max');
  const estimate = estimateParseCostUsd(model, effort);
  if (estimate === null) throw new Error(`No price for ${model} in the parser's pricing table`);

  const list = samples();
  if (list.length === 0) throw new Error(`No samples with answer keys in ${SAMPLES}`);
  let ledger = readLedger(existsSync(LEDGER) ? readFileSync(LEDGER, 'utf8') : null);
  console.log(`Samples: ${list.map((s) => s.name).join(', ')}`);
  console.log(`Model:   ${model}, effort ${effort}`);
  console.log(`Estimate: up to about ${formatUsd(estimate * list.length)}.`);
  console.log(`Budget:  ${formatUsd(ledger.totalUsd)} spent of ${formatUsd(budget)}.`);
  if (!values.yes) {
    console.log('\nNothing sent. Add --yes to call the API.');
    return;
  }

  const send = anthropicSender(new Anthropic({ apiKey: apiKey() }));
  mkdirSync(RESULTS, { recursive: true });
  const results: {
    name: string;
    score?: CrosswordScore;
    error?: string;
    notes?: readonly string[];
    file?: unknown;
    costUsd: number | null;
    durationMs: number | null;
  }[] = [];

  console.log('\nSample              size  style  squares  numbering  clues    cost     time');
  for (const sample of list) {
    if (!canAfford(ledger, estimate, budget)) {
      console.log(`Stopping: the next read could pass the ${formatUsd(budget)} budget.`);
      break;
    }
    const image = {
      data: readFileSync(sample.image).toString('base64'),
      mediaType: sample.mediaType,
    };
    const first = await parseCrosswordImage(send, image, { model, effort });
    let outcome = first;
    let looked = '';
    const fit = (file: Parameters<typeof crosswordFromFile>[0]) => {
      const read = crosswordFromFile(file);
      return read.ok ? clueNumberFit(read.crossword) : 0;
    };
    if (first.ok && values['second-look'] && (fit(first.file) ?? 1) < 1) {
      const second = await parseCrosswordImage(send, image, {
        model: values['second-look'],
        effort: 'high',
      });
      console.log(
        `  [${sample.name}] first fit ${fit(first.file)?.toFixed(2)}, second ${second.ok ? `fit ${fit(second.file)?.toFixed(2)}` : `failed: ${second.message}`}`,
      );
      const total = (first.costUsd ?? 0) + (second.costUsd ?? 0);
      const time = first.durationMs + (second.durationMs ?? 0);
      outcome =
        second.ok && (fit(second.file) ?? 0) > (fit(first.file) ?? 0)
          ? { ...second, costUsd: total, durationMs: time }
          : { ...first, costUsd: total, durationMs: time };
      looked = ' (second look)';
    }
    const costUsd = outcome.costUsd ?? null;
    ledger = addSpend(ledger, {
      at: new Date().toISOString(),
      model,
      effort,
      costUsd: costUsd ?? estimate,
    });
    writeFileSync(LEDGER, JSON.stringify(ledger, null, 2));
    const time = outcome.durationMs ? `${(outcome.durationMs / 1000).toFixed(0)}s` : '–';
    if (!outcome.ok) {
      console.log(`${sample.name.padEnd(18)}  failed: ${outcome.message}`);
      results.push({
        name: sample.name,
        error: outcome.message,
        costUsd,
        durationMs: outcome.durationMs ?? null,
      });
      continue;
    }
    const score = scoreCrossword(outcome.file, sample.truth);
    console.log(
      `${(sample.name + looked).padEnd(18)}  ${score.sizeRight ? ' ok ' : 'WRONG'}  ${score.styleRight ? ' ok  ' : 'WRONG'}  ${pct(score.squares)}   ${pct(score.numbering)}    ${pct(score.clues)}  ${formatUsd(costUsd ?? 0).padStart(7)}  ${time}`,
    );
    results.push({
      name: sample.name,
      score,
      notes: outcome.notes,
      file: outcome.file,
      costUsd,
      durationMs: outcome.durationMs,
    });
  }

  const file = resolve(RESULTS, `crossword-${model}-${effort}-${Date.now()}.json`);
  writeFileSync(file, JSON.stringify({ model, effort, results }, null, 2));
  const total = results.reduce((sum, r) => sum + (r.costUsd ?? 0), 0);
  console.log(
    `\nSpent ${formatUsd(total)} (ledger total ${formatUsd(ledger.totalUsd)}). Details: ${file}`,
  );
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
