import { render, screen, waitFor } from "@testing-library/react";
import { vi } from "vitest";
import { VisitCard } from "./VisitCard";
import { visitsService } from "../../services/visits.service";

vi.mock("../../services/visits.service");

test("loads consumable details on demand", async () => {
  (visitsService.get as ReturnType<typeof vi.fn>).mockResolvedValue({
    public_id: "visit-1",
    place: 1,
    visited_at: "2026-05-01T12:00:00Z",
    environment_rating: 8,
    service_rating: 9,
    overall_rating: 9,
    would_return: true,
    general_notes: "",
    items: [
      {
        public_id: "item-1",
        visit: 1,
        name: "Espresso",
        type: "coffee",
        rating: 9,
        price: "5.00",
        would_order_again: true,
        notes: "",
        photo: "",
        created_at: "",
        updated_at: "",
      },
    ],
    created_at: "",
    updated_at: "",
  });

  render(
    <VisitCard
      visit={{
        public_id: "visit-1",
        place: 1,
        visited_at: "2026-05-01T12:00:00Z",
        environment_rating: 8,
        service_rating: 9,
        overall_rating: 9,
        would_return: true,
        created_at: "",
        updated_at: "",
      }}
    />
  );

  screen.getByRole("button", { name: /consum/i }).click();

  await waitFor(() => expect(visitsService.get).toHaveBeenCalledWith("visit-1"));
  await waitFor(() => expect(screen.getByText("Espresso")).toBeInTheDocument());
});
