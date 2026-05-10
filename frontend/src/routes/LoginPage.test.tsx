import { vi } from "vitest";
vi.mock("../components/auth/GoogleSignInButton", () => ({
  GoogleSignInButton: () => <button type="button">Google Sign In</button>,
}));

import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { AuthProvider } from "../contexts/AuthContext";
import LoginPage from "./LoginPage";

test("renders username and password fields", () => {
  render(
    <MemoryRouter>
      <AuthProvider>
        <LoginPage />
      </AuthProvider>
    </MemoryRouter>
  );
  expect(screen.getByLabelText(/username/i)).toBeInTheDocument();
  expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
  expect(screen.getByRole("button", { name: /google sign in/i })).toBeInTheDocument();
});
