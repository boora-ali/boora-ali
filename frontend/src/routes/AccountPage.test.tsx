import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, expect, test, vi } from "vitest";

const navigate = vi.fn();
const logout = vi.fn().mockResolvedValue(undefined);
let isGoogleAccount = false;

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
  return {
    ...actual,
    useNavigate: () => navigate,
  };
});

vi.mock("../contexts/useAuth", () => ({
  useAuth: () => ({
    user: {
      id: 1,
      username: "smovisk",
      email: "smovisk@gmail.com",
      display_name: "Smovisk",
      nickname: "",
      profile_photo_url: "",
      is_google_account: isGoogleAccount,
    },
    setUser: vi.fn(),
    logout,
  }),
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => {
      const labels: Record<string, string> = {
        "account.menu.logout": "Sair",
        "account.title": "Conta",
        "account.subtitle": "Gerencie sua conta",
        "account.profile.saved": "Salvo",
        "account.profile.error": "Erro",
        "account.password.saved": "Senha salva",
        "account.password.error": "Erro",
        "account.profile.changePhoto": "Alterar foto",
        "account.profile.name": "Nome",
        "account.profile.nickname": "Apelido",
        "account.profile.username": "Usuário",
        "account.profile.email": "E-mail",
        "account.password.title": "Senha",
        "account.password.current": "Senha atual",
        "account.password.next": "Nova senha",
        "account.password.confirm": "Confirmar senha",
        "account.password.save": "Salvar senha",
        "common.back": "Voltar",
        "common.home": "Início",
        "common.photo": "Foto",
      };
      return labels[key] ?? key;
    },
  }),
}));

import AccountPage from "./AccountPage";

beforeEach(() => {
  navigate.mockReset();
  logout.mockClear();
  isGoogleAccount = false;
});

test("logout button signs out and redirects to login", async () => {
  render(
    <MemoryRouter>
      <AccountPage />
    </MemoryRouter>
  );

  fireEvent.click(await screen.findByRole("button", { name: "Sair" }));

  await waitFor(() => expect(logout).toHaveBeenCalledTimes(1));
  await waitFor(() =>
    expect(navigate).toHaveBeenCalledWith("/login", { replace: true })
  );
});

test("hides password section for Google accounts", async () => {
  isGoogleAccount = true;

  render(
    <MemoryRouter>
      <AccountPage />
    </MemoryRouter>
  );

  expect(screen.queryByRole("heading", { name: "Senha" })).not.toBeInTheDocument();
  expect(screen.queryByLabelText("Senha atual")).not.toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Sair" })).toBeInTheDocument();
});
