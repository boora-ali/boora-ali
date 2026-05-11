import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { vi } from "vitest";
import PlacesPage from "./PlacesPage";
import { placesService } from "../services/places.service";
import { AuthProvider } from "../contexts/AuthContext";
import { PLACES_CHANGED_EVENT } from "../utils/places-state";

vi.mock("../services/places.service");

const emptyPage = { count: 0, results: [], next: null, previous: null };

test("shows empty state when no places", async () => {
  (placesService.list as ReturnType<typeof vi.fn>).mockResolvedValue(emptyPage);
  (placesService.listAll as ReturnType<typeof vi.fn>).mockResolvedValue([]);
  render(
    <MemoryRouter>
      <AuthProvider>
        <PlacesPage />
      </AuthProvider>
    </MemoryRouter>
  );
  await waitFor(() => expect(screen.getByText(/no places yet/i)).toBeInTheDocument());
});

test("renders list of places", async () => {
  const places = [
    {
      id: 1,
      name: "Padaria Bom Pão",
      category: "bakery",
      address: "",
      status: "visited",
      created_at: "",
      updated_at: "",
      public_id: "place-1",
      latitude: "-3.1190275",
      longitude: "-60.0217314",
    },
  ];
  (placesService.list as ReturnType<typeof vi.fn>).mockResolvedValue({
    count: 1,
    next: null,
    previous: null,
    results: places,
  });
  (placesService.listAll as ReturnType<typeof vi.fn>).mockResolvedValue(places);
  render(
    <MemoryRouter>
      <AuthProvider>
        <PlacesPage />
      </AuthProvider>
    </MemoryRouter>
  );
  await waitFor(() => expect(screen.getByText("Padaria Bom Pão")).toBeInTheDocument());
  fireEvent.click(screen.getByRole("button", { name: "Show map" }));
  expect(screen.getByText("1 saved pins")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Zoom map in" })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Zoom map out" })).toBeInTheDocument();

  // MapLibre markers are native DOM elements managed by the library (not accessible buttons)
  // Interaction with individual markers is covered by visual/e2e tests

  window.dispatchEvent(new Event(PLACES_CHANGED_EVENT));

  await waitFor(() => expect(placesService.list).toHaveBeenCalledTimes(2));
});
