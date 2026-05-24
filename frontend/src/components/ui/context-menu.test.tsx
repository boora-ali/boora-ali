import { fireEvent, render, screen } from "@testing-library/react";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from "./context-menu";

test("uses Tailwind 4 compatible Radix CSS variable utilities", async () => {
  render(
    <ContextMenu>
      <ContextMenuTrigger>Open actions</ContextMenuTrigger>
      <ContextMenuContent>
        <ContextMenuItem>Open</ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>,
  );

  fireEvent.contextMenu(screen.getByText("Open actions"));

  const menu = await screen.findByRole("menu");
  expect(menu).toHaveClass("max-h-[var(--radix-context-menu-content-available-height)]");
  expect(menu).toHaveClass("origin-[var(--radix-context-menu-content-transform-origin)]");
});
