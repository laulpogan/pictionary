# pictionary

![Pictionary — a robot drawing its own prompt](assets/pictionary-hero.png)

**Read big text files as cheap images.** A tiny CLI + Claude Code skill that
rasterizes large, read-mostly text files into dense PNGs so Claude ingests them
as image tokens instead of text tokens — cutting the cost of reading them by
~2–5x.

> Vibe check: this is a meme / arbitrage joke, built petite. It is not a serious
> billing system. It is also, annoyingly, real.

## The trick

Claude bills **image** input at roughly `(width × height) / 750` tokens, capped
near **4,784 tokens per image** on current high-res models (max useful
resolution ~2576px on the long edge, ~3.75MP; bigger images get downscaled).
Claude bills **text** at roughly **4 characters per token**.

The image-token cost of a full page is fixed at the ~4,784 cap, so the whole game
is packing more characters under that ceiling. A full page must hold **>~19,136
characters** (4,784 × 4) just to break even with text. Here is what each density
actually fits on a full, densely-packed page (measured against this repo's
geometry — 1450×2576px pages):

| Density | Font | Chars / full page | Text-tokens' worth | Bills as | Best case |
|---|---|--:|--:|--:|--:|
| conservative | ~14px | ~20,000 | ~5,100 | ≤4,784 img | ~1.05× |
| balanced | ~12px | ~31,000 | ~7,700 | ≤4,784 img | ~1.6× |
| max | ~8px | ~72,000 | ~18,000 | ≤4,784 img | ~3.8× |

**Two honest caveats the naive pitch skips.** (1) 16px can *never* win — a 16px
page holds only ~16k chars, below the 19,136 break-even — which is why
`conservative` here is 14px, the largest near-lossless size that still saves.
(2) These are *full-page* numbers. Real files rarely fill every line to the
right edge (headers, blank lines, short list items, ragged paragraph wraps), and
at a typical ~55% line-fill only `max` reliably beats text; `balanced` and
`conservative` can break even or lose. **Always run `pictionary estimate` first**
— it tells you, for your actual file, whether packing helps.

Pages are sized to land in the billing sweet spot — long edge ≤2576px, area
≤3.75MP — so **no silent downscale ever occurs**. Long inputs paginate into
`file.p1.png`, `file.p2.png`, …

## Install

```
npm i -g pictionary
pictionary install-skill      # copies the skill into ~/.claude/skills/pictionary/
```

`install-skill` teaches Claude Code *when* to reach for this (big + read-mostly
files) and, crucially, when NOT to (code you'll edit, instructions, recent
conversation).

## Usage

```
# See the math without rendering or spending anything:
pictionary estimate bigfile.log --density balanced

# Pack it — writes bigfile.log.p1.png, .p2.png, … and prints a savings report:
pictionary pack bigfile.log --density balanced

# Then, in Claude Code, Read the PNGs instead of the text file.
```

Subcommands:

- `pictionary pack <file> [--density …] [--out dir] [--temperature 0..1]` —
  render + savings report (see **Analog temperature** below).
- `pictionary estimate <file> [--density …]` — the math only, no render.
- `pictionary bench [--file f] [--density …]` — measure the savings *and* the
  fidelity tax against a real corpus via `claude -p` (see below).
- `pictionary install-skill` — install the Claude Code skill.

## Density — honest fidelity labels

| Density | Font | Savings (best → typical mixed) | Fidelity | Use for |
|---|---|---|---|---|
| `conservative` *(default)* | ~14px | ~1.05× → often break-even/loss | near-lossless | tricky chars, dense numbers, lowest OCR risk |
| `balanced` | ~12px | ~1.6× → ~0.9–1.3× | good | dense prose, logs, transcripts |
| `max` | ~8px | ~3.8× → ~1.5–2× | lossy risk | the reliable win; bulky low-stakes text |

Denser font = more savings = more misread risk. **The default is `conservative`
(safest fidelity), but it is a *fidelity* mode, not a *savings* mode** — on most
real files it barely breaks even. If your goal is fewer tokens, reach for
`balanced` or `max` and let `pictionary estimate` confirm the win.

## Analog temperature

Anthropic **removed the `temperature` parameter** from its newest models
(Fable 5, Opus 4.8/4.7 — sending it is a 400). The official migration guidance
for creative use cases is to fix it *with prompting*.

Pictionary restores it the only way left — physically:

```
pictionary pack prompt.txt --temperature 0.8
```

| t | Regime | Effect |
|---|---|---|
| `0` | pristine scan | deterministic-ish |
| `0.3` | office photocopier | slight Gaussian blur |
| `0.7` | fax machine | blur + grain + baseline jitter |
| `1.0` | photocopy of a fax of a photocopy | the model creatively reinterprets your prompt |

Higher values increase output diversity by making the model genuinely unsure
what you said. It is — technically, defensibly — a sampling parameter. The
randomness is real; it's just implemented in Gaussian blur instead of logits.
Billing is unchanged (same pixels). Fidelity is not. That's the point.

## Caveats (documented, not hidden)

- **OCR fidelity** — the model reads pixels; rare misreads happen, more at higher
  density. Do not pack anything where an exact character is load-bearing.
- **No prompt caching** — image reads don't get the cached-text-prefix discount
  that repeated text prefixes enjoy. Best for read-once bulk.
- **Latency** — vision processing is slower than reading text.
- **Output-quality drift** — reasoning over OCR'd content can be slightly worse
  than over native text. The benchmark quantifies this.
- **The extra turn** — in an agent (Claude Code), Reading a PNG is a tool call,
  i.e. one more agentic turn that re-sends the conversation context. Most of
  that re-send is cache-read-priced, but on a short conversation it can swamp
  the packing savings entirely (one real single-question run measured the image
  arm *more* expensive in raw input tokens). Packing wins when the file is big
  and the surrounding context is small or already cached — `bench` measures
  this end-to-end, not just the static math.

When any of those bite, keep the file as text. The bundled skill encodes this
policy: pack the boring bulk, keep load-bearing text as text.

## Benchmark

`pictionary bench` asks N factual questions about a corpus two ways — (a) the
text pasted into the prompt, (b) the corpus packed to PNG and Read as an image —
then reports per-mode accuracy and measured input tokens. It drives Claude Code
via `claude -p` over your existing OAuth login (**no API key, no SDK**), and
degrades gracefully if the `claude` CLI is absent.

### Results

_Placeholder — run `pictionary bench --density balanced` to populate. The command
prints a markdown table ready to paste here._

```
## Benchmark results (density: balanced)
| Question | Text ✓ | Image ✓ | Text in-tok | Image in-tok |
| … |
```

## Prior art

[**pxpipe**](https://github.com/teamchong/pxpipe) is the industrial version of
this arbitrage: a local proxy that intercepts your API traffic and auto-images
system prompts, tool docs, and history, with profitability gates and real
production benchmarks (~3.1× on dense content — independently confirming the
math above). If you want to actually lower a bill, use pxpipe. Pictionary is
the 60-second party trick with a skill file — and the only one of the two that
gives you your temperature knob back.

## What it isn't

No MCP server, no hooks, no proxy, no auto-interception of Reads, no Python port,
no multi-provider support, no telemetry, no config files. One runtime dep
(`sharp`). Petite by design.

## License

MIT.
