import { vi } from "vitest";

vi.mock("../services/auth.service");

import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, expect, test } from "vitest";
import { AuthProvider } from "./AuthContext";
import { useAuth } from "./useAuth";
import { authService } from "../services/auth.service";
import { ACCESS_KEY } from "../utils/constants";

const mockAuthService = vi.mocked(authService);

const mockUser = {
  id: 1,
  username: "ana",
  email: "ana@ex.com",
  display_name: "Ana",
  nickname: "",
  profile_photo_url: "",
  is_google_account: false,
  terms_accepted_at: null,
};

function UserDisplay() {
  const { user, loading } = useAuth();
  if (loading) return <div>Loading...</div>;
  return <div>{user ? `User: ${user.username}` : "No user"}</div>;
}

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
});

test("user é null inicialmente sem token no localStorage", () => {
  render(
    <AuthProvider>
      <UserDisplay />
    </AuthProvider>
  );

  expect(screen.getByText("No user")).toBeInTheDocument();
  expect(screen.queryByText("Loading...")).not.toBeInTheDocument();
  expect(mockAuthService.me).not.toHaveBeenCalled();
});

test("carrega user quando token está no localStorage", async () => {
  localStorage.setItem(ACCESS_KEY, "fake-token");
  mockAuthService.me.mockResolvedValueOnce(mockUser);

  render(
    <AuthProvider>
      <UserDisplay />
    </AuthProvider>
  );

  expect(screen.getByText("Loading...")).toBeInTheDocument();

  await waitFor(() => expect(screen.getByText("User: ana")).toBeInTheDocument());
  expect(mockAuthService.me).toHaveBeenCalledTimes(1);
});

test("logout limpa o user do estado", async () => {
  localStorage.setItem(ACCESS_KEY, "fake-token");
  mockAuthService.me.mockResolvedValueOnce(mockUser);
  mockAuthService.logout.mockResolvedValueOnce(undefined);

  function LogoutButton() {
    const { user, loading, logout } = useAuth();
    if (loading) return <div>Loading...</div>;
    return (
      <div>
        <span>{user ? `User: ${user.username}` : "No user"}</span>
        <button onClick={() => void logout()}>Logout</button>
      </div>
    );
  }

  const { getByRole } = render(
    <AuthProvider>
      <LogoutButton />
    </AuthProvider>
  );

  await waitFor(() => expect(screen.getByText("User: ana")).toBeInTheDocument());

  getByRole("button", { name: "Logout" }).click();

  await waitFor(() => expect(screen.getByText("No user")).toBeInTheDocument());
  expect(mockAuthService.logout).toHaveBeenCalledTimes(1);
});
