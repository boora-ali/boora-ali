import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi } from "vitest";
import { PwaInstallButton } from "./PwaInstallButton";
import { usePwaInstall } from "../../hooks/usePwaInstall";

vi.mock("../../hooks/usePwaInstall");

test("triggers the native install prompt when the browser supports it", async () => {
  const user = userEvent.setup();
  const install = vi.fn().mockResolvedValue(true);

  (usePwaInstall as ReturnType<typeof vi.fn>).mockReturnValue({
    canInstall: true,
    isIos: false,
    isStandalone: false,
    install,
  });

  render(<PwaInstallButton />);

  await user.click(screen.getByRole("button", { name: /install bora ali on this device/i }));

  expect(install).toHaveBeenCalledTimes(1);
});

test("opens install instructions on iOS", async () => {
  const user = userEvent.setup();

  (usePwaInstall as ReturnType<typeof vi.fn>).mockReturnValue({
    canInstall: true,
    isIos: true,
    isStandalone: false,
    install: vi.fn(),
  });

  render(<PwaInstallButton />);

  await user.click(screen.getByRole("button", { name: /see how to install bora ali on iphone or ipad/i }));

  expect(screen.getByRole("heading", { name: /install on iphone or ipad/i })).toBeInTheDocument();
  expect(screen.getByText(/choose 'add to home screen' and confirm/i)).toBeInTheDocument();
  expect(screen.getByText(/edit actions/i)).toBeInTheDocument();
  expect(screen.getByText(/open this site in safari first/i)).toBeInTheDocument();
});
