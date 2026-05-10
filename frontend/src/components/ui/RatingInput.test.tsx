import { render, screen, fireEvent } from "@testing-library/react";
import { useState } from "react";
import { RatingInput } from "./RatingInput";

function Wrapper() {
  const [v, setV] = useState(5);
  return <RatingInput label="Rating" value={v} onChange={setV} />;
}

test("rejects values below 0 or above 10", () => {
  render(<Wrapper />);
  const input = screen.getByLabelText("Rating") as HTMLInputElement;

  fireEvent.change(input, { target: { value: "11" } });
  expect(input.value).toBe("5");

  fireEvent.change(input, { target: { value: "-1" } });
  expect(input.value).toBe("5");

  fireEvent.change(input, { target: { value: "7" } });
  expect(input.value).toBe("7");
});
