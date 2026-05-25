import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, vi } from "vitest";
import TrashPage from "./TrashPage";
import { placesService } from "../services/places.service";

vi.mock("../services/places.service");

function renderPage() {
  return render(
    <MemoryRouter>
      <TrashPage />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

test("shows an error state when trash loading fails", async () => {
  (placesService.trash as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
    new Error("Service unavailable"),
  );

  renderPage();

  await waitFor(() => expect(screen.getByText(/failed to load trash/i)).toBeInTheDocument());
});

test("renders trashed places when the API succeeds", async () => {
  (placesService.trash as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
    count: 1,
    next: null,
    previous: null,
    results: [
      {
        id: 1,
        public_id: "trash-1",
        name: "Café Central",
        category: "cafe",
        deleted_at: "2026-05-24T12:00:00Z",
      },
    ],
  });

  renderPage();

  await waitFor(() => expect(screen.getByText("Café Central")).toBeInTheDocument());
});
