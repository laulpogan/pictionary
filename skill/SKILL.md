---
name: pictionary
description: >
  Pack a large, read-mostly text file into dense PNG image(s) so Claude reads it
  as cheap image tokens instead of expensive text tokens. Use when you are about
  to Read a big reference file you will NOT edit — long docs, logs, transcripts,
  chat/context dumps, data exports, changelogs — and it is roughly >8k tokens
  (>~32k characters). Triggers: "this file is huge", "cheaper way to read this
  big log/doc/transcript", "pack this file", "read this as an image to save
  tokens", "reduce token cost of reading X".
---

# Pictionary — read big files as cheap images

Claude bills image input at about `(width x height) / 750` tokens, capped near
**4,784 tokens per image**. A single dense page holds tens of thousands of
characters — far more than 4,784 text tokens' worth. Rasterizing a big
read-mostly file into PNG(s) can cut the cost of reading it by ~2–5x.

## When to pack (all three should hold)

1. **Big** — the file is roughly >8,000 tokens (>~32,000 characters). Small files
   don't beat the per-image floor; packing them can cost *more*. Check first with
   `pictionary estimate <file>` — if "tokens saved" is not clearly positive, don't.
2. **Read-mostly** — you will read it for facts/context, not edit it: docs,
   logs, transcripts, dumps, changelogs, exports, meeting notes.
3. **Fidelity-tolerant** — approximate OCR of the content is acceptable. Exact
   byte fidelity is NOT guaranteed (see caveats).

## When NOT to pack (keep as text)

- **Code you intend to edit** — you need exact characters, line numbers, and the
  ability to quote/patch. Never pack it.
- **Instructions / prompts / specs you must follow precisely** — OCR drift on a
  single number or flag can mislead you.
- **Recent conversation or anything already in context** — no savings, just risk.
- **Anything you'll grep, diff, or cite verbatim.**

This smart-segmentation policy is enforced by judgment (this guidance), not by
code. Pack the boring bulk; keep the load-bearing text as text.

## How to use it

1. Estimate first (no render, no cost):

   ```
   pictionary estimate <file> --density balanced
   ```

   Only proceed if "tokens saved" is clearly positive.

2. Pack it:

   ```
   pictionary pack <file> --density balanced
   ```

   This writes `<file>.p1.png`, `<file>.p2.png`, … next to the file (or into
   `--out <dir>`) and prints a savings report.

3. **Read the PNG(s), not the original text file.** Claude Code's `Read` tool
   ingests PNGs visually. Read each page image in order.

## Density knob

Best-case ratios below are for a *full, densely-packed* page (see README table);
real files rarely fill every line, so `pictionary estimate` is the source of truth.

- `conservative` (~14px, near-lossless, ~1.05x best case — often break-even/loss)
  — **default**. A *fidelity* mode, not a *savings* mode: use it when the content
  has tricky characters, dense numbers, or you want the lowest OCR risk, and
  accept that it usually barely breaks even. (16px can never win — a 16px page
  holds < the ~19,136-char break-even — which is why conservative is 14px.)
- `balanced` (~12px, ~1.6x best case → ~0.9–1.3x typical) — good for dense
  prose/logs when you also want some savings.
- `max` (~8px, ~3.8x best case → ~1.5–2x typical, lossy risk) — the reliable win;
  for bulky, low-stakes text where a misread here or there won't hurt.

Denser font = more savings = more misread risk. When in doubt, step down a level.

## Tool-call overhead — the honest caveat on savings

The per-image billing (~4,784-token cap) is only the raw arbitrage. In Claude
Code's agentic loop, having Claude `Read` a PNG costs an **extra turn**: the model
first emits a tool call, then the tool result (the image) comes back in a *new*
turn that re-sends the system prompt + tool definitions. That fixed per-turn
overhead can equal or exceed the raw image-token saving, so on small/medium files
packing can make the whole request **more expensive** end-to-end, not cheaper.
The arbitrage is real per-image but is easily erased by the round-trip. Only pack
genuinely **big** files (comfortably >8k text tokens) so the saved bulk dwarfs the
extra-turn tax, and trust `pictionary estimate` for the raw math — not the
end-to-end request cost, which includes that overhead.

## Caveats

- **OCR fidelity** — the model reads pixels; rare misreads happen, more at higher
  density. Don't pack anything where an exact character matters.
- **No prompt caching** — image reads don't get the cached-text-prefix discount.
- **Latency** — vision processing is slower than reading text.
- **Output drift** — reasoning over OCR'd content can be slightly worse than over
  native text. If an answer looks off, re-read the original text file.
