import { vi } from "vitest";

vi.mock("../../services/collections.service");

import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, expect, test } from "vitest";
import { MemoryRouter } from "react-router-dom";
import CollectionListPage from "../CollectionListPage";
import { collectionsService } from "../../services/collections.service";

const mockService = vi.mocked(collectionsService);

const mockCollections = [
  {
    public_id: "col-1",
    name: "Cafés favoritos",
    emoji: "☕",
    description: "Os melhores cafés",
    place_count: 3,
    updated_at: "2026-01-01T00:00:00Z",
  },
];

beforeEach(() => {
  vi.clearAllMocks();
});

test("shows loading then renders collections", async () => {
  mockService.list.mockResolvedValueOnce(mockCollections);

  render(
    <MemoryRouter>
      <CollectionListPage />
    </MemoryRouter>,
  );

  await waitFor(() => expect(screen.getByText("Cafés favoritos")).toBeInTheDocument());
  expect(screen.getByText("☕")).toBeInTheDocument();
});

test("shows empty state when no collections", async () => {
  mockService.list.mockResolvedValueOnce([]);

  render(
    <MemoryRouter>
      <CollectionListPage />
    </MemoryRouter>,
  );

  await waitFor(() => expect(screen.getByText(/no collections yet/i)).toBeInTheDocument());
});
