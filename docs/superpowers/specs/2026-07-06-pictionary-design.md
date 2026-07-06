# Pictionary — design spec

**Date:** 2026-07-06
**Status:** approved (Paul, 2026-07-06)
**Vibe:** meme / fast build, not a serious project. Petite by design.

## The joke (and why it works)

Claude bills image input at roughly `(width × height) / 750` tokens, capped at
~4,784 tokens per image on current high-res models (Opus 4.7+, Sonnet 5,
Fable 5 — max useful resolution 2576px on the long edge, ~3.75MP; larger
images get downscaled). Text is billed at ~4 characters per token.

A 3.75MP page rendered with dense 8px text holds ~80,000 characters — about
20,000 text-tokens' worth of content — but bills as ~4,784 image tokens.
That's a ~4× underbilling at max density, ~2–3× at comfortable reading sizes.

**Pictionary** exploits this: it rasterizes big text files into dense PNGs so
Claude reads them as images instead of text. Claude Code's `Read` tool already
renders PNGs visually — no plumbing needed.

Known tradeoffs (documented, not hidden):

- **OCR fidelity** — smaller font = more savings = more misread risk.
- **No prompt caching** on repeated reads the way cached text prefixes work.
- **Latency** — vision processing is slower than text.
- **Output-quality drift** — model reasoning over OCR'd content can be worse
  than over native text. The benchmark measures this.

## What it is

An npm CLI + a Claude Code skill. Two artifacts, one repo.

1. **CLI (`pictionary`)** — TypeScript, Node ≥18, single runtime dep: `sharp`.
   - `pictionary pack <file> [--density conservative|balanced|max] [--out dir]`
     → renders the file to one or more PNGs + prints a savings report
     (estimated text tokens vs. image tokens, $ saved at current pricing).
   - `pictionary estimate <file> [--density ...]` → the savings math only,
     no render, no API call.
   - `pictionary bench [--file f] [--density ...]` → benchmark harness (below).
   - `pictionary install-skill` → copies the bundled SKILL.md into
     `~/.claude/skills/pictionary/`.
2. **Skill (`skill/SKILL.md`)** — teaches Claude Code when to use it:
   - File is big (>~8k tokens) AND read-mostly (docs, logs, transcripts,
     context dumps) → `pictionary pack`, then `Read` the PNG(s).
   - Code you intend to edit, instructions, and recent conversation stay as
     text — that's the smart-segmentation policy, enforced by skill guidance
     rather than code.

## Rendering core

- Pipeline: text → paginate → SVG (`<text>` lines, monospace font) → `sharp`
  → PNG.
- Density knob (font px / expected savings / fidelity):
  - `conservative` — ~16px, ~1.5–2×, near-lossless. **Default.**
  - `balanced` — ~12px, ~3×, good.
  - `max` — ~8px, ~4–5×, lossy risk; caveat in output.
- Page geometry targets the billing sweet spot: long edge ≤2576px, area
  ≤~3.75MP, so no silent downscale ever occurs. Long inputs paginate into
  multiple PNGs (`file.p1.png`, `file.p2.png`, …).
- White background, black text, generous line height at conservative — tuned
  for machine OCR, not human aesthetics.

## Token/cost math (in `estimate` and the pack report)

- Text tokens ≈ chars / 4 (heuristic; good enough for a meme).
- Image tokens ≈ Σ over pages of `min(w×h/750, 4784)`.
- Savings = text − image tokens; $ figures at current per-model input pricing
  (hardcoded table with a date comment; this is a joke project, not a billing
  system).

## Benchmark harness (`pictionary bench`)

Proves the arbitrage claim and measures the fidelity tax. **Uses the `claude`
CLI (`claude -p`) via the user's existing OAuth login — no API key, no SDK
dependency** (house rule: harness Claude Code, not the API).

Per run:

1. Take a corpus file (bundled sample + optional `--file`).
2. Ask N factual questions about it two ways: (a) file as text in the prompt,
   (b) file packed to PNG, prompt references the PNG path so Claude Reads it.
3. Compare answers (string/contains match against expected), report accuracy
   per density level + measured token deltas.
4. Output: a markdown table ready to paste into the README.

## Repo layout

```
pictionary/
  src/
    render.ts      # text→SVG→PNG core, pagination, density profiles
    estimate.ts    # token/cost math
    cli.ts         # arg parsing + subcommands
    bench.ts       # claude -p harness
  skill/SKILL.md   # the Claude Code skill (installed by install-skill)
  bench/corpus.txt # sample benchmark corpus
  docs/superpowers/specs/  # this spec
  README.md        # the meme: pitch, math, bench table, install, caveats
  package.json     # bin: pictionary; dep: sharp
```

## Non-goals

MCP server, hooks, Python port, multi-provider support, prompt-caching
interplay, automatic interception of Reads, telemetry, config files.

## Decisions log

- **CLI + skill over MCP/proxy/hooks** — Read tool already ingests PNGs;
  smallest possible integration surface. (Paul, 2026-07-06)
- **TypeScript + sharp over Python/Pillow or node-canvas** — npm distribution
  fits the Claude Code crowd; sharp has prebuilt binaries; canvas is a native
  build headache. (2026-07-06)
- **Tunable density, conservative default** — savings knob with honest
  fidelity labels beats one aggressive lossy setting. (Paul, 2026-07-06)
- **Bench via `claude -p` OAuth, not the API SDK** — no second bill, no key
  management; matches the target user's setup. (house rule)
- **Billing math source** — claude-api skill, verified 2026-07-06: high-res
  vision on Opus 4.7+/Sonnet 5/Fable 5 = 2576px long edge, w×h/750, cap
  ~4,784 tokens/image.
