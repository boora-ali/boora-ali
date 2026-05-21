/**
 * Gera os ícones PNG para PWA a partir do bora-ali-mark.svg.
 *
 * Uso:
 *   node scripts/generate-icons.mjs
 *
 * Saídas:
 *   public/icon-192.png          — ícone padrão 192×192
 *   public/icon-512.png          — ícone padrão 512×512
 *   public/icon-maskable-512.png — ícone maskable 512×512 (safe zone 80%)
 */

import sharp from "sharp";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");

const svgPath = resolve(root, "public/bora-ali-mark.svg");
const svgBuffer = readFileSync(svgPath);

// Fundo creme da marca — mesma cor usada no CSS (--color-background)
const BG = { r: 250, g: 247, b: 242, alpha: 1 };

async function generate(outPath, size, padding = 0) {
  const inner = size - padding * 2;

  // Renderiza o SVG no tamanho interno (com antialiasing via sharp/librsvg)
  const rendered = await sharp(svgBuffer)
    .resize(inner, inner, { fit: "contain", background: { ...BG, alpha: 0 } })
    .png()
    .toBuffer();

  // Cola sobre fundo de cor sólida com o padding do safe-zone (para maskable)
  await sharp({
    create: {
      width: size,
      height: size,
      channels: 4,
      background: BG,
    },
  })
    .composite([{ input: rendered, gravity: "center" }])
    .png({ compressionLevel: 9 })
    .toFile(outPath);

  console.log(`✓ ${outPath.replace(root + "/", "")} (${size}×${size}${padding ? `, padding ${padding}px` : ""})`);
}

await generate(resolve(root, "public/icon-192.png"), 192);
await generate(resolve(root, "public/icon-512.png"), 512);

// Maskable: safe zone = 80% do total → padding = 10% de 512 = ~51px
await generate(resolve(root, "public/icon-maskable-512.png"), 512, 51);

console.log("\nÍcones gerados com sucesso.");
