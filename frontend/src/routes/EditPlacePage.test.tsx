import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, vi } from "vitest";
import EditPlacePage from "./EditPlacePage";
import { placesService } from "../services/places.service";
import { notifyPlacesChanged } from "../utils/places-state";

vi.mock("../services/places.service");

const navigateSpy = vi.fn();

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
  return {
    ...actual,
    useNavigate: () => navigateSpy,
  };
});

vi.mock("../components/places/PlaceForm", () => ({
  PlaceForm: ({
    onSubmit,
    onResolveMapsUrl,
  }: {
    onSubmit: (data: Record<string, unknown>) => Promise<void>;
    onResolveMapsUrl?: (data: Record<string, unknown>) => Promise<void>;
  }) => (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        void onSubmit({});
      }}
    >
      <button type="submit">Save</button>
      {onResolveMapsUrl && (
        <button
          type="button"
          onClick={() => {
            void onResolveMapsUrl({ maps_url: "https://maps.app.goo.gl/QevQZS" });
          }}
        >
          Resolve Maps
        </button>
      )}
    </form>
  ),
}));

vi.mock("../utils/places-state", () => ({
  notifyPlacesChanged: vi.fn(),
}));

afterEach(() => {
  vi.clearAllMocks();
  vi.useRealTimers();
});

const basePlace = {
  public_id: "place-1",
  name: "Casa monsenhor",
  category: "cafe e restaurante",
  address: "Rua 10 de Julho, 567 - Centro, Manaus - AM, 69010-060",
  status: "favorite",
  notes: "",
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
  visits: [],
  consumables_count: 0,
  average_consumable_rating: null,
  total_consumed_amount: null,
};

function renderPage() {
  return render(
    <MemoryRouter initialEntries={["/places/place-1/edit"]}>
      <Routes>
        <Route path="/places/:id/edit" element={<EditPlacePage />} />
      </Routes>
    </MemoryRouter>,
  );
}

test("shows loading state while place is fetching", () => {
  (placesService.get as ReturnType<typeof vi.fn>).mockReturnValue(new Promise(() => {}));
  renderPage();
  expect(screen.queryByRole("heading", { name: /edit place/i })).not.toBeInTheDocument();
});

test("keeps the user on the edit page while coordinates are pending", async () => {
  (placesService.get as ReturnType<typeof vi.fn>)
    .mockResolvedValueOnce({
      ...basePlace,
      coords_status: "resolved",
      latitude: "-3.1296743",
      longitude: "-60.0224750",
    })
    .mockResolvedValueOnce({
      ...basePlace,
      coords_status: "pending",
      latitude: null,
      longitude: null,
    })
    .mockResolvedValueOnce({
      ...basePlace,
      coords_status: "resolved",
      latitude: "-3.1296743",
      longitude: "-60.0224750",
    });

  (placesService.update as ReturnType<typeof vi.fn>).mockResolvedValue({
    ...basePlace,
    coords_status: "pending",
    latitude: null,
    longitude: null,
  });

  renderPage();

  await screen.findByRole("heading", { name: /edit place|editar lugar/i });
  fireEvent.submit(screen.getByRole("button", { name: "Save" }).closest("form")!);

  await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent(/coordenadas|coordinates/i));
  expect(notifyPlacesChanged).toHaveBeenCalled();
  expect(navigateSpy).not.toHaveBeenCalled();

  await waitFor(() => expect(navigateSpy).not.toHaveBeenCalled(), {
    timeout: 1500,
  });
});

test("resolving maps url from the shortcut keeps the user on the edit page", async () => {
  (placesService.get as ReturnType<typeof vi.fn>)
    .mockResolvedValueOnce({
      ...basePlace,
      coords_status: "resolved",
      latitude: "-3.1296743",
      longitude: "-60.0224750",
    })
    .mockResolvedValueOnce({
      ...basePlace,
      coords_status: "pending",
      latitude: null,
      longitude: null,
    })
    .mockResolvedValueOnce({
      ...basePlace,
      coords_status: "resolved",
      latitude: "-3.1296743",
      longitude: "-60.0224750",
    });

  (placesService.update as ReturnType<typeof vi.fn>).mockResolvedValue({
    ...basePlace,
    coords_status: "pending",
    latitude: null,
    longitude: null,
  });

  renderPage();

  await screen.findByRole("heading", { name: /edit place|editar lugar/i });
  fireEvent.click(screen.getByRole("button", { name: "Resolve Maps" }));

  await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent(/coordenadas|coordinates/i));
  expect(notifyPlacesChanged).toHaveBeenCalled();
  expect(navigateSpy).not.toHaveBeenCalled();
});
