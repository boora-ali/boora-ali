import { expect, test } from "@playwright/test";
import { authenticateAsUser } from "../support/auth";
import { seedPlace } from "../support/api-seed";
import { placeSeed, visitItemSeed, visitSeed } from "../support/scenario-data";

test("user can create and edit a place", async ({ page, request }) => {
  // Given an authenticated user
  await authenticateAsUser(page, request, { password: "BoraAli!2026Strong" });

  // When the user fills in the new place form and saves
  await page.goto("/places/new");
  await page.getByLabel("Nome").fill(placeSeed.name);
  await page.getByLabel("Categoria").fill(placeSeed.category);
  await page.getByLabel("Endereço").fill(placeSeed.address);
  await page.getByLabel("Notas").fill(placeSeed.notes);
  await page.getByRole("button", { name: "Salvar" }).click();

  // Then the app redirects to the place detail and shows the heading
  await expect(page).toHaveURL(/\/places\/[^/]+$/);
  await expect(page.getByRole("heading", { name: placeSeed.name })).toBeVisible();

  // When the user edits the place name and notes
  await page.getByRole("link", { name: "Editar" }).click();
  await page.getByLabel("Nome").fill(`${placeSeed.name} atualizado`);
  await page.getByLabel("Notas").fill(`${placeSeed.notes} Atualizado.`);
  await page.getByRole("button", { name: "Salvar" }).click();

  // Then the updated heading is visible in the detail page
  await expect(page).toHaveURL(/\/places\/[^/]+$/);
  await expect(page.getByRole("heading", { name: /atualizado/i })).toBeVisible();
});

test("user can create a visit and remove a consumable", async ({ page, request }) => {
  // Given an authenticated user and a seeded place
  const auth = await authenticateAsUser(page, request, { password: "BoraAli!2026Strong" });
  const place = await seedPlace(request, placeSeed, auth.access);

  // When the user navigates to the place and starts a new visit
  await page.goto(`/places/${place.public_id}`);
  await page.getByRole("link", { name: "+ Adicionar visita" }).click();

  // Then the new visit URL is active
  await expect(page).toHaveURL(new RegExp(`/places/${place.public_id}/visits/new$`));

  // When the user fills in notes and adds a consumable via the dialog
  await page.getByLabel("Observações gerais").fill(visitSeed.general_notes);
  await page.getByRole("button", { name: "+ Adicionar consumível" }).last().click();

  const itemModal = page.getByRole("dialog");
  await itemModal.getByLabel("Nome do item").fill(visitItemSeed.name);
  await itemModal.getByLabel("Tipo").selectOption(visitItemSeed.type);
  await itemModal.getByLabel("Avaliação (0-10)").fill(String(visitItemSeed.rating));
  await itemModal.getByLabel("Preço (R$)").fill(visitItemSeed.price);
  await itemModal.getByLabel("Comentários").fill(visitItemSeed.notes);
  await itemModal.getByLabel("Pediria novamente").setChecked(visitItemSeed.would_order_again);
  await itemModal.getByRole("button", { name: "Salvar" }).click();

  // When the user saves the visit
  await page.getByRole("button", { name: "Salvar visita" }).click();

  // Then the app redirects to the place detail and the consumable is listed
  await expect(page).toHaveURL(new RegExp(`/places/${place.public_id}$`));
  await page.getByRole("button", { name: "Ver consumíveis" }).click();
  await expect(page.getByText(visitItemSeed.name)).toBeVisible();

  // When the user edits the visit and removes the consumable
  await page.getByRole("button", { name: "Editar" }).last().click();
  const itemCard = page.locator("div.group").filter({ hasText: visitItemSeed.name }).first();
  await itemCard.hover();
  await itemCard.getByLabel("Remover").click();
  await page.getByRole("button", { name: "Salvar visita" }).click();

  // Then the consumable no longer appears in the visit
  await expect(page).toHaveURL(new RegExp(`/places/${place.public_id}$`));
  await page.getByRole("button", { name: "Ver consumíveis" }).click();
  await expect(page.getByText("Nenhum consumível registrado.")).toBeVisible();
});
