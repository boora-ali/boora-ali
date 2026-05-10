import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { expect, test } from "@playwright/test";
import { mockAuthenticatedSession } from "../support/mock-auth";
import {
  instagramUrlFieldError,
  mockPlacePostBadRequest,
  mockPlacePostServerError,
  ratingAboveMaxFieldError,
  ratingBelowMinFieldError,
  mockVisitPostBadRequest,
  mockPlacesNetworkFailure,
} from "../support/error-fixtures";

const place = JSON.parse(
  readFileSync(
    fileURLToPath(new URL("../fixtures/place-detail.json", import.meta.url)),
    "utf8",
  ),
);

async function mockPlaceDetailApi(page: Parameters<typeof mockAuthenticatedSession>[0]) {
  await page.route(`**/api/places/${place.public_id}/`, async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify(place),
    });
  });
}

// Scenario 6 — Create place without required Nome
test("place form shows required-field error when Nome is empty", async ({ page }) => {
  // Given an authenticated session
  await mockAuthenticatedSession(page);

  // When the user opens the new place form and submits with a whitespace-only Nome
  // (whitespace satisfies browser required but fails JS .trim() check, showing the custom error)
  await page.goto("/places/new");
  await page.getByRole("heading", { name: /novo lugar/i }).waitFor({ state: "visible" });
  await page.getByLabel("Nome").fill("   ");
  await page.getByRole("button", { name: "Salvar" }).click();

  // Then the required-field error is visible and the app stays on /places/new
  await expect(page.getByText("Nome é obrigatório")).toBeVisible();
  await expect(page).toHaveURL(/\/places\/new/);
});

// Scenario 7 — Create place with invalid Instagram URL
test("place form shows inline error for invalid Instagram URL", async ({ page }) => {
  // Given an authenticated session and a mocked 400 for Instagram URL
  await mockAuthenticatedSession(page);
  await mockPlacePostBadRequest(page, instagramUrlFieldError);

  // When the user fills a valid Nome but an invalid Instagram URL and submits
  await page.goto("/places/new");
  await page.getByRole("heading", { name: /novo lugar/i }).waitFor({ state: "visible" });
  await page.getByLabel("Nome").fill("Café da Esquina");
  await page.getByLabel("URL do Instagram").fill("not-a-valid-instagram-url");
  await page.getByRole("button", { name: "Salvar" }).click();

  // Then the Instagram field error is visible and the app stays on /places/new
  await expect(page.getByText("Informe uma URL do Instagram válida.")).toBeVisible();
  await expect(page).toHaveURL(/\/places\/new/);
});

// Scenario 8 — API 500 on place save
test("place form shows generic error message when API returns 500", async ({ page }) => {
  // Given an authenticated session and a mocked 500 on place creation
  await mockAuthenticatedSession(page);
  await mockPlacePostServerError(page);

  // When the user fills a valid place form and submits
  await page.goto("/places/new");
  await page.getByRole("heading", { name: /novo lugar/i }).waitFor({ state: "visible" });
  await page.getByLabel("Nome").fill("Café da Esquina");
  await page.getByRole("button", { name: "Salvar" }).click();

  // Then a generic error message is visible and the app stays on /places/new
  // The 500 response body contains `detail`, so getApiErrorState uses it as the message
  await expect(page.getByText("Erro interno do servidor.")).toBeVisible();
  await expect(page).toHaveURL(/\/places\/new/);
});

// Scenario 9 — Delete place → DELETE is called and app navigates away
test("cancelling place deletion keeps the place visible and makes no DELETE request", async ({ page }) => {
  // Given an authenticated session and a mocked place detail endpoint
  await mockAuthenticatedSession(page);

  let deleteWasCalled = false;
  await page.route(`**/api/places/${place.public_id}/`, async (route) => {
    if (route.request().method() === "DELETE") {
      deleteWasCalled = true;
      await route.fulfill({ status: 204, body: "" });
    } else {
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify(place),
      });
    }
  });

  // When the user navigates to the place detail and clicks Excluir
  await page.goto(`/places/${place.public_id}`);
  await page.getByRole("link", { name: "Editar" }).waitFor({ state: "visible" });
  await page.getByRole("button", { name: "Excluir" }).first().click();

  // Then a confirmation dialog appears
  await page.getByRole("dialog").waitFor({ state: "visible" });
  await expect(page.getByRole("dialog")).toBeVisible();

  // And the user cancels the deletion
  await page.getByRole("dialog").getByRole("button", { name: "Cancelar" }).click();

  // Then the place detail heading is still visible
  await expect(page.getByRole("heading", { name: place.name })).toBeVisible();

  // And no DELETE request was made
  expect(deleteWasCalled).toBe(false);
});

