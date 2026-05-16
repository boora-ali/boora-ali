import React from "react";
import { render, screen, waitFor, fireEvent, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, vi } from "vitest";
import { placesService } from "../services/places.service";
import PlaceDetailPage from "./PlaceDetailPage";

vi.mock("../services/places.service");
vi.mock("../services/visits.service");

vi.mock("../components/visits/VisitCard", () => ({
  VisitCard: ({
    visit,
  }: {
    visit: { public_id: string; general_notes?: string; visited_at: string };
  }) => <div data-testid={`visit-${visit.public_id}`}>{visit.general_notes}</div>,
}));

vi.mock("@/components/ui/dropdown-menu", () => ({
  DropdownMenu: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  DropdownMenuTrigger: ({ children }: { children: React.ReactNode; asChild?: boolean }) => (
    <>{children}</>
  ),
  DropdownMenuContent: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  DropdownMenuGroup: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  DropdownMenuItem: ({
    children,
    onSelect,
    className,
  }: {
    children: React.ReactNode;
    onSelect?: () => void;
    className?: string;
  }) => (
    <button className={className} onClick={onSelect}>
      {children}
    </button>
  ),
}));

const navigateSpy = vi.fn();

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
  return { ...actual, useNavigate: () => navigateSpy };
});

afterEach(() => {
  vi.clearAllMocks();
  vi.useRealTimers();
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
        <Route path="/places/:id/edit" element={<div>EDIT PAGE</div>} />
        <Route path="/places" element={<div>PLACES PAGE</div>} />
      </Routes>
    </MemoryRouter>
  );
}

test("shows pending coordinates banner and disables map button", async () => {
  (placesService.get as ReturnType<typeof vi.fn>).mockResolvedValue({
    ...basePlace,
    maps_url: "https://maps.app.goo.gl/boraali",
    coords_status: "pending",
  });

  renderDetail();

  await waitFor(() =>
    expect(
      screen.getByText(/coordinates are being processed/i),
    ).toBeInTheDocument()
  );
  expect(screen.queryByRole("button", { name: "View on Maps" })).not.toBeInTheDocument();
  expect(screen.getByRole("link", { name: "View on Maps" })).toBeInTheDocument();
});

test("polls pending coordinates until the worker resolves them", async () => {
  (placesService.get as ReturnType<typeof vi.fn>)
    .mockResolvedValueOnce({
      ...basePlace,
      maps_url: "https://maps.app.goo.gl/boraali",
      coords_status: "pending",
    })
    .mockResolvedValueOnce({
      ...basePlace,
      maps_url: "https://www.google.com/maps/@-3.1019444,-60.0250000,17z",
      coords_status: "resolved",
      latitude: "-3.1019444",
      longitude: "-60.0250000",
    });

  renderDetail();

  expect(
    await screen.findByText(/coordinates are being processed/i),
  ).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "View on Maps" })).not.toBeInTheDocument();

  await waitFor(
    () => expect(screen.getByRole("button", { name: "View on Maps" })).toBeEnabled(),
    { timeout: 2000 },
  );
  expect(screen.queryByText(/coordinates are being processed/i)).not.toBeInTheDocument();
  expect(placesService.get).toHaveBeenCalledTimes(2);
});

test("shows failed coordinates banner and disables map button", async () => {
  (placesService.get as ReturnType<typeof vi.fn>).mockResolvedValue({
    ...basePlace,
    maps_url: "https://maps.app.goo.gl/boraali",
    coords_status: "failed",
  });

  renderDetail();

  await waitFor(() =>
    expect(
      screen.getByText(/could not extract coordinates/i),
    ).toBeInTheDocument()
  );
  expect(screen.queryByRole("button", { name: "View on Maps" })).not.toBeInTheDocument();
  expect(screen.getByRole("link", { name: "View on Maps" })).toBeInTheDocument();
});

test("opens the map modal when coordinates are resolved", async () => {
  (placesService.get as ReturnType<typeof vi.fn>).mockResolvedValue({
    ...basePlace,
    maps_url: "https://www.google.com/maps/@-3.1019444,-60.0250000,17z",
    coords_status: "resolved",
    latitude: "-3.1019444",
    longitude: "-60.0250000",
  });

  renderDetail();

  await waitFor(() => expect(screen.getByRole("button", { name: "View on Maps" })).toBeEnabled());
  fireEvent.click(screen.getByRole("button", { name: "View on Maps" }));

  expect(await screen.findByRole("dialog")).toBeInTheDocument();
  expect(screen.getByTitle("Café X")).toHaveAttribute(
    "src",
    "https://www.google.com/maps?q=-3.1019444,-60.0250000&z=16&output=embed",
  );
});

test("renders visits when place has visits", async () => {
  (placesService.get as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
    ...basePlace,
    coords_status: "resolved",
    visits: [
      {
        public_id: "visit-1",
        visited_at: "2026-01-15T10:00:00Z",
        general_notes: "Excelente café",
      },
    ],
  });

  renderDetail();

  await waitFor(() =>
    expect(screen.getByText("Excelente café")).toBeInTheDocument(),
  );
});

test("delete button opens confirmation dialog", async () => {
  (placesService.get as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
    ...basePlace,
    coords_status: "resolved",
  });

  renderDetail();

  await screen.findByText("Café X");

  fireEvent.click(screen.getByRole("button", { name: /delete/i }));

  expect(await screen.findByRole("dialog")).toBeInTheDocument();
  expect(screen.getByText(/delete place/i)).toBeInTheDocument();
});

test("confirming delete calls remove and navigates to /places", async () => {
  (placesService.get as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
    ...basePlace,
    coords_status: "resolved",
  });
  (placesService.remove as ReturnType<typeof vi.fn>).mockResolvedValueOnce(undefined);

  renderDetail();

  await screen.findByText("Café X");

  fireEvent.click(screen.getByRole("button", { name: /delete/i }));

  const dialog = await screen.findByRole("dialog");
  fireEvent.click(within(dialog).getByRole("button", { name: /delete/i }));

  await waitFor(() => expect(placesService.remove).toHaveBeenCalledWith("place-1"));
  await waitFor(() => expect(navigateSpy).toHaveBeenCalledWith("/places"));
});

test("cancelling delete does not call remove", async () => {
  (placesService.get as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
    ...basePlace,
    coords_status: "resolved",
  });

  renderDetail();

  await screen.findByText("Café X");

  fireEvent.click(screen.getByRole("button", { name: /delete/i }));

  const dialog = await screen.findByRole("dialog");
  fireEvent.click(within(dialog).getByRole("button", { name: /cancel/i }));

  await waitFor(() =>
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
  );
  expect(placesService.remove).not.toHaveBeenCalled();
});

test("renders cover photo via AuthImage", async () => {
  (placesService.get as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
    ...basePlace,
    coords_status: "resolved",
    cover_photo: "https://example.com/photo.jpg",
  });

  renderDetail();

  await waitFor(() =>
    expect(screen.getByRole("img", { name: "Café X" })).toBeInTheDocument(),
  );
});

test("edit link navigates to edit page", async () => {
  (placesService.get as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
    ...basePlace,
    coords_status: "resolved",
  });

  renderDetail();

  await screen.findByText("Café X");

  fireEvent.click(screen.getByRole("link", { name: /edit/i }));

  await waitFor(() => expect(screen.getByText("EDIT PAGE")).toBeInTheDocument());
});
