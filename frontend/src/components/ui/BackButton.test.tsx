import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

import { BackButton } from "./BackButton";

test("shows back and home actions", () => {
  render(
    <MemoryRouter>
      <BackButton />
    </MemoryRouter>,
  );

  expect(screen.getByRole("button", { name: /back/i })).toBeInTheDocument();
  expect(screen.getByRole("link", { name: /home/i })).toHaveAttribute(
    "href",
    "/places",
  );
});
