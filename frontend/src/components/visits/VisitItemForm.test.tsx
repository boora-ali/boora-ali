import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, vi } from "vitest";
import { VisitItemForm, VISIT_ITEM_FORM_ID } from "./VisitItemForm";

beforeEach(() => {
  vi.clearAllMocks();
});

function Wrapper({
  defaultValues = {},
  onSave = vi.fn(),
}: {
  defaultValues?: Record<string, unknown>;
  onSave?: ReturnType<typeof vi.fn>;
}) {
  return (
    <>
      <VisitItemForm defaultValues={defaultValues} onSave={onSave} />
      <button type="submit" form={VISIT_ITEM_FORM_ID}>
        Salvar
      </button>
    </>
  );
}

test("submit with valid name calls onSave with correct data", async () => {
  const onSave = vi.fn();
  render(<Wrapper onSave={onSave} />);

  fireEvent.change(screen.getByLabelText(/item name/i), {
    target: { value: "Café com leite" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Salvar" }));

  await waitFor(() =>
    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({ name: "Café com leite" }),
    ),
  );
});

test("submit with empty name shows validation error", async () => {
  render(<Wrapper />);

  fireEvent.click(screen.getByRole("button", { name: "Salvar" }));

  await waitFor(() =>
    expect(screen.getByText("Name is required")).toBeInTheDocument(),
  );
});

test("price field included as string in onSave payload", async () => {
  const onSave = vi.fn();
  render(<Wrapper onSave={onSave} />);

  fireEvent.change(screen.getByLabelText(/item name/i), {
    target: { value: "Espresso" },
  });
  fireEvent.change(screen.getByRole("spinbutton"), {
    target: { value: "12.5" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Salvar" }));

  await waitFor(() =>
    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({ name: "Espresso", price: "12.5" }),
    ),
  );
});

test("empty price is sent as null in onSave payload", async () => {
  const onSave = vi.fn();
  render(<Wrapper onSave={onSave} />);

  fireEvent.change(screen.getByLabelText(/item name/i), {
    target: { value: "Água" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Salvar" }));

  await waitFor(() =>
    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({ name: "Água", price: null }),
    ),
  );
});

test("notes field included in onSave payload", async () => {
  const onSave = vi.fn();
  render(<Wrapper onSave={onSave} />);

  fireEvent.change(screen.getByLabelText(/item name/i), {
    target: { value: "Drip" },
  });
  fireEvent.change(screen.getByPlaceholderText(/details/i), {
    target: { value: "extra shot" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Salvar" }));

  await waitFor(() =>
    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({ notes: "extra shot" }),
    ),
  );
});

test("defaultValues populate name and price fields", () => {
  render(
    <Wrapper
      defaultValues={{ name: "Espresso", price: 8.0, type: "coffee", rating: 9, would_order_again: true }}
    />,
  );

  expect(screen.getByLabelText(/item name/i)).toHaveValue("Espresso");
  expect(screen.getByRole("spinbutton")).toHaveValue(8);
});

test("form resets when remounted with new key", () => {
  const { rerender } = render(
    <Wrapper key="a" defaultValues={{ name: "Espresso", type: "coffee", rating: 9, price: 5, would_order_again: true }} />,
  );
  expect(screen.getByLabelText(/item name/i)).toHaveValue("Espresso");

  rerender(
    <Wrapper key="b" defaultValues={{}} />,
  );
  expect(screen.getByLabelText(/item name/i)).toHaveValue("");
});
