import { render, screen } from "@testing-library/react";
import { Button } from "./button";

test("uses the shared theme shadow instead of a white dark-mode shadow", () => {
  render(<Button>Salvar</Button>);

  const button = screen.getByRole("button", { name: "Salvar" });
  expect(button).toHaveClass("shadow-[4px_4px_0_var(--color-shadow)]");
  expect(button).not.toHaveClass("dark:shadow-[4px_4px_0_#fff]");
});
