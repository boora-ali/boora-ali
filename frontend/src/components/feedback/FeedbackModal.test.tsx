import { vi } from "vitest";

vi.mock("../../services/feedback.service", () => ({
  submitFeedback: vi.fn(),
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import userEvent from "@testing-library/user-event";
import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, expect, test } from "vitest";
import { toast } from "sonner";
import { submitFeedback } from "../../services/feedback.service";
import { FeedbackModal } from "./FeedbackModal";

const mockedSubmitFeedback = vi.mocked(submitFeedback);
const mockedToast = vi.mocked(toast);

function renderModal() {
  const onOpenChange = vi.fn();
  return {
    onOpenChange,
    user: userEvent.setup(),
    ...render(<FeedbackModal open onOpenChange={onOpenChange} />),
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

test("envia sugestão com a URL atual", async () => {
  mockedSubmitFeedback.mockResolvedValueOnce({
    kind: "suggestion",
    message: "Add a bug report link",
    page_url: window.location.href,
  });

  const { user, onOpenChange } = renderModal();

  await user.type(screen.getByLabelText(/message/i), "Add a bug report link");
  await user.click(screen.getByRole("button", { name: /send/i }));

  await waitFor(() =>
    expect(mockedSubmitFeedback).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: "suggestion",
        message: "Add a bug report link",
        page_url: window.location.href,
      }),
    ),
  );
  expect(mockedToast.success).toHaveBeenCalledWith("Feedback sent. Thanks.");
  expect(onOpenChange).toHaveBeenCalledWith(false);
});

test("permite enviar bug e mostra erro inline quando a request falha", async () => {
  mockedSubmitFeedback.mockRejectedValueOnce(new Error("boom"));

  const { user } = renderModal();

  await user.click(screen.getByRole("combobox"));
  await user.click(screen.getByRole("option", { name: /bug/i }));
  await user.type(screen.getByLabelText(/message/i), "Map is broken");
  await user.click(screen.getByRole("button", { name: /send/i }));

  await waitFor(() =>
    expect(screen.getByText(/could not send it right now/i)).toBeInTheDocument(),
  );
  expect(mockedToast.error).toHaveBeenCalled();
});
