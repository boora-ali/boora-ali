import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi } from "vitest";
import { VisitForm } from "./VisitForm";
import { visitItemsService } from "../../services/visit-items.service";

vi.mock("../../services/visit-items.service");

test("deletes an existing consumable through the API when removing it", async () => {
  (visitItemsService.remove as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);

  render(
    <VisitForm
      initialItems={[
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
      ]}
      onSubmit={vi.fn()}
    />
  );

  screen.getByLabelText("Remover").click();

  await waitFor(() => {
    expect(visitItemsService.remove).toHaveBeenCalledWith("item-1");
  });
  await waitFor(() => {
    expect(screen.queryByText("Espresso")).not.toBeInTheDocument();
  });
});

test("renders translated visit item labels instead of raw i18n keys", async () => {
  const user = userEvent.setup();

  render(<VisitForm onSubmit={vi.fn()} />);

  expect(screen.getByText("General notes")).toBeInTheDocument();
  expect(screen.getByText("Food and drinks consumed")).toBeInTheDocument();
  expect(screen.queryByText("visitForm.notes")).not.toBeInTheDocument();
  expect(screen.queryByText("visitForm.items")).not.toBeInTheDocument();

  await user.click(screen.getByRole("button", { name: /add item/i }));

  expect(screen.getAllByText("Add item").length).toBeGreaterThanOrEqual(1);
  expect(screen.getByRole("combobox")).toHaveTextContent("Other");
  expect(screen.getAllByText("Photo").length).toBeGreaterThanOrEqual(2);
  expect(screen.queryByText("visitItemType.other")).not.toBeInTheDocument();
  expect(screen.queryByText("visitItemForm.photo")).not.toBeInTheDocument();
});

test("shows a local preview for an item photo saved in the modal before submitting the visit", async () => {
  const file = new File(["fake-image"], "drink.jpg", { type: "image/jpeg" });
  const objectUrlSpy = vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:visit-item-photo");

  render(
    <VisitForm
      initialItems={[
        {
          public_id: "draft-item",
          visit: 1,
          name: "Suco de tapereba",
          type: "other",
          rating: 7,
          price: "10",
          notes: "muito bom",
          would_order_again: true,
          created_at: "",
          updated_at: "",
          photo: file,
        },
      ]}
      onSubmit={vi.fn()}
    />
  );

  await waitFor(() => {
    expect(screen.getByAltText("Suco de tapereba")).toHaveAttribute("src", "blob:visit-item-photo");
  });

  objectUrlSpy.mockRestore();
});
