import { describe, expect, test } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";

describe("tailwind content paths", () => {
  test("scans shadcn components kept outside src via @source directive", () => {
    const css = readFileSync(resolve(__dirname, "index.css"), "utf-8");
    expect(css).toContain('@source "../@"');
  });
});
