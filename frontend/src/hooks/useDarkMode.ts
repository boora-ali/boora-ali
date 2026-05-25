import { useEffect, useState } from "react";

export function getInitialDarkMode() {
  const stored = localStorage.getItem("theme");
  if (stored) return stored === "dark";
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

export function applyDarkMode(dark: boolean) {
  document.documentElement.classList.toggle("dark", dark);
  localStorage.setItem("theme", dark ? "dark" : "light");
  const themeColor = dark ? "#0D1117" : "#F4F7FB";
  const metaThemeColor = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
  if (metaThemeColor) {
    metaThemeColor.content = themeColor;
  }
}

export function useDarkMode() {
  const [dark, setDark] = useState(getInitialDarkMode);

  useEffect(() => {
    applyDarkMode(dark);
  }, [dark]);

  return { dark, toggle: () => setDark((d) => !d) };
}
