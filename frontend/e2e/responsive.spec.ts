import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { expect, test, type Page } from "@playwright/test";

const place = JSON.parse(
  readFileSync(
    fileURLToPath(new URL("./fixtures/place-detail.json", import.meta.url)),
    "utf8",
  ),
);

const visit = JSON.parse(
  readFileSync(
    fileURLToPath(new URL("./fixtures/visit-detail.json", import.meta.url)),
    "utf8",
  ),
);

const viewports = [
  { name: "mobile", width: 360, height: 780 },
  { name: "tablet", width: 768, height: 1024 },
  { name: "desktop", width: 1280, height: 900 },
];

async function mockApi(page: Page) {
  await page.route("**/auth/me/", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({ id: 1, username: "tester", email: "tester@example.com" }),
    });
  });

  await page.route("**/places/?**", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        count: 1,
        next: null,
        previous: null,
        results: [place],
      }),
    });
  });

  await page.route(`**/places/${place.public_id}/`, async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify(place),
    });
  });

  await page.route(`**/visits/${visit.public_id}/`, async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify(visit),
    });
  });
}

async function signIn(page: Page) {
  await page.addInitScript(() => {
    localStorage.setItem("boraali_access", "test-access-token");
  });
}

async function expectNoHorizontalOverflow(page: Page) {
  const hasOverflow = await page.evaluate(() => {
    const documentWidth = document.documentElement.scrollWidth;
    const viewportWidth = document.documentElement.clientWidth;
    const bodyWidth = document.body.scrollWidth;

    return documentWidth > viewportWidth || bodyWidth > viewportWidth;
  });

  expect(hasOverflow).toBe(false);
}

for (const viewport of viewports) {
  test(`places list has no horizontal overflow on ${viewport.name}`, async ({ page }) => {
    // Given the API is mocked and the user is signed in at the target viewport
    await page.setViewportSize(viewport);
    await mockApi(page);
    await signIn(page);

    // When the user opens the places list
    await page.goto("/places");
    await page.getByRole("link", { name: /novo lugar|novo/i }).waitFor({ state: "visible" });

    // Then the page header, new-place link, and place card are visible
    await expect(page.getByRole("heading", { name: "Bora Ali" })).toBeVisible();
    await expect(page.getByRole("link", { name: /novo lugar|novo/i })).toBeVisible();
    await expect(page.getByText(place.name)).toBeVisible();

    // And the page has no horizontal overflow
    await expectNoHorizontalOverflow(page);
  });

  test(`place detail has no horizontal overflow on ${viewport.name}`, async ({ page }) => {
    // Given the API is mocked and the user is signed in at the target viewport
    await page.setViewportSize(viewport);
    await mockApi(page);
    await signIn(page);

    // When the user opens a place detail page
    await page.goto(`/places/${place.public_id}`);

    // Then the edit action and heading are visible
    await page.getByRole("link", { name: "Editar" }).waitFor({ state: "visible" });
    await expect(page.getByRole("heading", { name: place.name })).toBeVisible();
    await expect(page.getByRole("link", { name: "Editar" })).toBeVisible();

    // And the consumables summary section is rendered
    await expect(page.getByRole("heading", { name: "Resumo de consumíveis" })).toBeVisible();

    // And the visit item name is visible after expanding the consumables list
    await page.getByRole("button", { name: "Ver consumíveis" }).click();
    await expect(page.getByText("Extremely long item name", { exact: false })).toBeVisible();

    // And the page has no horizontal overflow
    await expectNoHorizontalOverflow(page);
  });

  test(`new visit form has no horizontal overflow on ${viewport.name}`, async ({ page }) => {
    // Given the API is mocked and the user is signed in at the target viewport
    await page.setViewportSize(viewport);
    await mockApi(page);
    await signIn(page);

    // When the user opens the new visit form
    await page.goto(`/places/${place.public_id}/visits/new`);
    await page.getByRole("heading", { name: "Nova visita" }).waitFor({ state: "visible" });

    // Then the form heading and add-consumable button are visible
    await expect(page.getByRole("heading", { name: "Nova visita" })).toBeVisible();
    await expect(page.getByRole("button", { name: /adicionar consumível/i }).last()).toBeVisible();

    // When the user clicks add consumable
    await page.getByRole("button", { name: /adicionar consumível/i }).last().click();

    // Then the visit item dialog opens
    await page.getByRole("dialog").waitFor({ state: "visible" });
    await expect(page.getByRole("dialog")).toBeVisible();

    // And the form has no horizontal overflow
    await expectNoHorizontalOverflow(page);
  });

  test(`edit visit form has no horizontal overflow on ${viewport.name}`, async ({ page }) => {
    // Given the API is mocked and the user is signed in at the target viewport
    await page.setViewportSize(viewport);
    await mockApi(page);
    await signIn(page);

    // When the user opens the edit visit form
    await page.goto(`/visits/${visit.public_id}/edit`);
    await page.getByRole("heading", { name: "Editar visita" }).waitFor({ state: "visible" });

    // Then the form heading, existing visit item, and save button are visible
    await expect(page.getByRole("heading", { name: "Editar visita" })).toBeVisible();
    await expect(page.getByText("Extremely long item name", { exact: false })).toBeVisible();
    await expect(page.getByRole("button", { name: "Salvar visita" })).toBeVisible();

    // And the form has no horizontal overflow
    await expectNoHorizontalOverflow(page);
  });
}
