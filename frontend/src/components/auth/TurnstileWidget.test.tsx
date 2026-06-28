import { render, waitFor } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import { TurnstileWidget } from "./TurnstileWidget";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

test("waits for turnstile.ready before rendering the widget", async () => {
  vi.stubEnv("VITE_TURNSTILE_SITE_KEY", "site-key");

  let readyCallback: (() => void) | null = null;
  const renderWidget = vi.fn(() => "widget-id");
  const ready = vi.fn((callback: () => void) => {
    readyCallback = callback;
  });

  vi.stubGlobal("turnstile", {
    ready,
    render: renderWidget,
    reset: vi.fn(),
    remove: vi.fn(),
  });

  render(<TurnstileWidget onToken={vi.fn()} />);

  expect(ready).toHaveBeenCalled();
  expect(renderWidget).not.toHaveBeenCalled();

  readyCallback?.();

  await waitFor(() => expect(renderWidget).toHaveBeenCalled());
});
