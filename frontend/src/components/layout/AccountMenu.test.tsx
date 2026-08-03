import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { vi } from "vitest";
import { AccountMenu } from "./AccountMenu";

vi.mock("../../contexts/useAuth", () => ({
  useAuth: () => ({
    user: {
      username: "smovisk",
      email: "smovisk@gmail.com",
      display_name: "Smovisk",
      nickname: "",
    },
    logout: vi.fn(),
  }),
}));

vi.mock("./NotificationBell", () => ({ NotificationBell: () => <button type="button">Notificações</button> }));
vi.mock("../ui/LanguageToggle", () => ({ LanguageToggle: () => <div>PT EN</div> }));
vi.mock("../ui/DarkModeToggle", () => ({ DarkModeToggle: () => <div>Modo escuro</div> }));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => ({
      "account.menu.open": "Abrir menu da conta",
      "account.menu.account": "Conta",
      "account.menu.trash": "Lixeira",
      "account.menu.language": "Idioma",
      "account.menu.logout": "Sair",
      "account.photoAlt": "Foto de perfil",
    })[key] ?? key,
  }),
}));

test("opens the account menu as a square neo-brutalist panel", () => {
  render(
    <MemoryRouter>
      <AccountMenu />
    </MemoryRouter>,
  );

  fireEvent.click(screen.getByRole("button", { name: "Abrir menu da conta" }));

  const menu = screen.getByText("Conta").parentElement?.parentElement;
  expect(menu).toHaveClass("border-[3px]");
  expect(menu).toHaveClass("shadow-[6px_6px_0_var(--color-shadow)]");
  expect(menu).not.toHaveClass("rounded-2xl");
});
