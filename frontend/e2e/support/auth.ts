import type { APIRequestContext, Page } from "@playwright/test";

export type SeedUserInput = {
  username?: string;
  email?: string;
  password?: string;
};

export type SeededUser = {
  username: string;
  email: string;
  password: string;
};

export type AuthenticatedUser = SeededUser & {
  access: string;
  refresh: string;
};

function buildSeedUser(input: SeedUserInput = {}): SeededUser {
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const username = input.username ?? `qa-${suffix}`;
  const email = input.email ?? `${username}@example.com`;
  const password = input.password ?? "BoraAli!2026Strong";

  return { username, email, password };
}

export async function seedLoggedOutSession(page: Page) {
  await page.context().clearCookies();
  await page.addInitScript(() => {
    localStorage.removeItem("boraali_access");
    localStorage.removeItem("boraali_refresh");
    localStorage.removeItem("boraali_session_invalidated");
  });
}

export async function seedUser(
  request: APIRequestContext,
  input: SeedUserInput = {},
): Promise<SeededUser> {
  const user = buildSeedUser(input);
  const response = await request.post("http://localhost:8000/api/auth/register/", {
    data: {
      username: user.username,
      email: user.email,
      password: user.password,
      confirm_password: user.password,
    },
  });

  if (!response.ok()) {
    throw new Error(`Failed to seed user: ${response.status()} ${await response.text()}`);
  }

  return user;
}

export async function authenticateAsUser(
  page: Page,
  request: APIRequestContext,
  input: SeedUserInput = {},
): Promise<AuthenticatedUser> {
  const user = await seedUser(request, input);
  const loginResponse = await page.request.post("http://localhost:8000/api/auth/login/", {
    data: {
      username: user.username,
      password: user.password,
    },
  });

  if (!loginResponse.ok()) {
    throw new Error(
      `Failed to login seeded user: ${loginResponse.status()} ${await loginResponse.text()}`,
    );
  }

  const tokens = (await loginResponse.json()) as {
    access: string;
    refresh: string;
  };

  await page.addInitScript(
    ([access, refresh]) => {
      localStorage.setItem("boraali_access", access);
      localStorage.setItem("boraali_refresh", refresh);
    },
    [tokens.access, tokens.refresh],
  );

  return { ...user, access: tokens.access, refresh: tokens.refresh };
}
