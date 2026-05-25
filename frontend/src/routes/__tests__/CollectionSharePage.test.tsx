import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, expect, test, vi } from "vitest";
import { HelmetProvider } from "react-helmet-async";
import { shareService } from "../../services/share.service";
import { useAuth } from "../../contexts/useAuth";
import CollectionSharePage from "../CollectionSharePage";

vi.mock("../../services/share.service");
vi.mock("../../contexts/useAuth");
const navigateMock = vi.fn();
vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
  return { ...actual, useNavigate: () => navigateMock };
});
vi.mock("../NotFoundPage", () => ({
  default: () => <div>NOT FOUND</div>,
}));

function renderShare(token = "abc123") {
  return render(
    <HelmetProvider>
      <MemoryRouter initialEntries={[`/share/collections/${token}`]}>
        <Routes>
          <Route path="/share/collections/:token" element={<CollectionSharePage />} />
        </Routes>
      </MemoryRouter>
    </HelmetProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(useAuth).mockReturnValue({
    user: null,
    loading: false,
    login: vi.fn(),
    googleLogin: vi.fn(),
    logout: vi.fn(),
    refreshUser: vi.fn(),
    setUser: vi.fn(),
  });
});

test("renders collection snapshot", async () => {
  vi.mocked(shareService.getCollectionShare).mockResolvedValue({
    name: "Cafés favoritos",
    emoji: "☕",
    description: "Os melhores",
    place_count: 1,
    places: [
      {
        source_public_id: "place-1",
        name: "Café X",
        category: "cafe",
        address: "Rua das Flores, 10",
        instagram_url: "",
        maps_url: "",
        coords_status: "resolved",
        latitude: null,
        longitude: null,
        status: "favorite",
        notes: "snapshot",
        cover_photo_url: null,
      },
    ],
  });

  renderShare();

  await waitFor(() => expect(screen.getByText("Cafés favoritos")).toBeInTheDocument());
  expect(screen.getByText("Café X")).toBeInTheDocument();
  expect(screen.getByText(/Os melhores/)).toBeInTheDocument();
});

test("shows login CTA when user is not authenticated", async () => {
  vi.mocked(shareService.getCollectionShare).mockResolvedValue({
    name: "Cafés favoritos",
    emoji: "☕",
    description: "Os melhores",
    place_count: 0,
    places: [],
  });

  renderShare();

  await waitFor(() =>
    expect(screen.getByRole("link", { name: /sign in or register to save/i })).toBeInTheDocument(),
  );
});

test("authenticated user can save collection and navigate", async () => {
  vi.mocked(useAuth).mockReturnValue({
    user: { public_id: "user-1" } as never,
    loading: false,
    login: vi.fn(),
    googleLogin: vi.fn(),
    logout: vi.fn(),
    refreshUser: vi.fn(),
    setUser: vi.fn(),
  });
  vi.mocked(shareService.getCollectionShare).mockResolvedValue({
    name: "Cafés favoritos",
    emoji: "☕",
    description: "Os melhores",
    place_count: 0,
    places: [],
  });
  vi.mocked(shareService.saveCollectionShare).mockResolvedValue({
    public_id: "col-new",
  });

  renderShare();

  await waitFor(() => expect(screen.getByRole("button", { name: /save to my list/i })).toBeInTheDocument());
  screen.getByRole("button", { name: /save to my list/i }).click();

  await waitFor(() => expect(shareService.saveCollectionShare).toHaveBeenCalledWith("abc123"));
  expect(navigateMock).toHaveBeenCalledWith("/collections/col-new");
});
