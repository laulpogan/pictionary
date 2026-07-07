#!/usr/bin/env node
// cli.ts — hand-rolled arg parsing + subcommands: pack, estimate, bench, install-skill.

import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { renderFile, PROFILES, geometry, wrapLines, paginate, pageHeight, PageDim, Density, PAGE_W } from "./render";
import { estimate, imageTokens, textTokens, PRICING_PER_MTOK, dollarsSaved, Estimate } from "./estimate";
import { runBench } from "./bench";

const DENSITIES: Density[] = ["conservative", "balanced", "max"];

interface Args {
  positional: string[];
  flags: Record<string, string | boolean>;
}

function parseArgs(argv: string[]): Args {
  const positional: string[] = [];
  const flags: Record<string, string | boolean> = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith("--")) {
      const key = a.slice(2);
      const next = argv[i + 1];
      if (next !== undefined && !next.startsWith("--")) {
        flags[key] = next;
        i++;
      } else {
        flags[key] = true;
      }
    } else {
      positional.push(a);
    }
  }
  return { positional, flags };
}

function resolveDensity(flags: Record<string, string | boolean>): Density {
  const d = flags.density;
  if (d === true) {
    // `--density` passed with no value consumed (last arg, or followed by another
    // --flag). Silently defaulting would hide a dropped value — fail loud instead.
    fail(`--density needs a value. Choose one of: ${DENSITIES.join(", ")}`);
  }
  if (typeof d === "string") {
    if ((DENSITIES as string[]).includes(d)) return d as Density;
    fail(`unknown density "${d}". Choose one of: ${DENSITIES.join(", ")}`);
  }
  return "conservative";
}

// Analog temperature: 0 = pristine scan; higher = blur + grain + jitter, so the
// model's misreads supply the output diversity Anthropic's API no longer will.
function resolveTemperature(flags: Record<string, string | boolean>): number {
  const t = flags.temperature;
  if (t === undefined) return 0;
  if (t === true) fail("--temperature needs a value between 0 and 1.");
  const n = Number(t);
  if (!Number.isFinite(n) || n < 0) fail(`invalid temperature "${t}". Use a number between 0 and 1.`);
  if (n > 1) fail("--temperature max is 1. This is a smudge, not a shredder.");
  return n;
}

function temperatureLabel(t: number): string {
  if (t < 0.35) return "office photocopier";
  if (t < 0.75) return "fax machine";
  return "photocopy of a fax of a photocopy";
}

function fail(msg: string): never {
  process.stderr.write(`pictionary: ${msg}\n`);
  process.exit(1);
}

function fmtInt(n: number): string {
  return n.toLocaleString("en-US");
}

// Estimate math from a file without rendering (dims computed from geometry).
function estimateNoRender(file: string, density: Density): Estimate {
  const text = fs.readFileSync(file, "utf8");
  const profile = PROFILES[density];
  const geo = geometry(profile);
  const lines = wrapLines(text, geo.cols);
  const pages = paginate(lines, geo.rowsPerPage);
  const dims: PageDim[] = pages.map((pg) => ({
    width: PAGE_W,
    height: pageHeight(pg.length, geo),
  }));
  return estimate(text.length, dims);
}

function printReport(file: string, density: Density, est: Estimate, files?: string[]): void {
  const p = PROFILES[density];
  const lines: string[] = [];
  lines.push("");
  lines.push(`  pictionary — ${path.basename(file)}  [${p.label}]`);
  lines.push(`  ${"-".repeat(52)}`);
  lines.push(`  characters      ${fmtInt(est.chars)}`);
  lines.push(`  text tokens     ${fmtInt(est.textTokens)}   (~chars/4)`);
  lines.push(`  pages           ${est.pages}`);
  lines.push(`  image tokens    ${fmtInt(est.imageTokens)}   (min(w*h/750, 4784)/page)`);
  lines.push(`  ${"-".repeat(52)}`);
  if (est.tokensSaved > 0) {
    lines.push(`  tokens saved    ${fmtInt(est.tokensSaved)}   (${est.ratio.toFixed(2)}x cheaper)`);
  } else {
    lines.push(`  tokens saved    ${fmtInt(est.tokensSaved)}   (packing this file does NOT help — too small)`);
  }
  lines.push("");
  lines.push(`  $ saved per read (input pricing, 2026-07-06):`);
  for (const [model, price] of Object.entries(PRICING_PER_MTOK)) {
    const usd = dollarsSaved(est.tokensSaved, price);
    lines.push(`    ${model.padEnd(12)} $${usd.toFixed(5)}`);
  }
  if (files && files.length) {
    lines.push("");
    lines.push(`  wrote ${files.length} PNG${files.length > 1 ? "s" : ""}:`);
    for (const f of files) lines.push(`    ${f}`);
    lines.push("");
    lines.push(`  Next: Read the PNG(s) above instead of the text file.`);
  }
  lines.push("");
  process.stdout.write(lines.join("\n") + "\n");
}