// Scenario 10 — Visit overall rating above maximum (boundary: 11)
test("visit form shows error when overall rating is above 10", async ({ page }) => {
  // Given an authenticated session and a place detail mock
  await mockAuthenticatedSession(page);
  await mockPlaceDetailApi(page);
  await mockVisitPostBadRequest(page, place.public_id, ratingAboveMaxFieldError);

  // When the user opens the new visit form, sets rating to 11, and submits
  await page.goto(`/places/${place.public_id}/visits/new`);
  await page.getByRole("heading", { name: "Nova visita" }).waitFor({ state: "visible" });
  await page.getByLabel("Geral (0-10)").fill("11");
  await page.getByRole("button", { name: "Salvar visita" }).click();

  // Then the rating error is visible
  await expect(page.getByText(/menor ou igual a 10/i)).toBeVisible();
});

// Scenario 11 — Visit overall rating below minimum (boundary: −1)
test("visit form shows error when overall rating is below 0", async ({ page }) => {
  // Given an authenticated session and a place detail mock
  await mockAuthenticatedSession(page);
  await mockPlaceDetailApi(page);
  await mockVisitPostBadRequest(page, place.public_id, ratingBelowMinFieldError);

  // When the user opens the new visit form, sets rating to -1, and submits
  await page.goto(`/places/${place.public_id}/visits/new`);
  await page.getByRole("heading", { name: "Nova visita" }).waitFor({ state: "visible" });
  await page.getByLabel("Geral (0-10)").fill("-1");
  await page.getByRole("button", { name: "Salvar visita" }).click();

  // Then the rating error is visible
  await expect(page.getByText(/maior ou igual a 0/i)).toBeVisible();
});

// Scenario 12 — Close consumable modal via ESC — item not saved
test("closing consumable dialog with ESC does not add item to visit", async ({ page }) => {
  // Given an authenticated session and a place detail mock
  await mockAuthenticatedSession(page);
  await mockPlaceDetailApi(page);

  // When the user opens the new visit form and opens the add-consumable dialog
  await page.goto(`/places/${place.public_id}/visits/new`);
  await page.getByRole("heading", { name: "Nova visita" }).waitFor({ state: "visible" });
  await page.getByRole("button", { name: /adicionar consumível/i }).last().click();
  await page.getByRole("dialog").waitFor({ state: "visible" });

  // And the user fills in the item name but closes with ESC
  await page.getByRole("dialog").getByLabel("Nome do item").fill("Item que não deve aparecer");
  await page.keyboard.press("Escape");

  // Then the dialog is gone and no item appears in the visit form
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await expect(page.getByText("Item que não deve aparecer")).not.toBeVisible();
});

// Scenario 13 — Save consumable without required name — inline error shown, dialog stays open
test("saving consumable without name shows required-field error and keeps dialog open", async ({ page }) => {
  // Given an authenticated session and a place detail mock
  await mockAuthenticatedSession(page);
  await mockPlaceDetailApi(page);

  // When the user opens the new visit form and opens the add-consumable dialog
  await page.goto(`/places/${place.public_id}/visits/new`);
  await page.getByRole("heading", { name: "Nova visita" }).waitFor({ state: "visible" });
  await page.getByRole("button", { name: /adicionar consumível/i }).last().click();
  await page.getByRole("dialog").waitFor({ state: "visible" });

  // And the user clicks Salvar without filling in Nome do item
  await page.getByRole("dialog").getByRole("button", { name: "Salvar" }).click();

  // Then an inline error is visible inside the dialog
  await expect(page.getByRole("dialog").getByText("Nome do item é obrigatório")).toBeVisible();

  // And the dialog remains open
  await expect(page.getByRole("dialog")).toBeVisible();
});

// Scenario 14 — Network failure on places list
test("places list shows error state when network request fails", async ({ page }) => {
  // Given an authenticated session and a failing network for the places endpoint
  await mockAuthenticatedSession(page);
  await mockPlacesNetworkFailure(page);

  // When the user navigates to /places
  await page.goto("/places");

  // Then an error message is visible and no place cards are rendered
  await expect(page.getByText(/falha|erro|não foi possível/i)).toBeVisible();
  await expect(page.getByText(place.name)).not.toBeVisible();
});
