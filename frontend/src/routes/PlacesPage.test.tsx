import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, vi } from "vitest";
import { AxiosError } from "axios";
import PlacesPage from "./PlacesPage";
import { placesService } from "../services/places.service";
import { AuthProvider } from "../contexts/AuthContext";
import { PLACES_CHANGED_EVENT } from "../utils/places-state";

vi.mock("../services/places.service");

vi.mock("../hooks/useDebounce", () => ({
  useDebounce: (value: unknown) => value,
}));

const navigateSpy = vi.fn();

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
  return { ...actual, useNavigate: () => navigateSpy };
});

const emptyPage = { count: 0, results: [], next: null, previous: null };

function renderPage() {
  return render(
    <MemoryRouter>
      <AuthProvider>
        <PlacesPage />
      </AuthProvider>
    </MemoryRouter>
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  (placesService.listMapPins as ReturnType<typeof vi.fn>).mockResolvedValue([]);
});

test("shows empty state when no places", async () => {
  (placesService.list as ReturnType<typeof vi.fn>).mockResolvedValue(emptyPage);
  renderPage();
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
  (placesService.listMapPins as ReturnType<typeof vi.fn>).mockResolvedValue(places);
  renderPage();
  await waitFor(() => expect(screen.getByText("Padaria Bom Pão")).toBeInTheDocument());
  fireEvent.click(screen.getByRole("button", { name: "Show map" }));
  await waitFor(() => expect(screen.getByText("1 saved pins")).toBeInTheDocument());
  expect(screen.getByRole("button", { name: "Zoom map in" })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Zoom map out" })).toBeInTheDocument();

  // MapLibre markers are native DOM elements managed by the library (not accessible buttons)
  // Interaction with individual markers is covered by visual/e2e tests

  window.dispatchEvent(new Event(PLACES_CHANGED_EVENT));

  await waitFor(() => expect(placesService.list).toHaveBeenCalledTimes(2));
});

test("filters places by status when clicking Visited", async () => {
  (placesService.list as ReturnType<typeof vi.fn>).mockResolvedValue(emptyPage);
  renderPage();

  await waitFor(() => expect(screen.getByText(/no places yet/i)).toBeInTheDocument());

  (placesService.list as ReturnType<typeof vi.fn>).mockResolvedValue(emptyPage);
  fireEvent.click(screen.getByRole("button", { name: /visited/i }));

  await waitFor(() =>
    expect(placesService.list).toHaveBeenCalledWith(
      expect.objectContaining({ status: "visited" }),
    ),
  );
});

test("searches places by text input", async () => {
  (placesService.list as ReturnType<typeof vi.fn>).mockResolvedValue(emptyPage);
  renderPage();

  await waitFor(() => expect(screen.getByText(/no places yet/i)).toBeInTheDocument());

  (placesService.list as ReturnType<typeof vi.fn>).mockResolvedValue(emptyPage);
  fireEvent.change(screen.getByPlaceholderText(/search/i), {
    target: { value: "pizza" },
  });

  await waitFor(() =>
    expect(placesService.list).toHaveBeenCalledWith(
      expect.objectContaining({ search: "pizza" }),
    ),
  );
});

test("shows empty search state when search returns no results", async () => {
  (placesService.list as ReturnType<typeof vi.fn>).mockResolvedValue(emptyPage);
  renderPage();

  await waitFor(() => expect(screen.getByText(/no places yet/i)).toBeInTheDocument());

  fireEvent.change(screen.getByPlaceholderText(/search/i), {
    target: { value: "xyznotfound" },
  });

  await waitFor(() => expect(screen.getByText(/no places found/i)).toBeInTheDocument());
});

test("shows error message when API fails", async () => {
  (placesService.list as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
    new Error("Network error"),
  );
  renderPage();

  await waitFor(() => expect(screen.getByText(/failed to load places/i)).toBeInTheDocument());
});

test("redirects to /login when session is expired", async () => {
  const expiredError = new AxiosError(
    "Unauthorized",
    "ERR_BAD_REQUEST",
    {} as never,
    {},
    { status: 401, data: {}, statusText: "", headers: {}, config: {} as never } as never,
  );
  (placesService.list as ReturnType<typeof vi.fn>).mockRejectedValueOnce(expiredError);
  renderPage();

  await waitFor(() =>
    expect(navigateSpy).toHaveBeenCalledWith("/login", { replace: true }),
  );
});
