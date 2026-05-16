import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, vi } from "vitest";
import EditVisitPage from "./EditVisitPage";
import { visitsService } from "../services/visits.service";
import { visitItemsService } from "../services/visit-items.service";

vi.mock("../services/visits.service");
vi.mock("../services/visit-items.service");
vi.mock("../components/visits/VisitForm", () => ({
  VisitForm: ({ initialItems, onItemSave }: { initialItems: unknown[]; onItemSave?: (item: Record<string, unknown>, currentItem?: Record<string, unknown>) => Promise<unknown> }) => (
    <div data-testid="visit-form" data-items={initialItems.length}>
      <button
        type="button"
        onClick={() =>
          onItemSave?.({
            name: "Guarana",
            type: "drink",
            rating: 8,
            price: "12",
            would_order_again: true,
          })
        }
      >
        save-new-item
      </button>
      <button
        type="button"
        onClick={() =>
          onItemSave?.(
            {
              name: "Espresso updated",
              type: "coffee",
              rating: 10,
              price: "7.00",
              would_order_again: true,
            },
            {
              public_id: "item-1",
            }
          )
        }
      >
        save-existing-item
      </button>
    </div>
  ),
}));

const navigateSpy = vi.fn();

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
  return { ...actual, useNavigate: () => navigateSpy };
});

beforeEach(() => {
  vi.clearAllMocks();
});

test("shows loading state while visit is fetching", () => {
  (visitsService.get as ReturnType<typeof vi.fn>).mockReturnValue(new Promise(() => {}));
  render(
    <MemoryRouter initialEntries={["/visits/visit-1/edit"]}>
      <Routes>
        <Route path="/visits/:id/edit" element={<EditVisitPage />} />
      </Routes>
    </MemoryRouter>
  );
  expect(screen.queryByRole("heading", { name: /edit visit/i })).not.toBeInTheDocument();
});

test("shows error message when visit fails to load", async () => {
  (visitsService.get as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error("Server error"));
  render(
    <MemoryRouter initialEntries={["/visits/visit-1/edit"]}>
      <Routes>
        <Route path="/visits/:id/edit" element={<EditVisitPage />} />
      </Routes>
    </MemoryRouter>
  );
  await waitFor(() =>
    expect(screen.getByText(/failed to load the visit/i)).toBeInTheDocument()
  );
});

test("loads visit detail when edit state is missing", async () => {
  (visitsService.get as ReturnType<typeof vi.fn>).mockResolvedValue({
    public_id: "visit-1",
    place: 1,
    visited_at: "2026-05-01T12:00:00Z",
    environment_rating: 8,
    service_rating: 9,
    overall_rating: 9,
    would_return: true,
    items: [
      {
        public_id: "item-1",
        visit: 1,
        name: "Espresso",
        type: "coffee",
        rating: 9,
        price: "5.00",
        would_order_again: true,
        created_at: "",
        updated_at: "",
      },
    ],
    created_at: "",
    updated_at: "",
  });

  render(
    <MemoryRouter initialEntries={["/visits/visit-1/edit"]}>
      <Routes>
        <Route path="/visits/:id/edit" element={<EditVisitPage />} />
      </Routes>
    </MemoryRouter>
  );

  await waitFor(() => expect(visitsService.get).toHaveBeenCalledWith("visit-1"));
  await waitFor(() => expect(screen.getByTestId("visit-form")).toHaveAttribute("data-items", "1"));
});

test("creates a new item immediately from the modal when editing an existing visit", async () => {
  (visitsService.get as ReturnType<typeof vi.fn>).mockResolvedValue({
    public_id: "visit-1",
    place: 1,
    visited_at: "2026-05-01T12:00:00Z",
    environment_rating: 8,
    service_rating: 9,
    overall_rating: 9,
    would_return: true,
    items: [],
    created_at: "",
    updated_at: "",
  });
  (visitItemsService.create as ReturnType<typeof vi.fn>).mockResolvedValue({
    public_id: "item-new",
  });

  render(
    <MemoryRouter initialEntries={["/visits/visit-1/edit"]}>
      <Routes>
        <Route path="/visits/:id/edit" element={<EditVisitPage />} />
      </Routes>
    </MemoryRouter>
  );

  await waitFor(() => expect(screen.getByTestId("visit-form")).toBeInTheDocument());

  fireEvent.click(screen.getByRole("button", { name: "save-new-item" }));

  await waitFor(() => {
    expect(visitItemsService.create).toHaveBeenCalledWith("visit-1", {
      name: "Guarana",
      type: "drink",
      rating: 8,
      price: "12",
      would_order_again: true,
    });
  });
});

test("updates an existing item immediately from the modal when editing an existing visit", async () => {
  (visitsService.get as ReturnType<typeof vi.fn>).mockResolvedValue({
    public_id: "visit-1",
    place: 1,
    visited_at: "2026-05-01T12:00:00Z",
    environment_rating: 8,
    service_rating: 9,
    overall_rating: 9,
    would_return: true,
    items: [
      {
        public_id: "item-1",
        visit: 1,
        name: "Espresso",
        type: "coffee",
        rating: 9,
        price: "5.00",
        would_order_again: true,
        created_at: "",
        updated_at: "",
      },
    ],
    created_at: "",
    updated_at: "",
  });
  (visitItemsService.update as ReturnType<typeof vi.fn>).mockResolvedValue({
    public_id: "item-1",
  });

  render(
    <MemoryRouter initialEntries={["/visits/visit-1/edit"]}>
      <Routes>
        <Route path="/visits/:id/edit" element={<EditVisitPage />} />
      </Routes>
    </MemoryRouter>
  );

  await waitFor(() => expect(screen.getByTestId("visit-form")).toBeInTheDocument());

  fireEvent.click(screen.getByRole("button", { name: "save-existing-item" }));

  await waitFor(() => {
    expect(visitItemsService.update).toHaveBeenCalledWith("item-1", {
      name: "Espresso updated",
      type: "coffee",
      rating: 10,
      price: "7.00",
      would_order_again: true,
    });
  });
});
