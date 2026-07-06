import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { AxiosError } from "axios";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { toast } from "sonner";

vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));

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
      terms_accepted_at: "2026-05-29T12:00:00.000Z",
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
        "account.privacy.title": "Seus dados",
        "account.privacy.description": "Exporte seus dados pessoais ou revise o último consentimento registrado.",
        "account.privacy.export.button": "Exportar meus dados",
        "account.privacy.export.success": "Download iniciado.",
        "account.privacy.export.error": "Não foi possível exportar seus dados.",
        "account.privacy.acceptedAt": "Termos aceitos em {{date}}.",
        "account.rights.title": "Seus direitos",
        "account.rights.description": "Atalhos",
        "account.rights.editProfile": "Editar perfil",
        "account.rights.exportData": "Exportar dados",
        "account.rights.withdrawConsent": "Revogar consentimento",
        "account.rights.deleteAccount": "Excluir conta",
        "account.rights.withdraw.success": "Consentimento revogado. A exclusão da conta foi agendada.",
        "account.rights.withdraw.error": "Não foi possível revogar o consentimento.",
        "account.delete.title": "Zona de perigo",
        "account.delete.description": "Descrição exclusão",
        "account.delete.grace": "7 dias",
        "account.delete.button": "Excluir minha conta",
        "account.delete.deleting": "Excluindo",
        "account.delete.error": "Erro exclusão",
        "account.delete.scheduled": "Conta agendada",
        "account.delete.confirm.title": "Excluir conta permanentemente?",
        "account.delete.confirm.description": "Confirme a exclusão",
        "account.delete.confirm.password": "Confirme com sua senha",
        "account.delete.confirm.action": "Sim, excluir minha conta",
        "common.back": "Voltar",
        "common.cancel": "Cancelar",
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

    await waitFor(() => expect(toast.success).toHaveBeenCalledWith("Salvo"));
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
      expect(toast.error).toHaveBeenCalledWith("Internal server error")
    );
  });

  test("exibe avatar quando usuário tem profile_photo_url", () => {
    profilePhotoUrl = "https://example.com/photo.jpg";

    renderPage();

    expect(screen.getByRole("img", { name: "Foto do perfil" })).toBeInTheDocument();
  });
});

describe("exclusão de conta", () => {
  test("revoga consentimento e agenda exclusão", async () => {
    mockAuthService.withdrawConsent.mockResolvedValueOnce({ detail: "ok" });

    renderPage();

    fireEvent.click(screen.getByRole("button", { name: "Revogar consentimento" }));

    await waitFor(() => expect(mockAuthService.withdrawConsent).toHaveBeenCalledTimes(1));
    expect(screen.getByText(/Conta agendada/)).toBeInTheDocument();
    expect(toast.success).toHaveBeenCalledWith("Consentimento revogado. A exclusão da conta foi agendada.");
  });

  test("envia senha ao solicitar exclusão de conta não-Google", async () => {
    mockAuthService.deleteAccount.mockResolvedValueOnce(undefined);
    renderPage();

    fireEvent.click(screen.getByRole("button", { name: "Excluir minha conta" }));
    fireEvent.change(screen.getByLabelText("Confirme com sua senha"), {
      target: { value: "senhaAtual1!" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Sim, excluir minha conta" }));

    await waitFor(() =>
      expect(mockAuthService.deleteAccount).toHaveBeenCalledWith({
        password: "senhaAtual1!",
      })
    );
    expect(screen.getByText(/Conta agendada/)).toBeInTheDocument();
  });

  test("conta Google solicita exclusão sem campo de senha", async () => {
    isGoogleAccount = true;
    mockAuthService.deleteAccount.mockResolvedValueOnce(undefined);
    renderPage();

    fireEvent.click(screen.getByRole("button", { name: "Excluir minha conta" }));
    expect(screen.queryByLabelText("Confirme com sua senha")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Sim, excluir minha conta" }));

    await waitFor(() => expect(mockAuthService.deleteAccount).toHaveBeenCalledWith(undefined));
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

    await waitFor(() => expect(toast.success).toHaveBeenCalledWith("Senha salva"));
    expect(mockAuthService.changePassword).toHaveBeenCalledTimes(1);
  });
});

describe("seção Seus dados", () => {
  test("exibe a central de privacidade e dispara exportação", async () => {
    mockAuthService.exportData.mockResolvedValueOnce(undefined);

    renderPage();

    expect(screen.getByRole("heading", { name: "Seus dados" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Exportar meus dados" }));

    await waitFor(() => expect(mockAuthService.exportData).toHaveBeenCalledTimes(1));
    expect(toast.success).toHaveBeenCalledWith("Download iniciado.");
  });
});
