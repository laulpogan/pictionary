// bench.ts — measures whether ANALOG TEMPERATURE actually moves the model's
// output, via the `claude` CLI (claude -p) over the user's existing OAuth login.
// No API key, no SDK.
//
// The experiment: render the SAME prompt K times at each temperature level, ask
// Claude to read each rendered PNG, and measure how much the K answers differ.
//
//   t = 0   -> pristine PNG: identical pixels every render, so the only variation
//              is the model's own internal sampling. This is the baseline.
//   t > 0   -> fresh random jitter + grain PER render, so each of the K runs reads
//              a DIFFERENT smudged image. If smudging supplies sampling randomness,
//              output diversity should climb above the t=0 baseline.
//
// Diversity metric: mean pairwise normalized Levenshtein distance across the K
// answers (0 = all identical, 1 = maximally different). Structural, dependency-free,
// and not gameable by string-matching a known phrase.

import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { spawnSync } from "child_process";
import { renderFile, Density } from "./render";

// Temperature levels swept. Labels mirror the CLI's temperatureLabel() regimes.
const LEVELS: { t: number; regime: string }[] = [
  { t: 0, regime: "pristine scan (baseline)" },
  { t: 0.4, regime: "office photocopier" },
  { t: 0.8, regime: "fax machine" },
];

// Open-ended by design: a creative completion has a wide output distribution, so
// added input noise has room to show up as answer diversity. A closed factual
// question would pin every run to the same token and hide the effect.
const DEFAULT_PROMPT =
  "Write a single vivid opening sentence for a mystery novel set in a lighthouse. " +
  "Reply with only the sentence.";

function claudeAvailable(): boolean {
  const r = spawnSync("claude", ["--version"], { encoding: "utf8" });
  return r.status === 0;
}

// One claude -p call. Returns the model's text answer, or null on failure.
function ask(prompt: string, extraArgs: string[]): string | null {
  const r = spawnSync("claude", ["-p", prompt, "--output-format", "json", ...extraArgs], {
    encoding: "utf8",
    maxBuffer: 32 * 1024 * 1024,
  });
  if (r.status !== 0 || !r.stdout) return null;
  try {
    const obj = JSON.parse(r.stdout);
    return typeof obj.result === "string" ? obj.result.trim() : null;
  } catch {
    return null;
  }
}

// Levenshtein edit distance (iterative DP, two rows). Dependency-free.
function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  let curr = new Array<number>(b.length + 1);
  for (let i = 1; i <= a.length; i++) {
    curr[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + cost);
    }
    [prev, curr] = [curr, prev];
  }
  return prev[b.length];
}

// Mean pairwise Levenshtein distance, normalized to [0,1] by the longer string of
// each pair. 0 = every answer identical; higher = more diverse. Null if <2 answers.
function meanPairwiseDistance(answers: string[]): number | null {
  const valid = answers.filter((a) => a.length > 0);
  if (valid.length < 2) return null;
  let sum = 0;
  let pairs = 0;
  for (let i = 0; i < valid.length; i++) {
    for (let j = i + 1; j < valid.length; j++) {
      const denom = Math.max(valid[i].length, valid[j].length) || 1;
      sum += levenshtein(valid[i], valid[j]) / denom;
      pairs++;
    }
  }
  return pairs ? sum / pairs : null;
}

export interface BenchOpts {
  // Optional path to a prompt file (its contents become the prompt). Falls back to
  // the built-in creative prompt when absent.
  promptFile?: string;
  density: Density;
  runs: number;
}

interface LevelResult {
  t: number;
  regime: string;
  answers: string[];
  distance: number | null;
}

