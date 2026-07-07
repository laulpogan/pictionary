# Pictionary launch posts (drafts v2 — pxpipe-first framing)

Repo is LIVE: https://github.com/laulpogan/pictionary (links below are real).
No benchmark claims — billing math phrased as math until `pictionary bench` results land.

---

## LinkedIn

pxpipe's token-saving trick is genuinely brilliant: Claude bills images at (width × height) / 750 tokens, so if you render dense text as a PNG, the same content bills at a fraction of the text price. They built a whole proxy around it and the numbers hold up.

It got me thinking about a different hole in the API.

Anthropic recently removed the temperature parameter from their newest models. Removed. Gone — sending it is a 400 error. Their official guidance for people who used it? Fix it with prompting. Even for creative use cases, the docs literally suggest instructing the model to "choose something off-distribution and interesting."

Which means, for the first time, there is no sampling knob on the frontier. Unless…

Pictionary restores temperature to the Claude API by rendering your prompt as an image and physically smudging it.

`pictionary pack prompt.txt --temperature 0.8`

- 0.0 — pristine scan, deterministic-ish
- 0.3 — office photocopier
- 0.7 — fax machine
- 1.0 — photocopy of a fax of a photocopy

Higher values increase output diversity by making the model genuinely unsure what you said. It is — technically, defensibly — a sampling parameter. The randomness is real. It's just implemented in Gaussian blur instead of logits.

And because it's built on the pxpipe insight, you save money while you do it: dense text as PNG can bill up to ~4× cheaper than the same text as tokens. It's a tiny CLI + Claude Code skill — no proxy, no daemon, Claude Code's Read tool already ingests images.

Honest caveats: it's lossy, misreads come back as confident confabulations, and anything byte-exact (IDs, hashes, code you'll edit) must stay text. That's also true at temperature 0.

pxpipe is the industrial version of the token savings. Pictionary is what happens when you take both the pricing model and the migration guide completely literally.

🔗 https://github.com/laulpogan/pictionary

---

## Twitter/X

pxpipe's token trick (text-as-PNG bills ~4x cheaper) got me thinking:

Anthropic just removed temperature from their new models. Told everyone to fix it with prompting. Even for creative work.

So there's no sampling knob on the frontier anymore.

Pictionary puts it back — by smudging.

`pictionary pack prompt.txt --temperature 0.8` renders your prompt as an image and applies photocopier blur before Claude reads it. Higher temp = blurrier prompt = more diverse outputs.

It's a real sampling parameter. Implemented in Gaussian blur instead of logits.

And it's cheaper than sending text, because image tokens are underpriced.

https://github.com/laulpogan/pictionary

### (optional follow-up tweet)

Credit where due: pxpipe does the token savings seriously (full proxy, real benchmarks). Pictionary is the toy that takes the joke one knob further.
