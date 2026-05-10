import { expect, test } from "@playwright/test";
import { seedLoggedOutSession, seedUser } from "../support/auth";
import { stubGoogleIdentity } from "../support/google-gis-stub";

test("login succeeds with username and password", async ({ page, request }) => {
  // Given a clean session and a seeded user
  await seedLoggedOutSession(page);
  const user = await seedUser(request, { password: "BoraAli!2026Strong" });

  // When the user fills in valid credentials and submits
  await page.goto("/login");
  await page.getByLabel("Usuário").fill(user.email);
  await page.getByLabel("Senha").fill(user.password);
  await page.getByRole("button", { name: "Entrar" }).click();

  // Then the app redirects to /places
  await expect(page).toHaveURL(/\/places$/);
});

test("login succeeds with Google", async ({ page }) => {
  // Given a clean session with a stubbed Google identity and mocked backend
  await seedLoggedOutSession(page);
  await stubGoogleIdentity(page);

  await page.route("**/api/auth/google/", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        access: "google-access-token",
        refresh: "google-refresh-token",
      }),
    });
  });

  await page.route("**/api/auth/me/", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        id: 1,
        username: "google-user",
        email: "google-user@example.com",
        display_name: "Google User",
        nickname: "",
        profile_photo_url: "",
        is_google_account: true,
      }),
    });
  });

  // When the user clicks the Google sign-in button
  await page.goto("/login");
  await page.getByRole("button", { name: "Fazer Login com o Google" }).click();

  // Then the app redirects to /places
  await expect(page).toHaveURL(/\/places$/);
});
