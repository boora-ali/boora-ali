import { render } from "@testing-library/react";
import { LoadingSpinner } from "./LoadingSpinner";

test("renders a spinning icon", () => {
  const { container } = render(<LoadingSpinner className="h-4 w-4" />);

  expect(container.querySelector(".animate-spin")).toBeInTheDocument();
});
