import { describe, expect, test } from "vitest";

import tailwindConfig from "../tailwind.config.js";

describe("tailwind content paths", () => {
  test("scans shadcn components kept outside src", () => {
    expect(tailwindConfig.content).toContain("./@/**/*.{ts,tsx}");
  });
});
