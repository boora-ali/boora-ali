import { vi } from "vitest";

vi.mock("../components/auth/GoogleSignInButton", () => ({
  GoogleSignInButton: () => <button type="button">Google Sign In</button>,
}));
vi.mock("../components/auth/TurnstileWidget", () => ({ TurnstileWidget: () => null }));
vi.mock("../contexts/useAuth");
vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { HelmetProvider } from "react-helmet-async";
import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { AxiosError } from "axios";
import { useAuth } from "../contexts/useAuth";
import LoginPage from "./LoginPage";
import { SESSION_INVALIDATED_KEY } from "../utils/constants";

const navigate = vi.fn();

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
  return { ...actual, useNavigate: () => navigate };
});

const mockLogin = vi.fn();
const mockGoogleLogin = vi.fn();
const mockUseAuth = vi.mocked(useAuth);

function axiosErr(status: number, data: unknown) {
  return new AxiosError("error", "ERR_BAD_REQUEST", {} as never, {}, {
    status,
    data,
    statusText: "",
    headers: {},
    config: {} as never,
  } as never);
}

function renderPage() {
  return render(
    <HelmetProvider>
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>
    </HelmetProvider>
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  navigate.mockReset();
  mockLogin.mockResolvedValue(undefined);
  mockGoogleLogin.mockResolvedValue(undefined);
  mockUseAuth.mockReturnValue({
    user: null,
    loading: false,
    login: mockLogin,
    googleLogin: mockGoogleLogin,
    logout: vi.fn(),
    refreshUser: vi.fn().mockResolvedValue(null),
    setUser: vi.fn(),
  });
});

afterEach(() => {
  localStorage.clear();
});

test("renders username, password fields and Google button", () => {
  renderPage();
  expect(screen.getByLabelText(/username/i)).toBeInTheDocument();
  expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
  expect(screen.getByRole("button", { name: /google sign in/i })).toBeInTheDocument();
});

describe("submit com credenciais válidas", () => {
  test("redireciona para /places após login bem-sucedido", async () => {
    renderPage();

    fireEvent.change(screen.getByLabelText(/username/i), { target: { value: "ana" } });
    fireEvent.change(screen.getByLabelText(/password/i), { target: { value: "secret" } });
    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));

    await waitFor(() => expect(navigate).toHaveBeenCalledWith("/places"));
  });
});

describe("erros de API", () => {
  test("exibe mensagem de erro quando API retorna 401", async () => {
    mockLogin.mockRejectedValueOnce(axiosErr(401, { detail: "Invalid credentials" }));

    renderPage();

    fireEvent.change(screen.getByLabelText(/username/i), { target: { value: "ana" } });
    fireEvent.change(screen.getByLabelText(/password/i), { target: { value: "wrong" } });
    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));

    await waitFor(() =>
      expect(screen.getByText("Invalid credentials")).toBeInTheDocument()
    );
    expect(navigate).not.toHaveBeenCalled();
  });

  test("não chama login ao submeter campos vazios", async () => {
    renderPage();

    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));

    await waitFor(() => expect(mockLogin).not.toHaveBeenCalled());
  });
});

describe("banner de sessão encerrada", () => {
  test("aparece quando SESSION_INVALIDATED_KEY está no localStorage", () => {
    localStorage.setItem(SESSION_INVALIDATED_KEY, "1");

    renderPage();

    expect(screen.getByText(/your session was ended/i)).toBeInTheDocument();
  });

  test("não aparece quando chave não está no localStorage", () => {
    renderPage();

    expect(screen.queryByText(/your session was ended/i)).not.toBeInTheDocument();
  });
});

describe("links de navegação", () => {
  test("link para /register está presente", () => {
    renderPage();

    const link = screen.getByRole("link", { name: /register/i });
    expect(link).toHaveAttribute("href", "/register");
  });
});
