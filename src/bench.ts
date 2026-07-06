// bench.ts — proves the arbitrage + measures the fidelity tax, via the `claude`
// CLI (claude -p) over the user's existing OAuth login. No API key, no SDK.
//
// For each factual question we ask Claude two ways:
//   (a) TEXT   — the corpus pasted into the prompt.
//   (b) IMAGE  — the corpus packed to PNG(s); the prompt points at the paths and
//                lets Claude's Read tool ingest them as images.
// We compare answers against expected substrings and report per-mode accuracy +
// measured input-token usage from --output-format json.

import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { spawnSync } from "child_process";
import { renderFile, Density } from "./render";

interface QA {
  q: string;
  // Answer counts as correct if ANY of these substrings appears (case-insensitive,
  // commas stripped) in the model's answer.
  expect: string[];
}

// Q&A over the bundled corpus. Keep in sync with bench/corpus.txt facts.
const QUESTIONS: QA[] = [
  { q: "In what year was the Zephyrine Protocol ratified?", expect: ["1987"] },
  { q: "Who was the lead archivist of the project?", expect: ["Vance", "Ophelia"] },
  { q: "How many drives did server rack B-17 hold?", expect: ["288"] },
  { q: "What is the numeric value of the Tunbridge coefficient?", expect: ["0.734"] },
  { q: "How many nodes were in the Verdant Cluster?", expect: ["56"] },
  { q: "What was the maximum measured throughput in megabits per second?", expect: ["1920"] },
  { q: "What was the fiscal year 2019 revenue in dollars?", expect: ["8412900", "8,412,900"] },
  { q: "On what date did the Halberd release ship?", expect: ["March 3", "2011"] },
];

function claudeAvailable(): boolean {
  const r = spawnSync("claude", ["--version"], { encoding: "utf8" });
  return r.status === 0;
}

interface AskResult {
  answer: string;
  inputTokens: number | null;
}

function ask(prompt: string, extraArgs: string[]): AskResult | null {
  const r = spawnSync("claude", ["-p", prompt, "--output-format", "json", ...extraArgs], {
    encoding: "utf8",
    maxBuffer: 32 * 1024 * 1024,
  });
  if (r.status !== 0 || !r.stdout) return null;
  try {
    const obj = JSON.parse(r.stdout);
    const answer: string = typeof obj.result === "string" ? obj.result : "";
    const usage = obj.usage || {};
    const inTok =
      typeof usage.input_tokens === "number"
        ? usage.input_tokens +
          (usage.cache_read_input_tokens || 0) +
          (usage.cache_creation_input_tokens || 0)
        : null;
    return { answer, inputTokens: inTok };
  } catch {
    return null;
  }
}

function correct(answer: string, qa: QA): boolean {
  const norm = answer.toLowerCase().replace(/,/g, "");
  return qa.expect.some((e) => norm.includes(e.toLowerCase().replace(/,/g, "")));
}

export interface BenchOpts {
  file?: string;
  density: Density;
}

export async function runBench(opts: BenchOpts): Promise<void> {
  const corpus =
    opts.file ?? path.resolve(__dirname, "..", "bench", "corpus.txt");
  if (!fs.existsSync(corpus)) {
    process.stderr.write(`pictionary bench: corpus not found: ${corpus}\n`);
    process.exit(1);
  }

  if (!claudeAvailable()) {
    process.stderr.write(
      "pictionary bench: the `claude` CLI was not found on PATH.\n" +
        "The benchmark drives Claude Code via `claude -p` (OAuth) — install/login first,\n" +
        "then re-run. Skipping benchmark.\n"
    );
    process.exit(1);
  }

  const corpusText = fs.readFileSync(corpus, "utf8");

  // Pack once for the image arm.
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "pictionary-bench-"));
  const res = await renderFile(corpus, opts.density, tmpDir);
  const pngList = res.files.join(", ");

  process.stderr.write(
    `Running bench: ${QUESTIONS.length} questions x 2 modes via claude -p (density=${opts.density})...\n`
  );

  let textCorrect = 0;
  let imgCorrect = 0;
  let textTokTotal = 0;
  let imgTokTotal = 0;
  let textTokN = 0;
  let imgTokN = 0;

  interface Row {
    q: string;
    textOk: boolean;
    imgOk: boolean;
    textTok: number | null;
    imgTok: number | null;
  }
  const rows: Row[] = [];

  for (const qa of QUESTIONS) {
    const textPrompt =
      `Answer this question using ONLY the document below. Reply with just the answer.\n\n` +
      `Question: ${qa.q}\n\nDocument:\n${corpusText}`;
    const imgPrompt =
      `Answer this question using ONLY the document contained in these image file(s): ${pngList}\n` +
      `Read the image file(s), then reply with just the answer.\n\nQuestion: ${qa.q}`;

    const textRes = ask(textPrompt, []);
    const imgRes = ask(imgPrompt, ["--allowedTools", "Read"]);

    const textOk = textRes ? correct(textRes.answer, qa) : false;
    const imgOk = imgRes ? correct(imgRes.answer, qa) : false;
    if (textOk) textCorrect++;
    if (imgOk) imgCorrect++;
    if (textRes?.inputTokens != null) {
      textTokTotal += textRes.inputTokens;
      textTokN++;
    }
    if (imgRes?.inputTokens != null) {
      imgTokTotal += imgRes.inputTokens;
      imgTokN++;
    }
    rows.push({
      q: qa.q,
      textOk,
      imgOk,
      textTok: textRes?.inputTokens ?? null,
      imgTok: imgRes?.inputTokens ?? null,
    });
  }

  const n = QUESTIONS.length;
  const tok = (v: number | null) => (v == null ? "n/a" : v.toLocaleString("en-US"));

  const out: string[] = [];
  out.push("");
  out.push(`## Benchmark results (density: ${opts.density})`);
  out.push("");
  out.push(`Corpus: \`${path.basename(corpus)}\` — packed to ${res.pages} PNG page(s).`);
  out.push("");
  out.push("| Question | Text ✓ | Image ✓ | Text in-tok | Image in-tok |");
  out.push("|---|:--:|:--:|--:|--:|");
  for (const r of rows) {
    const shortQ = r.q.length > 46 ? r.q.slice(0, 45) + "…" : r.q;
    out.push(
      `| ${shortQ} | ${r.textOk ? "✓" : "✗"} | ${r.imgOk ? "✓" : "✗"} | ${tok(r.textTok)} | ${tok(r.imgTok)} |`
    );
  }
  out.push(`| **Accuracy** | **${textCorrect}/${n}** | **${imgCorrect}/${n}** | | |`);
  const avgText = textTokN ? Math.round(textTokTotal / textTokN) : null;
  const avgImg = imgTokN ? Math.round(imgTokTotal / imgTokN) : null;
  out.push(`| **Avg input tokens** | | | ${tok(avgText)} | ${tok(avgImg)} |`);
  out.push("");
  if (avgText != null && avgImg != null && avgImg > 0) {
    out.push(`Token ratio (text/image): ${(avgText / avgImg).toFixed(2)}x`);
    out.push("");
  }
  out.push(
    "> Note: input-token counts include Claude Code's system prompt + tool overhead, " +
      "so per-question totals are higher than the raw corpus tokens. The delta between " +
      "the text and image columns is the arbitrage; the ✓ columns are the fidelity tax."
  );
  out.push("");

  process.stdout.write(out.join("\n") + "\n");
}
