import React from "react";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { HelmetProvider } from "react-helmet-async";
import { toast } from "sonner";
import { shareService } from "../services/share.service";
import SharePage from "./SharePage";

vi.mock("../services/share.service");
vi.mock("sonner", () => ({
  toast: {
    error: vi.fn(),
  },
}));
vi.mock("./NotFoundPage", () => ({
  default: () => <div>NOT FOUND</div>,
}));

let mockUser: { username: string } | null = null;

vi.mock("../contexts/useAuth", () => ({
  useAuth: () => ({
    user: mockUser,
    loading: false,
  }),
}));

const navigate = vi.fn();
vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
  return { ...actual, useNavigate: () => navigate };
});

function renderShare(token = "abc123") {
  return render(
    <HelmetProvider>
      <MemoryRouter initialEntries={[`/share/${token}`]}>
        <Routes>
          <Route path="/share/:token" element={<SharePage />} />
        </Routes>
      </MemoryRouter>
    </HelmetProvider>
  );
}

const shareData = {
  name: "Café Bonito",
  category: "café",
  address: "Rua das Flores, 10",
  status: "favorite",
  instagram_url: "https://instagram.com/cafebonito",
  maps_url: "https://maps.google.com/?q=Café+Bonito",
  latitude: -3.1,
  longitude: -60.0,
  cover_photo_url: "https://example.com/photo.jpg",
};

beforeEach(() => {
  vi.clearAllMocks();
  mockUser = null;
});

describe("SharePage", () => {
  test("shows loading state while fetching", () => {
    (shareService.getShare as ReturnType<typeof vi.fn>).mockReturnValue(new Promise(() => {}));
    const { container } = renderShare();
    expect(container.querySelector(".animate-pulse")).toBeInTheDocument();
  });

  test("shows NotFound on error", async () => {
    (shareService.getShare as ReturnType<typeof vi.fn>).mockRejectedValue(new Error("404"));
    renderShare();
    await waitFor(() => expect(screen.getByText("NOT FOUND")).toBeInTheDocument());
  });

  test("shows place data on success", async () => {
    (shareService.getShare as ReturnType<typeof vi.fn>).mockResolvedValue(shareData);
    renderShare();
    await waitFor(() => expect(screen.getByText("Café Bonito")).toBeInTheDocument());
    expect(screen.getByText("café")).toBeInTheDocument();
    expect(screen.getByText("Rua das Flores, 10")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /view on maps/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /instagram/i })).toBeInTheDocument();
  });

  test("shows maps link from coordinates when shared place has no Maps URL", async () => {
    (shareService.getShare as ReturnType<typeof vi.fn>).mockResolvedValue({
      ...shareData,
      maps_url: "",
      latitude: -3.1,
      longitude: -60,
    });
    renderShare();
    await waitFor(() => expect(screen.getByText("Café Bonito")).toBeInTheDocument());

    expect(screen.getByRole("link", { name: /view on maps/i })).toHaveAttribute(
      "href",
      "https://www.google.com/maps/search/?api=1&query=-3.1%2C-60",
    );
  });

  test("shows login CTA for unauthenticated user", async () => {
    mockUser = null;
    (shareService.getShare as ReturnType<typeof vi.fn>).mockResolvedValue(shareData);
    renderShare();
    await waitFor(() => expect(screen.getByText("Café Bonito")).toBeInTheDocument());
    const loginLink = screen.getByRole("link", { name: /sign in or register to add/i });
    expect(loginLink).toBeInTheDocument();
    expect(loginLink).toHaveAttribute("href", "/login?next=/share/abc123");
  });

  test("shows import button for authenticated user", async () => {
    mockUser = { username: "smovisk" };
    (shareService.getShare as ReturnType<typeof vi.fn>).mockResolvedValue(shareData);
    renderShare();
    await waitFor(() => expect(screen.getByText("Café Bonito")).toBeInTheDocument());
    expect(screen.getByRole("button", { name: /add to my list/i })).toBeInTheDocument();
  });

  test("authenticated user can import place and navigates", async () => {
    mockUser = { username: "smovisk" };
    (shareService.getShare as ReturnType<typeof vi.fn>).mockResolvedValue(shareData);
    (shareService.importShare as ReturnType<typeof vi.fn>).mockResolvedValue({ public_id: "place-xyz" });
    renderShare();
    await waitFor(() => expect(screen.getByText("Café Bonito")).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: /add to my list/i }));
    await waitFor(() =>
      expect(navigate).toHaveBeenCalledWith("/places/place-xyz", {
        state: { refreshAfterImport: true },
      }),
    );
  });

  test("shows toast when import fails", async () => {
    mockUser = { username: "smovisk" };
    (shareService.getShare as ReturnType<typeof vi.fn>).mockResolvedValue(shareData);
    (shareService.importShare as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error("duplicate"),
    );
    renderShare();
    await waitFor(() => expect(screen.getByText("Café Bonito")).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: /add to my list/i }));
    await waitFor(() => expect(toast.error).toHaveBeenCalled());
    expect(screen.queryByText(/você já tem este lugar na sua lista/i)).not.toBeInTheDocument();
  });

  test("shows cover photo when available", async () => {
    (shareService.getShare as ReturnType<typeof vi.fn>).mockResolvedValue(shareData);
    renderShare();
    await waitFor(() => expect(screen.getByAltText("Café Bonito")).toBeInTheDocument());
  });
});
