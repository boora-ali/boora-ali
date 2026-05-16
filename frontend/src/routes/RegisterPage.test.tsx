import { vi } from "vitest";

vi.mock("../components/auth/TurnstileWidget", () => ({ TurnstileWidget: () => null }));
vi.mock("../services/auth.service");
vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { HelmetProvider } from "react-helmet-async";
import { beforeEach, describe, expect, test } from "vitest";
import { AxiosError } from "axios";
import RegisterPage from "./RegisterPage";
import { authService } from "../services/auth.service";

const navigate = vi.fn();

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
  return { ...actual, useNavigate: () => navigate };
});

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

function renderPage() {
  return render(
    <HelmetProvider>
      <MemoryRouter>
        <RegisterPage />
      </MemoryRouter>
    </HelmetProvider>
  );
}

function fillForm(opts: { password?: string; confirmPassword?: string } = {}) {
  const { password = "Abc12345", confirmPassword = "Abc12345" } = opts;
  fireEvent.change(screen.getByLabelText(/username/i), { target: { value: "testuser" } });
  fireEvent.change(screen.getByLabelText(/^email$/i), { target: { value: "test@test.com" } });
  fireEvent.change(screen.getByLabelText(/^password$/i), { target: { value: password } });
  fireEvent.change(screen.getByLabelText(/confirm password/i), { target: { value: confirmPassword } });
  fireEvent.click(screen.getByRole("switch", { name: /I have read/i }));
}

beforeEach(() => {
  vi.clearAllMocks();
  navigate.mockReset();
});

test("renders all registration fields", () => {
  const { container } = renderPage();
  expect(screen.getByLabelText(/username/i)).toBeInTheDocument();
  expect(screen.getByLabelText(/^email$/i)).toBeInTheDocument();
  expect(screen.getByLabelText(/^password$/i)).toBeInTheDocument();
  expect(screen.getByLabelText(/confirm password/i)).toBeInTheDocument();
  expect(container.querySelector('input[name="website"]')).toBeInTheDocument();
});

describe("validação Zod", () => {
  test("senha com menos de 8 chars (BVA) bloqueia submit", async () => {
    const { container } = renderPage();

    fireEvent.change(screen.getByLabelText(/username/i), { target: { value: "testuser" } });
    fireEvent.change(screen.getByLabelText(/^email$/i), { target: { value: "test@test.com" } });
    fireEvent.change(screen.getByLabelText(/^password$/i), { target: { value: "short1" } });
    fireEvent.change(screen.getByLabelText(/confirm password/i), { target: { value: "short1" } });
    fireEvent.click(screen.getByRole("switch", { name: /I have read/i }));

    fireEvent.submit(container.querySelector("form")!);

    await waitFor(() => expect(mockAuthService.register).not.toHaveBeenCalled());
  });

  test("confirmação de senha diferente bloqueia submit", async () => {
    const { container } = renderPage();

    fillForm({ password: "Abc12345", confirmPassword: "Diferente1" });

    fireEvent.submit(container.querySelector("form")!);

    await waitFor(() => expect(mockAuthService.register).not.toHaveBeenCalled());
  });
});

describe("submit", () => {
  test("sucesso redireciona para /login", async () => {
    mockAuthService.register.mockResolvedValueOnce(undefined);

    renderPage();
    fillForm();

    await waitFor(() =>
      expect(screen.getByRole("button", { name: /create account/i })).not.toBeDisabled()
    );

    fireEvent.click(screen.getByRole("button", { name: /create account/i }));

    await waitFor(() => expect(navigate).toHaveBeenCalledWith("/login"));
    expect(mockAuthService.register).toHaveBeenCalledTimes(1);
  });

  test("exibe erro de campo quando API retorna 400 com email fieldError", async () => {
    mockAuthService.register.mockRejectedValueOnce(
      axiosErr(400, { email: ["Email already in use."] })
    );

    renderPage();
    fillForm();

    await waitFor(() =>
      expect(screen.getByRole("button", { name: /create account/i })).not.toBeDisabled()
    );

    fireEvent.click(screen.getByRole("button", { name: /create account/i }));

    await waitFor(() =>
      expect(screen.getByText("Email already in use.")).toBeInTheDocument()
    );
  });
});
