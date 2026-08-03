import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router";
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

vi.mock("react-router", async () => {
  const actual = await vi.importActual<typeof import("react-router")>("react-router");
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

test("renders the Places heading with the neo-brutalist display treatment", async () => {
  (placesService.list as ReturnType<typeof vi.fn>).mockResolvedValue(emptyPage);
  renderPage();

  const title = await screen.findByRole("heading", { name: "Boora Ali" });
  expect(title).toHaveClass("font-[Impact,_Arial_Black,_system-ui,_sans-serif]");
  expect(title).toHaveClass("uppercase");
  expect(title.nextElementSibling).toHaveClass("uppercase");
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

test("leaves room around cards for their external status shadows", async () => {
  const places = [{
    public_id: "place-shadow",
    name: "Lugar com sombra",
    category: "café",
    address: "",
    status: "want_to_visit",
    created_at: "",
    updated_at: "",
  }];
  (placesService.list as ReturnType<typeof vi.fn>).mockResolvedValue({
    count: 1,
    next: null,
    previous: null,
    results: places,
  });

  renderPage();

  const card = await screen.findByRole("article");
  expect(card.parentElement).toHaveClass("gap-6");
  expect(card.parentElement).toHaveClass("pr-3");
  expect(card.parentElement).toHaveClass("pb-3");
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

test("shows each status filter with its semantic border", async () => {
  (placesService.list as ReturnType<typeof vi.fn>).mockResolvedValue(emptyPage);
  renderPage();

  await waitFor(() => expect(screen.getByText(/no places yet/i)).toBeInTheDocument());

  expect(screen.getByRole("button", { name: /want to visit/i })).toHaveClass("border-blue-600");
  expect(screen.getByRole("button", { name: /visited/i })).toHaveClass("border-yellow-500");
  expect(screen.getByRole("button", { name: /favorite/i })).toHaveClass("border-primary");
  expect(screen.getByRole("button", { name: /would not return/i })).toHaveClass("border-foreground");
});

test("fills the selected All filter so its white label stays readable", async () => {
  (placesService.list as ReturnType<typeof vi.fn>).mockResolvedValue(emptyPage);
  renderPage();

  await waitFor(() => expect(screen.getByText(/no places yet/i)).toBeInTheDocument());

  const allButton = screen.getByRole("button", { name: "All" });
  expect(allButton).toHaveClass("bg-primary");
  expect(allButton).not.toHaveClass("bg-surface");
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
