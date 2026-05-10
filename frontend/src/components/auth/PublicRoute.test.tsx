import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { PublicRoute } from "./PublicRoute";
import { ACCESS_KEY } from "../../utils/constants";

test("redirects authenticated user to /places", () => {
  localStorage.setItem(ACCESS_KEY, "fake-token");
  render(
    <MemoryRouter initialEntries={["/login"]}>
      <Routes>
        <Route path="/places" element={<div>PLACES PAGE</div>} />
        <Route
          path="/login"
          element={
            <PublicRoute>
              <div>LOGIN FORM</div>
            </PublicRoute>
          }
        />
      </Routes>
    </MemoryRouter>
  );
  expect(screen.getByText("PLACES PAGE")).toBeInTheDocument();
  localStorage.removeItem(ACCESS_KEY);
});