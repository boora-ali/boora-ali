import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { vi } from "vitest";
import PlacesPage from "./PlacesPage";
import { placesService } from "../services/places.service";
import { AuthProvider } from "../contexts/AuthContext";

vi.mock("../services/places.service");

const navigateSpy = vi.fn();

vi.mock("react-router", async () => {
  const actual = await vi.importActual<typeof import("react-router")>("react-router");
  return {
    ...actual,
    useNavigate: () => navigateSpy,
  };
});

test("redirects to login when the places request returns 401", async () => {
  (placesService.list as ReturnType<typeof vi.fn>).mockRejectedValue({
    isAxiosError: true,
    response: { status: 401, data: { code: "session_expired" } },
  });
  (placesService.listAll as ReturnType<typeof vi.fn>).mockResolvedValue([]);

  render(
    <MemoryRouter>
      <AuthProvider>
        <PlacesPage />
      </AuthProvider>
    </MemoryRouter>,
  );

  await waitFor(() => expect(navigateSpy).toHaveBeenCalledWith("/login", { replace: true }));
  expect(screen.queryByText(/falha ao carregar lugares|failed to load places/i)).not.toBeInTheDocument();
});
