"use client";

import { useEffect } from "react";

const STORAGE_KEY = "lyra-theme";

/**
 * Restores the saved theme from localStorage before React hydrates.
 * Runs once on mount so the saved theme applies across all pages and survives refresh.
 */
export function ThemeInitializer() {
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved === "light" || saved === "system" || saved === "dark") {
        document.documentElement.dataset.theme = saved;
      }
    } catch {
      // ignore
    }
  }, []);

  return null;
}
