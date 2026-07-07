# Session log — 2026-07-06 — Pictionary v0.1 built

## What
Greenfield build of Pictionary (npm CLI + Claude Code skill): rasterize big
read-mostly text files into dense PNGs so Claude bills them as image tokens
(w×h/750, cap ~4,784/page at 2576px/3.75MP) instead of text (~4 chars/token).
Branch: build/v0.1 (never merged; merge only on ask). Spec:
docs/superpowers/specs/2026-07-06-pictionary-design.md.

## How
Fable planned; ultracode workflow wf_4cb219eb-2c4 built it — opus builder,
3 sonnet reviewers, opus fixer, sonnet in-situ verifier (+1 rescue round).
8 agents, ~698k tokens, ~35 min. Verify round 2: PASS (7/7 incl. reading a
generated PNG with model vision and a real claude -p OCR round-trip).

## Key findings (the non-obvious stuff)
- **16px can never save**: full 3.75MP page always bills the 4,784 cap =
  19,136-char break-even; 16px holds ~16k chars. Conservative is 14px.
- **Honest ratios**: best-case full-fill ~1.05x/1.6x/3.8x (cons/bal/max);
  at typical ~55% line-fill only max reliably wins. Spec's 2x/3x/5x was wrong.
- **The extra-turn trap**: in Claude Code, Reading a PNG = one more agentic
  turn re-sending context; a real 1-question bench run measured the image arm
  ~1.8x MORE raw input tokens. Static math ≠ end-to-end bill. Documented in
  README caveats; bench results still placeholder — run before making claims.
- **Prior art**: pxpipe (teamchong, 4.1k stars) = industrial proxy version of
  the same arbitrage; dossier cached in slancha-brain store (#446). Decision:
  no fork — zero shared code, credit as prior art, adopt-not-fork if real
  savings ever wanted.

## Fun
--temperature 0..1 flag: Anthropic removed the sampling knob from new models
(400 on temperature); pictionary restores it in analog — blur + grain +
baseline jitter. Verified legible-but-degraded at t=0.8 by model vision.

## Artifacts
- Repo: ~/Source/pictionary, branch build/v0.1, tree clean, tsc green.
- Skill installed live at ~/.claude/skills/pictionary/SKILL.md.
- draft-launch-posts.md — LinkedIn/X drafts (pxpipe-first framing). DO NOT
  post until: repo pushed to GitHub (URL is placeholder) + bench run for real.

## Open
- Run `pictionary bench` across densities, paste results into README.
- Create GitHub repo + push (on Paul's word).
- Optional: voice-rinse posts through slancha-voice V12.
