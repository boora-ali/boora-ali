#!/usr/bin/env node
/**
 * Post-build script: prerender / with Puppeteer after vite build.
 * Workaround for Vite 8 (Rolldown) bug where @prerenderer/rollup-plugin
 * cannot replace the root index.html via emitFile.
 */

import { createServer } from "node:http";
import { readFileSync, writeFileSync, existsSync, statSync } from "node:fs";
import { resolve, extname, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import puppeteer from "puppeteer";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DIST = resolve(__dirname, "../dist");
const PORT = 5174;
const WAIT_MS = 3000;

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript",
  ".mjs": "application/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".webmanifest": "application/manifest+json",
  ".txt": "text/plain",
  ".xml": "text/xml",
};

function serveFile(req, res) {
  const urlPath = req.url.split("?")[0];
  let filePath = resolve(DIST, "." + urlPath);

  // SPA fallback: if path is a directory or doesn't exist, serve index.html
  if (!existsSync(filePath) || statSync(filePath).isDirectory()) {
    filePath = resolve(DIST, "index.html");
  }

  try {
    const data = readFileSync(filePath);
    const mime = MIME[extname(filePath)] || "application/octet-stream";
    res.writeHead(200, { "Content-Type": mime });
    res.end(data);
  } catch {
    res.writeHead(404);
    res.end("Not found");
  }
}

async function main() {
  const server = createServer(serveFile);
  await new Promise((resolve) => server.listen(PORT, "127.0.0.1", resolve));
  console.log(`[prerender] Server started at http://127.0.0.1:${PORT}`);

  let browser;
  try {
    browser = await puppeteer.launch({
      headless: true,
      executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });
    const page = await browser.newPage();

    await page.setUserAgent(
      "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)"
    );

    console.log(`[prerender] Rendering http://127.0.0.1:${PORT}/ ...`);
    await page.goto(`http://127.0.0.1:${PORT}/`, {
      waitUntil: "networkidle0",
      timeout: 30000,
    });
    await new Promise((r) => setTimeout(r, WAIT_MS));

    const html = await page.evaluate(() => document.documentElement.outerHTML);

    const outPath = resolve(DIST, "index.html");
    writeFileSync(outPath, "<!DOCTYPE html>\n" + html, "utf-8");
    console.log(`[prerender] Written ${outPath} (${html.length} bytes)`);
  } finally {
    if (browser) await browser.close();
    server.close();
    console.log("[prerender] Done.");
  }
}

main().catch((err) => {
  console.error("[prerender] Error:", err);
  process.exit(1);
});
