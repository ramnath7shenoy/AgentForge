import { create } from "zustand";

type Theme = "light" | "dark";

interface ThemeState {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
}

const getInitialTheme = (): Theme => {
  if (typeof window === "undefined") return "light";
  const stored = window.localStorage.getItem("agentforge-theme");
  if (stored === "light" || stored === "dark") return stored;
  return "light";
};

export const useThemeStore = create<ThemeState>((set, get) => ({
  theme: typeof window === "undefined" ? "light" : getInitialTheme(),
  setTheme: (theme) => {
    set({ theme });
    if (typeof window !== "undefined") {
      window.localStorage.setItem("agentforge-theme", theme);
      document.documentElement.dataset.theme = theme;
    }
  },
  toggleTheme: () => {
    const next: Theme = get().theme === "light" ? "dark" : "light";
    get().setTheme(next);
  },
}));

