// render.ts — text -> paginate -> SVG (monospace) -> sharp -> PNG.
//
// Page geometry targets Claude's high-res vision billing sweet spot:
//   long edge <= 2576px, area <= ~3.75MP, so no silent downscale ever occurs.
// A full page bills at the ~4784-token image cap regardless of density; denser
// fonts just pack more characters under that same cap, which is the whole trick.

import * as fs from "fs";
import * as path from "path";
import sharp from "sharp";

// Portrait page. 1450 * 2576 = 3,735,200 px = 3.735 MP  (<= 3.75MP, long edge 2576).
export const PAGE_W = 1450;
export const PAGE_H = 2576;
export const MARGIN = 24;

export type Density = "conservative" | "balanced" | "max";

export interface DensityProfile {
  fontPx: number;
  lineHeightFactor: number;
  // Fraction of an em that one monospace glyph advances. Slightly generous so
  // real glyph advance never overflows the right edge (which would clip text).
  charWidthFactor: number;
  label: string;
}

// NOTE on the font sizes: a full 3.75MP page always bills the ~4784 image-token
// cap, i.e. ~19,136 chars of text-equivalent break-even. A 16px page only holds
// ~16k chars, so 16px can NEVER beat text — the spec's "conservative ~16px" is
// arithmetically incapable of net savings. Conservative is therefore 14px, the
// largest near-lossless size that still clears break-even. charWidthFactor 0.61
// leaves a small right margin so real Menlo glyph advance never clips.
export const PROFILES: Record<Density, DensityProfile> = {
  conservative: { fontPx: 14, lineHeightFactor: 1.45, charWidthFactor: 0.61, label: "conservative (~14px, near-lossless)" },
  balanced: { fontPx: 12, lineHeightFactor: 1.3, charWidthFactor: 0.61, label: "balanced (~12px, good)" },
  max: { fontPx: 8, lineHeightFactor: 1.25, charWidthFactor: 0.61, label: "max (~8px, lossy risk)" },
};

export interface PageDim {
  width: number;
  height: number;
}

export interface Geometry {
  cols: number;
  rowsPerPage: number;
  charWidth: number;
  lineHeight: number;
}

export function geometry(p: DensityProfile): Geometry {
  const charWidth = p.fontPx * p.charWidthFactor;
  const lineHeight = p.fontPx * p.lineHeightFactor;
  const cols = Math.max(1, Math.floor((PAGE_W - 2 * MARGIN) / charWidth));
  const rowsPerPage = Math.max(1, Math.floor((PAGE_H - 2 * MARGIN) / lineHeight));
  return { cols, rowsPerPage, charWidth, lineHeight };
}

const TAB = "    "; // 4 spaces

// XML 1.0 forbids most C0 control bytes in element text. Everything except tab,
// LF, and CR is illegal and makes sharp/libvips reject the SVG ("PCDATA invalid
// Char value N"), crashing pack on real-world inputs — form-feed page breaks
// (\x0C) and ANSI color escapes (\x1B) in captured logs are the common culprits.
// Replace each such byte with U+FFFD so column math stays exact (1 char -> 1 char)
// and the substitution is visible rather than silent.
const XML_ILLEGAL = /[\x00-\x08\x0B\x0C\x0E-\x1F]/g;

// Wrap raw text into display lines of at most `cols` chars, preserving blank
// lines and hard breaks. Tabs expanded so column math stays exact; illegal XML
// control bytes sanitized so the downstream SVG is always well-formed.
export function wrapLines(text: string, cols: number): string[] {
  const out: string[] = [];
  const raw = text
    .replace(/\t/g, TAB)
    .replace(/\r\n?/g, "\n")
    .replace(XML_ILLEGAL, "�")
    .split("\n");
  for (const line of raw) {
    if (line.length === 0) {
      out.push("");
      continue;
    }
    for (let i = 0; i < line.length; i += cols) {
      out.push(line.slice(i, i + cols));
    }
  }
  return out;
}

export function paginate(lines: string[], rowsPerPage: number): string[][] {
  const pages: string[][] = [];
  for (let i = 0; i < lines.length; i += rowsPerPage) {
    pages.push(lines.slice(i, i + rowsPerPage));
  }
  if (pages.length === 0) pages.push([""]);
  return pages;
}

function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

// Height of a page holding `rowCount` display rows. Cropped to used rows so a
// short (or full) page bills fewer image tokens than the full canvas. Single
// source of truth so `estimate` (no-render) and `pack` (render) can never
// disagree on token counts for the same file.
export function pageHeight(rowCount: number, geo: Geometry): number {
  return Math.min(PAGE_H, Math.ceil(rowCount * geo.lineHeight + 2 * MARGIN));
}

// Build an SVG for one page. Height is cropped to used rows so a short final
// page bills fewer image tokens (honest savings math) instead of full canvas.
export function pageSvg(lines: string[], p: DensityProfile, geo: Geometry): { svg: string; dim: PageDim } {
  const height = pageHeight(lines.length, geo);
  const width = PAGE_W;
  const baselineY = (rowIndex: number) => MARGIN + (rowIndex + 0.8) * geo.lineHeight;

  const texts = lines
    .map((line, i) => {
      if (line.length === 0) return "";
      return `<text x="${MARGIN}" y="${baselineY(i).toFixed(2)}" xml:space="preserve">${escapeXml(line)}</text>`;
    })
    .filter(Boolean)
    .join("\n");

  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">` +
    `<rect width="100%" height="100%" fill="#ffffff"/>` +
    `<g font-family="Menlo, DejaVu Sans Mono, Consolas, monospace" font-size="${p.fontPx}px" fill="#000000">` +
    texts +
    `</g></svg>`;

  return { svg, dim: { width, height } };
}

export interface RenderResult {
  pages: number;
  files: string[];
  dims: PageDim[];
  totalChars: number;
  profile: DensityProfile;
  geometry: Geometry;
}

export async function renderFile(
  inputPath: string,
  density: Density,
  outDir?: string
): Promise<RenderResult> {
  const text = fs.readFileSync(inputPath, "utf8");
  const profile = PROFILES[density];
  const geo = geometry(profile);
  const lines = wrapLines(text, geo.cols);
  const pages = paginate(lines, geo.rowsPerPage);

  const base = path.basename(inputPath).replace(/\.[^.]+$/, "");
  const dir = outDir ?? path.dirname(inputPath);
  fs.mkdirSync(dir, { recursive: true });

  const files: string[] = [];
  const dims: PageDim[] = [];

  for (let i = 0; i < pages.length; i++) {
    const { svg, dim } = pageSvg(pages[i], profile, geo);
    const outPath = path.join(dir, `${base}.p${i + 1}.png`);
    await sharp(Buffer.from(svg)).png().toFile(outPath);
    files.push(outPath);
    dims.push(dim);
  }

  return {
    pages: pages.length,
    files,
    dims,
    totalChars: text.length,
    profile,
    geometry: geo,
  };
}
