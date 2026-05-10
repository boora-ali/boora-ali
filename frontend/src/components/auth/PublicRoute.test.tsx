import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { PublicRoute } from "./PublicRoute";
import { useAuth } from "../../contexts/useAuth";
import { vi } from "vitest";

vi.mock("../../contexts/useAuth");

const mockedUseAuth = vi.mocked(useAuth);

test("redirects authenticated user to /places", () => {
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
    <MemoryRouter initialEntries={["/login"]}>
      <Routes>
        <Route path="/places" element={<div>PLACES PAGE</div>} />
        <Route
          path="/login"
          element={
            <PublicRoute>
              <div>LOGIN FORM</div>
            </PublicRoute>
          }
        />
      </Routes>
    </MemoryRouter>
  );
  expect(screen.getByText("PLACES PAGE")).toBeInTheDocument();
});

test("renders children when unauthenticated", () => {
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
    <MemoryRouter initialEntries={["/login"]}>
      <Routes>
        <Route path="/places" element={<div>PLACES PAGE</div>} />
        <Route
          path="/login"
          element={
            <PublicRoute>
              <div>LOGIN FORM</div>
            </PublicRoute>
          }
        />
      </Routes>
    </MemoryRouter>
  );

  expect(screen.getByText("LOGIN FORM")).toBeInTheDocument();
});
