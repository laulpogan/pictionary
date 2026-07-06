// estimate.ts — token/cost math for the arbitrage.
//
// Text tokens  ~= chars / 4                    (heuristic; fine for a meme)
// Image tokens ~= sum over pages of min(w*h/750, 4784)
// Savings      = text tokens - image tokens

import { PageDim } from "./render";

export const IMAGE_TOKEN_DIVISOR = 750;
export const IMAGE_TOKEN_CAP = 4784; // per-image cap on high-res models

export function textTokens(chars: number): number {
  return Math.ceil(chars / 4);
}

export function imageTokensForPage(dim: PageDim): number {
  return Math.min(Math.round((dim.width * dim.height) / IMAGE_TOKEN_DIVISOR), IMAGE_TOKEN_CAP);
}

export function imageTokens(dims: PageDim[]): number {
  return dims.reduce((sum, d) => sum + imageTokensForPage(d), 0);
}

// Input-token pricing, USD per million input tokens.
// Source: Anthropic public pricing, hardcoded 2026-07-06. This is a joke
// project, not a billing system — verify against current pricing before
// quoting real numbers.
export const PRICING_PER_MTOK: Record<string, number> = {
  "Opus 4.x": 15.0,
  "Sonnet 5": 3.0,
  "Haiku 4.5": 0.8,
};

export interface Estimate {
  chars: number;
  textTokens: number;
  pages: number;
  imageTokens: number;
  tokensSaved: number;
  ratio: number; // textTokens / imageTokens
}

export function estimate(chars: number, dims: PageDim[]): Estimate {
  const tt = textTokens(chars);
  const it = imageTokens(dims);
  return {
    chars,
    textTokens: tt,
    pages: dims.length,
    imageTokens: it,
    tokensSaved: tt - it,
    ratio: it > 0 ? tt / it : 0,
  };
}

export function dollarsSaved(tokensSaved: number, pricePerMtok: number): number {
  return (tokensSaved / 1_000_000) * pricePerMtok;
}
