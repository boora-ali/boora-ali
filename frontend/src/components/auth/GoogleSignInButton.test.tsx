import { render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import { GoogleSignInButton } from "./GoogleSignInButton";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

test("forwards the GIS credential to the success callback", async () => {
  const onSuccess = vi.fn();
  let capturedCallback: ((response: { credential?: string }) => void) | null = null;
  const initialize = vi.fn((options: { callback: (response: { credential?: string }) => void }) => {
    capturedCallback = options.callback;
  });
  const renderButton = vi.fn();

  vi.stubGlobal("google", {
    accounts: {
      id: {
        initialize,
        renderButton,
      },
    },
  });
  vi.stubEnv("VITE_GOOGLE_OAUTH_CLIENT_ID", "google-client-id");

  render(<GoogleSignInButton onSuccess={onSuccess} />);

  expect(initialize).toHaveBeenCalled();
  expect(renderButton).toHaveBeenCalledWith(
    expect.any(HTMLElement),
    expect.objectContaining({
      theme: "filled_blue",
      size: "large",
      shape: "pill",
      text: "continue_with",
      logo_alignment: "left",
      width: 320,
    })
  );

  capturedCallback?.({ credential: "google-id-token" });

  await waitFor(() => expect(onSuccess).toHaveBeenCalledWith("google-id-token"));
});

test("renders nothing when the Google client id is missing", () => {
  const onSuccess = vi.fn();

  render(<GoogleSignInButton onSuccess={onSuccess} />);

  expect(screen.queryByText(/entrar com google/i)).not.toBeInTheDocument();
});
