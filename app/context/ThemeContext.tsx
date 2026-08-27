"use client";

import { createContext, useContext, useEffect, useState } from "react";

export type AppTheme = "default" | "doodle" | "minimalist" | "plain";

const themeOptions: AppTheme[] = ["default", "doodle", "minimalist", "plain"];

const ThemeContext = createContext<{
  theme: AppTheme;
  setTheme: (theme: AppTheme) => void;
}>({
  theme: "default",
  setTheme: () => {},
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<AppTheme>("default");

  useEffect(() => {
    try {
      const storedTheme = localStorage.getItem("app-theme");
      const legacyTheme = localStorage.getItem("theme");
      const initialTheme = themeOptions.includes(storedTheme as AppTheme)
        ? (storedTheme as AppTheme)
        : legacyTheme === "light"
          ? "plain"
          : "default";
      setThemeState(initialTheme);
      document.documentElement.setAttribute("data-theme", initialTheme);
    } catch {}
  }, []);

  const setTheme = (nextTheme: AppTheme) => {
    setThemeState(nextTheme);
    document.documentElement.setAttribute("data-theme", nextTheme);
    try {
      localStorage.setItem("app-theme", nextTheme);
    } catch {}
  };

  return <ThemeContext.Provider value={{ theme, setTheme }}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  return useContext(ThemeContext);
}
