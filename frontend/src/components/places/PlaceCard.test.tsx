import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, vi } from "vitest";
import { PlaceCard } from "./PlaceCard";
import type { Place } from "../../types/place";

const navigateSpy = vi.fn();

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
  return { ...actual, useNavigate: () => navigateSpy };
});

beforeEach(() => {
  vi.clearAllMocks();
});

const place: Place = {
  public_id: "place-1",
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

test("navigates to place detail on click", () => {
  render(
    <MemoryRouter>
      <PlaceCard place={place} />
    </MemoryRouter>
  );
  fireEvent.click(screen.getByRole("article"));
  expect(navigateSpy).toHaveBeenCalledWith("/places/place-1");
});

test("renders cover photo via img when cover_photo is provided", () => {
  const placeWithPhoto: Place = { ...place, cover_photo: "https://example.com/photo.jpg" };
  render(
    <MemoryRouter>
      <PlaceCard place={placeWithPhoto} />
    </MemoryRouter>
  );
  expect(screen.getByRole("img", { name: "Café X" })).toBeInTheDocument();
});

test("renders placeholder emoji when no cover_photo", () => {
  render(
    <MemoryRouter>
      <PlaceCard place={place} />
    </MemoryRouter>
  );
  expect(screen.getByText("🍽")).toBeInTheDocument();
});

test("shows notes when provided", () => {
  const placeWithNotes: Place = { ...place, notes: "Ótimo espresso" };
  render(
    <MemoryRouter>
      <PlaceCard place={placeWithNotes} />
    </MemoryRouter>
  );
  expect(screen.getByText("Ótimo espresso")).toBeInTheDocument();
});
