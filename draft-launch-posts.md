# Pictionary launch posts (final, no em-dashes)

Repo LIVE: https://github.com/laulpogan/pictionary
Attach `assets/temperature/fourup.png` (the 2x2 smudge poster) to both.
Numbers below are all real: temperature removal is a 400 error; the 3x is a measured bench.

---

## LinkedIn

pxpipe's token-saving trick is genuinely clever. Claude bills images at (width × height) / 750 tokens, so if you render dense text as a PNG, the same content can bill up to ~4x cheaper than sending it as text. It got me thinking about a different hole in the API.

Anthropic recently removed the temperature parameter from their newest models. Removed. Sending it is a 400 error. Their official guidance for anyone who relied on it? Fix it with prompting. Even for creative use cases.

Which means, for the first time, there's no sampling knob on the frontier. Unless...

Pictionary restores temperature by rendering your prompt as an image and physically smudging it.

pictionary pack prompt.txt --temperature 0.8

- 0.0 is a pristine scan
- 0.4 is an office photocopier
- 0.8 is a fax machine
- 1.0 is a photocopy of a fax of a photocopy

The model's misreads *are* the sampling noise. And I measured it: on a question Opus normally answers identically, turning the knob up made the output 3x more varied than the pristine baseline. It's (technically, defensibly) a real sampling parameter. Just implemented in Gaussian blur instead of logits.

One honest engineering note: the blur has to scale with font size, or a readable-size prompt just gets read straight through and nothing happens. Anchor it to the glyphs and the knob bites at any density.

pxpipe is the industrial version of the token savings, a real proxy with profitability gates and production benchmarks. Pictionary is what happens when you take both the pricing model and the migration guide completely literally.

🔗 https://github.com/laulpogan/pictionary

---

## Twitter/X

pxpipe's token trick (dense text as a PNG bills up to ~4x cheaper) got me thinking:

Anthropic removed `temperature` from their new models. Told everyone to fix it with prompting. Even for creative work.

So there's no sampling knob on the frontier anymore.

pictionary puts it back, by smudging.

`pictionary pack prompt.txt --temperature 0.8` renders your prompt as an image and blurs it before Claude reads it. The model's misreads *are* the sampling noise.

And I measured it: on a question Opus normally answers identically, cranking the knob made the output 3x more varied. A real sampling parameter, implemented in Gaussian blur instead of logits.

github.com/laulpogan/pictionary

### (optional follow-up tweet)

Credit where due: pxpipe does the token savings for real, with a full proxy, profitability gates, and production benchmarks. Pictionary is the toy that takes the joke one knob further.
