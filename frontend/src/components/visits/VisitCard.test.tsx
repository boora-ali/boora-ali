import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, vi } from "vitest";
import { VisitCard } from "./VisitCard";
import { visitsService } from "../../services/visits.service";

vi.mock("../../services/visits.service");

beforeEach(() => {
  vi.clearAllMocks();
});

const baseVisit = {
  public_id: "visit-1",
  place: 1,
  visited_at: "2026-03-15T14:30:00Z",
  environment_rating: 8,
  service_rating: 9,
  overall_rating: 8,
  would_return: true,
  created_at: "",
  updated_at: "",
};

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

  screen.getByRole("button", { name: /view items/i }).click();

  await waitFor(() => expect(visitsService.get).toHaveBeenCalledWith("visit-1"));
  await waitFor(() => expect(screen.getByText("Espresso")).toBeInTheDocument());
});

test("shows formatted date", () => {
  render(<VisitCard visit={baseVisit} />);
  // fmtDate uses toLocaleDateString — check year is present
  expect(screen.getByText(/2026/)).toBeInTheDocument();
});

test("shows overall rating via fmtRating", () => {
  render(<VisitCard visit={baseVisit} />);
  // fmtRating(8) = "8.0"; span includes label "Overall: 8.0"
  expect(screen.getByText(/overall.*8\.0/i)).toBeInTheDocument();
});

test("shows general_notes when provided", () => {
  render(<VisitCard visit={{ ...baseVisit, general_notes: "Ótimo ambiente" }} />);
  expect(screen.getByText("Ótimo ambiente")).toBeInTheDocument();
});

test("calls onEdit when edit button is clicked", () => {
  const onEdit = vi.fn();
  render(<VisitCard visit={baseVisit} onEdit={onEdit} />);
  fireEvent.click(screen.getByRole("button", { name: /edit/i }));
  expect(onEdit).toHaveBeenCalledTimes(1);
});

test("delete button opens confirmation dialog", () => {
  render(<VisitCard visit={baseVisit} onDelete={vi.fn()} />);
  fireEvent.click(screen.getByRole("button", { name: /delete/i }));
  expect(screen.getByRole("dialog")).toBeInTheDocument();
});

test("confirming delete calls onDelete prop", async () => {
  const onDelete = vi.fn();
  render(<VisitCard visit={baseVisit} onDelete={onDelete} />);

  fireEvent.click(screen.getByRole("button", { name: /delete/i }));

  const dialog = await screen.findByRole("dialog");
  fireEvent.click(within(dialog).getByRole("button", { name: /delete/i }));

  expect(onDelete).toHaveBeenCalledTimes(1);
});

test("cancelling delete does not call onDelete", async () => {
  const onDelete = vi.fn();
  render(<VisitCard visit={baseVisit} onDelete={onDelete} />);

  fireEvent.click(screen.getByRole("button", { name: /delete/i }));

  const dialog = await screen.findByRole("dialog");
  fireEvent.click(within(dialog).getByRole("button", { name: /cancel/i }));

  await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  expect(onDelete).not.toHaveBeenCalled();
});

test("shows pre-loaded items when visit already has items", async () => {
  const visitWithItems = {
    ...baseVisit,
    items: [
      {
        public_id: "item-1",
        visit: 1,
        name: "Cappuccino",
        type: "coffee" as const,
        rating: 9,
        price: "8.50",
        would_order_again: true,
        notes: "",
        photo: "",
        created_at: "",
        updated_at: "",
      },
    ],
  };

  render(<VisitCard visit={visitWithItems} />);

  fireEvent.click(screen.getByRole("button", { name: /view items/i }));

  await waitFor(() => expect(screen.getByText("Cappuccino")).toBeInTheDocument());
  expect(visitsService.get).not.toHaveBeenCalled();
});