async function cmdPack(args: Args): Promise<void> {
  const file = args.positional[0];
  if (!file) fail("pack: missing <file>. Usage: pictionary pack <file> [--density ...] [--out dir] [--dry-run]");
  if (!fs.existsSync(file)) fail(`pack: file not found: ${file}`);
  const density = resolveDensity(args.flags);
  const dryRun = args.flags["dry-run"] === true || args.flags["dry-run"] === "true";

  // --dry-run: show the same math without rendering or writing any PNGs. This is
  // the guard — run it to confirm "tokens saved" is positive before you pack.
  if (dryRun) {
    const est = estimateNoRender(file, density);
    printReport(file, density, est);
    return;
  }

  const outDir = typeof args.flags.out === "string" ? args.flags.out : undefined;
  const temperature = resolveTemperature(args.flags);

  const res = await renderFile(file, density, outDir, temperature);
  const est = estimate(res.totalChars, res.dims);
  if (temperature > 0) {
    process.stdout.write(`\n  analog temperature ${temperature} — ${temperatureLabel(temperature)}\n`);
  }
  printReport(file, density, est, res.files);
}

function cmdInstallSkill(): void {
  const src = path.resolve(__dirname, "..", "skill", "SKILL.md");
  if (!fs.existsSync(src)) fail(`install-skill: bundled skill not found at ${src}`);
  const destDir = path.join(os.homedir(), ".claude", "skills", "pictionary");
  const dest = path.join(destDir, "SKILL.md");
  fs.mkdirSync(destDir, { recursive: true });
  fs.copyFileSync(src, dest);
  process.stdout.write(`Installed pictionary skill -> ${dest}\n`);
}

function usage(): void {
  process.stdout.write(
    [
      "pictionary — rasterize read-mostly text into cheap image tokens",
      "",
      "Usage:",
      "  pictionary pack <file> [--density conservative|balanced|max] [--out dir] [--temperature 0..1] [--dry-run]",
      "  pictionary bench [--prompt-file f] [--runs N] [--density ...]",
      "  pictionary install-skill",
      "",
      "Densities: conservative (default, near-lossless), balanced, max (lossy risk).",
      "--dry-run: print the token math without rendering — run it first to confirm packing helps.",
      "Temperature: 0 pristine scan -> 1 photocopy of a fax of a photocopy.",
      "  (Anthropic removed the sampling knob; we put it back in analog.)",
      "",
    ].join("\n")
  );
}

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  const cmd = argv[0];
  const args = parseArgs(argv.slice(1));

  switch (cmd) {
    case "pack":
      await cmdPack(args);
      break;
    case "bench": {
      const runsFlag = Number(args.flags.runs);
      await runBench({
        promptFile: typeof args.flags["prompt-file"] === "string" ? args.flags["prompt-file"] : undefined,
        density: resolveDensity(args.flags),
        runs: Number.isFinite(runsFlag) && runsFlag >= 2 ? Math.floor(runsFlag) : 4,
      });
      break;
    }
    case "install-skill":
      cmdInstallSkill();
      break;
    case undefined:
    case "help":
    case "--help":
    case "-h":
      usage();
      break;
    default:
      fail(`unknown command "${cmd}". Run 'pictionary help'.`);
  }
}

main().catch((err) => {
  process.stderr.write(`pictionary: ${err instanceof Error ? err.message : String(err)}\n`);
  process.exit(1);
});
