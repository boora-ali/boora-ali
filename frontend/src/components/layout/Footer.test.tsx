import { vi } from "vitest";

vi.mock("../ui/DarkModeToggle", () => ({ DarkModeToggle: () => <div /> }));
vi.mock("../ui/BotpressChatToggle", () => ({ BotpressChatToggle: () => <div /> }));

import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { Footer } from "./Footer";

test("mostra o botão de feedback no footer compartilhado", () => {
  render(
    <MemoryRouter>
      <Footer />
    </MemoryRouter>,
  );

  expect(screen.getByRole("button", { name: /suggestions \/ report bug/i })).toBeInTheDocument();
});
