import sharp from 'sharp';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const svgPath = join(__dirname, '../public/bora-ali-mark.svg');
const outPath = join(__dirname, '../public/og-image.png');

const W = 1200;
const H = 630;
const LOGO_SIZE = 220;
const BG = '#FAF7F2';
const RED = '#C1121F';

let svgContent = readFileSync(svgPath, 'utf8');
svgContent = svgContent.replace(/fill="#ea1d2c"/g, `fill="${RED}"`);
const svgBuffer = Buffer.from(svgContent);

const logoBuffer = await sharp(svgBuffer)
  .resize(LOGO_SIZE, LOGO_SIZE)
  .png()
  .toBuffer();

const textSvg = `
<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
  <rect width="${W}" height="${H}" fill="${BG}"/>
  <text
    x="${W / 2}"
    y="${H / 2 + LOGO_SIZE / 2 + 48}"
    font-family="Georgia, serif"
    font-size="52"
    font-weight="bold"
    fill="${RED}"
    text-anchor="middle"
  >Bora Ali</text>
  <text
    x="${W / 2}"
    y="${H / 2 + LOGO_SIZE / 2 + 108}"
    font-family="Georgia, serif"
    font-size="28"
    fill="#555"
    text-anchor="middle"
  >Diário de lugares e experiências</text>
</svg>`;

await sharp(Buffer.from(textSvg))
  .composite([{
    input: logoBuffer,
    top: Math.round(H / 2 - LOGO_SIZE / 2 - 40),
    left: Math.round(W / 2 - LOGO_SIZE / 2),
  }])
  .png()
  .toFile(outPath);

console.log(`og-image.png gerado em ${outPath}`);
