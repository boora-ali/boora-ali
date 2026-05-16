import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { ProtectedRoute } from "./ProtectedRoute";
import { useAuth } from "../../contexts/useAuth";
import { vi } from "vitest";

vi.mock("../../contexts/useAuth");

const mockedUseAuth = vi.mocked(useAuth);

test("exibe loading state enquanto autenticação está carregando", () => {
  mockedUseAuth.mockReturnValue({
    user: null,
    loading: true,
    login: vi.fn(),
    googleLogin: vi.fn(),
    logout: vi.fn(),
    refreshUser: vi.fn(),
    setUser: vi.fn(),
  });

  render(
    <MemoryRouter>
      <ProtectedRoute>
        <div>SECRET</div>
      </ProtectedRoute>
    </MemoryRouter>
  );

  expect(screen.queryByText("SECRET")).not.toBeInTheDocument();
  expect(screen.queryByText("LOGIN PAGE")).not.toBeInTheDocument();
});

test("redirects unauthenticated user to /login", () => {
  mockedUseAuth.mockReturnValue({
    user: null,
    loading: false,
    login: vi.fn(),
    googleLogin: vi.fn(),
    logout: vi.fn(),
    refreshUser: vi.fn(),
    setUser: vi.fn(),
  });

  render(
    <MemoryRouter initialEntries={["/private"]}>
      <Routes>
        <Route path="/login" element={<div>LOGIN PAGE</div>} />
        <Route
          path="/private"
          element={
            <ProtectedRoute>
              <div>SECRET</div>
            </ProtectedRoute>
          }
        />
      </Routes>
    </MemoryRouter>
  );
  expect(screen.getByText("LOGIN PAGE")).toBeInTheDocument();
});

test("renders children when authenticated", () => {
  mockedUseAuth.mockReturnValue({
    user: {
      id: 1,
      username: "samuel",
      email: "samuel@example.com",
      display_name: "Samuel",
      nickname: "Sam",
      profile_photo_url: "",
      is_google_account: false,
      terms_accepted_at: null,
    },
    loading: false,
    login: vi.fn(),
    googleLogin: vi.fn(),
    logout: vi.fn(),
    refreshUser: vi.fn(),
    setUser: vi.fn(),
  });

  render(
    <MemoryRouter initialEntries={["/private"]}>
      <Routes>
        <Route path="/login" element={<div>LOGIN PAGE</div>} />
        <Route
          path="/private"
          element={
            <ProtectedRoute>
              <div>SECRET</div>
            </ProtectedRoute>
          }
        />
      </Routes>
    </MemoryRouter>
  );

  expect(screen.getByText("SECRET")).toBeInTheDocument();
});
