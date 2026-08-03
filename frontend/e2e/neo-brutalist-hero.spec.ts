import { expect, test } from "@playwright/test";

test("renders the neo-brutalist hero on the landing route", async ({ page }) => {
  await page.goto("/");

  await expect(page.locator("#neo-brutalist-hero")).toBeVisible();
  await expect(page.locator("#neo-brutalist-hero-copy h1")).toBeVisible();
  await expect(page.getByRole("link", { name: /começar agora/i })).toBeVisible();
  await expect(page.locator("#neo-brutalist-hero-scene #neo-brutalist-scene")).toBeVisible();
  await expect(page.locator("#neo-brutalist-scene canvas")).toBeVisible();
  await expect(page.locator(".landing-nav")).toBeVisible();
  await expect(page.locator("#como-funciona")).toBeVisible();
  await expect(page.locator(".landing-footer")).toBeVisible();

  const themeToggle = page.getByRole("switch", { name: /alternar modo escuro/i });
  const initiallyDark = await page.locator("html").evaluate((element) => element.classList.contains("dark"));
  await themeToggle.click();
  await expect.poll(() => page.locator("html").evaluate((element) => element.classList.contains("dark"))).toBe(!initiallyDark);
});

test("keeps the Three.js canvas sized to its responsive container", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");

  const scene = page.locator("#neo-brutalist-scene");
  const canvas = page.locator("#neo-brutalist-scene canvas");

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
