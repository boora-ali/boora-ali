import { expect, test } from "@playwright/test";
import { seedLoggedOutSession } from "../support/auth";
import { mockAuthenticatedSession } from "../support/mock-auth";
import { mockLoginUnauthorized } from "../support/error-fixtures";

// Scenario 1 — Login with wrong credentials
test("login shows error when backend rejects credentials", async ({ page }) => {
  // Given a clean session and a mocked 401 from the login endpoint
  await seedLoggedOutSession(page);
  await mockLoginUnauthorized(page);
  await page.route("**/api/auth/refresh/", async (route) => {
    await route.fulfill({
      status: 401,
      contentType: "application/json",
      body: JSON.stringify({ detail: "Token inválido." }),
    });
  });

  // When the user submits invalid credentials
  await page.goto("/login");
  await page.getByLabel("Usuário").fill("nao-existe@example.com");
  await page.getByLabel("Senha").fill("senha-errada");
  await page.getByRole("button", { name: "Entrar" }).click();

  // Then the inline error is visible and the app stays on /login
  await expect(page.getByText("Credenciais inválidas")).toBeVisible();
  await expect(page).toHaveURL(/\/login/);
});

// Scenario 2 — Login without filling fields does not call the API
test("login does not submit when fields are empty", async ({ page }) => {
  // Given a clean session
  await seedLoggedOutSession(page);

  // And a listener that detects if the login endpoint is called
  let loginApiCalled = false;
  await page.route("**/api/auth/login/", async (route) => {
    loginApiCalled = true;
    await route.continue();
  });

  // When the user clicks Entrar without filling any field
  await page.goto("/login");
  await page.getByRole("button", { name: "Entrar" }).click();

  // Then the API was never called, error message is shown, and the app stays on /login
  expect(loginApiCalled).toBe(false);
  await expect(page.getByText("Preencha todos os campos")).toBeVisible();
  await expect(page).toHaveURL(/\/login/);
});

// Scenario 3 — Unauthenticated access to protected route
test("unauthenticated user is redirected to login from /places", async ({ page }) => {
  // Given no access token in localStorage
  await seedLoggedOutSession(page);

  // When the user navigates directly to the protected route
  await page.goto("/places");

  // Then the app redirects to /login
  await expect(page).toHaveURL(/\/login/);
});

// Scenario 4 — Session expiry banner shown on login page
test("session-expiry banner is visible when session was invalidated", async ({ page }) => {
  // Given the session-invalidated flag is set in localStorage (set by api.ts on session_expired response)
  await page.addInitScript(() => {
    localStorage.setItem("boraali_session_invalidated", "true");
  });

  // When the user opens the login page
  await page.goto("/login");

  // Then the amber session-expiry banner is visible
  await expect(
    page.getByText("Sua sessão foi encerrada porque você entrou em outro dispositivo."),
  ).toBeVisible();
});

// Scenario 5 — Password change section hidden for Google accounts
test("change-password section is not shown for Google accounts", async ({ page }) => {
  // Given an authenticated session where the account is a Google account
  await mockAuthenticatedSession(page, { is_google_account: true });

  // When the user opens the account settings page
  await page.goto("/account");
  await page.getByRole("heading", { name: /perfil|conta/i }).waitFor({ state: "visible" });

  // Then the change-password fields are not present
  await expect(page.getByLabel("Senha atual")).not.toBeVisible();
  await expect(page.getByLabel("Nova senha")).not.toBeVisible();
});
