import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { ProtectedRoute } from "./ProtectedRoute";
import { ACCESS_KEY } from "../../utils/constants";
import { AUTH_STATE_CHANGED_EVENT } from "../../utils/client-state";

test("redirects unauthenticated user to /login", () => {
  localStorage.removeItem(ACCESS_KEY);
  render(
    <MemoryRouter initialEntries={["/private"]}>
      <Routes>
        <Route path="/login" element={<div>LOGIN PAGE</div>} />
        <Route
          path="/private"
          element={
            <ProtectedRoute>
              <div>SECRET</div>
            </ProtectedRoute>
          }
        />
      </Routes>
    </MemoryRouter>
  );
  expect(screen.getByText("LOGIN PAGE")).toBeInTheDocument();
});

test("redirects when auth state changes and the token disappears", async () => {
  localStorage.setItem(ACCESS_KEY, "fake-token");
  render(
    <MemoryRouter initialEntries={["/private"]}>
      <Routes>
        <Route path="/login" element={<div>LOGIN PAGE</div>} />
        <Route
          path="/private"
          element={
            <ProtectedRoute>
              <div>SECRET</div>
            </ProtectedRoute>
          }
        />
      </Routes>
    </MemoryRouter>
  );

  expect(screen.getByText("SECRET")).toBeInTheDocument();
  localStorage.removeItem(ACCESS_KEY);
  window.dispatchEvent(new Event(AUTH_STATE_CHANGED_EVENT));
  await waitFor(() => expect(screen.getByText("LOGIN PAGE")).toBeInTheDocument());
});
