import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useDebounce } from "./useDebounce";

describe("useDebounce", () => {
  it("returns the initial value immediately", () => {
    const { result } = renderHook(() => useDebounce("hello", 400));
    expect(result.current).toBe("hello");
  });

  it("does not update before the delay elapses", () => {
    vi.useFakeTimers();
    const { result, rerender } = renderHook(({ value }) => useDebounce(value, 400), {
      initialProps: { value: "a" },
    });

    rerender({ value: "ab" });
    act(() => { vi.advanceTimersByTime(200); });
    expect(result.current).toBe("a");

    vi.useRealTimers();
  });

  it("updates after the delay elapses", () => {
    vi.useFakeTimers();
    const { result, rerender } = renderHook(({ value }) => useDebounce(value, 400), {
      initialProps: { value: "a" },
    });

    rerender({ value: "ab" });
    act(() => { vi.advanceTimersByTime(400); });
    expect(result.current).toBe("ab");

    vi.useRealTimers();
  });

  it("resets the timer when the value changes rapidly", () => {
    vi.useFakeTimers();
    const { result, rerender } = renderHook(({ value }) => useDebounce(value, 400), {
      initialProps: { value: "a" },
    });

    rerender({ value: "ab" });
    act(() => { vi.advanceTimersByTime(200); });
    rerender({ value: "abc" });
    act(() => { vi.advanceTimersByTime(200); });
    expect(result.current).toBe("a");

    act(() => { vi.advanceTimersByTime(200); });
    expect(result.current).toBe("abc");

    vi.useRealTimers();
  });
});
