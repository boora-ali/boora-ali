import { vi } from "vitest";

vi.mock("../../services/collections.service");
vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
  return { ...actual, useParams: () => ({ id: "col-1" }) };
});

import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, expect, test } from "vitest";
import { MemoryRouter } from "react-router-dom";
import CollectionDetailPage from "../CollectionDetailPage";
import { collectionsService } from "../../services/collections.service";

const mockService = vi.mocked(collectionsService);

const mockDetail = {
  public_id: "col-1",
  name: "Cafés favoritos",
  emoji: "☕",
  description: "Os melhores cafés",
  place_count: 1,
  updated_at: "2026-01-01T00:00:00Z",
  places: [
    {
      public_id: "place-1",
      name: "Café X",
      category: "café",
      address: "Rua das Flores, 10",
      status: "favorite" as const,
      created_at: "2026-01-01T00:00:00Z",
      updated_at: "2026-01-01T00:00:00Z",
    },
  ],
};

beforeEach(() => {
  vi.clearAllMocks();
});

test("renders collection name and places", async () => {
  mockService.get.mockResolvedValueOnce(mockDetail);

  render(
    <MemoryRouter>
      <CollectionDetailPage />
    </MemoryRouter>,
  );

  await waitFor(() => expect(screen.getByText("Cafés favoritos")).toBeInTheDocument());
  expect(screen.getByText("Café X")).toBeInTheDocument();
});

test("shows empty places state", async () => {
  mockService.get.mockResolvedValueOnce({ ...mockDetail, places: [] });

  render(
    <MemoryRouter>
      <CollectionDetailPage />
    </MemoryRouter>,
  );

  await waitFor(() =>
    expect(screen.getByText(/no places in this collection/i)).toBeInTheDocument(),
  );
});
