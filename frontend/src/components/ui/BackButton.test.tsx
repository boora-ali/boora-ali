import { fireEvent, render, screen } from "@testing-library/react";
import { vi } from "vitest";
import { MemoryRouter } from "react-router";

import { BackButton } from "./BackButton";

test("shows back and home actions", () => {
  render(
    <MemoryRouter>
      <BackButton />
    </MemoryRouter>,
  );

  expect(screen.getByRole("button", { name: /back/i })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: /home/i })).toBeInTheDocument();
});

test("checks whether navigation is allowed before going back", () => {
  const onBeforeNavigate = vi.fn(() => false);
  render(
    <MemoryRouter>
      <BackButton onBeforeNavigate={onBeforeNavigate} />
    </MemoryRouter>,
  );

  fireEvent.click(screen.getByRole("button", { name: /back/i }));

  expect(onBeforeNavigate).toHaveBeenCalledOnce();
});
