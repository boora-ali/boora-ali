import type { Page } from "@playwright/test";

const defaultUser = {
  id: 1,
  username: "tester",
  email: "tester@example.com",
  display_name: "Tester",
  nickname: "",
  profile_photo_url: "",
  is_google_account: false,
};

export type UserOverrides = Partial<typeof defaultUser>;

export async function mockAuthenticatedSession(
  page: Page,
  overrides: UserOverrides = {},
) {
  const user = { ...defaultUser, ...overrides };

  await page.addInitScript(([access, refresh]) => {
    localStorage.setItem("boraali_access", access);
    localStorage.setItem("boraali_refresh", refresh);
  }, ["test-access-token", "test-refresh-token"]);

  await page.route("**/api/auth/me/", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify(user),
    });
  });
}
