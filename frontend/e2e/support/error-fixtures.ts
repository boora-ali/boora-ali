import type { Page } from "@playwright/test";

export const invalidCredentialsResponse = {
  code: "authentication_failed",
  detail: "Credenciais inválidas.",
};

export const serverErrorResponse = {
  detail: "Erro interno do servidor.",
};

export const instagramUrlFieldError = {
  instagram_url: ["Informe uma URL do Instagram válida."],
};

export const ratingAboveMaxFieldError = {
  overall_rating: ["Certifique-se de que este valor seja menor ou igual a 10."],
};

export const ratingBelowMinFieldError = {
  overall_rating: ["Certifique-se de que este valor seja maior ou igual a 0."],
};

export async function mockLoginUnauthorized(page: Page) {
  await page.route("**/api/auth/login/", async (route) => {
    await route.fulfill({
      status: 401,
      contentType: "application/json",
      body: JSON.stringify(invalidCredentialsResponse),
    });
  });
}

export async function mockPlacePostBadRequest(
  page: Page,
  errors: Record<string, string[]>,
) {
  await page.route("**/api/places/", async (route) => {
    if (route.request().method() === "POST") {
      await route.fulfill({
        status: 400,
        contentType: "application/json",
        body: JSON.stringify(errors),
      });
    } else {
      await route.continue();
    }
  });
}

export async function mockPlacePostServerError(page: Page) {
  await page.route("**/api/places/", async (route) => {
    if (route.request().method() === "POST") {
      await route.fulfill({
        status: 500,
        contentType: "application/json",
        body: JSON.stringify(serverErrorResponse),
      });
    } else {
      await route.continue();
    }
  });
}

export async function mockVisitPostBadRequest(
  page: Page,
  placePublicId: string,
  errors: Record<string, string[]>,
) {
  await page.route(`**/api/places/${placePublicId}/visits/`, async (route) => {
    if (route.request().method() === "POST") {
      await route.fulfill({
        status: 400,
        contentType: "application/json",
        body: JSON.stringify(errors),
      });
    } else {
      await route.continue();
    }
  });
}

export async function mockPlacesNetworkFailure(page: Page) {
  // Matches /api/places/ with or without query string (e.g. ?page=1)
  await page.route(/\/api\/places\/(?:\?.*)?$/, async (route) => {
    if (route.request().method() === "GET") {
      await route.abort("failed");
    } else {
      await route.continue();
    }
  });
}
