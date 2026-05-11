import { render, screen } from "@testing-library/react";
import { useState } from "react";
import { RatingInput } from "./RatingInput";

function Wrapper() {
  const [v, setV] = useState(5);
  return <RatingInput label="Rating" value={v} onChange={setV} />;
}

test("renders a 0 to 10 slider with the current rating", () => {
  render(<Wrapper />);
  const slider = screen.getByRole("slider", { name: "Rating" });

  expect(slider).toHaveAttribute("aria-valuemin", "0");
  expect(slider).toHaveAttribute("aria-valuemax", "10");
  expect(slider).toHaveAttribute("aria-valuenow", "5");
  expect(screen.getByText("5/10")).toBeInTheDocument();
});
