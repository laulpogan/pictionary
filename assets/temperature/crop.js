// One-off: render assets/temperature/demo.txt at conservative density across
// temperatures and tight-crop each to the text bbox so the smudge fills the frame.
const path = require("path");
const sharp = require("../../node_modules/sharp");
const { renderFile } = require("../../dist/render");

const SRC = path.join(__dirname, "demo.txt");
// [temperature, filename-label] — explicit labels so 1.0 doesn't collapse to "1".
const TEMPS = [[0, "0"], [0.4, "0.4"], [0.8, "0.8"], [1.0, "1.0"]];
// Crop window covering the 4 short lines at conservative (14px) density.
const CROP = { left: 12, top: 16, width: 300, height: 96 };

(async () => {
  for (const [t, label] of TEMPS) {
    const outDir = path.join(__dirname, "build", `t${label}`);
    const res = await renderFile(SRC, "conservative", outDir, t);
    const dest = path.join(__dirname, `t${label}.png`);
    await sharp(res.files[0]).extract(CROP).toFile(dest);
    console.log(`t=${t} -> ${dest}`);
  }
})();
