import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { HelmetProvider } from "react-helmet-async";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { authService } from "../services/auth.service";
import VerifyEmailPage from "./VerifyEmailPage";

vi.mock("../services/auth.service");

const mockAuthService = vi.mocked(authService);

function renderPage(initialPath = "/verify-email?token=abc123") {
  return render(
    <HelmetProvider>
      <MemoryRouter initialEntries={[initialPath]}>
        <Routes>
          <Route path="/verify-email" element={<VerifyEmailPage />} />
        </Routes>
      </MemoryRouter>
    </HelmetProvider>
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("VerifyEmailPage", () => {
  test("shows loading state while verifying", () => {
    mockAuthService.verifyEmail.mockReturnValue(new Promise(() => {}));
    const { container } = renderPage();

    expect(screen.getByText(/verifying your email/i)).toBeInTheDocument();
    expect(container.querySelector(".animate-spin")).toBeInTheDocument();
  });

  test("shows success state when verification works", async () => {
    mockAuthService.verifyEmail.mockResolvedValue(undefined);

    renderPage();

    await waitFor(() => expect(screen.getByText(/email verified!/i)).toBeInTheDocument());
    expect(screen.getByText(/your account is active/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /go to login/i })).toHaveAttribute("href", "/login");
  });

  test("shows generic error when verification fails", async () => {
    mockAuthService.verifyEmail.mockRejectedValue(new Error("boom"));

    renderPage();

    await waitFor(() =>
      expect(screen.getByText(/invalid or expired link/i)).toBeInTheDocument()
    );
    expect(screen.getByText(/could not verify your email/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /resend verification email/i })).toBeInTheDocument();
  });

  test("shows no-token state when token is missing", async () => {
    renderPage("/verify-email");

    await waitFor(() =>
      expect(screen.getByText(/invalid or expired link/i)).toBeInTheDocument()
    );
    expect(screen.getByText(/no verification token found/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /resend verification email/i })).toBeInTheDocument();
  });

  test("resend button calls resendVerification", async () => {
    mockAuthService.verifyEmail.mockRejectedValue(new Error("boom"));
    mockAuthService.resendVerification.mockResolvedValue(undefined);

    renderPage();

    await waitFor(() =>
      expect(screen.getByRole("button", { name: /resend verification email/i })).toBeInTheDocument()
    );

    fireEvent.click(screen.getByRole("button", { name: /resend verification email/i }));

    await waitFor(() => expect(mockAuthService.resendVerification).toHaveBeenCalledTimes(1));
    expect(screen.getByText(/email resent/i)).toBeInTheDocument();
  });
});
