# Setting up image parsing (Anthropic API key)

"Upload a puzzle image" sends the image to Claude to read. That needs an Anthropic API key, and **each
image costs money** (roughly half a cent with Haiku 5.5 at low effort, up to about $0.40 with Opus 5.5
at high effort; see the cost review below). Without a key, everything else works and uploading answers
"Image parsing isn't set up on this server."

## 1. Get an API key

1. Sign in at <https://platform.claude.com> with your Anthropic account.
2. Add a payment method and, ideally, set a monthly spend limit for the workspace.
3. Create an API key (Settings → API keys). Copy it: it starts with `sk-ant-`. Keep it in a password
   manager; never paste it into chat or commit it.

## 2. Use it locally

```
npm run setup:claude      # asks for the key (typed hidden), writes apps/worker/.dev.vars
npm run doctor:claude     # checks the key's format (no API call)
```

Restart `npm run dev`. Sign in with an allowlisted account and choose **Upload a puzzle image**.

## 3. Measure accuracy and cost (the cost review)

`npm run eval:parse` reads the sample image with the real API and scores the result against the
hand-made transcription. It shows an estimate and does nothing without `--yes`. Every run's actual cost
goes into `eval-results/spend.json`, and runs that could pass `--budget` (default $4.00) are refused.
Start cheapest and step up only if accuracy needs it:

```
npm run eval:parse -- --yes                                         # Haiku 5.5, low effort
npm run eval:parse -- --yes --model claude-sonnet-5-5 --effort medium
npm run eval:parse -- --yes --model claude-opus-5-5 --effort high
```

## 4. Production

The deploy uploads the key with the other secrets when it's in your `.dev.vars`:

```
npm run deploy -- --secrets
```

Or set it alone: `cd apps/worker && npx wrangler secret put ANTHROPIC_API_KEY`.

Choose the production model and effort after the cost review by editing `PARSE_MODEL` and
`PARSE_EFFORT` in `apps/worker/wrangler.jsonc` (no code change), then `npm run deploy`. The daily
budget across everyone is `PARSE_DAILY_BUDGET_USD` (default `5`); each person can parse 10 images an
hour. Every parse is logged in the `parse_runs` table.

The Workers free plan allows 10 ms of CPU per request. Waiting on Claude doesn't count, but large
uploads might exceed it; if parsing fails in production with CPU errors, the Workers Paid plan
($5/month) lifts the limit.
