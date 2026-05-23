import React from "react";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { shareService } from "../services/share.service";
import PlaceDetailPage from "./PlaceDetailPage";
import { placesService } from "../services/places.service";

vi.mock("../services/share.service");
vi.mock("../services/places.service");
vi.mock("../services/visits.service");
vi.mock("../services/collections.service", () => ({
  collectionsService: { list: vi.fn().mockResolvedValue([]) },
}));

vi.mock("@/components/ui/dropdown-menu", () => ({
  DropdownMenu: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  DropdownMenuTrigger: ({ children }: { children: React.ReactNode; asChild?: boolean }) => <>{children}</>,
  DropdownMenuContent: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  DropdownMenuGroup: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  DropdownMenuItem: ({ children, onSelect }: { children: React.ReactNode; onSelect?: () => void }) => (
    <button onClick={onSelect}>{children}</button>
  ),
}));

vi.mock("@/components/ui/popover", () => ({
  Popover: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  PopoverTrigger: ({ children, asChild }: { children: React.ReactNode; asChild?: boolean }) => {
    if (asChild && React.isValidElement(children)) return children;
    return <>{children}</>;
  },
  PopoverContent: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="popover-content">{children}</div>
  ),
}));

const navigateSpy = vi.fn();
vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
  return { ...actual, useNavigate: () => navigateSpy };
});

const basePlace = {
  public_id: "place-1",
  name: "Café X",
  category: "café",
  address: "Rua das Flores, 10",
  status: "favorite",
  notes: "",
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
  visits: [],
  consumables_count: 0,
  average_consumable_rating: null,
  total_consumed_amount: null,
};

function renderDetail() {
  return render(
    <MemoryRouter initialEntries={["/places/place-1"]}>
      <Routes>
        <Route path="/places/:id" element={<PlaceDetailPage />} />
      </Routes>
    </MemoryRouter>
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  Object.defineProperty(navigator, "share", { value: undefined, configurable: true });
  Object.defineProperty(navigator, "clipboard", {
    value: { writeText: vi.fn().mockResolvedValue(undefined) },
    configurable: true,
  });
});

describe("ShareButton", () => {
  test("renders share button in place detail", async () => {
    (placesService.get as ReturnType<typeof vi.fn>).mockResolvedValue(basePlace);
    renderDetail();
    await waitFor(() => expect(screen.getByText("Share")).toBeInTheDocument());
  });

  test("calls createShare and opens popover on desktop (no navigator.share)", async () => {
    (placesService.get as ReturnType<typeof vi.fn>).mockResolvedValue(basePlace);
    (shareService.createShare as ReturnType<typeof vi.fn>).mockResolvedValue({
      token: "tok123",
      url: "https://booraali.com/share/tok123",
    });

    renderDetail();
    await waitFor(() => expect(screen.getByText("Share")).toBeInTheDocument());
    fireEvent.click(screen.getByText("Share"));

    await waitFor(() => expect(shareService.createShare).toHaveBeenCalledWith("place-1"));
    expect(screen.getByTestId("popover-content")).toBeInTheDocument();
    expect(screen.getByText("WhatsApp")).toBeInTheDocument();
    expect(screen.getByText("Copy link")).toBeInTheDocument();
  });

  test("copy link shows copied state", async () => {
    (placesService.get as ReturnType<typeof vi.fn>).mockResolvedValue(basePlace);
    (shareService.createShare as ReturnType<typeof vi.fn>).mockResolvedValue({
      token: "tok123",
      url: "https://booraali.com/share/tok123",
    });

    renderDetail();
    await waitFor(() => expect(screen.getByText("Share")).toBeInTheDocument());
    fireEvent.click(screen.getByText("Share"));
    await waitFor(() => expect(screen.getByText("Copy link")).toBeInTheDocument());
    fireEvent.click(screen.getByText("Copy link"));

    await waitFor(() => expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
      "https://booraali.com/share/tok123"
    ));
    await waitFor(() => expect(screen.getByText("Link copied!")).toBeInTheDocument());
  });

  test("uses native share API when available", async () => {
    const shareMock = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "share", {
      value: shareMock,
      configurable: true,
      writable: true,
    });

    (placesService.get as ReturnType<typeof vi.fn>).mockResolvedValue(basePlace);
    (shareService.createShare as ReturnType<typeof vi.fn>).mockResolvedValue({
      token: "tok123",
      url: "https://booraali.com/share/tok123",
    });

    renderDetail();
    await waitFor(() => expect(screen.getByText("Share")).toBeInTheDocument(), { timeout: 3000 });
    fireEvent.click(screen.getByText("Share"));

    await waitFor(
      () =>
        expect(shareMock).toHaveBeenCalledWith({
          title: "Café X",
          url: "https://booraali.com/share/tok123",
        }),
      { timeout: 3000 }
    );
  });
});
