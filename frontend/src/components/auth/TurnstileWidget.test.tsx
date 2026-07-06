import { render } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import { TurnstileWidget } from "./TurnstileWidget";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

test("renders the widget after the turnstile script loads", () => {
  vi.stubEnv("VITE_TURNSTILE_SITE_KEY", "site-key");

  const renderWidget = vi.fn(() => "widget-id");

  vi.stubGlobal("turnstile", {
    render: renderWidget,
    reset: vi.fn(),
    remove: vi.fn(),
  });

  render(<TurnstileWidget onToken={vi.fn()} />);

  expect(renderWidget).toHaveBeenCalled();
});
