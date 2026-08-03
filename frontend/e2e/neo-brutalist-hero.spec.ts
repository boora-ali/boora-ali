import { expect, test } from "@playwright/test";

test("serves the standalone hero shell", async ({ page }) => {
  await page.goto("/neo-brutalist-hero.html");

  await expect(page.locator("#hero")).toBeVisible();
  await expect(page.locator("#hero-copy h1")).toBeVisible();
  await expect(page.getByRole("button", { name: /começar agora/i })).toBeVisible();
  await expect(page.locator("#hero-scene #scene")).toBeVisible();
  await expect(page.locator("#scene canvas")).toBeVisible();
});

test("keeps the Three.js canvas sized to its responsive container", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/neo-brutalist-hero.html");

  const scene = page.locator("#scene");
  const canvas = page.locator("#scene canvas");

  await expect(canvas).toBeVisible();
  await expect.poll(async () => {
    const [sceneWidth, canvasWidth] = await Promise.all([
      scene.evaluate((element) => element.clientWidth),
      canvas.evaluate((element) => Math.round(element.getBoundingClientRect().width)),
    ]);
    return sceneWidth === canvasWidth;
  }).toBe(true);
  await expect(page.locator("html")).toHaveJSProperty("scrollWidth", 390);
});
