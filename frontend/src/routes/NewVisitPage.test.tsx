import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router";
import { vi } from "vitest";
import NewVisitPage from "./NewVisitPage";
import { visitsService } from "../services/visits.service";
import { visitItemsService } from "../services/visit-items.service";

vi.mock("../services/visits.service");
vi.mock("../services/visit-items.service");
vi.mock("../components/visits/VisitForm", () => ({
  VisitForm: ({ onSubmit }: { onSubmit: (visit: object, items: object[]) => Promise<void> }) => (
    <button type="button" onClick={() => void onSubmit({}, [{ name: "Coffee" }]).catch(() => {})}>
      save visit
    </button>
  ),
}));

test("rolls back a new visit when an item cannot be created", async () => {
  (visitsService.create as ReturnType<typeof vi.fn>).mockResolvedValue({ public_id: "visit-1" });
  (visitItemsService.create as ReturnType<typeof vi.fn>).mockRejectedValue(new Error("network"));
  (visitsService.remove as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);

  render(
    <MemoryRouter initialEntries={["/places/place-1/visits/new"]}>
      <Routes><Route path="/places/:id/visits/new" element={<NewVisitPage />} /></Routes>
    </MemoryRouter>,
  );

  fireEvent.click(screen.getByRole("button", { name: "save visit" }));

  await waitFor(() => expect(visitsService.remove).toHaveBeenCalledWith("visit-1"));
});
