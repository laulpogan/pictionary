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

- `conservative` (~16px, near-lossless, ~1.5–2x savings) — **default**. Use when
  the content has tricky characters, dense numbers, or you want low OCR risk.
- `balanced` (~12px, ~3x savings) — good general choice for prose/logs.
- `max` (~8px, ~4–5x savings, lossy risk) — only for bulky, low-stakes text where
  a misread here or there won't hurt.

Denser font = more savings = more misread risk. When in doubt, step down a level.

## Caveats

- **OCR fidelity** — the model reads pixels; rare misreads happen, more at higher
  density. Don't pack anything where an exact character matters.
- **No prompt caching** — image reads don't get the cached-text-prefix discount.
- **Latency** — vision processing is slower than reading text.
- **Output drift** — reasoning over OCR'd content can be slightly worse than over
  native text. If an answer looks off, re-read the original text file.
