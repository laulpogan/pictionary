// One-off: compose the four temperature crops into a single labeled 2x2 poster
// for social posting. Output: assets/temperature/fourup.png
const path = require("path");
const sharp = require("../../node_modules/sharp");

const DIR = __dirname;
const PANELS = [
  { file: "t0.png", t: "t = 0", regime: "pristine scan" },
  { file: "t0.4.png", t: "t = 0.4", regime: "office photocopier" },
  { file: "t0.8.png", t: "t = 0.8", regime: "fax machine" },
  { file: "t1.0.png", t: "t = 1.0", regime: "photocopy of a fax of a photocopy" },
];

const PAD = 32;
const IMG_W = 600;
const IMG_H = 192; // 2x upscale of the 300x96 crop
const LABEL_H = 48;
const CELL_H = LABEL_H + IMG_H;
const TITLE_H = 104;
const W = PAD + IMG_W + PAD + IMG_W + PAD; // 1296
const H = TITLE_H + CELL_H + PAD + CELL_H + PAD; // 636

const cellX = (col) => PAD + col * (IMG_W + PAD);
const cellY = (row) => TITLE_H + row * (CELL_H + PAD);
const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

function overlaySvg() {
  const parts = [];
  parts.push(
    `<text x="${W / 2}" y="52" text-anchor="middle" font-family="Helvetica, Arial, sans-serif" ` +
      `font-size="34" font-weight="700" fill="#111">Analog temperature — sampling by Gaussian blur, not logits</text>`
  );
  parts.push(
    `<text x="${W / 2}" y="84" text-anchor="middle" font-family="Helvetica, Arial, sans-serif" ` +
      `font-size="19" fill="#666">the temperature parameter Anthropic removed, reimplemented in a smudge · pictionary</text>`
  );
  PANELS.forEach((p, i) => {
    const col = i % 2;
    const row = (i / 2) | 0;
    const x = cellX(col);
    const y = cellY(row);
    parts.push(
      `<text x="${x + 2}" y="${y + 33}" font-family="Helvetica, Arial, sans-serif" font-size="26">` +
        `<tspan font-weight="700" fill="#111">${esc(p.t)}</tspan>` +
        `<tspan dx="14" font-size="21" fill="#777">${esc(p.regime)}</tspan></text>`
    );
    parts.push(
      `<rect x="${x}" y="${y + LABEL_H}" width="${IMG_W}" height="${IMG_H}" fill="none" stroke="#d0d0d0" stroke-width="1.5"/>`
    );
  });
  return Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">${parts.join("")}</svg>`
  );
}

(async () => {
  const images = [];
  for (let i = 0; i < PANELS.length; i++) {
    const col = i % 2;
    const row = (i / 2) | 0;
    const buf = await sharp(path.join(DIR, PANELS[i].file))
      .resize(IMG_W, IMG_H, { kernel: "nearest" }) // keep the grain crisp, don't re-smooth
      .toBuffer();
    images.push({ input: buf, left: cellX(col), top: cellY(row) + LABEL_H });
  }
  const dest = path.join(DIR, "fourup.png");
  await sharp({ create: { width: W, height: H, channels: 3, background: "#ffffff" } })
    .composite([...images, { input: overlaySvg(), left: 0, top: 0 }])
    .png()
    .toFile(dest);
  console.log(`wrote ${dest} (${W}x${H})`);
})();
