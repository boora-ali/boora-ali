import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { HelmetProvider } from "react-helmet-async";
import RegisterPage from "./RegisterPage";

test("renders all registration fields", () => {
  const { container } = render(
    <HelmetProvider>
      <MemoryRouter>
        <RegisterPage />
      </MemoryRouter>
    </HelmetProvider>
  );
  expect(screen.getByLabelText(/username/i)).toBeInTheDocument();
  expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
  expect(screen.getByLabelText(/^password$/i)).toBeInTheDocument();
  expect(screen.getByLabelText(/confirm password/i)).toBeInTheDocument();
  expect(container.querySelector('input[name="website"]')).toBeInTheDocument();
});
