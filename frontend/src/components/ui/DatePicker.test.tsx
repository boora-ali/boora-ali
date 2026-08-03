import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, test, vi } from "vitest";
import { DatePicker } from "./DatePicker";

test("clears a selected date", async () => {
  const onChange = vi.fn();
  const user = userEvent.setup();

  render(<DatePicker aria-label="Visit date" value="2026-08-03" onChange={onChange} />);

  await user.click(screen.getByRole("button", { name: "Visit date" }));
  await user.click(screen.getByRole("button", { name: /clear date/i }));

  expect(onChange).toHaveBeenCalledWith("");
});
