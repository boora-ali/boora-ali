import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { PlaceCard } from "./PlaceCard";
import type { Place } from "../../types/place";

const place: Place = {
  id: 1,
  name: "Café X",
  category: "café",
  address: "Rua das Flores, 10",
  status: "favorite",
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
};

test("renders main place data", () => {
  render(
    <MemoryRouter>
      <PlaceCard place={place} />
    </MemoryRouter>
  );
  expect(screen.getByText("Café X")).toBeInTheDocument();
  expect(screen.getByText("café")).toBeInTheDocument();
  expect(screen.getByText("Rua das Flores, 10")).toBeInTheDocument();
});
