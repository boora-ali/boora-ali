import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, vi } from "vitest";
import { placesService } from "../services/places.service";
import PlaceDetailPage from "./PlaceDetailPage";

vi.mock("../services/places.service");

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
  expect(screen.queryByRole("button", { name: "Maps" })).not.toBeInTheDocument();
  expect(screen.getByRole("link", { name: "Maps" })).toBeInTheDocument();
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
  expect(screen.queryByRole("button", { name: "Maps" })).not.toBeInTheDocument();

  await waitFor(
    () => expect(screen.getByRole("button", { name: "Maps" })).toBeEnabled(),
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
  expect(screen.queryByRole("button", { name: "Maps" })).not.toBeInTheDocument();
  expect(screen.getByRole("link", { name: "Maps" })).toBeInTheDocument();
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

  await waitFor(() => expect(screen.getByRole("button", { name: "Maps" })).toBeEnabled());
  fireEvent.click(screen.getByRole("button", { name: "Maps" }));

  expect(await screen.findByRole("dialog")).toBeInTheDocument();
  expect(screen.getByTitle("Café X")).toHaveAttribute(
    "src",
    "https://www.google.com/maps?q=-3.1019444,-60.0250000&z=16&output=embed",
  );
});
