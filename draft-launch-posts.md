# Pictionary launch posts (paul-voice, per essays/STYLE.md + DISTRIBUTION.md)

Repo: https://github.com/laulpogan/pictionary
Voiced against essays/STYLE.md (trailing-space "- " dash, register hops, "BuT pAuL" move,
end-on-a-turn). Platform rules per essays/DISTRIBUTION.md.
All numbers real: temperature removal is a 400; the 3x is a measured bench.

Assets: attach `assets/temperature/fourup.png` (the 2x2 smudge poster). Optional: hero
`assets/pictionary-hero.png` on the LinkedIn post / lead tweet.

---

## LinkedIn  (link goes in the FIRST COMMENT, not the body; algorithm penalizes body links)

Anthropic removed the temperature parameter from their newest models- the one knob that controlled how random the output is- and told everyone to fix it with prompting instead.

So I rebuilt temperature out of a photocopier.

Quick background on the arbitrage this rides on: Claude bills image input by area, not by character, so a page of text rendered as a PNG can cost a fraction of the same text as tokens. Most people who know this trick use it to shave a bill. I used it to smuggle my prompt into the model as a picture- and then I smudged the picture.

Blur it, dust it with photocopier grain, jitter the baselines off true. Now the model has to OCR its way back to your words, and past a certain point it reads them slightly wrong. Those misreads are randomness. Dial-able randomness, scaled by how hard you smudge- which is to say, a temperature knob, implemented in Gaussian blur instead of logits.

The stupid part is that it works. I measured it: on a question the model normally answers identically every single time, cranking the blur made its output 3x more varied. A real sampling parameter, reconstructed out of fax-machine artifacts.

"BuT pAuL," you might say, "that's just corrupting your own input." Correct, idiot. That's what temperature always was- controlled corruption of the sampling step. I just moved the corruption upstream into the pixels, where Anthropic can't 400 it.

They took the knob off the frontier. Turns out you can rebuild it out of image compression. What's the dumbest arbitrage you've found hiding in an API's pricing model?

---

## Twitter/X  (thread; hook tweet stands alone; end on the link)

1/
Anthropic removed the temperature parameter from their newest models. Told everyone to fix it with prompting- even for creative work.

So I rebuilt temperature out of a photocopier.

2/
temperature was the knob that controlled how random a model's output is. it's gone. send it now and you get a 400. there is currently no sampling knob on the frontier.

3/
there's a quirk in how Claude bills images: text rendered as a PNG costs a fraction of the same text as tokens, because image input is priced by area, not characters.

usually people use this to save money. I used it to sneak my prompt in as a picture.

4/
then I smudged the picture. blur, photocopier grain, jittered baselines.

the model has to OCR its way back to your words- and past a certain point it reads them slightly wrong. those misreads are your randomness.

5/
temperature, implemented in Gaussian blur instead of logits.

0.0 is a clean scan. 1.0 is a photocopy of a fax of a photocopy.

[attach assets/temperature/fourup.png]

6/
and it works. I measured it: on a question Opus normally answers identically, cranking the blur made the output 3x more varied.

a real sampling parameter, reconstructed out of image-compression artifacts.

7/
they took the knob off the frontier. I rebuilt it out of a fax machine.

github.com/laulpogan/pictionary

---

## Standalone bangers (quote-tweet fuel / cut anywhere)

- Anthropic: we removed temperature, just prompt for it. me, quietly wheeling in a photocopier: no.
- the only stochastic decoding left on the frontier is a Gaussian blur, and I think that says something about all of us.
- turns out "just prompt for it" has a loophole and the loophole is a fax machine.
