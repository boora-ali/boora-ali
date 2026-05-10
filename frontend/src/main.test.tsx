import { beforeEach, expect, test, vi } from "vitest";

const render = vi.fn();

vi.mock("react-dom/client", () => ({
  createRoot: vi.fn(() => ({ render })),
}));

vi.mock("./App.tsx", () => ({
  default: () => null,
}));

beforeEach(() => {
  vi.resetModules();
  render.mockReset();
  document.documentElement.classList.remove("dark");
  document.body.innerHTML = '<div id="root"></div>';
  localStorage.clear();
});

test("applies persisted dark theme during app bootstrap", async () => {
  localStorage.setItem("theme", "dark");

  await import("./main.tsx");

  expect(document.documentElement.classList.contains("dark")).toBe(true);
});
