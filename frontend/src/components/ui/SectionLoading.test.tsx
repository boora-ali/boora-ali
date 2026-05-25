import { render, screen } from "@testing-library/react";
import { SectionLoading } from "./SectionLoading";

test("renders a loading label with spinner", () => {
  render(<SectionLoading message="Carregando..." />);

  expect(screen.getByText("Carregando...")).toBeInTheDocument();
  expect(document.querySelector(".animate-spin")).toBeInTheDocument();
});