export async function runBench(opts: BenchOpts): Promise<void> {
  if (!claudeAvailable()) {
    process.stderr.write(
      "pictionary bench: the `claude` CLI was not found on PATH.\n" +
        "The benchmark drives Claude Code via `claude -p` (OAuth) — install/login first,\n" +
        "then re-run. Skipping benchmark.\n"
    );
    process.exit(1);
  }

  const prompt =
    opts.promptFile && fs.existsSync(opts.promptFile)
      ? fs.readFileSync(opts.promptFile, "utf8").trim()
      : DEFAULT_PROMPT;
  const runs = Math.max(2, opts.runs); // need >=2 answers per level to measure spread

  // Write the prompt to a temp text file so renderFile (which reads a path) can
  // rasterize it at each temperature.
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "pictionary-tempbench-"));
  const promptTxt = path.join(tmpDir, "prompt.txt");
  fs.writeFileSync(promptTxt, prompt, "utf8");

  process.stderr.write(
    `Running temperature bench: ${LEVELS.length} levels x ${runs} runs via claude -p ` +
      `(density=${opts.density})...\n`
  );

  const results: LevelResult[] = [];
  for (const level of LEVELS) {
    const answers: string[] = [];
    for (let run = 0; run < runs; run++) {
      // Fresh render every run: at t>0 each carries independent jitter+grain, which
      // is the whole point — the randomness lives in the pixels, not the API call.
      const outDir = path.join(tmpDir, `t${level.t}-r${run}`);
      const res = await renderFile(promptTxt, opts.density, outDir, level.t);
      const pngList = res.files.join(", ");
      const imgPrompt =
        `Read the prompt contained in these image file(s): ${pngList}\n` +
        `Then do exactly what the prompt says. Reply with only your answer.`;
      const ans = ask(imgPrompt, ["--allowedTools", "Read"]);
      if (ans) answers.push(ans);
      process.stderr.write(`  t=${level.t} run ${run + 1}/${runs} ${ans ? "ok" : "FAILED"}\n`);
    }
    results.push({
      t: level.t,
      regime: level.regime,
      answers,
      distance: meanPairwiseDistance(answers),
    });
  }

  const baseline = results.find((r) => r.t === 0)?.distance ?? null;
  const dist = (d: number | null) => (d == null ? "n/a" : d.toFixed(3));

  const out: string[] = [];
  out.push("");
  out.push(`## Analog temperature bench (density: ${opts.density}, ${runs} runs/level)`);
  out.push("");
  out.push(`Prompt: _${prompt.length > 80 ? prompt.slice(0, 79) + "…" : prompt}_`);
  out.push("");
  out.push("| Temperature | Regime | Runs | Output diversity | vs. baseline |");
  out.push("|--:|---|:--:|--:|--:|");
  for (const r of results) {
    let vs = "—";
    if (r.t !== 0 && r.distance != null && baseline != null && baseline > 0) {
      vs = `${(r.distance / baseline).toFixed(2)}x`;
    } else if (r.t !== 0 && r.distance != null && baseline === 0) {
      vs = r.distance > 0 ? "∞ (baseline 0)" : "—";
    }
    out.push(`| ${r.t.toFixed(1)} | ${r.regime} | ${r.answers.length} | ${dist(r.distance)} | ${vs} |`);
  }
  out.push("");

  // Honest verdict — report a null result plainly if smudging did nothing.
  const hot = results.find((r) => r.t === 0.8)?.distance ?? null;
  if (baseline != null && hot != null) {
    if (baseline > 0 && hot > baseline * 1.15) {
      out.push(
        `> Verdict: smudging works. At t=0.8 the model's output was ` +
          `${(hot / baseline).toFixed(2)}x more varied than the pristine baseline — ` +
          `the analog sampling knob measurably moves the distribution.`
      );
    } else if (baseline === 0 && hot > 0) {
      out.push(
        `> Verdict: smudging works. The pristine baseline produced identical outputs ` +
          `(diversity 0); smudging alone introduced variation.`
      );
    } else {
      out.push(
        `> Verdict: no measurable effect. Output diversity at t=0.8 (${dist(hot)}) did not ` +
          `clearly exceed the pristine baseline (${dist(baseline)}). The model's own sampling ` +
          `dominates; the smudge is (this run) cosmetic. Reported honestly.`
      );
    }
  } else {
    out.push(`> Verdict: inconclusive — too few successful runs to measure. Check the \`claude\` CLI.`);
  }
  out.push("");
  out.push(
    "> Metric: mean pairwise normalized Levenshtein distance across the runs at each " +
      "level (0 = identical, higher = more diverse). t=0 renders identical pixels every " +
      "run, so its diversity is pure model sampling; t>0 adds fresh per-render noise."
  );
  out.push("");

  process.stdout.write(out.join("\n") + "\n");
}
