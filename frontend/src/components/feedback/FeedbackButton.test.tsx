import { fireEvent, render, screen } from "@testing-library/react";
import { FeedbackButton } from "./FeedbackButton";

test("abre o modal de feedback ao clicar no botão", () => {
  render(<FeedbackButton />);

  fireEvent.click(screen.getByRole("button", { name: /suggestions \/ report bug/i }));

  expect(screen.getByRole("dialog")).toBeInTheDocument();
  expect(screen.getByRole("heading", { name: /send a suggestion or report a bug/i })).toBeInTheDocument();
});
