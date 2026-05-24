import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { MemoryRouter } from "react-router-dom";
import { within } from "@testing-library/react";
import { beforeEach, vi } from "vitest";
import { PlaceCard } from "./PlaceCard";
import type { Place } from "../../types/place";
import { placesService } from "../../services/places.service";

const navigateSpy = vi.fn();

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
  return { ...actual, useNavigate: () => navigateSpy };
});

vi.mock("../../services/places.service");

vi.mock("../ui/context-menu", () => ({
  ContextMenu: ({ children }: { children: ReactNode }) => <>{children}</>,
  ContextMenuTrigger: ({ children }: { children: ReactNode; asChild?: boolean }) => (
    <>{children}</>
  ),
  ContextMenuContent: ({ children }: { children: ReactNode }) => <>{children}</>,
  ContextMenuItem: ({ children, onClick, className }: {
    children: ReactNode;
    onClick?: () => void;
    className?: string;
  }) => (
    <button className={className} onClick={onClick}>
      {children}
    </button>
  ),
  ContextMenuSeparator: () => <hr />,
}));

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

test("prevents mobile text selection on context menu long press", () => {
  render(
    <MemoryRouter>
      <PlaceCard place={place} />
    </MemoryRouter>
  );

  const card = screen.getByRole("article");
  expect(card).toHaveClass("select-none");
  expect(card).toHaveClass("touch-manipulation");
  expect(card).toHaveClass("[-webkit-touch-callout:none]");
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

test("shows image spinner until cover photo loads", () => {
  const placeWithPhoto: Place = { ...place, cover_photo: "https://example.com/photo.jpg" };
  render(
    <MemoryRouter>
      <PlaceCard place={placeWithPhoto} />
    </MemoryRouter>
  );

  expect(screen.getByRole("status", { name: "Carregando imagem" })).toBeInTheDocument();
  fireEvent.load(screen.getByRole("img", { name: "Café X" }));
  expect(screen.queryByRole("status", { name: "Carregando imagem" })).not.toBeInTheDocument();
});

test("renders placeholder icon when no cover_photo", () => {
  render(
    <MemoryRouter>
      <PlaceCard place={place} />
    </MemoryRouter>
  );
  expect(screen.getByRole("article")).toBeInTheDocument();
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

test("shows map link when place only has coordinates", () => {
  render(
    <MemoryRouter>
      <PlaceCard place={{ ...place, maps_url: "", latitude: "-3.1", longitude: "-60" }} />
    </MemoryRouter>
  );

  expect(screen.getByRole("link", { name: /maps/i })).toHaveAttribute(
    "href",
    "https://www.google.com/maps/search/?api=1&query=-3.1%2C-60",
  );
});

test("opens delete confirmation dialog instead of native confirm", () => {
  render(
    <MemoryRouter>
      <PlaceCard place={place} onDeleted={vi.fn()} />
    </MemoryRouter>
  );

  fireEvent.click(screen.getByRole("button", { name: /delete/i }));

  expect(screen.getByRole("dialog")).toBeInTheDocument();
  expect(screen.getByText(/delete place/i)).toBeInTheDocument();
});

test("confirming delete calls remove and onDeleted", async () => {
  const onDeleted = vi.fn();
  (placesService.remove as ReturnType<typeof vi.fn>).mockResolvedValueOnce(undefined);

  render(
    <MemoryRouter>
      <PlaceCard place={place} onDeleted={onDeleted} />
    </MemoryRouter>
  );

  fireEvent.click(screen.getByRole("button", { name: /delete/i }));
  const dialog = await screen.findByRole("dialog");
  fireEvent.click(within(dialog).getByRole("button", { name: /delete/i }));

  await waitFor(() => expect(placesService.remove).toHaveBeenCalledWith("place-1"));
  await waitFor(() => expect(onDeleted).toHaveBeenCalledTimes(1));
});
