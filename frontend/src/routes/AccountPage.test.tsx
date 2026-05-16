import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { AxiosError } from "axios";
import { beforeEach, describe, expect, test, vi } from "vitest";

const navigate = vi.fn();
const logout = vi.fn().mockResolvedValue(undefined);
const setUser = vi.fn();
let isGoogleAccount = false;
let profilePhotoUrl = "";

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
  return {
    ...actual,
    useNavigate: () => navigate,
  };
});

vi.mock("../services/auth.service");
vi.mock("../contexts/useAuth", () => ({
  useAuth: () => ({
    user: {
      id: 1,
      username: "smovisk",
      email: "smovisk@gmail.com",
      display_name: "Smovisk",
      nickname: "",
      profile_photo_url: profilePhotoUrl,
      is_google_account: isGoogleAccount,
    },
    setUser,
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
        "account.profile.save": "Salvar perfil",
        "account.profile.photo": "Foto",
        "account.photoAlt": "Foto do perfil",
        "account.password.saved": "Senha salva",
        "account.password.error": "Erro senha",
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
        "account.profile.removePhoto": "Remover foto",
        "common.back": "Voltar",
        "common.home": "Início",
        "common.photo": "Foto",
      };
      return labels[key] ?? key;
    },
  }),
}));

import AccountPage from "./AccountPage";
import { authService } from "../services/auth.service";

const mockAuthService = vi.mocked(authService);

function axiosErr(status: number, data: unknown) {
  return new AxiosError("error", "ERR_BAD_REQUEST", {} as never, {}, {
    status,
    data,
    statusText: "",
    headers: {},
    config: {} as never,
  } as never);
}

beforeEach(() => {
  navigate.mockReset();
  logout.mockClear();
  setUser.mockClear();
  isGoogleAccount = false;
  profilePhotoUrl = "";
  vi.clearAllMocks();
  logout.mockResolvedValue(undefined);
});

function renderPage() {
  return render(
    <MemoryRouter>
      <AccountPage />
    </MemoryRouter>
  );
}

test("logout button signs out and redirects to login", async () => {
  renderPage();

  fireEvent.click(await screen.findByRole("button", { name: "Sair" }));

  await waitFor(() => expect(logout).toHaveBeenCalledTimes(1));
  await waitFor(() =>
    expect(navigate).toHaveBeenCalledWith("/login", { replace: true })
  );
});

test("hides password section for Google accounts", () => {
  isGoogleAccount = true;

  renderPage();

  expect(screen.queryByRole("heading", { name: "Senha" })).not.toBeInTheDocument();
  expect(screen.queryByLabelText("Senha atual")).not.toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Sair" })).toBeInTheDocument();
});

describe("formulário de perfil", () => {
  test("salva alterações de perfil com sucesso e exibe mensagem", async () => {
    const updatedUser = {
      id: 1,
      username: "smovisk",
      email: "smovisk@gmail.com",
      display_name: "Smovisk Novo",
      nickname: "",
      profile_photo_url: "",
      is_google_account: false,
    };
    mockAuthService.updateMe.mockResolvedValueOnce(updatedUser);

    renderPage();

    fireEvent.change(screen.getByLabelText("Nome"), { target: { value: "Smovisk Novo" } });
    fireEvent.click(screen.getByRole("button", { name: "Salvar perfil" }));

    await waitFor(() => expect(screen.getByText("Salvo")).toBeInTheDocument());
    expect(mockAuthService.updateMe).toHaveBeenCalledTimes(1);
  });

  test("exibe erro de campo ao salvar perfil com 400 fieldError", async () => {
    mockAuthService.updateMe.mockRejectedValueOnce(
      axiosErr(400, { username: ["Usuário já existe."] })
    );

    renderPage();

    fireEvent.change(screen.getByLabelText("Nome"), { target: { value: "outro" } });
    fireEvent.click(screen.getByRole("button", { name: "Salvar perfil" }));

    await waitFor(() =>
      expect(screen.getByText("Usuário já existe.")).toBeInTheDocument()
    );
  });

  test("exibe erro genérico root ao salvar perfil com 500", async () => {
    mockAuthService.updateMe.mockRejectedValueOnce(
      axiosErr(500, { detail: "Internal server error" })
    );

    renderPage();

    fireEvent.change(screen.getByLabelText("Nome"), { target: { value: "mudança" } });
    fireEvent.click(screen.getByRole("button", { name: "Salvar perfil" }));

    await waitFor(() =>
      expect(screen.getByText("Internal server error")).toBeInTheDocument()
    );
  });

  test("exibe avatar quando usuário tem profile_photo_url", () => {
    profilePhotoUrl = "https://example.com/photo.jpg";

    renderPage();

    expect(screen.getByRole("img", { name: "Foto do perfil" })).toBeInTheDocument();
  });
});

describe("seção Alterar Senha", () => {
  test("campos de senha estão presentes para usuário não-Google", () => {
    renderPage();

    expect(screen.getByLabelText("Senha atual")).toBeInTheDocument();
    expect(screen.getByLabelText("Nova senha")).toBeInTheDocument();
    expect(screen.getByLabelText("Confirmar senha")).toBeInTheDocument();
  });

  test("erro 400 em current_password exibe erro inline no campo", async () => {
    mockAuthService.changePassword.mockRejectedValueOnce(
      axiosErr(400, { current_password: ["Senha incorreta."] })
    );

    renderPage();

    fireEvent.change(screen.getByLabelText("Senha atual"), { target: { value: "errada" } });
    fireEvent.change(screen.getByLabelText("Nova senha"), { target: { value: "novaSenha1!" } });
    fireEvent.change(screen.getByLabelText("Confirmar senha"), { target: { value: "novaSenha1!" } });
    fireEvent.click(screen.getByRole("button", { name: "Salvar senha" }));

    await waitFor(() =>
      expect(screen.getByText("Senha incorreta.")).toBeInTheDocument()
    );
  });

  test("nova senha com menos de 8 chars falha na validação Zod antes de submeter", async () => {
    renderPage();

    fireEvent.change(screen.getByLabelText("Senha atual"), { target: { value: "velha123" } });
    fireEvent.change(screen.getByLabelText("Nova senha"), { target: { value: "curta" } });
    fireEvent.change(screen.getByLabelText("Confirmar senha"), { target: { value: "curta" } });
    fireEvent.click(screen.getByRole("button", { name: "Salvar senha" }));

    await waitFor(() =>
      expect(mockAuthService.changePassword).not.toHaveBeenCalled()
    );
  });

  test("sucesso exibe mensagem e chama changePassword uma vez", async () => {
    mockAuthService.changePassword.mockResolvedValueOnce(undefined);

    renderPage();

    fireEvent.change(screen.getByLabelText("Senha atual"), { target: { value: "senhaAtual1!" } });
    fireEvent.change(screen.getByLabelText("Nova senha"), { target: { value: "novaSenha1!" } });
    fireEvent.change(screen.getByLabelText("Confirmar senha"), { target: { value: "novaSenha1!" } });
    fireEvent.click(screen.getByRole("button", { name: "Salvar senha" }));

    await waitFor(() => expect(screen.getByText("Senha salva")).toBeInTheDocument());
    expect(mockAuthService.changePassword).toHaveBeenCalledTimes(1);
  });
});
