import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, expect, vi } from "vitest";
import { toast } from "sonner";
import { VisitForm } from "./VisitForm";
import { visitItemsService } from "../../services/visit-items.service";

vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));
vi.mock("../../services/visit-items.service");

beforeEach(() => {
  vi.clearAllMocks();
});

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

  screen.getByLabelText("Remove").click();

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

  expect(screen.getByText("Notes")).toBeInTheDocument();
  expect(screen.getByText("What did you log?")).toBeInTheDocument();
  expect(screen.queryByText("visitForm.notes")).not.toBeInTheDocument();
  expect(screen.queryByText("visitForm.items")).not.toBeInTheDocument();

  await user.click(screen.getByRole("button", { name: /add item/i }));

  expect(screen.getAllByText("Add item").length).toBeGreaterThanOrEqual(1);
  expect(screen.getByRole("combobox")).toHaveTextContent("Other");
  expect(screen.getAllByText("Photo").length).toBeGreaterThanOrEqual(1);
  expect(screen.queryByText("visitItemType.other")).not.toBeInTheDocument();
  expect(screen.queryByText("visitItemForm.photo")).not.toBeInTheDocument();
});

test("submit calls onSubmit with default rating values", async () => {
  const onSubmit = vi.fn().mockResolvedValue(undefined);
  render(<VisitForm onSubmit={onSubmit} />);

  fireEvent.submit(
    screen.getByRole("button", { name: /save visit/i }).closest("form")!,
  );

  await waitFor(() =>
    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        overall_rating: 7,
        environment_rating: 7,
        service_rating: 7,
        would_return: true,
      }),
      [],
    ),
  );
});

test("shows root error message when onSubmit rejects", async () => {
  const onSubmit = vi.fn().mockRejectedValueOnce(new Error("Server error"));
  render(<VisitForm onSubmit={onSubmit} />);

  fireEvent.submit(
    screen.getByRole("button", { name: /save visit/i }).closest("form")!,
  );

  await waitFor(() =>
    expect(toast.error).toHaveBeenCalledWith("Failed to save visit"),
  );
});

test("clicking Add item button opens the modal", async () => {
  render(<VisitForm onSubmit={vi.fn()} />);

  fireEvent.click(screen.getByRole("button", { name: /add item/i }));

  expect(await screen.findByRole("dialog")).toBeInTheDocument();
});

test("removes draft item from list without calling visitItemsService", async () => {
  render(
    <VisitForm
      initialItems={[
        { name: "Draft drink", type: "drink", rating: 5, price: "5", would_order_again: false },
      ]}
      onSubmit={vi.fn()}
    />,
  );

  expect(screen.getByText("Draft drink")).toBeInTheDocument();
  fireEvent.click(screen.getByLabelText("Remove"));

  await waitFor(() =>
    expect(screen.queryByText("Draft drink")).not.toBeInTheDocument(),
  );
  expect(visitItemsService.remove).not.toHaveBeenCalled();
});

test("visit photo upload sets preview via URL.createObjectURL", async () => {
  const file = new File(["img"], "visit.jpg", { type: "image/jpeg" });
  const createObjectURL = vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:preview");

  render(<VisitForm onSubmit={vi.fn()} />);

  const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
  fireEvent.change(fileInput, { target: { files: [file] } });

  await waitFor(() => expect(createObjectURL).toHaveBeenCalledWith(file));

  createObjectURL.mockRestore();
});

test("submits xss-like general notes as plain strings", async () => {
  const onSubmit = vi.fn().mockResolvedValue(undefined);
  render(<VisitForm onSubmit={onSubmit} />);

  fireEvent.change(screen.getByPlaceholderText(/how was it\? what stood out\?/i), {
    target: { value: `<img src=x onerror=alert(1)>` },
  });
  fireEvent.submit(
    screen.getByRole("button", { name: /save visit/i }).closest("form")!,
  );

  await waitFor(() =>
    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        general_notes: `<img src=x onerror=alert(1)>`,
      }),
      [],
    ),
  );
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
